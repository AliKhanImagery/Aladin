# Production deploy checklist (after merge to main)

Use this **right after** you've merged to `main` and pushed, so your deploy (e.g. Vercel) doesn’t break.

---

## Before / during deploy

### 1. Environment variables (production)

In your host (e.g. Vercel → Project → Settings → Environment Variables), ensure:

| Variable | Required for this release |
|----------|---------------------------|
| `FAL_KEY` | Yes – transcribe, voice-changer (F5), F5-TTS, image/video |
| `ELEVENLABS_API_KEY` | Optional – app-level fallback when user has no BYOA key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes – billing, storage, integrations |

Do **not** set `NEXT_PUBLIC_FAL_KEY` or any `NEXT_PUBLIC_*` secret.

### 2. Supabase (production)

- **Storage:** Buckets `user-media` and `projects` must exist. Policies must allow uploads from the app (service role or authenticated user).
- **Database:** Run migrations if not already applied:
  - `012_user_integrations.sql` – BYOA ElevenLabs (Settings → Connecting apps).
  - `011_credit_pricing_transcribe.sql` – transcribe billing (or insert `audio.whisper.transcribe` into `credit_pricing` with your desired `cost` and `active = true`).

### 3. After deploy (smoke test)

- **Voice Changer:** Record → transform with ElevenLabs or My Cast (F5).
- **Audio Library:** New clips show method chip (Voice Changer / TTS / Music / SFX) and persist.
- **TTS:** Generate voiceover with a selected ElevenLabs voice (and optional BYOA key in Settings).
- **Reeve:** Create / Edit / Remix image; confirm no 500 and pricing works.

---

## If something breaks

- **Revert the merge:**  
  `git revert -m 1 <merge-commit-hash>`  
  then `git push origin main` and redeploy.  
  (Merge commit is the one from “Merge branch 'feature/audio-characters'”.)
- **Or** fix forward with a new commit on `main`, push, and redeploy.
