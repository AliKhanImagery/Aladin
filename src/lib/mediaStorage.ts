/**
 * Media Storage Service
 * 
 * Industry-standard media storage service for Supabase Storage
 * Handles downloading from external URLs, uploading to Supabase Storage,
 * and graceful error handling for all edge cases.
 */

import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

/**
 * Get a Supabase client for server-side operations.
 * 
 * Strategy:
 * 1. If accessToken is provided, use it with the ANON key. This allows RLS policies 
 *    (auth.uid() = user_id) to work correctly.
 * 2. If no accessToken, try to use the SERVICE_ROLE_KEY (bypasses RLS).
 * 3. Final fallback: use the ANON key (RLS will likely block operations unless they are public).
 */
export async function getServerSupabaseClient(accessToken?: string) {
  if (typeof window === 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
    
    // CASE 1: Use User's Access Token (RLS Compliance)
    if (accessToken) {
      console.log('🔐 getServerSupabaseClient: Creating client with user access token')
      
      // Create a client with the user's token
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
      
      // We also need to explicitly set the session so Supabase internals 
      // (like storage and RLS) correctly identify the user.
      try {
        // Try to get the user first to make sure the token is valid
        const { data: { user }, error: userError } = await client.auth.getUser(accessToken)
        
        if (user && !userError) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: '',
          })
          
          if (!sessionError) {
            return client
          }
          console.warn('⚠️ getServerSupabaseClient: setSession failed:', sessionError.message)
        } else {
          console.warn('⚠️ getServerSupabaseClient: getUser failed with token:', userError?.message)
        }
      } catch (e: any) {
        console.warn('⚠️ getServerSupabaseClient: Exception during session setup:', e.message)
      }
      
      // Fallback within Case 1: If session setup failed but we have a token, 
      // the headers might still work for some operations.
      return client
    }
    
    // CASE 2: Use Service Role Key (Admin Access)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🛡️ getServerSupabaseClient: Using SERVICE_ROLE_KEY')
      return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    }
    
    // CASE 3: Fallback to Anon Key (Limited Access)
    console.warn('⚠️ getServerSupabaseClient: Falling back to ANON_KEY (no token, no service key)')
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  
  // Client-side fallback
  return supabase
}

export interface MediaUploadResult {
  success: boolean
  storagePath?: string
  publicUrl?: string
  bucket?: string
  error?: string
  errorCode?: string
}

export interface MediaDownloadResult {
  success: boolean
  buffer?: ArrayBuffer
  contentType?: string
  size?: number
  error?: string
  errorCode?: string
}

export interface MediaValidationResult {
  isValid: boolean
  error?: string
  size?: number
  type?: string
}

// Storage buckets configuration - Industry Standard Organization
// All user-generated media goes to 'user-media' bucket, organized by type
const STORAGE_BUCKETS = {
  IMAGES: 'user-media',      // Generated images
  VIDEOS: 'user-media',      // Generated videos
  THUMBNAILS: 'user-media',  // Video thumbnails
  AVATARS: 'avatars',        // User profile pictures
  ASSETS: 'assets',          // User-uploaded assets (characters/products/locations)
} as const

// Fallback bucket if primary fails
const FALLBACK_BUCKET = 'user-media'

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  THUMBNAIL: 5 * 1024 * 1024, // 5MB
} as const

// Allowed MIME types
const ALLOWED_TYPES = {
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  THUMBNAIL: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
} as const

/**
 * Validate file before upload
 */
export function validateMediaFile(
  file: File | ArrayBuffer,
  type: 'image' | 'video' | 'thumbnail'
): MediaValidationResult {
  try {
    let size: number
    let mimeType: string | undefined

    if (file instanceof File) {
      size = file.size
      mimeType = file.type
    } else {
      size = file.byteLength
      // Cannot determine MIME type from ArrayBuffer, will be inferred from extension
    }

    const maxSize = type === 'image' || type === 'thumbnail'
      ? MAX_FILE_SIZES.IMAGE
      : MAX_FILE_SIZES.VIDEO

    const allowedTypes: readonly string[] = type === 'image' || type === 'thumbnail'
      ? ALLOWED_TYPES.IMAGE
      : ALLOWED_TYPES.VIDEO

    if (size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
        size,
      }
    }

    if (mimeType && !allowedTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        type: mimeType,
        size,
      }
    }

    return {
      isValid: true,
      size,
      type: mimeType,
    }
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Validation error',
    }
  }
}

/**
 * Download file from external URL with retry logic
 */
export async function downloadMediaFromUrl(
  url: string,
  maxRetries: number = 3
): Promise<MediaDownloadResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📥 Downloading media from URL (attempt ${attempt}/${maxRetries}):`, url.substring(0, 100))

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'File not found at source URL',
            errorCode: 'FILE_NOT_FOUND',
          }
        }

        if (response.status >= 500 && attempt < maxRetries) {
          console.warn(`⚠️ Server error (${response.status}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          errorCode: `HTTP_${response.status}`,
        }
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const contentLength = response.headers.get('content-length')
      const buffer = await response.arrayBuffer()
      const size = buffer.byteLength

      console.log(`✅ Downloaded media:`, {
        url: url.substring(0, 100),
        size: `${(size / 1024 / 1024).toFixed(2)}MB`,
        contentType,
        attempt,
      })

      return {
        success: true,
        buffer,
        contentType,
        size: contentLength ? parseInt(contentLength, 10) : size,
      }
    } catch (error: any) {
      console.error(`❌ Download attempt ${attempt} failed:`, error.message)

      if (attempt === maxRetries) {
        // Check for specific error types
        if (error.message?.includes('fetch failed') || error.message?.includes('network')) {
          return {
            success: false,
            error: 'Network error: Unable to download file',
            errorCode: 'NETWORK_ERROR',
          }
        }

        if (error.message?.includes('timeout')) {
          return {
            success: false,
            error: 'Download timeout: File took too long to download',
            errorCode: 'TIMEOUT',
          }
        }

        return {
          success: false,
          error: error.message || 'Unknown download error',
          errorCode: 'UNKNOWN_ERROR',
        }
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }

  return {
    success: false,
    error: 'Download failed after all retries',
    errorCode: 'MAX_RETRIES_EXCEEDED',
  }
}

/**
 * Check if bucket exists and is accessible
 */
async function checkBucketExists(bucket: string): Promise<boolean> {
  try {
    const client = await getServerSupabaseClient()
    const { data, error } = await client.storage.from(bucket).list('', { limit: 1 })
    // If we can list (even empty), bucket exists
    return !error
  } catch {
    return false
  }
}

/**
 * Upload media file to Supabase Storage
 * Industry standard: Organizes files by user ID and type
 * Structure: {type}s/{userId}/{timestamp}-{filename}
 */
export async function uploadMediaToStorage(
  file: File | ArrayBuffer,
  userId: string,
  type: 'image' | 'video' | 'thumbnail',
  metadata?: {
    projectId?: string
    clipId?: string
    filename?: string
    contentType?: string
    accessToken?: string  // User's access token for RLS policy compliance
  }
): Promise<MediaUploadResult> {
  try {
    // Validate file
    const validation = validateMediaFile(file, type)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'File validation failed',
        errorCode: 'VALIDATION_ERROR',
      }
    }

    // Determine bucket with fallback strategy
    let bucket = STORAGE_BUCKETS[type === 'image' || type === 'thumbnail' ? 'IMAGES' : 'VIDEOS']
    
    // Verify bucket exists before upload
    const bucketExists = await checkBucketExists(bucket)
    if (!bucketExists) {
      console.warn(`⚠️ Primary bucket "${bucket}" not found, trying fallback...`)
      const fallbackExists = await checkBucketExists(FALLBACK_BUCKET)
      if (fallbackExists) {
        bucket = FALLBACK_BUCKET
        console.log(`✅ Using fallback bucket: ${bucket}`)
      } else {
        return {
          success: false,
          error: `Storage bucket "${bucket}" not found. Please create it in Supabase Dashboard → Storage`,
          errorCode: 'BUCKET_NOT_FOUND',
        }
      }
    }

    // Generate file path: {type}s/{userId}/{timestamp}-{filename}
    // Industry standard structure for organization
    const timestamp = Date.now()
    const extension = determineFileExtension(file, metadata?.contentType)
    const filename = metadata?.filename
      ? `${timestamp}-${sanitizeFilename(metadata.filename)}`
      : `${timestamp}.${extension}`
    const storagePath = `${type}s/${userId}/${filename}`

    console.log(`📤 Uploading media to storage:`, {
      bucket,
      path: storagePath,
      size: validation.size,
      type: validation.type || metadata?.contentType,
    })

    // Convert ArrayBuffer to Blob if needed
    let blob: Blob
    if (file instanceof File) {
      blob = file
    } else {
      const contentType = metadata?.contentType || `application/${extension}`
      blob = new Blob([file], { type: contentType })
    }

    // Upload to Supabase Storage
    // Industry Standard: Use user's access token to respect RLS policies
    // This ensures auth.uid() is available in RLS policy checks
    const client = await getServerSupabaseClient(metadata?.accessToken)
    const { data, error } = await client.storage
      .from(bucket)
      .upload(storagePath, blob, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
        contentType: blob.type,
      })

    if (error) {
      // Handle specific Supabase storage errors
      if (error.message?.includes('already exists')) {
        console.warn(`⚠️ File already exists, using existing: ${storagePath}`)
        // Continue to get public URL even if file exists
      } else {
        console.error('❌ Supabase storage upload error:', error)
        return {
          success: false,
          error: `Storage upload failed: ${error.message}`,
          errorCode: 'STORAGE_UPLOAD_ERROR',
        }
      }
    }

    // Get public URL (reuse existing client)
    const { data: urlData } = client.storage
      .from(bucket)
      .getPublicUrl(storagePath)

    console.log(`✅ Media uploaded successfully:`, {
      path: storagePath,
      url: urlData.publicUrl.substring(0, 100) + '...',
    })

    return {
      success: true,
      storagePath,
      publicUrl: urlData.publicUrl,
      bucket,
    }
  } catch (error: any) {
    console.error('❌ Exception in uploadMediaToStorage:', error)
    return {
      success: false,
      error: error.message || 'Unknown upload error',
      errorCode: 'UNKNOWN_ERROR',
    }
  }
}

/**
 * Download from external URL and upload to Supabase Storage in one operation
 */
export async function downloadAndStoreMedia(
  externalUrl: string,
  userId: string,
  type: 'image' | 'video' | 'thumbnail',
  metadata?: {
    projectId?: string
    clipId?: string
    filename?: string
    contentType?: string
    accessToken?: string  // User's access token for RLS policy compliance
  }
): Promise<MediaUploadResult> {
  try {
    // Step 1: Download from external URL
    const downloadResult = await downloadMediaFromUrl(externalUrl)

    if (!downloadResult.success || !downloadResult.buffer) {
      return {
        success: false,
        error: downloadResult.error || 'Download failed',
        errorCode: downloadResult.errorCode || 'DOWNLOAD_ERROR',
      }
    }

    // Step 2: Upload to Supabase Storage
    // Pass access token through to ensure RLS policies work correctly
    const uploadResult = await uploadMediaToStorage(
      downloadResult.buffer,
      userId,
      type,
      {
        ...metadata,
        contentType: downloadResult.contentType,
        accessToken: metadata?.accessToken,  // Pass through access token
      }
    )

    return uploadResult
  } catch (error: any) {
    console.error('❌ Exception in downloadAndStoreMedia:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
      errorCode: 'UNKNOWN_ERROR',
    }
  }
}

/**
 * Delete media from Supabase Storage
 */
export async function deleteMediaFromStorage(
  storagePath: string,
  bucket: string = STORAGE_BUCKETS.IMAGES
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!storagePath) {
      return { success: false, error: 'Storage path is required' }
    }

    console.log(`🗑️ Deleting media from storage:`, { bucket, path: storagePath })

    const client = await getServerSupabaseClient()
    const { error } = await client.storage
      .from(bucket)
      .remove([storagePath])

    if (error) {
      // Don't fail if file doesn't exist (already deleted)
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        console.warn(`⚠️ File already deleted or not found: ${storagePath}`)
        return { success: true } // Consider this a success
      }

      console.error('❌ Error deleting media:', error)
      return {
        success: false,
        error: `Failed to delete: ${error.message}`,
      }
    }

    console.log(`✅ Media deleted successfully: ${storagePath}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Exception in deleteMediaFromStorage:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Check if file exists in storage (for validation)
 */
export async function checkMediaExists(
  storagePath: string,
  bucket: string = STORAGE_BUCKETS.IMAGES
): Promise<{ exists: boolean; error?: string }> {
  try {
    if (!storagePath) {
      return { exists: false, error: 'Storage path is required' }
    }

    const client = await getServerSupabaseClient()
    const { data, error } = await client.storage
      .from(bucket)
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        limit: 1000,
        search: storagePath.split('/').pop() || '',
      })

    if (error) {
      console.warn(`⚠️ Error checking file existence: ${error.message}`)
      return { exists: false, error: error.message }
    }

    const filename = storagePath.split('/').pop()
    const exists = data?.some(file => file.name === filename) || false

    return { exists }
  } catch (error: any) {
    console.error('❌ Exception in checkMediaExists:', error)
    return {
      exists: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Get public URL for a storage path (with fallback validation)
 */
export async function getMediaPublicUrl(
  storagePath: string,
  bucket: string = STORAGE_BUCKETS.IMAGES
): Promise<string> {
  if (!storagePath) {
    console.warn('⚠️ No storage path provided for public URL')
    return ''
  }

  const client = await getServerSupabaseClient()
  const { data } = client.storage
    .from(bucket)
    .getPublicUrl(storagePath)

  return data.publicUrl
}

/**
 * Helper: Determine file extension from file or content type
 */
function determineFileExtension(
  file: File | ArrayBuffer,
  contentType?: string
): string {
  if (file instanceof File) {
    const ext = file.name.split('.').pop()
    if (ext) return ext
  }

  // Infer from content type
  if (contentType) {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
    if (contentType.includes('png')) return 'png'
    if (contentType.includes('webp')) return 'webp'
    if (contentType.includes('mp4')) return 'mp4'
    if (contentType.includes('webm')) return 'webm'
    if (contentType.includes('quicktime')) return 'mov'
  }

  // Default based on common types
  return 'jpg'
}

/**
 * Helper: Sanitize filename for storage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100) // Limit length
}

