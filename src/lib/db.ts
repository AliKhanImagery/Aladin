import { supabase } from './supabase'
import { Project, Clip } from '@/types'
import { getUserVideos } from './userMedia'

// Load projects for current user
export async function loadUserProjects(userId: string): Promise<Project[]> {
  try {
    console.log('🔍 loadUserProjects: Starting query for user:', userId)
    
    // First, verify Supabase client is initialized
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase environment variables not set!')
      console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING')
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'MISSING')
      throw new Error('Supabase configuration missing')
    }
    
    console.log('🔍 Supabase URL:', supabaseUrl.substring(0, 30) + '...')
    
    // Check session before query
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('🔍 Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message
    })
    
    if (!session) {
      console.warn('⚠️ No active session - RLS might block the query')
    }
    
    console.log('🔍 Executing query...')
    const queryStartTime = Date.now()
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('created_by', userId)
      .order('updated_at', { ascending: false })

    const queryDuration = Date.now() - queryStartTime
    console.log('🔍 loadUserProjects: Query completed', { 
      hasData: !!data, 
      dataLength: data?.length || 0,
      hasError: !!error,
      duration: `${queryDuration}ms`
    })

    if (error) {
      console.error('❌ loadUserProjects: Supabase error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Check if table exists
      if (error.code === '42P01') {
        console.error('⚠️ Table "projects" does not exist. Please run the database migration: supabase/migrations/001_initial_schema.sql')
      }
      throw error
    }

    console.log('✅ loadUserProjects: Transforming data, count:', data?.length || 0)

    // Transform database format to app format
    let transformed = (data || []).map(project => ({
      id: project.id,
      name: project.name,
      description: project.description || '',
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
      createdBy: project.created_by,
      settings: project.settings || {},
      story: project.story || {},
      scenes: project.scenes || [],
      characters: project.characters || [],
      metadata: project.metadata || {},
      permissions: project.permissions || {},
      budget: project.budget || {},
    })) as Project[]

    // CRITICAL: Restore video URLs from user_videos table
    // This ensures videos persist even if project JSONB doesn't have them
    console.log('🔗 loadUserProjects: Restoring video URLs from user_videos table...')
    try {
      const allVideos = await getUserVideos()
      console.log('🔗 Found', allVideos.length, 'videos in user_videos table')
      
      // Create a map of clip_id -> video_url for quick lookup
      const videoMap = new Map<string, { video_url: string; thumbnail_url?: string; duration?: number }>()
      allVideos.forEach(video => {
        if (video.clip_id && video.video_url) {
          videoMap.set(video.clip_id, {
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url || undefined,
            duration: video.duration || undefined
          })
        }
      })
      
      console.log('🔗 Video map created with', videoMap.size, 'entries')
      
      // Restore videos to clips in each project
      transformed = transformed.map(project => {
        const updatedScenes = project.scenes.map(scene => ({
          ...scene,
          clips: scene.clips.map(clip => {
            // Check if clip has a video URL in the map but not in the clip
            const videoData = videoMap.get(clip.id)
            if (videoData && !clip.generatedVideo) {
              console.log(`🔗 Restoring video for clip "${clip.name}" (${clip.id})`)
              return {
                ...clip,
                generatedVideo: videoData.video_url,
                previewVideo: videoData.video_url,
                generatedImage: videoData.thumbnail_url || clip.generatedImage,
                duration: videoData.duration || clip.duration
              } as Clip
            }
            // If clip already has video URL, ensure it matches the one in database
            if (clip.generatedVideo && videoData && clip.generatedVideo !== videoData.video_url) {
              console.log(`⚠️ Clip "${clip.name}" has different video URL than database, using database version`)
              return {
                ...clip,
                generatedVideo: videoData.video_url,
                previewVideo: videoData.video_url
              } as Clip
            }
            return clip
          })
        }))
        
        return {
          ...project,
          scenes: updatedScenes
        }
      })
      
      console.log('✅ loadUserProjects: Video URLs restored successfully')
    } catch (videoError) {
      console.error('⚠️ loadUserProjects: Failed to restore videos (continuing anyway):', videoError)
      // Continue without video restoration - project data is still valid
    }

    console.log('✅ loadUserProjects: Returning', transformed.length, 'projects')
    return transformed
  } catch (error: any) {
    console.error('❌ loadUserProjects: Exception caught:', error)
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    return []
  }
}

// Helper function to serialize Date objects to ISO strings for JSONB storage
function serializeProjectForDB(project: Project): any {
  const serializeValue = (value: any): any => {
    if (value === null || value === undefined) return value
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(serializeValue)
    if (typeof value === 'object') {
      const serialized: any = {}
      for (const key in value) {
        serialized[key] = serializeValue(value[key])
      }
      return serialized
    }
    return value
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    created_by: project.createdBy,
    settings: serializeValue(project.settings),
    story: serializeValue(project.story),
    scenes: serializeValue(project.scenes),
    characters: serializeValue(project.characters),
    metadata: serializeValue(project.metadata),
    permissions: serializeValue(project.permissions),
    budget: serializeValue(project.budget),
    updated_at: new Date().toISOString(),
  }
}

// Save project to database
export async function saveProject(project: Project, userId: string): Promise<{ success: boolean; error?: any; lastSaved?: Date }> {
  try {
    // Count clips with videos for logging
    const clipsWithVideos = project.scenes?.flatMap(s => s.clips || []).filter(c => c.generatedVideo).length || 0
    const totalClips = project.scenes?.reduce((sum, s) => sum + (s.clips?.length || 0), 0) || 0
    
    console.log('💾 saveProject: Starting save for project:', {
      projectId: project.id,
      projectName: project.name,
      userId,
      scenesCount: project.scenes?.length || 0,
      totalClips,
      clipsWithVideos,
      clipsWithImages: project.scenes?.flatMap(s => s.clips || []).filter(c => c.generatedImage && !c.generatedVideo).length || 0
    })
    
    // Log video URLs being saved
    if (clipsWithVideos > 0) {
      const videoClips = project.scenes?.flatMap(s => s.clips || []).filter(c => c.generatedVideo)
      console.log('💾 saveProject: Saving clips with videos:', videoClips.map(c => ({
        clipId: c.id,
        clipName: c.name,
        hasVideo: !!c.generatedVideo,
        videoUrl: c.generatedVideo?.substring(0, 50) + '...'
      })))
    }

    const projectData = serializeProjectForDB({
      ...project,
      createdBy: userId, // Ensure created_by matches userId
    })

    // Check if project exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project.id)
      .single()

    const saveStartTime = Date.now()
    let saveError

    if (existing) {
      // Update existing project
      console.log('💾 saveProject: Updating existing project')
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', project.id)

      if (error) {
        saveError = error
        console.error('❌ saveProject: Update error:', error)
      } else {
        const saveDuration = Date.now() - saveStartTime
        console.log(`✅ saveProject: Project updated successfully in ${saveDuration}ms`)
      }
    } else {
      // Insert new project
      console.log('💾 saveProject: Inserting new project')
      projectData.created_at = project.createdAt instanceof Date 
        ? project.createdAt.toISOString() 
        : new Date().toISOString()
      
      const { error } = await supabase
        .from('projects')
        .insert(projectData)

      if (error) {
        saveError = error
        console.error('❌ saveProject: Insert error:', error)
      } else {
        const saveDuration = Date.now() - saveStartTime
        console.log(`✅ saveProject: Project inserted successfully in ${saveDuration}ms`)
      }
    }

    if (saveError) {
      throw saveError
    }

    const lastSaved = new Date()
    return { success: true, lastSaved }
  } catch (error: any) {
    console.error('❌ saveProject: Exception caught:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return { success: false, error }
  }
}

// Delete project
export async function deleteProject(projectId: string, userId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('created_by', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { success: false, error }
  }
}
