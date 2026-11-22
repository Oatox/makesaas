-- =========================================================================================
-- MAKESAAS — SUPABASE SETUP
-- Run once in the Supabase SQL Editor of a new project. Safe to re-run: tables are created
-- if missing, functions replaced, policies dropped then recreated, seeds never overwrite edits.
-- =========================================================================================

-- 1. PROFILES
-- One row per auth user, created by the signup trigger (section 4).
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE,
    full_name TEXT,
    avatar_url TEXT,
    -- First-touch acquisition data (UTM, ref, referrer), written once at signup.
    signup_source JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'))
);

-- 2. SAAS
-- The SaaS a user builds. Each one belongs to a single owner (no members). The user switches
-- between them from the sidebar; profiles.current_saas_id remembers the active one. A first SaaS
-- is created at signup (section 4); creating more needs a subscription (section 8).
CREATE TABLE IF NOT EXISTS public.saas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Icon key from SAAS_ICONS (shared/saas.ts); unknown keys fall back to the default icon.
    icon TEXT NOT NULL DEFAULT 'rocket',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT saas_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT saas_icon_check CHECK (icon ~ '^[a-z0-9-]{1,32}$')
);

CREATE INDEX IF NOT EXISTS saas_owner_created_idx ON public.saas (owner_id, created_at);

-- Active SaaS of each user (NULL: the client falls back to their oldest one).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS current_saas_id UUID REFERENCES public.saas(id) ON DELETE SET NULL;

-- Covers the ON DELETE SET NULL run when a SaaS is deleted.
CREATE INDEX IF NOT EXISTS profiles_current_saas_id_idx ON public.profiles (current_saas_id);

-- 3. PROFILES: ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helpers used by RLS policies live in a schema the Data API does not expose, so they cannot be
-- called as /rest/v1/rpc endpoints.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Helper used by admin policies. SECURITY DEFINER avoids recursive RLS checks.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, auth
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- Defense in depth: browser-authenticated sessions must not change privilege or acquisition
-- fields, even if a broad UPDATE grant is added later.
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_field_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    new_profile JSONB;
    old_profile JSONB;
    protected_column TEXT;
    protected_columns CONSTANT TEXT[] := ARRAY['role', 'signup_source'];
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    new_profile := to_jsonb(NEW);
    old_profile := to_jsonb(OLD);

    FOREACH protected_column IN ARRAY protected_columns LOOP
        IF new_profile -> protected_column IS DISTINCT FROM old_profile -> protected_column THEN
            RAISE EXCEPTION 'Updating protected profile field "%" is not allowed', protected_column
                USING ERRCODE = '42501';
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_sensitive_field_update ON public.profiles;
CREATE TRIGGER prevent_profile_sensitive_field_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_sensitive_field_update();

-- The active SaaS must be one the user owns (switching to someone else's is refused).
CREATE OR REPLACE FUNCTION public.check_profile_current_saas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.current_saas_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.saas WHERE id = NEW.current_saas_id AND owner_id = NEW.id) THEN
        RAISE EXCEPTION 'The current SaaS must belong to the user' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_profile_current_saas ON public.profiles;
CREATE TRIGGER check_profile_current_saas
    BEFORE UPDATE OF current_saas_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_current_saas();

-- Policy names of earlier versions of this script are dropped too.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own self-service profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles self-service fields" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile, admins read all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile, admins update all" ON public.profiles;

-- One permissive policy per action (own row OR admin): Postgres runs every permissive policy, so
-- separate user and admin policies cost twice. (SELECT ...) evaluates each helper once per query.
CREATE POLICY "Users read own profile, admins read all"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id OR (SELECT private.is_admin()));

-- Column-level grants (section 6) decide which fields can actually be updated.
CREATE POLICY "Users update own profile, admins update all"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id OR (SELECT private.is_admin()))
    WITH CHECK ((SELECT auth.uid()) = id OR (SELECT private.is_admin()));

-- 4. SIGNUP: PROFILE AND FIRST SAAS CREATED FOR EVERY NEW AUTH USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    extracted_name TEXT;
    extracted_avatar TEXT;
    first_saas_id UUID;
BEGIN
    extracted_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    extracted_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
    );

    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, signup_source)
    VALUES (
        NEW.id,
        NEW.email,
        extracted_name,
        extracted_avatar,
        'user',
        CASE
            WHEN jsonb_typeof(NEW.raw_user_meta_data->'signup_source') = 'object'
            THEN NEW.raw_user_meta_data->'signup_source'
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        signup_source = COALESCE(profiles.signup_source, EXCLUDED.signup_source),
        updated_at = NOW();

    -- First SaaS, active right away (renamed from its settings). Name mirrored by
    -- DEFAULT_SAAS_NAME in shared/saas.ts. Inserted outside RLS: no subscription needed (section 8).
    IF NOT EXISTS (SELECT 1 FROM public.saas WHERE owner_id = NEW.id) THEN
        INSERT INTO public.saas (owner_id, name) VALUES (NEW.id, 'Mon SaaS')
        RETURNING id INTO first_saas_id;

        UPDATE public.profiles SET current_saas_id = first_saas_id WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ADMIN SESSION RPCs (least privilege, no auth schema exposure; called by the server only)
CREATE OR REPLACE FUNCTION public.admin_list_user_sessions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    not_after TIMESTAMP WITH TIME ZONE,
    ip TEXT,
    user_agent TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
    SELECT s.id, s.user_id, s.created_at, s.not_after, s.ip::text, s.user_agent
    FROM auth.sessions AS s
    WHERE s.user_id = p_user_id
    ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_session(p_user_id UUID, p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.sessions
    WHERE id = p_session_id
      AND user_id = p_user_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_all_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.sessions
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 6. PROFILES: PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- REVOKE ALL also drops any column-level privilege, so only the grants below remain.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
-- Self-service fields only: role and signup_source stay server-side. current_saas_id is checked
-- by the check_profile_current_saas trigger (the user's own SaaS only).
GRANT UPDATE (full_name, avatar_url, last_active_at, current_saas_id, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_profile_current_saas() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_list_user_sessions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_user_session(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_all_user_sessions(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_user_sessions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_session(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_all_user_sessions(UUID) TO service_role;

-- 7. SUBSCRIPTIONS (Whop)
-- One row per user holding their current subscription. A single plan unlocks the whole app and
-- there is no free plan: no row, or a row whose status gives no access (canceled, expired...),
-- means no access to the app. Written by the server only (Whop webhook, admin grants); users read
-- their own row, admins read all of them.
-- provider: 'whop' (paid through Whop) or 'manual' (granted by an admin, no billing).
CREATE TABLE IF NOT EXISTS public.subscriptions (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'manual',
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
    whop_membership_id TEXT UNIQUE,
    whop_user_id TEXT,
    -- Whop billing portal of the membership (cancel, change card).
    manage_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT subscriptions_provider_check CHECK (provider IN ('whop', 'manual'))
);

-- Statuses that grant access (Whop membership statuses; past_due = grace period while Whop retries
-- the payment, canceling = cancelled at period end, still running). Mirrored in shared/billing.ts.
CREATE OR REPLACE FUNCTION public.subscription_grants_access(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
    SELECT p_status IN ('active', 'trialing', 'past_due', 'completed', 'canceling');
$$;

-- Whether the caller can use the paid app: admin, or a subscription granting access. For the RLS
-- policies of paid features, e.g. (SELECT private.has_access()). SECURITY DEFINER avoids recursive
-- RLS checks.
CREATE OR REPLACE FUNCTION private.has_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        LEFT JOIN public.subscriptions AS s ON s.user_id = p.id
        WHERE p.id = auth.uid()
          AND (p.role = 'admin' OR public.subscription_grants_access(s.status))
    );
$$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users read own subscription, admins read all" ON public.subscriptions;

CREATE POLICY "Users read own subscription, admins read all"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id OR (SELECT private.is_admin()));

REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT EXECUTE ON FUNCTION public.subscription_grants_access(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.has_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_access() TO authenticated, service_role;

-- 8. SAAS: ROW LEVEL SECURITY, PERMISSIONS
-- A user always keeps at least one SaaS. Account deletion (cascade run by Supabase) is not affected.
CREATE OR REPLACE FUNCTION public.prevent_last_saas_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN OLD;
    END IF;

    -- Serializes the deletions of one owner, so two parallel requests cannot remove the last two.
    PERFORM pg_advisory_xact_lock(hashtextextended('saas_owner:' || OLD.owner_id::text, 0));

    IF NOT EXISTS (SELECT 1 FROM public.saas WHERE owner_id = OLD.owner_id AND id <> OLD.id) THEN
        -- Message matched by the client (SAAS_LAST_ONE_ERROR in shared/saas.ts).
        RAISE EXCEPTION 'saas_last_one' USING ERRCODE = 'P0001';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_saas_delete ON public.saas;
CREATE TRIGGER prevent_last_saas_delete
    BEFORE DELETE ON public.saas
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_saas_delete();

CREATE OR REPLACE FUNCTION public.set_saas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_saas_updated_at ON public.saas;
CREATE TRIGGER set_saas_updated_at
    BEFORE UPDATE ON public.saas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_saas_updated_at();

ALTER TABLE public.saas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saas" ON public.saas;
DROP POLICY IF EXISTS "Admins can read all saas" ON public.saas;
DROP POLICY IF EXISTS "Users read own saas, admins read all" ON public.saas;
DROP POLICY IF EXISTS "Users can create own saas" ON public.saas;
DROP POLICY IF EXISTS "Subscribers can create own saas" ON public.saas;
DROP POLICY IF EXISTS "Users can update own saas" ON public.saas;
DROP POLICY IF EXISTS "Users can delete own saas" ON public.saas;

CREATE POLICY "Users read own saas, admins read all"
    ON public.saas
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id OR (SELECT private.is_admin()));

-- Creating a SaaS needs a subscription (admins excepted), with no limit on their number. The first
-- SaaS comes from the signup trigger, which RLS does not apply to.
CREATE POLICY "Subscribers can create own saas"
    ON public.saas
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT private.has_access()));

CREATE POLICY "Users can update own saas"
    ON public.saas
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id)
    WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can delete own saas"
    ON public.saas
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id);

-- The owner is always the caller (column default), never sent by the browser.
REVOKE ALL ON public.saas FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.saas TO authenticated;
GRANT INSERT (name, icon) ON public.saas TO authenticated;
GRANT UPDATE (name, icon) ON public.saas TO authenticated;
GRANT ALL ON public.saas TO service_role;

REVOKE ALL ON FUNCTION public.prevent_last_saas_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_saas_updated_at() FROM PUBLIC, anon, authenticated;

-- 9. AI PIPELINES
-- Prompt sets sent to the LLM through OneShotAPI, editable by admins from /admin/pipeline.
-- Messages are sent in this order: system → user 1 (data, must contain {{input}})
-- → user 2 (instructions) → user 3 (expected output format). OneShotAPI manages sampling
-- itself, so there is no temperature. Rows are seeded here; the app never inserts or deletes.
CREATE TABLE IF NOT EXISTS public.ai_pipelines (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    data_prompt TEXT NOT NULL,
    instructions_prompt TEXT NOT NULL,
    output_format_prompt TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT ai_pipelines_data_placeholder_check CHECK (POSITION('{{input}}' IN data_prompt) > 0),
    CONSTRAINT ai_pipelines_prompt_length_check CHECK (
        char_length(system_prompt) BETWEEN 1 AND 20000
        AND char_length(data_prompt) BETWEEN 1 AND 20000
        AND char_length(instructions_prompt) BETWEEN 1 AND 20000
        AND char_length(output_format_prompt) BETWEEN 1 AND 20000
    )
);

-- Covers the ON DELETE SET NULL run when an auth user is deleted.
CREATE INDEX IF NOT EXISTS ai_pipelines_updated_by_idx ON public.ai_pipelines (updated_by);

-- Audit fields are set by the database, never trusted from the client.
CREATE OR REPLACE FUNCTION public.set_ai_pipeline_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ai_pipeline_audit_fields ON public.ai_pipelines;
CREATE TRIGGER set_ai_pipeline_audit_fields
    BEFORE UPDATE ON public.ai_pipelines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_ai_pipeline_audit_fields();

ALTER TABLE public.ai_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ai pipelines" ON public.ai_pipelines;
DROP POLICY IF EXISTS "Admins can update ai pipelines" ON public.ai_pipelines;

CREATE POLICY "Admins can read ai pipelines"
    ON public.ai_pipelines
    FOR SELECT
    TO authenticated
    USING ((SELECT private.is_admin()));

CREATE POLICY "Admins can update ai pipelines"
    ON public.ai_pipelines
    FOR UPDATE
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

REVOKE ALL ON public.ai_pipelines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_pipelines TO authenticated;
GRANT UPDATE (model, system_prompt, data_prompt, instructions_prompt, output_format_prompt)
    ON public.ai_pipelines TO authenticated;
GRANT ALL ON public.ai_pipelines TO service_role;

-- Example pipeline (POST /api/ai/example, shape in shared/ai-pipeline.ts): summarises a text
-- into key points. ON CONFLICT DO NOTHING: re-running this script never overwrites admin edits.
INSERT INTO public.ai_pipelines (
    slug, name, model,
    system_prompt, data_prompt, instructions_prompt, output_format_prompt
)
VALUES (
    'example',
    'Exemple',
    'gemini-3.8-flash',
    $prompt$Tu es l'assistant de MakeSaaS.
Tu t'appuies uniquement sur le texte fourni : tu n'inventes aucun fait.
Tu écris en français, de façon claire, factuelle et concise.$prompt$,
    $prompt$Voici le texte envoyé par l'utilisateur :

{{input}}$prompt$,
    $prompt$Traite ce texte :
1. Résume-le en 2 phrases (50 mots maximum).
2. Dégage de 1 à 5 points clés, une phrase courte chacun, du plus important au moins important.$prompt$,
    $prompt$Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, au format exact suivant :
{
  "summary": "2 phrases, 50 mots maximum",
  "keyPoints": ["point clé", "point clé"]
}$prompt$
)
ON CONFLICT (slug) DO NOTHING;

-- 10. CLEANUP OF EARLIER VERSIONS
-- is_admin() used to live in public, where the Data API exposed it as /rest/v1/rpc/is_admin.
-- No policy uses it anymore (they were all recreated above with private.is_admin()).
DROP FUNCTION IF EXISTS public.is_admin();

-- Starter and Pro plans were merged into a single plan: no plan column, no SaaS limit per plan
-- (creating a SaaS only needs a subscription, see the saas INSERT policy).
DROP TRIGGER IF EXISTS enforce_saas_limit ON public.saas;
DROP FUNCTION IF EXISTS public.enforce_saas_limit();
DROP FUNCTION IF EXISTS public.saas_limit_for_plan(TEXT);
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS plan;

-- 11. ADMIN ACCESS
-- To make a user admin, run in the Supabase SQL Editor (replace the email):
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'email@example.com';

/*
Rollbackable RLS regression test for public.profiles.
Run manually in the Supabase SQL editor after applying this setup.

BEGIN;

INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
)
VALUES (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'rls-profile-test@example.com',
    'not-used-for-rls-test',
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"RLS Profile Test"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',
    true
);

-- A normal authenticated user can read their own profile (created by the signup trigger).
SELECT id, email, role
FROM public.profiles
WHERE id = '00000000-0000-0000-0000-000000000101';

-- A normal authenticated user can update allowed self-service fields.
UPDATE public.profiles
SET full_name = 'Allowed Self Service Update',
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000101';

-- A normal authenticated user cannot update the admin field.
DO $$
BEGIN
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = '00000000-0000-0000-0000-000000000101';

    RAISE EXCEPTION 'Expected role update to be blocked';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Role update blocked as expected';
END $$;

-- Must return false.
SELECT has_column_privilege(
    'authenticated',
    'public.profiles',
    'role',
    'UPDATE'
) AS authenticated_can_update_role;

ROLLBACK;
*/
