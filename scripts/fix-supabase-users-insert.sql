-- Fix Supabase Users Table Insert Issue
-- Run this in Supabase SQL Editor

-- Option 1: Add INSERT policy to allow users to create their own profile
-- This allows manual insert when email confirmation is required
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Option 2: If the above doesn't work (email confirmation issue),
-- Create a policy that allows insert for authenticated users
-- (This is more permissive but necessary if email confirmation delays auth.uid())
CREATE POLICY "Authenticated users can insert profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify the trigger exists and is working
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';

-- Test: Check if any users exist in auth.users but not in public.users
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at as auth_created_at,
  pu.id as profile_exists
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

