# Supabase Storage Buckets Setup Guide

## Required Buckets

Your application requires **3 storage buckets** to be created in Supabase:

### 1. `user-media` (Primary - Required)
- **Purpose**: Stores all generated images, videos, and thumbnails
- **Public**: ✅ Yes (must be public)
- **Used by**: Image/video generation, media storage

### 2. `avatars` (Required)
- **Purpose**: Stores user profile avatars
- **Public**: ✅ Yes (must be public)
- **Used by**: User profile pictures, asset upload fallback

### 3. `assets` (Optional but Recommended)
- **Purpose**: Stores user-uploaded assets (character/product/location references)
- **Public**: ✅ Yes (must be public)
- **Used by**: Asset uploads in IdeaAnalysisScreen
- **Note**: Falls back to `avatars` if not found, but `assets` is preferred

## Quick Setup Steps

### Step 1: Create Buckets in Supabase Dashboard

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket** for each bucket below:

#### Create `user-media` bucket:
- **Name**: `user-media` (exactly this, lowercase with hyphen)
- **Public bucket**: ✅ **Enable** (check this box - CRITICAL)
- Click **Create bucket**

#### Create `avatars` bucket:
- **Name**: `avatars` (exactly this, lowercase)
- **Public bucket**: ✅ **Enable** (check this box - CRITICAL)
- Click **Create bucket**

#### Create `assets` bucket (Recommended):
- **Name**: `assets` (exactly this, lowercase)
- **Public bucket**: ✅ **Enable** (check this box - CRITICAL)
- Click **Create bucket**

### Step 2: Set RLS Policies (Recommended for Security)

Run this SQL in your **Supabase SQL Editor** to set up Row Level Security policies:

```sql
-- ============================================
-- RLS Policies for 'user-media' bucket
-- ============================================

-- Allow authenticated users to upload their own media
CREATE POLICY "Users can upload own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-media' 
  AND (
    (storage.foldername(name))[1] = 'images' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'videos' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'thumbnails' 
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Allow public read access to media
CREATE POLICY "Public can view media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-media');

-- Allow users to update their own media
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-media' 
  AND (
    (storage.foldername(name))[1] = 'images' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'videos' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'thumbnails' 
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Allow users to delete their own media
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-media' 
  AND (
    (storage.foldername(name))[1] = 'images' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'videos' 
    AND (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'thumbnails' 
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- ============================================
-- RLS Policies for 'avatars' bucket
-- ============================================

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- RLS Policies for 'assets' bucket
-- ============================================

-- Allow authenticated users to upload their own assets
CREATE POLICY "Users can upload own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to assets
CREATE POLICY "Public can view assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'assets');

-- Allow users to update their own assets
CREATE POLICY "Users can update own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own assets
CREATE POLICY "Users can delete own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 3: Verify Buckets Exist

After creating the buckets, verify they exist:

1. Go to **Storage** in Supabase Dashboard
2. You should see all three buckets listed:
   - ✅ `user-media`
   - ✅ `avatars`
   - ✅ `assets`

## Troubleshooting

### Error: "Bucket not found"

**Solution**: 
1. Check that the bucket name is **exactly** as specified (case-sensitive, no typos)
2. Verify the bucket exists in your Supabase Dashboard → Storage
3. Make sure the bucket is **Public** (not private)
4. Refresh your browser after creating buckets

### Error: "Permission denied" or "Access denied"

**Solution**:
1. Ensure the bucket is set to **Public** in bucket settings
2. Run the RLS policies SQL above
3. Check that your user is authenticated

### Which bucket is missing?

Check the browser console for the exact error message. It will tell you which bucket is missing:
- `user-media` → Used for storing generated images/videos
- `avatars` → Used for user profile pictures
- `assets` → Used for asset uploads (has fallback to avatars)

## Quick Fix: Create All Buckets at Once

If you want to create all buckets quickly:

1. Go to Supabase Dashboard → Storage
2. Create each bucket with these exact settings:
   - **user-media**: Public ✅
   - **avatars**: Public ✅
   - **assets**: Public ✅

That's it! The app will work once all three buckets exist and are public.

