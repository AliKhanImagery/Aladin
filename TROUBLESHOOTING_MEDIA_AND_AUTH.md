# Troubleshooting: Media History & Authentication Issues

## Issues Fixed

### 1. Images/Videos Not Populating in History

**Problem:** Generated images and videos were not showing up in `/my-images` and `/my-videos` pages.

**Fixes Applied:**
- ✅ Enhanced error logging in `saveUserImage()` and `saveUserVideo()` functions
- ✅ Added detailed console logs to track save operations
- ✅ Added specific error messages for missing database tables
- ✅ Improved error handling to catch and log all failures

**What to Check:**

1. **Database Migration Status:**
   - Open Supabase Dashboard → SQL Editor
   - Run the migration: `supabase/migrations/002_user_media_tables.sql`
   - Verify tables exist: `user_images` and `user_videos`

2. **Check Browser Console:**
   - Open DevTools (F12) → Console tab
   - Generate an image/video
   - Look for these logs:
     - `💾 Saving image to database:` - Save attempt started
     - `✅ Image saved to user_images:` - Success
     - `❌ Error saving user image:` - Failure (check error details)

3. **Common Errors:**
   - **Error Code `42P01`**: Table doesn't exist → Run migration
   - **Error Code `42501`**: RLS policy issue → Check RLS policies
   - **No user authenticated**: User not logged in → Sign in first

### 2. Session Not Persisting Across Tabs

**Problem:** Opening `localhost:3000` in a new tab doesn't remember the logged-in user, and sign-in attempts fail.

**Fixes Applied:**
- ✅ Updated Supabase client configuration with proper session persistence
- ✅ Enabled `persistSession: true` and `autoRefreshToken: true`
- ✅ Configured localStorage for session storage
- ✅ Added PKCE flow for better security
- ✅ Improved `getCurrentUser()` to check session first

**What Changed:**
```typescript
// src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    flowType: 'pkce'
  }
})
```

**Testing:**
1. Sign in on one tab
2. Open `localhost:3000` in a new tab
3. User should be automatically logged in
4. If not, check browser console for errors

**If Still Not Working:**
- Clear browser cache and localStorage
- Check if cookies are being blocked
- Verify Supabase URL and keys in `.env.local`
- Check browser console for authentication errors

## Debugging Steps

### Check if Images/Videos are Being Saved

1. **Open Browser Console** (F12)
2. **Generate an image or video**
3. **Look for these logs:**
   ```
   💾 Saving image to database: { user_id: "...", ... }
   ✅ Image saved to user_images: <uuid>
   ```
4. **If you see errors**, check the error details:
   - Error code
   - Error message
   - Table existence

### Check Database Tables

1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Check if these tables exist:
   - `user_images`
   - `user_videos`
4. If missing, run the migration

### Check Authentication State

1. Open Browser Console
2. Run: `localStorage.getItem('sb-auth-token')`
3. Should return a token string if logged in
4. Check: `supabase.auth.getSession()` in console

## Next Steps

1. **Run Database Migration:**
   - Copy contents of `supabase/migrations/002_user_media_tables.sql`
   - Paste in Supabase SQL Editor
   - Click "Run"

2. **Test Image/Video Generation:**
   - Sign in
   - Generate an image
   - Check console for save logs
   - Visit `/my-images` to verify

3. **Test Session Persistence:**
   - Sign in
   - Open new tab with `localhost:3000`
   - Should be automatically logged in

## Still Having Issues?

Check the browser console for:
- ❌ Red error messages
- ⚠️ Yellow warning messages
- 💾 Save operation logs
- ✅ Success confirmations

Share the console output for further debugging.

