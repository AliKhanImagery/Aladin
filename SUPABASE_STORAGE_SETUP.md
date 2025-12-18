# Supabase Storage Setup for Avatars

## Create the Avatars Bucket

To enable avatar uploads, you need to create a storage bucket in Supabase:

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project at [supabase.com](https://supabase.com)
   - Select your project

2. **Open Storage**
   - Click on "Storage" in the left sidebar
   - Click "New bucket" or "Create bucket"

3. **Configure the Bucket**
   - **Name**: `avatars` (must be exactly this name)
   - **Public bucket**: ✅ Enable (check this box)
   - Click "Create bucket"

4. **Set RLS Policies (Optional but Recommended)**

   If you want to restrict access, you can set up Row Level Security policies:

   ```sql
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
   ```

### Quick Setup (Public Bucket - No RLS)

If you just want to get it working quickly:
1. Create bucket named `avatars`
2. Make it **Public**
3. That's it! No RLS policies needed for public buckets.

### Verify Setup

After creating the bucket:
1. You should see `avatars` in your Storage buckets list
2. Try uploading an avatar in the app
3. Check the browser console for any errors

### Troubleshooting

**Error: "Bucket not found"**
- Make sure the bucket name is exactly `avatars` (lowercase, no spaces)
- Make sure the bucket exists in your Supabase project
- Refresh the app after creating the bucket

**Error: "Permission denied"**
- Make sure the bucket is set to Public, OR
- Set up the RLS policies as shown above

**Error: "Upload failed"**
- Check file size (max 5MB)
- Check file type (JPG, PNG, or WebP only)
- Check browser console for detailed error messages

