-- Migration: Add storage paths to media tables
-- This allows tracking both external URLs (temporary) and permanent Supabase Storage paths

-- Add storage_path field to user_images
ALTER TABLE public.user_images 
ADD COLUMN IF NOT EXISTS storage_path TEXT, -- Path in Supabase Storage (e.g., "images/user_id/filename.jpg")
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'user-media'; -- Bucket name

-- Add storage_path field to user_videos
ALTER TABLE public.user_videos
ADD COLUMN IF NOT EXISTS storage_path TEXT, -- Path in Supabase Storage (e.g., "videos/user_id/filename.mp4")
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'user-media'; -- Bucket name

-- Add index on storage_path for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_images_storage_path ON public.user_images(storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_videos_storage_path ON public.user_videos(storage_path) WHERE storage_path IS NOT NULL;

-- Add index on storage_bucket
CREATE INDEX IF NOT EXISTS idx_user_images_storage_bucket ON public.user_images(storage_bucket);
CREATE INDEX IF NOT EXISTS idx_user_videos_storage_bucket ON public.user_videos(storage_bucket);

