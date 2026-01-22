-- Billing/Credits Engine (Coins)
-- Single source of truth: Postgres (Supabase)
-- Enforcement: server calls RPCs before provider calls

-- 1) Settings (single row)
create table if not exists public.billing_settings (
  id int primary key default 1,
  signup_grant bigint not null default 50, -- coins granted on signup
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_settings_singleton check (id = 1)
);

insert into public.billing_settings (id, signup_grant)
values (1, 50)
on conflict (id) do nothing;

-- 2) Current balance
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 3) Immutable ledger
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

-- 4) Backend-controlled pricing table
create table if not exists public.credit_pricing (
  key text primary key,
  cost bigint not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed a minimal default price map (tune later via SQL/admin tooling)
insert into public.credit_pricing (key, cost, active) values
  ('blueprint.plan', 25, true),
  ('image.flux.text_to_image', 10, true),
  ('image.flux.edit', 15, true),
  ('image.nano_banana.text_to_image', 12, true),
  ('image.nano_banana.edit', 18, true),
  ('image.reeve.text_to_image', 10, true),
  ('image.reeve.remix', 15, true),
  ('video.kling.5s', 60, true),
  ('video.kling.10s', 110, true),
  ('video.ltx.2s', 25, true),
  ('video.vidu.5s', 60, true),
  ('video.vidu.10s', 110, true)
on conflict (key) do nothing;

-- 5) Row Level Security
alter table public.billing_settings enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_pricing enable row level security;

-- Read-only to authenticated users
drop policy if exists "billing_settings_read" on public.billing_settings;
create policy "billing_settings_read"
on public.billing_settings
for select
to authenticated
using (true);

drop policy if exists "credit_pricing_read" on public.credit_pricing;
create policy "credit_pricing_read"
on public.credit_pricing
for select
to authenticated
using (true);

drop policy if exists "user_credits_read_own" on public.user_credits;
create policy "user_credits_read_own"
on public.user_credits
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "credit_ledger_read_own" on public.credit_ledger;
create policy "credit_ledger_read_own"
on public.credit_ledger
for select
to authenticated
using (auth.uid() = user_id);

-- 6) RPCs (security definer, bypass direct table writes from client)
create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_settings_touch_updated_at on public.billing_settings;
create trigger billing_settings_touch_updated_at
before update on public.billing_settings
for each row execute procedure public._touch_updated_at();

drop trigger if exists credit_pricing_touch_updated_at on public.credit_pricing;
create trigger credit_pricing_touch_updated_at
before update on public.credit_pricing
for each row execute procedure public._touch_updated_at();

-- Ensure a user_credits row exists for the current user
create or replace function public.ensure_my_credit_row()
returns public.user_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  row public.user_credits;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.user_credits (user_id, balance)
  values (uid, 0)
  on conflict (user_id) do nothing;

  select * into row from public.user_credits where user_id = uid;
  return row;
end;
$$;

-- Spend credits atomically (throws on insufficient funds)
create or replace function public.spend_credits(
  p_cost bigint,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  current_balance bigint;
  new_balance bigint;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.ensure_my_credit_row();

  select balance into current_balance
  from public.user_credits
  where user_id = uid
  for update;

  if current_balance < p_cost then
    raise exception 'insufficient_credits';
  end if;

  new_balance := current_balance - p_cost;

  update public.user_credits
  set balance = new_balance,
      updated_at = now()
  where user_id = uid;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (uid, -p_cost, p_reason, coalesce(p_metadata, '{}'::jsonb));

  return new_balance;
end;
$$;

-- Grant/refund credits atomically
create or replace function public.grant_credits(
  p_amount bigint,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  current_balance bigint;
  new_balance bigint;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.ensure_my_credit_row();

  select balance into current_balance
  from public.user_credits
  where user_id = uid
  for update;

  new_balance := current_balance + p_amount;

  update public.user_credits
  set balance = new_balance,
      updated_at = now()
  where user_id = uid;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (uid, p_amount, p_reason, coalesce(p_metadata, '{}'::jsonb));

  return new_balance;
end;
$$;

-- Get my current balance (convenience)
create or replace function public.get_my_credit_balance()
returns bigint
language sql
security definer
set search_path = public
as $$
  select balance from public.ensure_my_credit_row();
$$;

-- 7) Auto-grant on signup
create or replace function public.handle_new_user_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_amount bigint;
begin
  select signup_grant into grant_amount
  from public.billing_settings
  where id = 1;

  insert into public.user_credits (user_id, balance)
  values (new.id, grant_amount)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (new.id, grant_amount, 'signup_grant', jsonb_build_object('source', 'trigger'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
after insert on auth.users
for each row execute procedure public.handle_new_user_credits();

-- 8) Function privileges
revoke all on function public.ensure_my_credit_row() from public;
revoke all on function public.spend_credits(bigint, text, jsonb) from public;
revoke all on function public.grant_credits(bigint, text, jsonb) from public;
revoke all on function public.get_my_credit_balance() from public;

grant execute on function public.ensure_my_credit_row() to authenticated;
grant execute on function public.spend_credits(bigint, text, jsonb) to authenticated;
grant execute on function public.grant_credits(bigint, text, jsonb) to authenticated;
grant execute on function public.get_my_credit_balance() to authenticated;

