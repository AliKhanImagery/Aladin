-- Align signup grant to 50 coins (for DBs that ran earlier migration)
update public.billing_settings
set signup_grant = 50,
    updated_at = now()
where id = 1;

