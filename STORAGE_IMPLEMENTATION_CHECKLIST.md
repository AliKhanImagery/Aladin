# Supabase Storage Implementation - Testing Checklist

## ✅ Implementation Status

### Core Files Created/Updated

1. **`src/lib/mediaStorage.ts`** ✅
   - Media storage service with download/upload/delete operations
   - Error handling with retry logic
   - File validation
   - TypeScript errors: **FIXED**

2. **`src/lib/userMedia.ts`** ✅
   - Updated `saveUserImage()` to auto-store in Supabase Storage
   - Updated `saveUserVideo()` to auto-store in Supabase Storage
   - Added `getImageUrl()` and `getVideoUrl()` helpers with fallbacks
   - TypeScript errors: **FIXED**

3. **`src/app/api/store-media/route.ts`** ✅
   - API endpoint for downloading and storing media
   - Validates inputs and handles errors gracefully

4. **`supabase/migrations/003_add_storage_paths.sql`** ✅
   - Adds `storage_path` and `storage_bucket` columns
   - Creates indexes for performance

5. **`src/components/ui/MediaDisplay.tsx`** ✅
   - React component for displaying media with error handling
   - Shows placeholders for missing files

6. **Integration Points Updated** ✅
   - `src/components/ClipDetailDrawer.tsx` - All image saves use `storeExternally: true`
   - `src/components/tabs/IdeaTab.tsx` - Image generation stores automatically
   - `src/components/tabs/TimelineTab.tsx` - Video generation stores automatically

## 🧪 Testing Checklist

### Prerequisites
- [ ] Supabase Storage bucket `user-media` created and set to public
- [ ] Database migration `003_add_storage_paths.sql` executed
- [ ] Environment variables configured (Supabase keys)

### Test Scenarios

#### 1. Image Generation & Storage
- [ ] Generate image using OpenAI DALL-E
  - Expected: Image saved to database AND Supabase Storage
  - Check: Database record has `storage_path` and `storage_bucket`
  - Check: File exists in Supabase Storage at path `images/{userId}/{timestamp}.jpg`
  - Check: `image_url` points to Supabase Storage URL

- [ ] Generate image using Fal AI Vidu
  - Same checks as above

- [ ] Generate image using Fal AI Reve Remix
  - Same checks as above

- [ ] Generate image using Fal AI Nano Banana
  - Same checks as above

#### 2. Video Generation & Storage
- [ ] Generate video using Fal AI Vidu
  - Expected: Video saved to database AND Supabase Storage
  - Check: Database record has `storage_path` and `storage_bucket`
  - Check: File exists in Supabase Storage at path `videos/{userId}/{timestamp}.mp4`
  - Check: `video_url` points to Supabase Storage URL
  - Check: Thumbnail also stored if provided

- [ ] Generate video using Fal AI Kling
  - Same checks as above

#### 3. Error Handling
- [ ] Test with missing Supabase Storage bucket
  - Expected: App doesn't crash, uses original external URL
  - Check: Console shows warning but operation continues

- [ ] Test with network failure during download
  - Expected: Retries up to 3 times, then falls back gracefully
  - Check: Error logged but app continues

- [ ] Test with invalid file URL
  - Expected: Error message shown, no crash
  - Check: User-friendly error displayed

- [ ] Test with file too large
  - Expected: Validation error before upload
  - Check: Error message indicates file size limit

#### 4. Legacy Media (External URLs)
- [ ] Load project with old external URLs (Fal AI URLs)
  - Expected: Media still displays using external URL
  - Check: No errors in console
  - Check: Images/videos load correctly

- [ ] Generate new media in project with old media
  - Expected: New media stored in Supabase, old media still works
  - Check: Both types coexist without issues

#### 5. Missing Files
- [ ] Try to load image that doesn't exist in storage
  - Expected: Falls back to `image_url`, or shows placeholder
  - Check: MediaDisplay component shows error state gracefully

- [ ] Try to load video that doesn't exist in storage
  - Expected: Falls back to `video_url`, or shows placeholder
  - Check: MediaDisplay component shows error state gracefully

#### 6. Bulk Generation (Idea Tab)
- [ ] Generate story with multiple clips that auto-generate images
  - Expected: All images automatically stored in Supabase Storage
  - Check: All clips have valid `storage_path` in database
  - Check: All files exist in Supabase Storage

#### 7. Timeline Tab Video Generation
- [ ] Generate videos for multiple clips from timeline
  - Expected: All videos automatically stored in Supabase Storage
  - Check: All clips have valid `storage_path` in database
  - Check: All files exist in Supabase Storage

## 🔍 Verification Commands

### Check Database Records
```sql
-- Check if storage_path is being saved
SELECT id, image_url, storage_path, storage_bucket, created_at 
FROM user_images 
ORDER BY created_at DESC 
LIMIT 10;

SELECT id, video_url, storage_path, storage_bucket, created_at 
FROM user_videos 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Supabase Storage
1. Go to Supabase Dashboard → Storage → `user-media` bucket
2. Navigate to `images/{userId}/` or `videos/{userId}/`
3. Verify files exist and are accessible

### Check Console Logs
Look for these log messages:
- ✅ `✅ Image stored in Supabase Storage: images/{userId}/...`
- ✅ `✅ Video stored in Supabase Storage: videos/{userId}/...`
- ⚠️ `⚠️ Failed to store image in Supabase Storage, using original URL` (if storage fails)

## 🐛 Common Issues & Solutions

### Issue: "Bucket not found"
**Solution**: Create bucket named exactly `user-media` in Supabase Storage dashboard

### Issue: "Permission denied"
**Solution**: 
- Make bucket public, OR
- Set up RLS policies (see `SUPABASE_STORAGE_SETUP.md`)

### Issue: Files not appearing in storage
**Check**:
1. User is authenticated
2. Bucket exists and is accessible
3. Check browser console for errors
4. Verify `storage_path` in database matches actual file path

### Issue: TypeScript errors
**Status**: ✅ All fixed
- Added `contentType` to metadata type
- Fixed type inference for `allowedTypes`

## 📝 Next Steps After Testing

1. If all tests pass: Implementation is complete ✅
2. If issues found: 
   - Check console logs for specific errors
   - Verify Supabase Storage setup
   - Check database migration was applied
   - Review error handling in `mediaStorage.ts`

## 🎯 Success Criteria

✅ Images automatically stored in Supabase Storage when generated  
✅ Videos automatically stored in Supabase Storage when generated  
✅ Database records include `storage_path` and `storage_bucket`  
✅ App doesn't crash if storage fails (graceful degradation)  
✅ Legacy external URLs still work  
✅ Missing files show graceful error states  

