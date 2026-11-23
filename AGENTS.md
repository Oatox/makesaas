# AGENTS.md — MakeSaaS

This is the canonical context file for AI coding assistants in this repository (Claude Code, Cursor, Replit Agent, and similar tools).

Tool-specific context files should stay minimal and defer to this file.

## Overview

MakeSaaS is a SaaS boilerplate: everything a paid web app needs before its first feature (landing, onboarding, authentication, Whop subscriptions, admin, AI pipeline, legal pages, SEO). The product itself starts in `client/src/pages/Dashboard.tsx`. The UI copy is in French.

Everything marked `⚠️ PLACEHOLDER` in the code (testimonials, member count, FAQ, features, plan descriptions, legal identity) must be replaced before launch.

Architecture is frontend-first: the React app communicates directly with Supabase for auth and most data operations, while the Express backend stays lightweight (static assets, health checks, and server-only operations: billing, admin, AI).

## Non-negotiable constraints

1. **Supabase only** for database and authentication.
2. **No local/Replit development database usage** for app data.
3. **Drizzle ORM is for schema/types only** in this project context.
4. **RLS is enforced in Supabase** and should be part of the default design.
5. **Frontend-first CRUD** when safely possible via Supabase SDK + RLS.
6. **`SUPABASE_SECRET_KEY` (sb_secret_...) is server-only** and must never be exposed in client bundles.

## Tech stack

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Framer Motion
- Routing: `wouter`
- Async/server state: `@tanstack/react-query`
- Backend shell: Node.js + Express (run with Bun in development)
- Data/Auth provider: Supabase (`@supabase/supabase-js`)
- Payments: Whop (`@whop/sdk`, `@whop/elements-react`)
- AI: OneShotAPI (Gemini models, enforced JSON output)

## Environment variables

Set them in `.env` (development) or in the host platform (production):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (`sb_publishable_...`)
- `SUPABASE_SECRET_KEY` — Supabase secret key (`sb_secret_...`, server-only)
- `WHOP_API_KEY` — Whop account API key (server-only; without it the paywall shows "abonnements indisponibles")
- `WHOP_WEBHOOK_SECRET` — signing secret of the Whop webhook (`ws_...`, server-only)
- `WHOP_PLAN_ID` — Whop plan id (`plan_...`) of the single monthly plan
- `WHOP_ENVIRONMENT` — `sandbox` to use sandbox.whop.com, production otherwise
- `ONESHOT_API_KEY` — OneShotAPI key for the AI pipelines (server-only, optional: without it the AI routes answer 503)

## User journey

- Landing `/` → onboarding `/onboarding` (questions saved in localStorage, `client/src/components/onboarding/steps.tsx`; adding a step there is all it takes) → sign-up `/register` → paywall `/abonnement` → app `/app`.
- `ProtectedRoute` (client/src/App.tsx) sends visitors to the onboarding and signed-in users without a subscription to the paywall.

## Product data

- Product data belongs to a user: give new tables a `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE` and RLS through `user_id = (SELECT auth.uid())`; add `(SELECT private.has_access())` to the write policies of paid features.

## Subscriptions (Whop)

- A single paid plan unlocks the whole app (`PLAN` in `shared/billing.ts`: name and description); there is no free plan. Subscriptions live in their own table `subscriptions` (one row per user, `provider` `whop` or `manual`), never on `profiles`. Access = a row whose `status` grants access (`grantsAccess` in `shared/billing.ts`, mirrored by `subscription_grants_access` in SQL), or the admin role: `hasAccess` from `useAuth()` on the client, `private.has_access()` in RLS.
- `POST /api/billing/checkout` creates a Whop checkout configuration carrying `metadata.supabase_user_id`. Access is granted only by the signed webhook `POST /api/billing/whop/webhook` (`server/billing/`), which re-reads the membership from Whop and upserts the user's `subscriptions` row. A new membership never replaces one still running on Whop: a double payment is logged as an error, to refund from the Whop dashboard.
- `requireSubscriber` (server/lib/auth.ts) guards paid API routes.

## AI pipelines

- Prompts (system, data, instructions, output format) are stored in `ai_pipelines` and edited by admins at `/admin/pipeline`. Slugs, variables and enforced JSON shapes live in `shared/ai-pipeline.ts`.
- `server/ai/oneshot-client.ts` is the OneShotAPI client (JSON jobs and streamed chat); `server/ai/routes.ts` holds the example route `POST /api/ai/example` (tried from the dashboard). Copy it for each real pipeline: slug in `shared/ai-pipeline.ts`, seed row in `supabase_setup.sql`, editor config in `client/src/components/admin/pipeline/pipeline-steps.ts`.

## Setup

1. Create a Supabase project.
2. Create `.env` with the variables above.
3. Run `supabase_setup.sql` in the Supabase SQL Editor.
4. Start the app with `bun run dev` (or `npm run dev:node`).
5. Sign up, then make yourself admin (below).

## Project structure

```text
├── client/
│   ├── public/          # Brand assets, robots.txt, manifest
│   └── src/
│       ├── components/  # UI (admin, billing, landing, layout, onboarding, ui = shadcn)
│       ├── config/      # Auth paths, SEO, legal identity, FAQ, page titles
│       ├── hooks/       # useAuth, billing, admin, onboarding (React Query)
│       ├── lib/         # Supabase client, API client, helpers
│       └── pages/       # Landing, Onboarding, Auth, Subscribe, Dashboard, Settings, Admin, legal pages
├── server/              # Express: account, admin, billing (Whop), ai (OneShotAPI)
├── shared/              # Types shared by client and server (schema, billing, ai-pipeline)
├── script/build.ts      # Production build + prerender of the public pages
└── supabase_setup.sql   # Idempotent DB setup script
```

## Admin access

To grant admin rights to a user:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'user@example.com';
```

## Adapter files

- `replit.md`: Replit-specific runtime notes only
- `CLAUDE.md`: Claude Code-specific runtime notes only
- `.cursor/rules/*`: Cursor-specific rule format only

These adapter files should reference this `AGENTS.md` file instead of duplicating full project guidance.
