-- Create user_images table to store all user image generations
CREATE TABLE IF NOT EXISTS public.user_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL, -- Fal AI or other hosting URL
  prompt TEXT, -- Original generation prompt
  model TEXT, -- Which model was used (openai, fal-ai, nano-banana, remix)
  aspect_ratio TEXT, -- 16:9, 9:16, 1:1
  project_id UUID, -- Optional: link to project (if stored in projects table)
  clip_id TEXT, -- Optional: link to specific clip
  metadata JSONB DEFAULT '{}', -- Additional metadata (size, dimensions, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_videos table to store all user video generations
CREATE TABLE IF NOT EXISTS public.user_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL, -- Fal AI or other hosting URL
  prompt TEXT, -- Original generation prompt
  model TEXT, -- Which model was used (kling, vidu, etc.)
  duration INTEGER, -- Video duration in seconds
  aspect_ratio TEXT, -- 16:9, 9:16, 1:1
  project_id UUID, -- Optional: link to project (if stored in projects table)
  clip_id TEXT, -- Optional: link to specific clip
  thumbnail_url TEXT, -- Optional: video thumbnail
  metadata JSONB DEFAULT '{}', -- Additional metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_images_user_id ON public.user_images(user_id);
CREATE INDEX IF NOT EXISTS idx_user_images_created_at ON public.user_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_images_project_id ON public.user_images(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_videos_user_id ON public.user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_created_at ON public.user_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_videos_project_id ON public.user_videos(project_id) WHERE project_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.user_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_images
-- Users can view their own images
CREATE POLICY "Users can view own images"
  ON public.user_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own images
CREATE POLICY "Users can insert own images"
  ON public.user_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own images
CREATE POLICY "Users can update own images"
  ON public.user_images
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own images
CREATE POLICY "Users can delete own images"
  ON public.user_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_videos
-- Users can view their own videos
CREATE POLICY "Users can view own videos"
  ON public.user_videos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own videos
CREATE POLICY "Users can insert own videos"
  ON public.user_videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own videos
CREATE POLICY "Users can update own videos"
  ON public.user_videos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own videos
CREATE POLICY "Users can delete own videos"
  ON public.user_videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at
CREATE TRIGGER update_user_images_updated_at
  BEFORE UPDATE ON public.user_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_videos_updated_at
  BEFORE UPDATE ON public.user_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

