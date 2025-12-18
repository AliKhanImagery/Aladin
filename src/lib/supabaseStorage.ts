import { supabase } from './supabase'

/**
 * Upload avatar image to Supabase Storage
 * @param file - Image file to upload
 * @param userId - User ID for file path
 * @returns Public URL of uploaded file
 */
export async function uploadAvatarToSupabase(file: File, userId: string): Promise<string> {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPG, PNG, or WebP image.')
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.')
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    // Upload to Supabase Storage bucket 'avatars'
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      throw new Error(`Failed to upload avatar: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    throw error
  }
}

/**
 * Delete avatar from Supabase Storage
 * @param filePath - Path to file in storage (e.g., "userId/filename.jpg")
 */
export async function deleteAvatarFromSupabase(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath])

    if (error) {
      console.error('Failed to delete avatar:', error)
      // Don't throw - deletion failure is not critical
    }
  } catch (error) {
    console.error('Avatar deletion error:', error)
  }
}