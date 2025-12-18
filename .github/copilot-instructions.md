# StoryFlow AI — Copilot Instructions

These instructions give an AI coding agent the minimal, high-value context to be productive in this repository.

**Big Picture**
- **App type**: Next.js 14 app-router single-repo frontend with serverless API routes in `src/app/api/*`.
- **Backend & storage**: Supabase (Postgres + Storage). DB migrations live in `supabase/migrations/` and include triggers (e.g. user profile creation).
- **AI integrations**: OpenAI for story generation and Fal AI (`@fal-ai/client`) for video generation. Look at `src/app/api/generate-story/route.ts` and `src/app/api/generate-video/route.ts` for examples.

**Key files to read first**
- `src/lib/supabase.ts`: Supabase client creation and runtime console checks — env vars must be `NEXT_PUBLIC_*`.
- `src/lib/auth.ts`: Central auth helpers (`signIn`, `signUp`, `getCurrentUser`) and notes about DB triggers.
- `src/components/AuthModal.tsx` and `src/components/AuthProvider.tsx`: UI flow, `Promise.race` timeouts, and auth-state handling. If you change auth behavior, update both files.
- `src/lib/store.ts`: application state (Zustand) used across components.
- `supabase/migrations/001_initial_schema.sql` and `002_user_media_tables.sql`: database schema and triggers referenced by `signUp`.

**Dev workflow / commands**
- Copy env: `cp env.example .env.local` (populate Supabase, OpenAI, Fal keys).
- Install: `npm install`.
- Dev server: `npm run dev` (Next dev on `localhost:3000`).
- Build: `npm run build`; Start: `npm run start`.
- Lint: `npm run lint`.

**Project-specific conventions & patterns**
- Auth: Client-side Supabase auth with `persistSession: true` and `flowType: 'pkce'` in `src/lib/supabase.ts`. UI applies quick timeouts to fail fast (`AuthProvider` uses 800ms for initial session check; `AuthModal` defaults to 60s for sign-in requests).
- Timeouts: Many UI flows use `Promise.race([action, timeout])`. When editing async flows, look for these to avoid silent hangs.
- Serverless routes: API handlers use `route.ts` under `src/app/api/*` — follow that pattern when adding endpoints.
- DB assumptions: `signUp` expects a DB trigger to create a profile; changing migrations requires coordinating code that reads `users` table (`src/lib/auth.ts`).

**Integration points & where to look for issues**
- Supabase network issues: Browser console logs `✅ Supabase client initialized` and other labeled logs from `src/lib/*` and `src/components/*`. Useful log tags: `🔐`, `🔄`, `✅`.
- Storage uploads: `src/app/api/upload-file/route.ts` and `src/app/api/upload-avatar/route.ts` wrap Supabase Storage calls — check CORS and signed URL flows if uploads fail.
- Video/image generators: `src/app/api/generate-image*/` and `src/app/api/generate-video/route.ts` call external AI providers — test keys and rate limits.

**Debugging tips (quick wins)**
- When auth times out: open DevTools → Console for `🔐 Attempting sign in for:` and `🔐 Sign in result:` logs; Network tab for calls to Supabase (`/auth/v1/token` or the Supabase domain).
- Check env variables: `env.example` shows required keys — missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` prevents client init (`src/lib/supabase.ts` logs this).
- If DB-related code seems missing data (e.g. profile), inspect `supabase/migrations/*` and the trigger definitions.

**What an agent should not change without human review**
- Secrets or `.env` handling (don't commit `.env.local`).
- DB migrations and trigger logic in `supabase/migrations/` — schema changes require DB migration and deployment coordination.
- Auth flow fundamentals (`flowType`, session storage) — these affect login across browsers and tabs.

If anything here is unclear or you want me to expand examples (for a specific feature or flow), tell me which area to expand (auth, AI integrations, or DB migrations) and I will update this file.
