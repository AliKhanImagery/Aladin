-- Store per-user API keys for BYOA (e.g. ElevenLabs).
-- Only server-side code should read api_key; use service role in API routes.
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  api_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

create index if not exists idx_user_integrations_user_id on public.user_integrations(user_id);

alter table public.user_integrations enable row level security;

create policy "Users can manage own integrations"
  on public.user_integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_integrations is 'Per-user third-party API keys (BYOA). Server-only usage.';
