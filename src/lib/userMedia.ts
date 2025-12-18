import { supabase } from './supabase'

export interface SaveImageParams {
  image_url: string
  prompt?: string
  model?: string
  aspect_ratio?: string
  project_id?: string
  clip_id?: string
  metadata?: Record<string, any>
}

export interface SaveVideoParams {
  video_url: string
  prompt?: string
  model?: string
  duration?: number
  aspect_ratio?: string
  project_id?: string
  clip_id?: string
  thumbnail_url?: string
  metadata?: Record<string, any>
}

/**
 * Save a generated image to user_images table
 */
export async function saveUserImage(params: SaveImageParams) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error in saveUserImage:', authError)
      return null
    }
    
    if (!user) {
      console.warn('⚠️ No user authenticated, skipping image save')
      return null
    }

    console.log('💾 Saving image to database:', {
      user_id: user.id,
      image_url: params.image_url?.substring(0, 50) + '...',
      model: params.model,
      has_prompt: !!params.prompt
    })

    const { data, error } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        image_url: params.image_url,
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
      console.error('❌ Error saving user image to database:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Check if table exists
      if (error.code === '42P01') {
        console.error('⚠️ Table "user_images" does not exist. Please run the database migration: supabase/migrations/002_user_media_tables.sql')
      }
      return null
    }

    console.log('✅ Image saved to user_images:', data.id)
    return data
  } catch (error: any) {
    console.error('❌ Exception in saveUserImage:', error)
    console.error('Error stack:', error.stack)
    return null
  }
}

/**
 * Save a generated video to user_videos table
 */
export async function saveUserVideo(params: SaveVideoParams) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error in saveUserVideo:', authError)
      return null
    }
    
    if (!user) {
      console.warn('⚠️ No user authenticated, skipping video save')
      return null
    }

    console.log('💾 Saving video to database:', {
      user_id: user.id,
      video_url: params.video_url?.substring(0, 50) + '...',
      model: params.model,
      duration: params.duration,
      has_prompt: !!params.prompt
    })

    const { data, error } = await supabase
      .from('user_videos')
      .insert({
        user_id: user.id,
        video_url: params.video_url,
        prompt: params.prompt || null,
        model: params.model || null,
        duration: params.duration || null,
        aspect_ratio: params.aspect_ratio || null,
        project_id: params.project_id || null,
        clip_id: params.clip_id || null,
        thumbnail_url: params.thumbnail_url || null,
        metadata: params.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving user video to database:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Check if table exists
      if (error.code === '42P01') {
        console.error('⚠️ Table "user_videos" does not exist. Please run the database migration: supabase/migrations/002_user_media_tables.sql')
      }
      return null
    }

    console.log('✅ Video saved to user_videos:', data.id)
    return data
  } catch (error: any) {
    console.error('❌ Exception in saveUserVideo:', error)
    console.error('Error stack:', error.stack)
    return null
  }
}

/**
 * Fetch user images
 */
export async function getUserImages(projectId?: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error in getUserImages:', authError)
      return []
    }
    
    if (!user) {
      console.warn('⚠️ No user authenticated, cannot fetch images')
      return []
    }

    console.log('📸 Fetching images for user:', user.id)
    
    // Check session before query
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📸 Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message
    })
    
    if (!session) {
      console.warn('⚠️ No active session - RLS might block the query')
    }
    
    console.log('📸 Executing query...')
    const queryStartTime = Date.now()

    let query = supabase
      .from('user_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
    
    const queryDuration = Date.now() - queryStartTime
    console.log('📸 Query completed', {
      duration: `${queryDuration}ms`,
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error
    })

    if (error) {
      console.error('❌ Error fetching user images:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Check if table exists
      if (error.code === '42P01') {
        console.error('⚠️ Table "user_images" does not exist. Please run the database migration: supabase/migrations/002_user_media_tables.sql')
      }
      return []
    }

    console.log('✅ Fetched images:', data?.length || 0)
    return data || []
  } catch (error: any) {
    console.error('❌ Exception in getUserImages:', error)
    console.error('Error stack:', error.stack)
    return []
  }
}

/**
 * Fetch user videos
 */
export async function getUserVideos(projectId?: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error in getUserVideos:', authError)
      return []
    }
    
    if (!user) {
      console.warn('⚠️ No user authenticated, cannot fetch videos')
      return []
    }

    console.log('🎬 Fetching videos for user:', user.id)
    
    // Check session before query
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('🎬 Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message
    })
    
    if (!session) {
      console.warn('⚠️ No active session - RLS might block the query')
    }
    
    console.log('🎬 Executing query...')
    const queryStartTime = Date.now()

    let query = supabase
      .from('user_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
    
    const queryDuration = Date.now() - queryStartTime
    console.log('🎬 Query completed', {
      duration: `${queryDuration}ms`,
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error
    })

    if (error) {
      console.error('❌ Error fetching user videos:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Check if table exists
      if (error.code === '42P01') {
        console.error('⚠️ Table "user_videos" does not exist. Please run the database migration: supabase/migrations/002_user_media_tables.sql')
      }
      return []
    }

    console.log('✅ Fetched videos:', data?.length || 0)
    return data || []
  } catch (error: any) {
    console.error('❌ Exception in getUserVideos:', error)
    console.error('Error stack:', error.stack)
    return []
  }
}

/**
 * Delete user image
 */
export async function deleteUserImage(imageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { error } = await supabase
      .from('user_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return true
  } catch (error: any) {
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
    
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { error } = await supabase
      .from('user_videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return true
  } catch (error: any) {
    console.error('Error deleting user video:', error)
    throw error
  }
}

