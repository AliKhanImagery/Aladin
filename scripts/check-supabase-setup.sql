-- Diagnostic queries to check Supabase setup
-- Run these in Supabase SQL Editor

-- 1. Check if users table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'users'
);

-- 2. Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 3. Check RLS policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 4. Check if function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 5. Check recent auth.users (last 10)
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- 6. Check if any users exist in public.users
SELECT id, email, full_name, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;

