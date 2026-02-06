import { supabase } from './supabase'
import { Project, Clip } from '@/types'
import { getUserVideos, getUserImages } from './userMedia'

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
      // Restore asset context if present (confirmed assets & settings from analysis)
      assetContext: project.asset_context || project.assetContext || null,
      metadata: project.metadata || {},
      permissions: project.permissions || {},
      budget: project.budget || {},
      timeline: project.timeline || undefined,
    })) as Project[]

    // CRITICAL: Restore video URLs from user_videos table
    // This ensures videos persist even if project JSONB doesn't have them
    console.log('🔗 loadUserProjects: Restoring media URLs from database registry...')
    
    // 1. Restore Videos
    try {
      const allVideos = await getUserVideos()
      console.log('🔗 Found', allVideos.length, 'videos in user_videos table')
      
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
      
      transformed = transformed.map(project => {
        const updatedScenes = project.scenes.map(scene => ({
          ...scene,
          clips: scene.clips.map(clip => {
            const videoData = videoMap.get(clip.id)
            if (videoData && !clip.generatedVideo) {
              return {
                ...clip,
                generatedVideo: videoData.video_url,
                previewVideo: videoData.video_url,
                generatedImage: videoData.thumbnail_url || clip.generatedImage,
                duration: videoData.duration || clip.duration
              } as Clip
            }
            return clip
          })
        }))
        return { ...project, scenes: updatedScenes }
      })
    } catch (videoError) {
      console.warn('⚠️ loadUserProjects: Failed to restore videos:', videoError)
    }

    // 2. Restore Images (Self-Healing)
    try {
      console.log('🖼️ loadUserProjects: Fetching images for self-healing...')
      const allImages = await getUserImages()
      
      if (!allImages || !Array.isArray(allImages)) {
        console.warn('⚠️ loadUserProjects: allImages is not an array:', allImages)
      } else {
        console.log(`🖼️ Found ${allImages.length} images in registry. Matching to clips...`)
        
        const imageMap = new Map<string, string>()
        allImages.forEach(img => {
          if (img.clip_id && img.image_url) {
            imageMap.set(img.clip_id, img.image_url)
          }
        })

        let restoredCount = 0
        transformed = transformed.map(project => {
          const updatedScenes = (project.scenes || []).map(scene => ({
            ...scene,
            clips: (scene.clips || []).map(clip => {
              const storedImageUrl = imageMap.get(clip.id)
              // If we have a stored image URL but the clip object doesn't have it, restore it
              if (storedImageUrl && !clip.generatedImage) {
                restoredCount++
                console.log(`🖼️ Healing clip "${clip.name}" (${clip.id}) with image from registry`)
              return {
                ...clip,
                  generatedImage: storedImageUrl,
                  previewImage: storedImageUrl,
                  // Ensure status reflects completion if we found an image
                  status: (clip.status === 'pending' || clip.status === 'generating') ? 'completed' : clip.status
              } as Clip
            }
            return clip
          })
        }))
          return { ...project, scenes: updatedScenes }
      })
      
        if (restoredCount > 0) {
          console.log(`✅ loadUserProjects: Self-healed ${restoredCount} clips across ${transformed.length} projects`)
        } else {
          console.log('ℹ️ loadUserProjects: No missing images found to heal.')
        }
      }
    } catch (imageError) {
      console.warn('⚠️ loadUserProjects: Failed to restore images during self-healing:', imageError)
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
    // Persist asset context so detected assets & their actions survive reloads
    asset_context: serializeValue((project as any).assetContext),
    metadata: serializeValue(project.metadata),
    permissions: serializeValue(project.permissions),
    budget: serializeValue(project.budget),
    timeline: serializeValue(project.timeline),
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

    // CRITICAL: Verify save succeeded by reading back from database
    const verifyStartTime = Date.now()
    try {
      const { data: verified, error: verifyError } = await supabase
        .from('projects')
        .select('id, updated_at')
        .eq('id', project.id)
        .single()

      if (verifyError) {
        console.error('❌ saveProject: Verification failed - could not read back saved project:', verifyError)
        throw new Error(`Save verification failed: ${verifyError.message}`)
      }

      if (!verified) {
        console.error('❌ saveProject: Verification failed - project not found after save')
        throw new Error('Save verification failed: Project not found in database after save')
      }

      const verifyDuration = Date.now() - verifyStartTime
      console.log(`✅ saveProject: Save verified successfully in ${verifyDuration}ms`, {
        projectId: verified.id,
        updatedAt: verified.updated_at
      })
    } catch (verifyError: any) {
      console.error('❌ saveProject: Save verification error:', verifyError)
      // Don't throw - save might have succeeded but verification failed
      // Log as warning but return success if the save operation itself succeeded
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

// Background save queue for failed saves
interface QueuedSave {
  project: Project
  userId: string
  attempts: number
  lastAttempt: Date
  nextRetry: Date
}

const failedSaveQueue: QueuedSave[] = []
const MAX_QUEUE_ATTEMPTS = 10
const QUEUE_RETRY_DELAY = 30000 // 30 seconds

/**
 * Queue a failed save for retry in the background
 */
export function queueFailedSave(project: Project, userId: string): void {
  const existingIndex = failedSaveQueue.findIndex(
    q => q.project.id === project.id && q.userId === userId
  )

  if (existingIndex >= 0) {
    // Update existing queue entry
    failedSaveQueue[existingIndex] = {
      project,
      userId,
      attempts: failedSaveQueue[existingIndex].attempts + 1,
      lastAttempt: new Date(),
      nextRetry: new Date(Date.now() + QUEUE_RETRY_DELAY * Math.pow(2, failedSaveQueue[existingIndex].attempts))
    }
    console.log(`📋 Updated failed save in queue (attempt ${failedSaveQueue[existingIndex].attempts}/${MAX_QUEUE_ATTEMPTS})`)
  } else {
    // Add new queue entry
    failedSaveQueue.push({
      project,
      userId,
      attempts: 1,
      lastAttempt: new Date(),
      nextRetry: new Date(Date.now() + QUEUE_RETRY_DELAY)
    })
    console.log(`📋 Added failed save to retry queue`)
  }

  // Start background processor if not already running
  if (failedSaveQueue.length === 1) {
    processFailedSaveQueue()
  }
}

/**
 * Process failed saves in the background
 */
async function processFailedSaveQueue(): Promise<void> {
  while (failedSaveQueue.length > 0) {
    const now = new Date()
    const readyToRetry = failedSaveQueue.filter(q => q.nextRetry <= now && q.attempts < MAX_QUEUE_ATTEMPTS)

    if (readyToRetry.length === 0) {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 5000))
      continue
    }

    for (const queuedSave of readyToRetry) {
      try {
        console.log(`🔄 Retrying failed save from queue (attempt ${queuedSave.attempts}/${MAX_QUEUE_ATTEMPTS})...`)
        const result = await saveProject(queuedSave.project, queuedSave.userId)

        if (result.success) {
          // Remove from queue on success
          const index = failedSaveQueue.findIndex(
            q => q.project.id === queuedSave.project.id && q.userId === queuedSave.userId
          )
          if (index >= 0) {
            failedSaveQueue.splice(index, 1)
            console.log(`✅ Failed save retry succeeded, removed from queue`)
          }
        } else {
          // Update retry time for next attempt
          queuedSave.nextRetry = new Date(Date.now() + QUEUE_RETRY_DELAY * Math.pow(2, queuedSave.attempts))
          queuedSave.attempts++
          queuedSave.lastAttempt = new Date()
          
          if (queuedSave.attempts >= MAX_QUEUE_ATTEMPTS) {
            // Remove from queue after max attempts
            const index = failedSaveQueue.findIndex(
              q => q.project.id === queuedSave.project.id && q.userId === queuedSave.userId
            )
            if (index >= 0) {
              failedSaveQueue.splice(index, 1)
              console.error(`❌ Failed save exceeded max attempts, removed from queue`)
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error retrying failed save:`, error)
        queuedSave.nextRetry = new Date(Date.now() + QUEUE_RETRY_DELAY * Math.pow(2, queuedSave.attempts))
        queuedSave.attempts++
      }
    }

    // Wait before next iteration
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('✅ Failed save queue processor finished (no more items)')
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
