-- 009_admin_grant_credits.sql

-- Secure function to grant credits to a specific user (for Webhooks/Admin)
create or replace function public.admin_grant_credits(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer -- Runs with privileges of the creator (postgres/admin)
set search_path = public
as $$
declare
  current_balance bigint;
  new_balance bigint;
begin
  -- Verify user exists
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found';
  end if;

  -- Ensure credit row exists
  insert into public.user_credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Lock row for update
  select balance into current_balance
  from public.user_credits
  where user_id = p_user_id
  for update;

  new_balance := current_balance + p_amount;

  -- Update balance
  update public.user_credits
  set balance = new_balance,
      updated_at = now()
  where user_id = p_user_id;

  -- Record in Ledger
  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (p_user_id, p_amount, p_reason, coalesce(p_metadata, '{}'::jsonb));

  return new_balance;
end;
$$;

-- Grant access ONLY to service_role (backend) and postgres (admin)
-- NOT to 'authenticated' or 'anon'
revoke all on function public.admin_grant_credits(uuid, bigint, text, jsonb) from public;
revoke all on function public.admin_grant_credits(uuid, bigint, text, jsonb) from authenticated;
grant execute on function public.admin_grant_credits(uuid, bigint, text, jsonb) to service_role;
