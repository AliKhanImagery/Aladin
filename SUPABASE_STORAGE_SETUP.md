# Supabase Storage Setup for User Media

## Overview

The application now stores all user-generated media (images and videos) permanently in Supabase Storage. This prevents data loss when external URLs (like Fal AI's 7-day hosting) expire.

## Architecture

### Storage Structure
```
user-media/
├── images/
│   └── {userId}/
│       └── {timestamp}-{filename}.jpg
├── videos/
│   └── {userId}/
│       └── {timestamp}-{filename}.mp4
└── thumbnails/
    └── {userId}/
        └── {timestamp}-{filename}.jpg
```

### Database Schema
The `user_images` and `user_videos` tables now include:
- `storage_path`: Path in Supabase Storage (e.g., `"images/user_id/filename.jpg"`)
- `storage_bucket`: Bucket name (default: `"user-media"`)
- `image_url`/`video_url`: Public URL (now points to Supabase Storage after migration)

## Setup Steps

### 1. Create Storage Buckets

Your application requires **3 storage buckets**. Create each one:

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket** for each bucket below:

#### Bucket 1: `user-media` (Primary - Required)
- **Name**: `user-media` (must be exactly this, lowercase with hyphen)
- **Public bucket**: ✅ Enable (check this box - CRITICAL)
- Click **Create bucket**

#### Bucket 2: `avatars` (Required)
- **Name**: `avatars` (must be exactly this, lowercase)
- **Public bucket**: ✅ Enable (check this box - CRITICAL)
   - Click **Create bucket**

#### Bucket 3: `assets` (Optional but Recommended)
- **Name**: `assets` (must be exactly this, lowercase)
- **Public bucket**: ✅ Enable (check this box - CRITICAL)
- Click **Create bucket**
- **Note**: If this bucket doesn't exist, the app will fallback to `avatars` for asset uploads

### 2. Set RLS Policies (Recommended)

Run this SQL in your Supabase SQL Editor to set up security policies for all buckets:

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

### 3. Run Database Migration

Run the migration to add storage path fields:

```sql
-- Migration: Add storage paths to media tables
-- File: supabase/migrations/003_add_storage_paths.sql
```

You can copy the SQL from `supabase/migrations/003_add_storage_paths.sql` and run it in the Supabase SQL Editor.

## How It Works

### Automatic Storage

When images/videos are generated:
1. The media is generated via Fal AI or OpenAI (returns temporary URL)
2. The app automatically downloads the file from the external URL
3. The file is uploaded to Supabase Storage under the user's folder
4. The database record stores both:
   - `image_url`/`video_url`: Public Supabase Storage URL (permanent)
   - `storage_path`: Path in storage for programmatic access

### Error Handling

The system gracefully handles:
- **Missing files**: Falls back to original URL if storage file not found
- **Download failures**: Logs error but doesn't crash the app
- **Storage errors**: Continues with external URL if storage upload fails
- **Network issues**: Retries with exponential backoff

### Manual Migration

To migrate existing media from external URLs to Supabase Storage:

```typescript
// Use the API endpoint to migrate existing media
const response = await fetch('/api/store-media', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    externalUrl: 'https://fal.ai/files/...', // Old Fal AI URL
    type: 'image', // or 'video' or 'thumbnail'
    projectId: '...',
    clipId: '...',
  }),
})
```

## Configuration

### File Size Limits

- Images: 10MB max
- Videos: 100MB max
- Thumbnails: 5MB max

### Allowed File Types

- Images: JPEG, PNG, WebP
- Videos: MP4, WebM, QuickTime

## Troubleshooting

### Error: "Bucket not found"
- **Check which bucket is missing**: The error message will tell you which bucket (`user-media`, `avatars`, or `assets`)
- **Create the missing bucket(s)**:
  - Go to Supabase Dashboard → Storage
  - Create bucket with exact name (case-sensitive):
    - `user-media` (lowercase, with hyphen) - **Required**
    - `avatars` (lowercase) - **Required**
    - `assets` (lowercase) - **Recommended** (falls back to `avatars` if missing)
  - Make sure **Public bucket** is enabled (checked) for all buckets
- **Refresh the app** after creating buckets
- See `BUCKET_SETUP_GUIDE.md` for detailed instructions

### Error: "Permission denied"
- Ensure the bucket is set to **Public**, OR
- Set up the RLS policies as shown above

### Error: "Upload failed"
- Check file size (must be under limits)
- Check file type (must be in allowed types)
- Check browser console for detailed error messages

### Files not appearing after upload
- Check Supabase Storage dashboard to verify files exist
- Verify RLS policies allow public read access
- Check that `storage_path` is correctly saved in database

### Migration issues
- Old media with external URLs will continue to work
- New media is automatically stored
- Use `/api/store-media` endpoint to migrate old media manually
