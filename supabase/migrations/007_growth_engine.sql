-- Growth Engine: Refunds, Profit Tracking, Referrals, and Batch Pricing

-- 1. Profit Margin Tracking
alter table public.credit_ledger
add column if not exists raw_cost_usd numeric(10, 5); -- e.g., 0.00150

-- 2. Referrals System
-- Add referral code to users table
alter table public.users
add column if not exists referral_code text unique;

-- Generate unique referral codes for existing users (simple default)
update public.users
set referral_code = 'REF-' || substring(id::text from 1 for 8)
where referral_code is null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id),
  referee_id uuid not null references public.users(id) unique, -- One referrer per user
  status text not null default 'pending', -- pending, completed
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

-- 3. Upgrade spend_credits to v2 (Return Ledger ID for Profit Tracking)
-- We drop the old function to change signature
drop function if exists public.spend_credits(bigint, text, jsonb);

create or replace function public.spend_credits(
  p_cost bigint,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb -- Returns { "new_balance": 123, "ledger_id": "uuid" }
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  current_balance bigint;
  new_balance bigint;
  ledger_id uuid;
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
  values (uid, -p_cost, p_reason, coalesce(p_metadata, '{}'::jsonb))
  returning id into ledger_id;

  return jsonb_build_object(
    'new_balance', new_balance,
    'ledger_id', ledger_id
  );
end;
$$;

-- Grant permissions for new spend_credits
grant execute on function public.spend_credits(bigint, text, jsonb) to authenticated;

-- 4. Refund Credits RPC
create or replace function public.refund_credits(
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

grant execute on function public.refund_credits(bigint, text, jsonb) to authenticated;

-- 5. Record Usage Cost RPC (For Profit Tracking)
create or replace function public.record_usage_cost(
  p_ledger_id uuid,
  p_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only allow updating if the ledger entry belongs to the user OR user is admin (but here we rely on RLS logic usually)
  -- Since this is security definer, we must check ownership manually
  if not exists (
    select 1 from public.credit_ledger
    where id = p_ledger_id and user_id = auth.uid()
  ) then
    raise exception 'permission_denied';
  end if;

  update public.credit_ledger
  set raw_cost_usd = p_cost_usd
  where id = p_ledger_id;
end;
$$;

grant execute on function public.record_usage_cost(uuid, numeric) to authenticated;

-- 6. Daily Profit Summary View
create or replace view public.daily_profit_summary as
select
  date(created_at) as day,
  sum(case when delta < 0 then abs(delta) else 0 end) as coins_spent,
  sum(raw_cost_usd) as provider_cost_usd,
  -- Assuming 1 coin = $0.01 (change if different)
  (sum(case when delta < 0 then abs(delta) else 0 end) * 0.01) as revenue_est_usd,
  (sum(case when delta < 0 then abs(delta) else 0 end) * 0.01) - coalesce(sum(raw_cost_usd), 0) as profit_est_usd
from public.credit_ledger
group by date(created_at)
order by day desc;

-- 7. Referral Signup Bonus Trigger (Updated handle_new_user_credits)
create or replace function public.handle_new_user_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_amount bigint;
  ref_code text;
  referrer_user_id uuid;
begin
  -- 1. Standard Grant
  select signup_grant into grant_amount
  from public.billing_settings
  where id = 1;

  insert into public.user_credits (user_id, balance)
  values (new.id, grant_amount)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (new.id, grant_amount, 'signup_grant', jsonb_build_object('source', 'trigger'));

  -- 2. Generate own referral code for new user
  update public.users
  set referral_code = 'REF-' || substring(new.id::text from 1 for 8)
  where id = new.id;

  -- 3. Check for Referral Code in metadata
  ref_code := new.raw_user_meta_data->>'referral_code';

  if ref_code is not null then
    -- Find referrer
    select id into referrer_user_id
    from public.users
    where referral_code = ref_code;

    if referrer_user_id is not null and referrer_user_id != new.id then
       -- Valid Referral!
       -- A. Log the referral
       insert into public.referrals (referrer_id, referee_id, status)
       values (referrer_user_id, new.id, 'completed');

       -- B. Bonus for New User (Referee) - e.g. 20 coins
       perform public.grant_credits(20, 'referral_bonus_signup', jsonb_build_object('referrer', referrer_user_id));

       -- C. Bonus for Referrer - e.g. 20 coins
       -- Direct insert for referrer:
       update public.user_credits
       set balance = balance + 20,
           updated_at = now()
       where user_id = referrer_user_id;

       insert into public.credit_ledger (user_id, delta, reason, metadata)
       values (referrer_user_id, 20, 'referral_reward_signup', jsonb_build_object('referee', new.id));
    end if;
  end if;

  return new;
end;
$$;
