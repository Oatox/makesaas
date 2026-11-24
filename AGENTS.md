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
7. **Uploaded files go to Cloudflare R2**, never to a Supabase Storage bucket (see Files below).

## Tech stack

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Framer Motion
- Routing: `wouter`
- Async/server state: `@tanstack/react-query`
- Backend shell: Node.js + Express (run with Bun in development)
- Data/Auth provider: Supabase (`@supabase/supabase-js`)
- Payments: Whop (`@whop/sdk`, `@whop/elements-react`)
- AI: OneShotAPI (Gemini models, enforced JSON output)
- Files: Cloudflare R2 (S3 API signed with `aws4fetch`)

## Environment variables

Set them in `.env` (development) or in the host platform (production):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (`sb_publishable_...`)
- `SUPABASE_SECRET_KEY` — Supabase secret key (`sb_secret_...`, server-only)
- `WHOP_API_KEY` — Whop account API key (server-only; without it the paywall shows "abonnements indisponibles")
- `WHOP_WEBHOOK_SECRET` — signing secret of the Whop webhook (`ws_...`, server-only)
- `WHOP_PRODUCT_ID` — Whop product id (`prod_...`): its visible renewal plans of 30, 90 and 365 days become the 1, 3 and 12-month offers (the paywall only offers the periods the product has)
- `WHOP_PLAN_ID` — instead of a product, the plan id (`plan_...`) of a single monthly plan
- `WHOP_ENVIRONMENT` — `sandbox` to use sandbox.whop.com, production otherwise
- `ONESHOT_API_KEY` — OneShotAPI key for the AI pipelines (server-only, optional: without it the AI routes answer 503; the coach also reads the older name `ONESHOTAPI_KEY`)
- `SCRAPECREATORS_API_KEY` — ScrapeCreators key for the TikTok stats of the acquisition page (server-only, optional: without it adding or refreshing an account answers 503)
- `REVENUE_ENCRYPTION_KEY` — 32 random bytes (`openssl rand -hex 32`) encrypting the Stripe/Whop keys members connect to the revenue dashboard (server-only, recommended: without it a key derived from `SUPABASE_SECRET_KEY` is used, and rotating that one forces members to reconnect their accounts)
- `R2_ACCOUNT_ID` — Cloudflare account id (the S3 endpoint is `https://<id>.r2.cloudflarestorage.com`)
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — R2 API token with Object Read & Write on the bucket (server-only)
- `R2_BUCKET` — name of the R2 bucket of uploaded files
- `R2_PUBLIC_URL` — public base URL of that bucket (its `r2.dev` URL, or a custom domain in production); without the five R2 variables, uploads answer 503 and generated carousels get no images

## User journey

- Landing `/` → onboarding `/onboarding` (questions saved in localStorage, `client/src/components/onboarding/steps.tsx`; adding a step there is all it takes) → sign-up `/register` → paywall `/abonnement` → Gus's 3 SaaS ideas `/lancement`, then the project, the plan and the first mission (the app stays locked until the launch is over) → Accueil `/accueil` (the day's tasks, where members land once signed in: `AUTH_CONFIG.REDIRECT_PATH`).
- `ProtectedRoute` (client/src/App.tsx) sends visitors to the onboarding and signed-in users without a subscription to the paywall.
- Nobody skips the onboarding: accounts are created in it (`AccountStep`). `/register` (the login page's "S'inscrire") sends visitors there until they answered it on this device (`onboardingFinishedHere`), and the paywall sends there the signed-in users who never answered it (an account opened with Google from the login page): `useOnboardingAnswered` (`client/src/hooks/use-onboarding.ts`, finished on this device or answers saved on `profiles.onboarding_profile`).

## Product data

- Product data belongs to a user: give new tables a `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE` and RLS through `user_id = (SELECT auth.uid())`; add `(SELECT private.has_access())` to the write policies of paid features.
- It also belongs to one of the user's SaaS: a member has 0 to 20 SaaS (`public.saas`, `shared/saas.ts`), switched from the sidebar (`SaasSwitcher`, the active one in `profiles.current_saas_id`; for now its menu creates none: a SaaS comes from /lancement). The gear of each SaaS in that menu opens its settings, as does a click on the active SaaS (another one is switched to) (`client/src/components/saas/SaasDialog.tsx`): tabs Général (logo, rename, the app's address, delete), TikTok (its accounts) and Paiements (its payment account), reusing the acquisition and revenue hooks for that SaaS's id; a feature with per-SaaS connections adds its tab there. Give product tables a `saas_id UUID NOT NULL` with `FOREIGN KEY (saas_id, user_id) REFERENCES public.saas (id, user_id) ON DELETE CASCADE` (a row can only belong to a SaaS of its own user). On the client, read them for `useCurrentSaasId()` (`client/src/hooks/use-saas.ts`), in the query key, and show an empty state while it is undefined (no SaaS yet); server routes take a `saasId` and check it belongs to the user.

## Files (Cloudflare R2)

- Files members upload (carousel images, SaaS logos) live in one public R2 bucket (`shared/storage.ts`), under `<user_id>/<saas_id>/carousels/<carousel_id>/` and `<user_id>/<saas_id>/logo/`. Only the server writes there (`server/storage/`: `r2.ts` is the S3 client, `files.ts` the key layout, image checks and cleanup): the browser sends the raw file to a route that checks the owner and the real type (PNG, JPG, WebP by their bytes), stores it under a new name and answers its public URL.
- SaaS logo: `PUT /api/saas/:id/logo` (resized to 256 px in the browser) and `DELETE` (back to the initials) write `saas.logo_url`, which members cannot write themselves (`server/saas/routes.ts`).
- Cleanup: deleting a carousel or a SaaS goes straight to Supabase, then the client asks the server to remove its prefix (`DELETE /api/content/carousels/:id/images?saasId=`, `DELETE /api/saas/:id/files`, refused while the row still exists); deleting an account removes `<user_id>/`.
- The bucket needs public read access (r2.dev or a custom domain) and a CORS rule allowing `GET` and `HEAD` (any origin: the files are public anyway), since the carousel export reads the images with `fetch`.

## Subscriptions (Whop)

- A single paid plan unlocks the whole app (`PLAN` in `shared/billing.ts`: name and description); there is no free plan. It is sold for 1, 3 or 12 months (`OFFERS` and `RECOMMENDED_OFFER` in `shared/billing.ts`, one Whop plan each, found on the product `WHOP_PRODUCT_ID` by billing period; any membership on that product grants access); the paywall (`/abonnement`, `client/src/components/billing/Paywall.tsx`) shows the guarantee, then the offers with Whop's checkout embedded under them. Subscriptions live in their own table `subscriptions` (one row per user, `provider` `whop` or `manual`), never on `profiles`. Access = a row whose `status` grants access (`grantsAccess` in `shared/billing.ts`, mirrored by `subscription_grants_access` in SQL), or the admin role: `hasAccess` from `useAuth()` on the client, `private.has_access()` in RLS.
- `POST /api/billing/checkout` (body `{ offer }`) creates a Whop checkout configuration on that offer's plan, carrying `metadata.supabase_user_id`. Access is granted only by the signed webhook `POST /api/billing/whop/webhook` (`server/billing/`), which re-reads the membership from Whop and upserts the user's `subscriptions` row. A new membership never replaces one still running on Whop: a double payment is logged as an error, to refund from the Whop dashboard.
- Members cancel or resume the renewal from the settings (`ManageSubscription`): `POST /api/billing/subscription/cancel` and `/resume` change `cancel_at_period_end` on Whop, then sync the row right away (access stays until the paid period ends).
- Deleting an account (the member's from the settings, or a member from the admin) is refused while its Whop subscription renews (`renewsBilling` in `shared/billing.ts`, checked by `deleteAuthUser` in `server/admin/routes.ts`): Whop would keep billing a deleted member. Cancel the renewal first (the member from the settings, an admin on Whop).
- `requireSubscriber` (server/lib/auth.ts) guards paid API routes.

## AI pipelines

- Prompts (system, data, instructions, output format) are stored in `ai_pipelines` and edited by admins at `/admin/pipeline` (the pipelines along the member's journey, onboarding to app, by their `stage`, each opening on its page `/admin/pipeline/:slug`: what the model receives in order, every prompt, and the fixed parts the app adds; described in `client/src/components/admin/pipeline/pipeline-steps.ts`). Slugs, variables and enforced JSON shapes live in `shared/ai-pipeline.ts`.
- `server/ai/oneshot-client.ts` is the OneShotAPI client (JSON jobs and streamed chat); `server/ai/pipelines.ts` reads a pipeline and fills its `{{variables}}`. The coach (`server/coach/`) is the pipeline to copy for a new one: slug in `shared/ai-pipeline.ts`, seed row in `supabase_setup.sql`, editor config in `client/src/components/admin/pipeline/pipeline-steps.ts`, and its server route.

## SaaS ideas (/lancement)

- The app starts with a project: a subscriber whose launch is not over (no SaaS yet, or its last steps) is sent to `/lancement` by `ProtectedRoute` (only `/settings` and the admin pages stay open), and the paywall's activation goes there. The page (`client/src/pages/Launch.tsx`, full screen: `bare` in `ProtectedRoute`) is a chat with Gus like the onboarding's (`CoachThread`): he welcomes the member, then, after "Continuer" and a loader while they are written (`client/src/components/ideas/IdeasLoader.tsx`, the onboarding's sphere of dots), opens straight on 3 B2C app ideas made from their answers, the first being the one he recommends. "D'autres idées" asks for 3 new ones (optionally steered by a sentence), never one already proposed; "Je garde cette idée" creates the SaaS straight from Supabase with `description`, `audience` and `idea_id` (composite key: an idea of the same user). There is no way to skip it. Each step is saved on the profile (`profiles.launch_step`: `project` with `launch_idea_id`, then `plan`, `tour`, `mission`, `done`; `shared/launch.ts`, saved by `useSaveLaunchStep`), so a reload, a new sign-in or another device resumes it (`resumeLaunch`: with a SaaS and no step saved, the launch is over). Once confirmed, the project is locked: no going back to the ideas with a SaaS, `POST /api/ideas/next` answers 409, and the database refuses another SaaS from an idea (`enforce_saas_from_idea`, section 13: `saas_idea_taken`).
- The first series starts at the payment: the Whop webhook calls `startWelcomeIdeas` (`server/ideas/service.ts`) when it activates a subscription, for a member without SaaS nor ideas. It reads the onboarding answers that the paywall saved on the profile (`useSaveOnboardingProfile`: `profiles.onboarding_profile`, question → answer lines built by `buildOnboardingProfile`, `shared/onboarding-profile.ts`). The page follows a series being written (members read `saas_idea_batches`) and asks itself when there is none.
- One request to the `ideas` pipeline (admin-editable, Gemini 2.5 Flash by default: consumer apps on formats that already sell, like Cal AI) writes `IDEAS_PER_REQUEST` (12) ideas ranked from the most recommended, each with its main feature (`feature`: what the user gives → what the app gives back, which the Base44 prompt builds the app around; ideas written before it have none) and its single price (one monthly subscription at a consumer app price, 2,99 € to 29,99 € ending in ,99: `consumerPrice` in `shared/ideas.ts` brings the model's answer there; older ideas have whole euros), which the Base44 prompts of the roadmap reuse, stored in `saas_ideas` (one `saas_idea_batches` row per request, section 13 of `supabase_setup.sql`). They are shown 3 at a time (`saas_idea_batches.revealed`, cut in series by `revealedSeries` in `shared/ideas.ts`): `POST /api/ideas/next` (`server/ideas/`) reveals the next 3 of the latest request at once, and only makes a new request (about a minute) when none are left or the member steers the ideas. The page shows only the latest series: ideas from stock (`hasStock` in `useIdeas`) replace the cards in place, a new request shows the loader. One request at a time per member (409), `IDEA_BATCHES_PER_DAY` requests over a rolling 24 h (failed ones and series from stock do not count).

- Keeping an idea leads to three last steps with Gus on the same page (`client/src/components/ideas/LaunchSteps.tsx`): the project to confirm (name and sentence, editable: the SaaS is created there), the plan to the member's monthly goal from the onboarding (`PlanDialog`, over the chat in the onboarding's dialog, like its "Ton plan personnalisé est prêt"), then, from its "Et maintenant ?", a new conversation: Gus shows around the app (`AppTour`: the pages of `APP_PAGES` in `client/src/config/app-pages.ts`, the sidebar's too, each with its `tour` line, then talking to him) and, after "Compris", the first mission alone on screen, said by Gus like the onboarding's statements (`StatementStep`: its title, then its `why` and time): its button "C'est parti" enters the app on Accueil, where it waits. The plan and Gus's lines are read from the roadmap (`roadmapStagesFor`; the first mission is `firstMissionFor`, the first one the SaaS does not already check, said with its title, time and `why`): nothing to change here when its missions are renamed or reordered.

## Accueil (/accueil) and Roadmap (/roadmap)

- Members see three words, each with one meaning, never others ("palier", "jalon"): the **objectifs** (`objectivesOf` in `shared/today.ts`: "Lancer ton SaaS", "Première vidéo", "Premier client", then each amount per month up to the member's goal from the onboarding, the "Objectif final"), the **étapes** each is made of (the milestones of `milestonesFor`, checked from the data), and the **tâches** they do today to pass the step in progress. A task's instructions (its `steps`) have no name: numbers and "Suivant".
- Both read the same journey of the active SaaS (`shared/roadmap-missions.ts`: `roadmapStagesFor`, stages of missions), in two ways:
  - **Accueil** (`client/src/pages/Today.tsx`): where the member acts, the day's tasks (`shared/today.ts`, `todayPlan`). Until the SaaS is launched, the launch missions (logo, Base44, home page, accounts, onboarding, core, changes, review, publish, domain name, Whop, its webhook, payment test, TikTok, first video) in their order, a few each day (up to `TASKS_PER_DAY`, about `MINUTES_PER_DAY`); once launched, every day's tasks (`dailyTasks`, keyed by the day: post a video, answer the comments) and the next mission of the MRR tier the member works towards. Tasks done today stay in the day; once all are done, "Demander de nouvelles tâches" starts a new series (`since` of `todayPlan`, kept for the day on the device): those done go to "Tâches accomplies" and the next `TASKS_PER_DAY` come, without the time budget. Under them, "Tâches accomplies" (`doneTasks`, `DoneTaskList`): the tasks done before, in the order of the journey (not of when they were ticked), the furthest first, each opening again in the drawer to read its steps and reuse their buttons. The tasks form one list (`DayTaskList`: a row per task with its state, title and time, the one to do now outlined in orange; the time left by the section's title); a row opens its task in a drawer (`TaskDetail`): its instructions one at a time (numbered, a segment per instruction to go back to it), each with its button and "Suivant", then on the last one "Tâche suivante" (ticks it and opens the next one; "C'est fait" for the day's last) or what the data waits for; a task done says when in its header line and shows all its instructions at once (checked, their buttons secondary, "Pas encore faite" to untick), the next task pinned at the bottom; a launch task waits for the one before it (`taskBlocker`, "Y aller"), and unticking one ("Pas encore faite") unticks it alone, those ticked after it stay done. Above the tasks (`ObjectiveBar`), the objective in progress (`currentObjective`: "Objectif 1 sur 7", "Lancer ton SaaS", "2 / 4 étapes"), its steps as segments and the step in progress with its figure (`currentMilestone`, `milestoneCounter`); an objective of a single step (an amount per month) shows its figure.
  - **Roadmap** (`client/src/pages/Roadmap.tsx`): where the member sees how far they are, the objectives only, drawn as a winding path (`RoadmapPath`), from the launch to the goal. Their steps are the milestones of `milestonesFor` (`Milestone` in `shared/roadmap.ts`), grouped by `objectivesOf`: the launch (idea, logo, app online, payments), the first video (TikTok account, first video), the first customer (7 videos, first payment), then one per MRR tier, each its single step. Nothing to tick: each step is checked from the data by the mission of the same key; an objective says when it was reached or, in progress, how far it is (`objectiveProgress`: "2 / 4 étapes", or the figure of its single step, `milestoneCounter`: "64 € / 100 € par mois", from `progress` in the state). Clicking one opens its drawer (`ObjectiveDetail`): its steps, each with its date, figure or tasks done (`milestoneTasks`), or, for a single step, the tasks that lead to it.
- Members build their app with Base44, the AI app builder that also hosts it; its sign-up link, opened by its task, is `BASE44_URL` in `shared/roadmap-missions.ts` (our referral link: 30 free credits for the member). Base44 builds the whole app from one detailed prompt per task, pasted into the same Base44 chat and filled with the project (`shared/roadmap-prompts.ts`): the app and its home page with the legal pages (the first prompt, which creates the app), accounts (Base44's login pages, settings with account deletion, the `is_subscriber` field only admins change, an admin page to turn buyers Pro), the onboarding (questions, then the paywall: the result partly blurred above the Pro offer and "Débloquer mon résultat", which leads to the sign-up), the core (the main feature, for Pro users; any AI or API goes through OneShotAPI from a Base44 server function, capped per user and day so that a subscriber costs at most a quarter of their subscription in credits, with the member's own key, ONESHOT_API_KEY in the app's secrets, which Base44 walks them through getting), then, before publishing, a review of the whole app that Base44 fixes itself ("Valide ton app"), then payment with Whop (`buildPaymentPrompt`: the paywall's and "Passer à Pro" buttons have a server function create a Whop checkout carrying the user's id in its metadata; the signed `membership.updated` webhook re-reads the membership and turns `is_subscriber` on or off, so nobody is turned Pro by hand; Pro users manage and cancel from Whop. The member creates the Whop API key while Base44 builds it, then the webhook on Whop once the app is published, its own task, "Relie Whop à ton app"). Members who built their app with the former single prompt have the build tasks before the core done, and those who went past a task added later (the review, the Whop webhook) have it done (`withEarlierBuildMissions` in `server/roadmap/service.ts`, `LATER_ADDED_MISSIONS`).
- Content in `shared/roadmap-missions.ts` (`roadmapStagesFor`: idea, its style (the logo made with ChatGPT, whose colors the build prompt takes), build the app, test payment, first video, first customer, one stage per MRR tier under the goal, then the goal; edit the texts freely, keep the keys), model in `shared/roadmap.ts`, the prompts in `shared/roadmap-prompts.ts`. A mission has a one-line `why` (for Gus, not shown), a duration (shown by its title) (`minutes`, or `span` for what takes days) and a few `steps`: one short sentence starting with a verb, in everyday words, and at most one button (`StepAction`, rendered by `client/src/components/roadmap/StepAction.tsx`: open a site, a page of the app, ChatGPT with its prompt already written, copy a prompt, ask Gus, the SaaS's logo dropped or picked right in its task (`LogoDrop`, the settings' upload), the SaaS's payment settings, the app's address, its Whop payment link).
- The goal is the onboarding's ("Combien tu veux gagner par mois ?"), saved on `profiles.monthly_goal` with the answers (`useSaveOnboardingProfile`, on the paywall and `/lancement`); 10 000 € when missing.
- A mission is done in `roadmap_missions` (section 14 of `supabase_setup.sql`) either by the server, which checks it from the SaaS's data on every `GET /api/roadmap?saasId=` (`server/roadmap/service.ts`: whether the app's address is on its own domain, the SaaS's logo, the payment account, TikTok accounts and videos, the first payment and the MRR of the live account in euros; saved once seen, never undone), or by the member ("C'est fait" at the end of a task, straight in Supabase, `source = 'declared'`: theirs to untick; every day's tasks too, keyed `daily:<task>:<day>`). The same answer carries `progress` (videos, TikTok accounts, MRR in euros) for the milestones' figures.
- The app's address: the publish task ("Publie ton app") only has the member click Publish in Base44 and is ticked by them; the domain name task that follows (bought straight in Base44 with "Buy new domain", which a paid plan allows: the Base44 account task advises its Builder plan, whose yearly billing makes the first year of the domain free) ends with the member pasting the app's address (or changing it in the SaaS's settings, Général tab; both through `useSaveAppUrl`). The browser checks that it answers (`fetch` in no-cors mode: the server never fetches member URLs), then `PUT /api/roadmap/app-url` saves it on `saas.app_url` (server-only column). The domain task, and with it the Roadmap step "Ton app en ligne", is done once that address is not a free one like `*.base44.app` (`isCustomDomain` in `shared/roadmap.ts`).
- The Whop payment link: the member pastes it in "Crée ta boutique Whop", which is done once it is saved; `PUT /api/roadmap/payment-link` checks it is a whop.com address (`paymentLinkBodySchema`, mirrored by `saas_payment_link_check`) and saves it on `saas.payment_link` (server-only column). The payment prompt carries it (`project.paymentLink`), else its placeholder.

## Revenue dashboard (Tableau de bord)

- `/dash` shows the active SaaS's revenue (`/app`, its former address, redirects there) (`client/src/components/revenue/RevenueDashboard.tsx`): the period's key figures (`KpiCards`: revenue collected, MRR/ARR, new subscribers, churn, each with a mini chart), the MRR card (revenue collected as bars on the left axis, MRR as a line on the right axis) and the latest payments (an icon per kind of payment), over 30 days / 90 days / 12 months.
- A SaaS connects a single payment account (unique index `revenue_connections_saas_key`): to change it, the member removes it first (Paiements tab of the SaaS settings; a failed sync shows above the figures); reconnecting the same account only replaces its key. Members connect it with a read-only API key: Stripe (restricted key `rk_…` reading Charges and Subscriptions) and Whop (account API key with `payment:basic:read`, `member:basic:read` and plan read). `POST /api/revenue/connections` (body `{ saasId, provider, apiKey }`) checks the key, imports 12 months of history and stores the key encrypted (`server/revenue/secret-box.ts`) in `revenue_connections` with the computed daily series (`snapshot`). Members read the public columns and remove accounts straight from Supabase (RLS); the key and the snapshot are never granted to clients.
- `GET /api/revenue?saasId=` combines the SaaS's accounts (other currencies converted with the ECB rates of frankfurter.dev) and re-syncs in the background the accounts synced more than 30 minutes ago; the client polls while `syncing` is not empty. `POST /api/revenue/refresh` re-syncs now.
- MRR and subscribers are rebuilt day by day from the subscriptions (start after trial, end), at their current price; revenue comes from the payments, refunds deducted (`server/revenue/metrics.ts`, tested in `metrics.test.ts`). To add a provider: see the header of `shared/revenue.ts`.

## Acquisition (TikTok)

- "Acquisition" unfolds two sub-pages in the sidebar (`children` in `APP_PAGES`, `client/src/config/app-pages.ts`), both rendered by `client/src/pages/Acquisition.tsx`: **Statistiques** at `/acquisition` (`StatsSection`) and **Création de contenu** at `/acquisition/contenu` (`ContentSection`, the carousels, below).
- Members add public TikTok accounts by @handle to their active SaaS (`saas_id` on the three tables, `POST` body `{ saasId, handle }`); `TIKTOK_MAX_ACCOUNTS` counts every SaaS of the user, since credits follow the number of accounts (`shared/acquisition.ts`). The server (`server/acquisition/`) fetches their profile and latest videos from ScrapeCreators (1 credit per call) and alone writes `tiktok_accounts`, `tiktok_videos` and `tiktok_account_stats` (one snapshot per account and day, for the evolution charts); members read them and remove accounts straight from Supabase (RLS).
- No background job: opening the page refreshes the accounts older than `TIKTOK_AUTO_SYNC_HOURS`, and refreshes are capped at one per `TIKTOK_SYNC_COOLDOWN_MINUTES` per account (atomic claim on `sync_attempted_at`).

## Content (TikTok carousels)

- A carousel is one JSON document in `carousels.document` (one row per carousel, per SaaS): slides with a layout of 1 to 9 image cells (focal point per image) and text layers positioned in % of the slide, sized in px of the slide's base frame (`shared/carousel.ts`: types, zod schema, formats, limits). Members create, edit (autosave) and delete carousels straight from Supabase (RLS); their images are sent to `POST /api/content/carousels/:id/images`, which stores them in the R2 bucket (Files above).
- The same slide is drawn by the DOM (`client/src/components/content/SlideView.tsx`: previews and editor) and by the Canvas renderer (`shared/carousel-renderer.ts`: download as PNG 1080 px, a zip for several slides, `client/src/lib/carousel-export.ts`): keep both in sync. Their font is Outfit, loaded on demand (`client/src/lib/carousel-font.ts`).
- Editor at `/acquisition/contenu/:id` (`client/src/components/content/editor/`, full screen over the app): slides side by side on a canvas that pans and zooms, reducer with undo/redo (`editor-state.ts`), text inspector, image upload or drag and drop.
- Generation (`POST /api/content/carousels/generate`, `server/content/`): answers 202 at once, then in the background the `carousel` AI pipeline (admin-editable, `/admin/pipeline`) writes the title, the text of each slide and an image prompt, Nano Banana 2 (`CAROUSEL_IMAGE_MODEL`) draws one image per slide without any text, the images are copied to the bucket (OneShotAPI URLs are temporary) and the text is laid over them as editable layers. `CAROUSEL_GENERATIONS_PER_DAY` per user over a rolling 24 h (`carousel_generations`, failed ones do not count). When a generation ends, the library opens the carousel in a preview (`client/src/components/content/CarouselPreviewDialog.tsx`: slides swiped on phones, arrows and ← → elsewhere, "Modifier" and "Télécharger"), also reachable from the "Aperçu" item of a card.

## Discussions (coach Gus)

- A new discussion starts from "Discuter avec Gus": at the top of the sidebar under the SaaS switcher (`TalkToGusLink` in `AppSidebar`), and at the top right of the pages' header (`TalkToGusButton` in `AppLayout`; not in the discussions, on Accueil, the content pages and the admin pages): `/discussions`, Gus's welcome and suggested questions. "Discussions" is a category of the sidebar (`Content` in `NAV_GROUPS`, rendered by `SidebarDiscussions`; hidden until the active SaaS has a discussion): the 3 latest discussions of the active SaaS (plus the open one), then "Voir tout" when there are more, which opens every discussion (`DiscussionsHistory`: search by title, grouped by date); collapsed to icons, a single icon opens that list. A discussion (`/discussions/:id`, `client/src/pages/Discussions.tsx`, components in `client/src/components/coach/`) is renamed or deleted from its "…" menu, in the sidebar or in the page header (`DiscussionDialogs`). The layout gives these pages the full height (`isFullHeightPage` in `AppLayout`).
- Conversations belong to a SaaS (`coach_conversations`, `coach_messages`, section 11 of `supabase_setup.sql`; constants and stream events in `shared/coach.ts`). The server alone writes messages; members read, rename (title only) and delete straight from Supabase (RLS).
- `POST /api/coach/messages` (body `{ saasId, conversationId, content }`; `conversationId: null` creates the discussion, `content: null` answers again the last message after a failure) saves the member's message, then streams Gus's answer as NDJSON (`start`, `delta`…, `done` | `error`) through `streamChat` (OneShotAPI `/v1/chat/completions`) with the `coach` pipeline (default model `gemini-3.8-flash`) and the last `COACH_HISTORY_MESSAGES` messages. The answer is saved even if the member leaves. One answer at a time per discussion, 60 messages per hour per member (in memory). On the client, `sendToCoach` (`client/src/hooks/use-coach.ts`) keeps the turn being answered in the query cache (`useLiveTurn`) so it survives a change of page.
- Gus knows everything about the member, rebuilt on every message (`server/coach/context.ts`, the `coach` pipeline's `{{profil}}`, `{{projet}}`, `{{roadmap}}`, `{{chiffres}}`): their onboarding answers and monthly goal, the active SaaS and the idea it comes from, their roadmap (its objectives, the steps of the one in progress with their figure or tasks, the day's tasks, the next one's instructions and prompt), and their real figures (revenue of the connected account, TikTok accounts and best videos, carousels). A part that cannot be read says so instead of failing the answer. Each mission of the roadmap has "Demander à Gus", which opens a discussion naming it.
- Gus only helps with the member's SaaS (the end of the `coach` pipeline's instructions): he does nothing about their MakeSaaS subscription or account (refund, cancellation, dispute: no steps, no promise) nor anything that does not serve their SaaS, even when they insist; the refunds of their own app's customers are part of their SaaS. Keep that rule when editing the prompt.
- Gus's answers are rendered by `CoachMarkdown` (a small Markdown subset, no HTML): keep the coach's format prompt within it.

## Setup

1. Create a Supabase project.
2. Create `.env` with the variables above.
3. Run `supabase_setup.sql` in the Supabase SQL Editor.
4. Create the R2 bucket (public access, CORS `GET`/`HEAD`) and an R2 API token, then fill the `R2_*` variables.
5. Start the app with `bun run dev` (or `npm run dev:node`).
6. Sign up, then make yourself admin (below).

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
├── server/              # Express: account, admin, billing (Whop), ai (OneShotAPI), storage (R2)
├── shared/              # Types shared by client and server (schema, billing, ai-pipeline)
├── script/build.ts      # Production build + prerender of the public pages
└── supabase_setup.sql   # Idempotent DB setup script
```

## Member page (admin)

- `/admin/users/:id` (`client/src/components/admin/users/AdminUserDetailsPage.tsx`) shows the profile, the subscription, the member's SaaS and their onboarding answers with their monthly goal (`journey` of `GET /api/admin/users/:id/details`, `shared/admin.ts`). Each SaaS is one line (its milestone in progress) that opens a drawer (`details/SaasDrawer.tsx`): its progress, milestones, figures, discussions with Gus, tasks done, project and connections, read by `GET /api/admin/users/:id/saas/:saasId` (`server/admin/member.ts`); a discussion opens in the drawer itself (`details/Discussions.tsx`, `GET /api/admin/users/:id/discussions/:conversationId`, shown with the member's `ChatThread`). Looking never writes: the roadmap is checked with `RoadmapService.state(…, { save: false })`.

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
