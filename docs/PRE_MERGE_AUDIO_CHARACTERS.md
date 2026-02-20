# Pre-merge checklist: `feature/audio-characters` → main

**Use this before merging.** Covers Voice Changer, BYOA ElevenLabs, transcribe billing, and related APIs.

---

## Safety review (Senior Solution Architect)

### 1. Secrets and env vars

| Check | Status |
|-------|--------|
| **FAL_KEY** used only server-side (transcribe, voice-changer, generate-audio F5, nano-banana) | OK – no `NEXT_PUBLIC_FAL_KEY` |
| **ELEVENLABS** – BYOA keys in `user_integrations`; GET returns only `id, provider, name, created_at` (no `api_key`) | OK |
| **Supabase** – Service role only in API routes; user token used for billing via `getServerSupabaseClient(accessToken)` | OK |

### 2. Auth and billing

| Route | Auth | Billing |
|-------|------|---------|
| `POST /api/audio/transcribe` | Bearer or cookie; `getAuthenticatedUserAndToken` | `spend_credits` via `getServerSupabaseClient(accessToken)` (user-scoped) |
| `POST /api/audio/voice-changer` | None (FAL_KEY only). Consider adding auth for consistency. | No credits (FAL usage billed separately) |
| `POST /api/audio/voice-changer/elevenlabs` | Bearer required | No credits (user’s ElevenLabs key) |
| `GET /api/user/credits/pricing` | Bearer or cookie | Read-only |
| `GET/POST/PUT /api/user/integrations` | Bearer required | N/A |

**Action:** Ensure production has `credit_pricing` row for `audio.whisper.transcribe` if transcribe is enabled.

### 3. Storage

| Bucket | Used by |
|--------|---------|
| `user-media` | Transcribe temp uploads (`voice-changer-temp/`), ElevenLabs STS output (`audio/{projectId}/`) |
| `projects` | F5 voice-changer and generate-audio re-upload (optional durability) |

**Action:** Confirm `user-media` and `projects` exist in production; RLS/policies allow uploads from API (service role or authenticated user).

### 4. Required production env vars (for this branch)

- `FAL_KEY` – transcribe, voice-changer (F5), generate-audio (F5-TTS), image/video Fal models
- `ELEVENLABS_API_KEY` – optional app-level fallback when user has no BYOA key
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 5. Database

- **user_integrations** – required for BYOA ElevenLabs. Apply migration if not already (e.g. `012_user_integrations.sql`).
- **credit_pricing** – add `audio.whisper.transcribe` with desired `cost` and `active = true` if using transcribe.

---

## Pre-merge commands

```bash
git checkout feature/audio-characters
npm run lint   # ✅ Pass (warnings only, pre-existing)
npm run build  # ✅ Pass
```

---

## Post-merge

- Smoke test: Voice Changer (ElevenLabs STS + My Cast), transcribe (if enabled), Audio Library method chips, TTS with selected voice.
- Optional: Reduce `console.log` in API routes in a follow-up (see PRE_MERGE_CHECKLIST.md §6).
