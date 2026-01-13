-- Migration: Verify storage_path and storage_bucket columns exist
-- This ensures the database schema supports the storage architecture

-- Verify and add storage_path to user_images if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_images' 
    AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.user_images 
    ADD COLUMN storage_path TEXT;
    RAISE NOTICE 'Added storage_path column to user_images';
  ELSE
    RAISE NOTICE 'storage_path column already exists in user_images';
  END IF;
END $$;

-- Verify and add storage_bucket to user_images if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_images' 
    AND column_name = 'storage_bucket'
  ) THEN
    ALTER TABLE public.user_images 
    ADD COLUMN storage_bucket TEXT DEFAULT 'user-media';
    RAISE NOTICE 'Added storage_bucket column to user_images';
  ELSE
    RAISE NOTICE 'storage_bucket column already exists in user_images';
  END IF;
END $$;

-- Verify and add storage_path to user_videos if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_videos' 
    AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.user_videos 
    ADD COLUMN storage_path TEXT;
    RAISE NOTICE 'Added storage_path column to user_videos';
  ELSE
    RAISE NOTICE 'storage_path column already exists in user_videos';
  END IF;
END $$;

-- Verify and add storage_bucket to user_videos if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_videos' 
    AND column_name = 'storage_bucket'
  ) THEN
    ALTER TABLE public.user_videos 
    ADD COLUMN storage_bucket TEXT DEFAULT 'user-media';
    RAISE NOTICE 'Added storage_bucket column to user_videos';
  ELSE
    RAISE NOTICE 'storage_bucket column already exists in user_videos';
  END IF;
END $$;

-- Create indexes if they don't exist (for performance)
CREATE INDEX IF NOT EXISTS idx_user_images_storage_path 
  ON public.user_images(storage_path) 
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_images_storage_bucket 
  ON public.user_images(storage_bucket);

CREATE INDEX IF NOT EXISTS idx_user_videos_storage_path 
  ON public.user_videos(storage_path) 
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_videos_storage_bucket 
  ON public.user_videos(storage_bucket);

