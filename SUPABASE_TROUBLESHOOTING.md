# Supabase Troubleshooting Guide

## Issue: Users not appearing in `users` table after signup

### Common Causes:

1. **Email Confirmation Required**
   - Supabase requires email confirmation by default
   - User isn't fully authenticated until they click the confirmation link
   - The trigger might not fire if email isn't confirmed

2. **RLS Policy Blocking**
   - Row Level Security might be blocking the insert
   - The trigger uses `SECURITY DEFINER` but manual insert might fail

3. **Trigger Not Working**
   - The trigger might not be created
   - The function might have errors

4. **Duplicate Insert Conflict**
   - Both trigger AND manual insert are trying to create user
   - This can cause race conditions

### Solutions:

#### Step 1: Check Supabase Auth Settings

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings**
3. Check **"Enable email confirmations"**
   - If enabled: Users must confirm email before being fully authenticated
   - If disabled: Users are authenticated immediately

#### Step 2: Verify Database Migration

Run this in Supabase SQL Editor to check if migration was applied:

```sql
-- Check if users table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'users'
);

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

#### Step 3: Check Recent Signups

```sql
-- Check auth.users (all signups)
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Check public.users (profiles)
SELECT id, email, full_name, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;
```

#### Step 4: Fix RLS Policy for INSERT

The current RLS policy only allows users to view/update their own profile, but doesn't allow INSERT. We need to add an INSERT policy OR rely on the trigger.

**Option A: Let trigger handle it (Recommended)**
- Remove manual insert from `signUp` function
- Let the trigger create user profiles automatically
- This is more reliable

**Option B: Add INSERT policy**
```sql
-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

#### Step 5: Test the Fix

1. **Disable email confirmation** (for testing):
   - Supabase Dashboard → Authentication → Settings
   - Disable "Enable email confirmations"
   - Save

2. **Try signing up again**
   - Check browser console for errors
   - Check Supabase logs for errors

3. **Check if user was created**:
   ```sql
   SELECT * FROM public.users ORDER BY created_at DESC LIMIT 1;
   ```

### Recommended Fix:

The best approach is to:
1. **Remove manual insert** from `signUp` function
2. **Rely on the trigger** to create user profiles
3. **Add better error handling** to catch trigger failures

This avoids race conditions and duplicate key errors.

