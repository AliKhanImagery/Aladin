-- Create user_images table
CREATE TABLE IF NOT EXISTS user_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  clip_id UUID, -- References a clip, but not a foreign key constraint to avoid circular dependencies
  image_url TEXT NOT NULL,
  prompt TEXT,
  model TEXT,
  aspect_ratio TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for user_images
ALTER TABLE user_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own images
CREATE POLICY "Allow authenticated users to insert images" ON user_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view their own images
CREATE POLICY "Allow authenticated users to view images" ON user_images
  FOR SELECT USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own images
CREATE POLICY "Allow authenticated users to delete images" ON user_images
  FOR DELETE USING (auth.uid() = user_id);

-- Create user_videos table
CREATE TABLE IF NOT EXISTS user_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  clip_id UUID, -- References a clip, but not a foreign key constraint to avoid circular dependencies
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  prompt TEXT,
  model TEXT,
  aspect_ratio TEXT,
  duration INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for user_videos
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own videos
CREATE POLICY "Allow authenticated users to insert videos" ON user_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view their own videos
CREATE POLICY "Allow authenticated users to view videos" ON user_videos
  FOR SELECT USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own videos
CREATE POLICY "Allow authenticated users to delete videos" ON user_videos
  FOR DELETE USING (auth.uid() = user_id);

-- Storage buckets for user media
-- You'll need to create these buckets manually in Supabase Storage dashboard
-- Name: user-generated-images (Public)
-- Name: user-generated-videos (Public)
-- No specific RLS policies needed on buckets if RLS is managed at table level
-- or if buckets are public, but consider adding if you want more granular storage control.

-- Example RLS for a private storage bucket (if you make buckets private)
-- CREATE POLICY "User images access" ON storage.objects FOR ALL USING (bucket_id = 'user-generated-images' AND auth.uid() = (storage.foldername(name))[1]);
-- CREATE POLICY "User videos access" ON storage.objects FOR ALL USING (bucket_id = 'user-generated-videos' AND auth.uid() = (storage.foldername(name))[1]);

