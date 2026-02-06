import { supabase } from './supabase'
import { downloadAndStoreMedia, getMediaPublicUrl, checkMediaExists } from './mediaStorage'

export interface SaveImageParams {
  image_url: string // Can be external URL (will be stored) or already-stored URL
  prompt?: string
  model?: string
  aspect_ratio?: string
  project_id?: string
  clip_id?: string
  metadata?: Record<string, any>
  storeExternally?: boolean // If true, download and store in Supabase Storage
}

export interface SaveVideoParams {
  video_url: string // Can be external URL (will be stored) or already-stored URL
  prompt?: string
  model?: string
  duration?: number
  aspect_ratio?: string
  project_id?: string
  clip_id?: string
  thumbnail_url?: string
  metadata?: Record<string, any>
  storeExternally?: boolean // If true, download and store in Supabase Storage
}

export interface SaveAssetParams {
  name: string
  type: 'character' | 'product' | 'location' | 'audio'
  asset_url: string
  storage_path?: string
  storage_bucket?: string
  description?: string
  prompt?: string
  project_id?: string
  metadata?: Record<string, any>
}

/**
 * Save a user asset (character, product, location)
 */
export async function saveUserAsset(params: SaveAssetParams): Promise<any> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('⚠️ saveUserAsset: No active session found')
      return null
    }

    const { data, error } = await supabase
      .from('user_assets')
      .insert({
        user_id: session.user.id,
        name: params.name,
        type: params.type,
        asset_url: params.asset_url,
        storage_path: params.storage_path || null,
        storage_bucket: params.storage_bucket || 'user-media',
        description: params.description || null,
        prompt: params.prompt || null,
        project_id: params.project_id || null,
        metadata: params.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('❌ saveUserAsset error:', error)
      return null
    }

    console.log('✅ saveUserAsset: Successfully saved asset', { assetId: data.id })
    return data
  } catch (error) {
    console.error('❌ saveUserAsset exception:', error)
    return null
  }
}

/**
 * Fetch user assets with enhanced error handling and session verification
 */
export async function getUserAssets(projectId?: string, type?: string) {
  try {
    // Strategy 1: Try getSession() first (most reliable for RLS)
    let userId: string | null = null
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (session && session.user) {
      userId = session.user.id
      console.log('✅ getUserAssets: Active session found', { userId: userId.substring(0, 8) })
    } else if (sessionError) {
      console.warn('⚠️ getUserAssets: Session error, trying fallback:', sessionError.message)
    } else {
      console.warn('⚠️ getUserAssets: No active session found, trying fallback')
    }
      
    // Strategy 2: Fallback to getUser() if session fails
    if (!userId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        console.log('✅ getUserAssets: Fallback getUser() succeeded', { userId: userId.substring(0, 8) })
      } else {
        console.error('❌ getUserAssets: All auth methods failed', {
          sessionError: sessionError?.message,
          userError: userError?.message
        })
        return []
      }
    }

    // Execute query with detailed error logging
    return await executeAssetQuery(userId, projectId, type)
  } catch (error: any) {
    console.error('❌ getUserAssets exception:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    })
    return []
  }
}

/**
 * Shared logic for executing asset queries to avoid duplication
 */
async function executeAssetQuery(userId: string, projectId?: string, type?: string) {
  console.log(`📦 Asset Bin: Synchronizing assets for user ${userId.substring(0, 8)}...`, {
    projectId: projectId || 'all projects',
    type: type || 'all types',
    timestamp: new Date().toISOString()
  })

  let query = supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (type) {
    query = query.eq('type', type)
  }

  const queryStartTime = Date.now()
  const { data, error } = await query
  const queryDuration = Date.now() - queryStartTime

  if (error) {
    console.error('❌ executeAssetQuery error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      duration: `${queryDuration}ms`,
      userId: userId.substring(0, 8),
      projectId: projectId || 'all'
    })
    
    // Provide helpful error context
    if (error.code === 'PGRST116') {
      console.error('💡 Hint: This might be an RLS (Row Level Security) issue. Check that:')
      console.error('   1. User is authenticated')
      console.error('   2. RLS policies allow SELECT on user_assets')
      console.error('   3. user_id matches auth.uid() in RLS policy')
    }
    
    return []
  }

  console.log(`✅ Asset Bin: Successfully retrieved ${data?.length || 0} assets`, {
    duration: `${queryDuration}ms`,
    userId: userId.substring(0, 8),
    projectId: projectId || 'all'
  })
  
  return data || []
}

/**
 * Delete user asset
 */
export async function deleteUserAsset(assetId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('user_assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting user asset:', error)
    throw error
  }
}

/**
 * Save a generated image to user_images table with retry logic
 */
export async function saveUserImage(params: SaveImageParams, retryAttempt = 0): Promise<any> {
  const maxRetries = 3
  const baseDelay = 1000 // 1 second base delay

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.warn('⚠️ saveUserImage: No authenticated user found')
      if (retryAttempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retryAttempt)))
        return saveUserImage(params, retryAttempt + 1)
      }
      return null
    }

    let finalImageUrl = params.image_url
    let storagePath: string | null = null
    let storageBucket: string | null = null

    // Download and store external media if needed
    if (params.storeExternally && params.image_url) {
      const isExternalUrl = !params.image_url.includes('supabase.co/storage')
      
      if (isExternalUrl) {
        try {
        const storageResult = await downloadAndStoreMedia(
          params.image_url,
          user.id,
          'image',
          {
            projectId: params.project_id,
            clipId: params.clip_id,
            contentType: 'image/jpeg',
          }
        )

        if (storageResult.success && storageResult.publicUrl) {
          finalImageUrl = storageResult.publicUrl
          storagePath = storageResult.storagePath || null
          storageBucket = storageResult.bucket || null
            console.log('✅ saveUserImage: Image stored in Supabase Storage', {
              storagePath,
              bucket: storageBucket
            })
          } else {
            console.warn('⚠️ saveUserImage: Storage failed, using original URL')
          }
        } catch (storageError: any) {
          console.warn('⚠️ saveUserImage: Storage error (continuing with original URL):', storageError?.message)
          // Continue with original URL if storage fails
        }
      }
    }

    // Insert into database with retry logic
    const { data, error } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        image_url: finalImageUrl,
        storage_path: storagePath,
        storage_bucket: storageBucket,
        prompt: params.prompt || null,
        model: params.model || null,
        aspect_ratio: params.aspect_ratio || null,
        project_id: params.project_id || null,
        clip_id: params.clip_id || null,
        metadata: params.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error(`❌ saveUserImage error (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Retry on transient errors
      if (retryAttempt < maxRetries && (
        error.code === 'PGRST301' || // Connection error
        error.code === 'PGRST116' || // RLS error (might be transient)
        error.message?.includes('timeout') ||
        error.message?.includes('network')
      )) {
        const delay = baseDelay * Math.pow(2, retryAttempt)
        console.log(`🔄 saveUserImage: Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return saveUserImage(params, retryAttempt + 1)
      }
      
      return null
    }

    // Validate that data was returned
    if (!data || !data.id) {
      console.error('❌ saveUserImage: Insert succeeded but no data returned')
      if (retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        return saveUserImage(params, retryAttempt + 1)
      }
      return null
    }

    console.log('✅ saveUserImage: Successfully saved image', {
      imageId: data.id,
      storagePath,
      bucket: storageBucket,
      attempts: retryAttempt + 1
    })

    return data
  } catch (error: any) {
    console.error(`❌ saveUserImage exception (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    })
    
    // Retry on exceptions
    if (retryAttempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryAttempt)
      console.log(`🔄 saveUserImage: Retrying after exception in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return saveUserImage(params, retryAttempt + 1)
    }
    
    return null
  }
}

/**
 * Save a generated video to user_videos table with retry logic
 */
export async function saveUserVideo(params: SaveVideoParams, retryAttempt = 0): Promise<any> {
  const maxRetries = 3
  const baseDelay = 1000 // 1 second base delay

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.warn('⚠️ saveUserVideo: No authenticated user found')
      if (retryAttempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retryAttempt)))
        return saveUserVideo(params, retryAttempt + 1)
      }
      return null
    }

    let finalVideoUrl = params.video_url
    let storagePath: string | null = null
    let storageBucket: string | null = null
    let finalThumbnailUrl = params.thumbnail_url

    // Download and store external media if needed
    if (params.storeExternally && params.video_url) {
      const isExternalUrl = !params.video_url.includes('supabase.co/storage')
      
      if (isExternalUrl) {
        try {
        const videoStorageResult = await downloadAndStoreMedia(
          params.video_url,
          user.id,
          'video',
          {
            projectId: params.project_id,
            clipId: params.clip_id,
            contentType: 'video/mp4',
          }
        )

        if (videoStorageResult.success && videoStorageResult.publicUrl) {
          finalVideoUrl = videoStorageResult.publicUrl
          storagePath = videoStorageResult.storagePath || null
          storageBucket = videoStorageResult.bucket || null
            console.log('✅ saveUserVideo: Video stored in Supabase Storage', {
              storagePath,
              bucket: storageBucket
            })
          } else {
            console.warn('⚠️ saveUserVideo: Storage failed, using original URL')
          }
        } catch (storageError: any) {
          console.warn('⚠️ saveUserVideo: Storage error (continuing with original URL):', storageError?.message)
          // Continue with original URL if storage fails
        }

        // Store thumbnail if provided
        if (params.thumbnail_url) {
          const isThumbnailExternal = !params.thumbnail_url.includes('supabase.co/storage')
          if (isThumbnailExternal) {
            try {
            const thumbnailStorageResult = await downloadAndStoreMedia(
              params.thumbnail_url,
              user.id,
              'thumbnail',
              {
                projectId: params.project_id,
                clipId: params.clip_id,
                contentType: 'image/jpeg',
              }
            )

            if (thumbnailStorageResult.success && thumbnailStorageResult.publicUrl) {
              finalThumbnailUrl = thumbnailStorageResult.publicUrl
              }
            } catch (thumbnailError: any) {
              console.warn('⚠️ saveUserVideo: Thumbnail storage error:', thumbnailError?.message)
            }
          }
        }
      }
    }

    // Insert into database with retry logic
    const { data, error } = await supabase
      .from('user_videos')
      .insert({
        user_id: user.id,
        video_url: finalVideoUrl,
        storage_path: storagePath,
        storage_bucket: storageBucket,
        prompt: params.prompt || null,
        model: params.model || null,
        duration: params.duration || null,
        aspect_ratio: params.aspect_ratio || null,
        project_id: params.project_id || null,
        clip_id: params.clip_id || null,
        thumbnail_url: finalThumbnailUrl || null,
        metadata: params.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error(`❌ saveUserVideo error (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Retry on transient errors
      if (retryAttempt < maxRetries && (
        error.code === 'PGRST301' || // Connection error
        error.code === 'PGRST116' || // RLS error (might be transient)
        error.message?.includes('timeout') ||
        error.message?.includes('network')
      )) {
        const delay = baseDelay * Math.pow(2, retryAttempt)
        console.log(`🔄 saveUserVideo: Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return saveUserVideo(params, retryAttempt + 1)
      }
      
      return null
    }

    // Validate that data was returned
    if (!data || !data.id) {
      console.error('❌ saveUserVideo: Insert succeeded but no data returned')
      if (retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        return saveUserVideo(params, retryAttempt + 1)
      }
      return null
    }

    console.log('✅ saveUserVideo: Successfully saved video', {
      videoId: data.id,
      storagePath,
      bucket: storageBucket,
      attempts: retryAttempt + 1
    })

    return data
  } catch (error: any) {
    console.error(`❌ saveUserVideo exception (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    })
    
    // Retry on exceptions
    if (retryAttempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryAttempt)
      console.log(`🔄 saveUserVideo: Retrying after exception in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return saveUserVideo(params, retryAttempt + 1)
    }
    
    return null
  }
}

/**
 * Fetch user images with enhanced error handling and session verification
 */
export async function getUserImages(projectId?: string, clipId?: string) {
  try {
    // Check session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.warn('⚠️ getUserImages: No active session found')
      return []
    }

    const userId = session.user.id
    console.log(`📸 Foundry: Synchronizing images for user ${userId.substring(0, 8)}...`)

    let query = supabase
      .from('user_images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (clipId) {
      query = query.eq('clip_id', clipId)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ getUserImages error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('❌ getUserImages exception:', error)
    return []
  }
}

/**
 * Fetch user videos with enhanced error handling and session verification
 */
export async function getUserVideos(projectId?: string, clipId?: string) {
  try {
    // Strategy 1: Try getSession() first (most reliable for RLS)
    let userId: string | null = null
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (session && session.user) {
      userId = session.user.id
      console.log('✅ getUserVideos: Active session found', { userId: userId.substring(0, 8) })
    } else if (sessionError) {
      console.warn('⚠️ getUserVideos: Session error, trying fallback:', sessionError.message)
    } else {
      console.warn('⚠️ getUserVideos: No active session found, trying fallback')
    }
      
    // Strategy 2: Fallback to getUser() if session fails
    if (!userId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        console.log('✅ getUserVideos: Fallback getUser() succeeded', { userId: userId.substring(0, 8) })
      } else {
        console.error('❌ getUserVideos: All auth methods failed', {
          sessionError: sessionError?.message,
          userError: userError?.message
        })
        return []
      }
    }

    // Strategy 3: Refresh session if we have userId but no session (helps with RLS)
    if (userId && !session) {
      console.log('🔄 getUserVideos: Refreshing session for RLS compatibility...')
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.warn('⚠️ getUserVideos: Session refresh failed, proceeding anyway:', refreshError.message)
      } else if (refreshedSession) {
        console.log('✅ getUserVideos: Session refreshed successfully')
    }
    }

    // Execute query with detailed error logging
    return await executeVideoQuery(userId, projectId, clipId)
  } catch (error: any) {
    console.error('❌ getUserVideos exception:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    })
    return []
  }
}

/**
 * Fetch user audio assets
 */
export async function getUserAudio(projectId?: string) {
  try {
    // Check session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.warn('⚠️ getUserAudio: No active session found')
      return []
    }

    const userId = session.user.id
    console.log(`🎵 Audio Bin: Synchronizing audio for user ${userId.substring(0, 8)}...`)

    // Reuse executeAssetQuery but filter for audio
    return await executeAssetQuery(userId, projectId, 'audio')
  } catch (error: any) {
    console.error('❌ getUserAudio exception:', error)
    return []
  }
}

/**
 * Shared logic for executing video queries to avoid duplication
 */
async function executeVideoQuery(userId: string, projectId?: string, clipId?: string) {
  console.log(`🎬 Master Bin: Synchronizing sequences for user ${userId.substring(0, 8)}...`, {
    projectId: projectId || 'all projects',
    timestamp: new Date().toISOString()
  })

  let query = supabase
    .from('user_videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (clipId) {
    query = query.eq('clip_id', clipId)
  }

  const queryStartTime = Date.now()
  const { data, error } = await query
  const queryDuration = Date.now() - queryStartTime

  if (error) {
    console.error('❌ executeVideoQuery error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      duration: `${queryDuration}ms`,
      userId: userId.substring(0, 8),
      projectId: projectId || 'all'
    })
    
    // Provide helpful error context
    if (error.code === 'PGRST116') {
      console.error('💡 Hint: This might be an RLS (Row Level Security) issue. Check that:')
      console.error('   1. User is authenticated')
      console.error('   2. RLS policies allow SELECT on user_videos')
      console.error('   3. user_id matches auth.uid() in RLS policy')
    }
    
    return []
  }

  console.log(`✅ Master Bin: Successfully retrieved ${data?.length || 0} sequences`, {
    duration: `${queryDuration}ms`,
    userId: userId.substring(0, 8),
    projectId: projectId || 'all'
  })
  
  return data || []
}

/**
 * Get image URL with fallback to storage
 */
export async function getImageUrl(imageRecord: any): Promise<string | null> {
  try {
    if (!imageRecord) return null

    if (imageRecord.storage_path) {
      const storageUrl = await getMediaPublicUrl(
        imageRecord.storage_path,
        imageRecord.storage_bucket || 'user-media'
      )
      
      const { exists } = await checkMediaExists(
        imageRecord.storage_path,
        imageRecord.storage_bucket || 'user-media'
      )

      if (exists) return storageUrl
    }

    return imageRecord.image_url || null
  } catch (error) {
    console.error('❌ getImageUrl error:', error)
    return imageRecord?.image_url || null
  }
}

/**
 * Get video URL with fallback to storage
 */
export async function getVideoUrl(videoRecord: any): Promise<string | null> {
  try {
    if (!videoRecord) return null

    if (videoRecord.storage_path) {
      const storageUrl = await getMediaPublicUrl(
        videoRecord.video_url, // Note: video_url stores the public URL in our schema
        videoRecord.storage_bucket || 'user-media'
      )
      
      const { exists } = await checkMediaExists(
        videoRecord.storage_path,
        videoRecord.storage_bucket || 'user-media'
      )

      if (exists) return storageUrl
    }

    return videoRecord.video_url || null
  } catch (error) {
    console.error('❌ getVideoUrl error:', error)
    return videoRecord?.video_url || null
  }
}

/**
 * Delete user image
 */
export async function deleteUserImage(imageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('user_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting user image:', error)
    throw error
  }
}

/**
 * Delete user video
 */
export async function deleteUserVideo(videoId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('user_videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting user video:', error)
    throw error
  }
}
