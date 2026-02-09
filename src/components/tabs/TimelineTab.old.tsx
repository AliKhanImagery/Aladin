'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { Play, Pause, Download, Volume2, VolumeX, Settings, Sparkles, Loader2, Clock, Zap } from 'lucide-react'
import { Clip } from '@/types'
// Note: saveUserVideo removed - API now handles storage automatically
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// Video model options
const VIDEO_MODELS: SelectOption[] = [
  {
    value: 'vidu',
    label: 'Vidu (Recommended)',
    description: 'High quality, supports image-to-video and text-to-video'
  },
  {
    value: 'kling',
    label: 'Kling AI',
    description: 'Alternative model for video generation'
  }
]

export default function TimelineTab() {
  const { 
    currentProject, 
    updateClip, 
    setClipGeneratingStatus, 
    clipGeneratingStatus,
    user,
    saveProjectNow
  } = useAppStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [hasLipsync, setHasLipsync] = useState(false)
  const [hasSFX, setHasSFX] = useState(false)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('vidu')
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  if (!currentProject) return null

  // Get all clips from all scenes
  const allClips = currentProject.scenes.flatMap(scene => 
    scene.clips.map(clip => ({ ...clip, sceneName: scene.name }))
  )

  const totalDuration = allClips.reduce((total, clip) => total + clip.duration, 0)
  const totalCost = allClips.reduce((total, clip) => total + clip.actualCost, 0)

  // Get clips with different states
  const clipsWithVideo = allClips.filter(clip => clip.generatedVideo)
  const clipsWithImage = allClips.filter(clip => clip.generatedImage && !clip.generatedVideo)
  const clipsWithScript = allClips.filter(clip => !clip.generatedImage && !clip.generatedVideo)

  // Get current clip based on index (works with all clips)
  const currentClip = allClips[currentClipIndex] || null
  const currentClipType = currentClip 
    ? (currentClip.generatedVideo ? 'video' : currentClip.generatedImage ? 'image' : 'script')
    : null

  // Auto-advance for non-video clips
  useEffect(() => {
    if (isPlaying && currentClipType !== 'video') {
      const timer = setTimeout(() => {
        if (currentClipIndex < allClips.length - 1) {
          setCurrentClipIndex(currentClipIndex + 1)
        } else {
          setIsPlaying(false)
          setCurrentClipIndex(0)
        }
      }, 3000) // Show each clip for 3 seconds

      return () => clearTimeout(timer)
    }
  }, [isPlaying, currentClipIndex, currentClipType, allClips.length])

  // Handle play/pause - works for all clip types
  const handlePlayPause = () => {
    // If current clip has video, play/pause it
    if (currentClipType === 'video' && videoRef.current && currentClip?.generatedVideo) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        videoRef.current.play().catch(error => {
          console.error('Error playing video:', error)
          setIsPlaying(false)
        })
        setIsPlaying(true)
      }
    } else if (currentClipType !== 'video') {
      // For non-video clips (image or script), toggle play state (auto-advance handled by useEffect)
      setIsPlaying(!isPlaying)
    }
  }

  // Handle video end - move to next clip
  const handleVideoEnd = () => {
    if (currentClipIndex < allClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1)
      setCurrentTime(0)
    } else {
      // Reached end of timeline
      setIsPlaying(false)
      setCurrentClipIndex(0)
      setCurrentTime(0)
    }
  }

  // Update current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  // Seek to specific time
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Calculate current time in timeline context
  const calculateTimelineTime = () => {
    let time = 0
    for (let i = 0; i < currentClipIndex; i++) {
      time += allClips[i]?.duration || 0
    }
    return time + currentTime
  }

  // Handle timeline scrubbing
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || allClips.length === 0) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    const percentage = Math.max(0, Math.min(1, clickX / width))
    const targetTime = percentage * totalDuration

    // Find which clip this time corresponds to
    let accumulatedTime = 0
    for (let i = 0; i < allClips.length; i++) {
      const clipDuration = allClips[i].duration || 0
      if (targetTime <= accumulatedTime + clipDuration) {
        setCurrentClipIndex(i)
        if (videoRef.current && allClips[i].generatedVideo) {
          videoRef.current.currentTime = targetTime - accumulatedTime
          setCurrentTime(targetTime - accumulatedTime)
        } else {
          setCurrentTime(0)
        }
        break
      }
      accumulatedTime += clipDuration
    }
  }

  // Handle video source changes smoothly when clip changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || currentClipType !== 'video' || !currentClip?.generatedVideo) {
      return
    }

    // Check if we're switching to a different clip
    const previousClipId = video.getAttribute('data-clip-id')
    const isNewClip = previousClipId !== currentClip.id

    if (isNewClip) {
      // New clip - update source smoothly
      const wasPlaying = !video.paused
      const currentSrc = video.src

      // Only change source if it's actually different
      if (currentSrc !== currentClip.generatedVideo) {
        // Pause current video to prevent black screen
        video.pause()
        
        // Update source
        video.src = currentClip.generatedVideo
        video.setAttribute('data-clip-id', currentClip.id)
        
        // Reset time
        setCurrentTime(0)
        video.currentTime = 0
        
        // Load new video
        video.load()
        
        // Resume playing if it was playing before
        if (wasPlaying && isPlaying) {
          const handleCanPlayThrough = () => {
            if (video.src === currentClip.generatedVideo) {
              video.play().catch(() => {
                // Ignore play errors
              })
            }
            video.removeEventListener('canplaythrough', handleCanPlayThrough)
          }
          video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true })
        }
      }
    }
  }, [currentClipIndex, currentClip?.id, currentClip?.generatedVideo, currentClipType])

  // Sync video playback state when clip changes or play state changes
  // This effect handles smooth transitions between video clips
  useEffect(() => {
    const video = videoRef.current
    if (!video || currentClipType !== 'video' || !currentClip?.generatedVideo) {
      return
    }

    // Don't reset time if we're just changing play state on the same clip
    const previousClipId = video.getAttribute('data-clip-id')
    if (previousClipId !== currentClip.id) {
      setCurrentTime(0)
      video.setAttribute('data-clip-id', currentClip.id)
    }

    // Wait for video to be ready before playing
    const handleCanPlay = () => {
      // Double-check the video source matches (in case clip changed during load)
      if (video.src === currentClip.generatedVideo && isPlaying) {
        video.play().catch(error => {
          // Only log if it's not an AbortError (which is expected during transitions)
          if (error.name !== 'AbortError') {
            console.error('Error playing video:', error)
          }
          setIsPlaying(false)
        })
      }
    }

    const handleLoadedData = () => {
      // Video is ready, can now play if needed
      if (video.src === currentClip.generatedVideo && isPlaying) {
        // Small delay to ensure video is fully ready
        requestAnimationFrame(() => {
          if (video.src === currentClip.generatedVideo && isPlaying) {
            video.play().catch(error => {
              if (error.name !== 'AbortError') {
                console.error('Error playing video:', error)
              }
              setIsPlaying(false)
            })
          }
        })
      }
    }

    // If video is already loaded and ready, try to play immediately
    if (video.readyState >= 3) { // HAVE_FUTURE_DATA or higher (more reliable)
      if (isPlaying && video.src === currentClip.generatedVideo) {
        // Use requestAnimationFrame to ensure smooth transition
        requestAnimationFrame(() => {
          if (video.src === currentClip.generatedVideo && isPlaying) {
            video.play().catch(error => {
              if (error.name !== 'AbortError') {
                console.error('Error playing video:', error)
              }
              setIsPlaying(false)
            })
          }
        })
      } else if (!isPlaying) {
        video.pause()
      }
    } else {
      // Wait for video to load - use both events for better compatibility
      video.addEventListener('canplay', handleCanPlay, { once: true })
      video.addEventListener('loadeddata', handleLoadedData, { once: true })
      video.addEventListener('canplaythrough', handleCanPlay, { once: true })
    }

    // Cleanup function
    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('canplaythrough', handleCanPlay)
    }
  }, [currentClipIndex, currentClip?.id, currentClip?.generatedVideo, currentClipType, isPlaying])

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Export to ZIP
  const handleExportZip = async () => {
    if (!currentProject || allClips.length === 0) return

    setIsExporting(true)
    const toastId = toast.loading('Preparing assets for export...')

    try {
      const zip = new JSZip()
      const sanitizedProjectName = currentProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project'
      const folder = zip.folder(sanitizedProjectName)
      
      if (!folder) throw new Error('Failed to create zip folder')

      const exportableClips = allClips.filter(c => c.generatedVideo || c.generatedImage)
      
      if (exportableClips.length === 0) {
        throw new Error('No generated media found to export')
      }

      let processedCount = 0
      
      await Promise.all(exportableClips.map(async (clip, index) => {
        const url = clip.generatedVideo || clip.generatedImage
        if (!url) return

        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Failed to fetch media for clip ${index + 1}`)
          
          const blob = await response.blob()
          const extension = clip.generatedVideo ? 'mp4' : 'png'
          
          const safeSceneName = (clip.sceneName || 'Scene').replace(/[^a-z0-9]/gi, '_')
          const safeClipName = (clip.name || `Clip${index}`).replace(/[^a-z0-9]/gi, '_')
          const filename = `${String(index + 1).padStart(2, '0')}_${safeSceneName}_${safeClipName}.${extension}`
          
          folder.file(filename, blob)
          processedCount++
        } catch (err) {
          console.error(`Failed to export clip ${clip.name}:`, err)
        }
      }))

      if (processedCount === 0) {
        throw new Error('Failed to download any clips. They may have expired.')
      }

      toast.loading('Compressing archive...', { id: toastId })
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${sanitizedProjectName}_export.zip`)
      
      toast.success(`Exported ${processedCount} files successfully!`, { id: toastId })
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(`Export failed: ${error.message}`, { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  // Generate videos for all clips that need them
  const handleGenerateTimeline = async () => {
    if (!currentProject) return

    // Get all clips that need video generation
    const clipsNeedingVideo: Array<{ clip: Clip; sceneId: string }> = []
    currentProject.scenes.forEach(scene => {
      scene.clips.forEach(clip => {
        // Only generate if clip has a video prompt and doesn't already have a video
        if (clip.videoPrompt && !clip.generatedVideo) {
          clipsNeedingVideo.push({ clip, sceneId: scene.id })
        }
      })
    })

    if (clipsNeedingVideo.length === 0) {
      toast.success('All clips already have videos!')
      return
    }

    // CRITICAL: Save project BEFORE starting generation to prevent data loss
    if (user?.id) {
      try {
        console.log('💾 Saving project state before video generation...')
        await saveProjectNow(currentProject.id, true)
        console.log('✅ Project saved successfully before generation')
        toast.success('Project saved. Starting video generation...', { duration: 2000 })
      } catch (saveError) {
        console.error('❌ Failed to save project before generation:', saveError)
        toast.error('Failed to save project. Please try again.', { duration: 3000 })
        return // Don't proceed if save fails
      }
    }

    console.log(`🎬 Starting timeline generation for ${clipsNeedingVideo.length} clips with model: ${selectedVideoModel}...`)
    setIsGeneratingTimeline(true)

    // Set generating status for ALL clips immediately
    clipsNeedingVideo.forEach(({ clip }) => {
      setClipGeneratingStatus(clip.id, 'video')
    })

    toast.loading(`Generating ${clipsNeedingVideo.length} videos...`, { id: 'timeline-generation' })

    const startTime = Date.now()
    const aspectRatio = currentProject.story.aspectRatio || '16:9'

    // Generate all videos in parallel
    const videoGenerationPromises = clipsNeedingVideo.map(async ({ clip }, index) => {
      const clipName = clip.name
      const clipId = clip.id
      const requestStartTime = Date.now()

      try {
        console.log(`\n🎬 [${index + 1}/${clipsNeedingVideo.length}] Starting video generation for clip: "${clipName}"`, {
          clipId,
          promptLength: clip.videoPrompt?.length || 0,
          promptPreview: clip.videoPrompt?.substring(0, 100) + '...' || 'N/A',
          duration: clip.duration || 5,
          aspectRatio
        })

        // Determine video model: Check clip metadata for videoEngine (Aladin Pro Dynamic Pacing)
        // If clip has videoEngine from story generation, use it; otherwise use user selection
        const videoEngineFromMetadata = clip.generationMetadata?.videoEngine as 'kling' | 'ltx' | undefined
        const effectiveVideoModel = videoEngineFromMetadata || selectedVideoModel
        
        // Determine video model based on available assets and user selection
        // Prioritize consistent images and reference images for video generation
        let requestBody: any = {
          prompt: clip.videoPrompt,
          duration: clip.duration || 5, // Use clip duration (preserved from story generation)
          resolution: '720p',
          videoModel: effectiveVideoModel, // Use videoEngine from metadata or selected model
        }
        
        // LTX and Kling require aspect_ratio
        if (effectiveVideoModel === 'ltx' || effectiveVideoModel === 'kling') {
          requestBody.aspect_ratio = aspectRatio
          // LTX is fixed at 720p @ 24fps, Kling can use 720p or 1080p but we use 720p for consistency
          requestBody.resolution = '720p'
        }

        // Use image-to-video if clip has a generated image (ensures consistency)
        // LTX and Kling require image_url (image-to-video only)
        if (clip.generatedImage) {
          requestBody.image_url = clip.generatedImage
          console.log(`📸 [${index + 1}/${clipsNeedingVideo.length}] Using image-to-video for "${clipName}" with model: ${effectiveVideoModel}${videoEngineFromMetadata ? ' (from story generation)' : ''}`)
          
          // LTX and Kling require image_url, so we're good
          if ((effectiveVideoModel === 'ltx' || effectiveVideoModel === 'kling') && !requestBody.image_url) {
            console.warn(`⚠️ [${index + 1}/${clipsNeedingVideo.length}] ${effectiveVideoModel.toUpperCase()} requires image URL but clip has no generated image for "${clipName}"`)
          }
          
          // If we have reference images in metadata, pass them for additional consistency
          // This helps video models maintain character/product consistency across frames
          if (clip.generationMetadata?.referenceImageUrls && clip.generationMetadata.referenceImageUrls.length > 0) {
            requestBody.reference_image_urls = clip.generationMetadata.referenceImageUrls.slice(0, 4) // Limit to 4 for video models
            console.log(`🎯 [${index + 1}/${clipsNeedingVideo.length}] Adding ${requestBody.reference_image_urls.length} reference images for video consistency`)
          }
        } else {
          // Text-to-video: Still try to use reference images if available for consistency
          if (clip.generationMetadata?.referenceImageUrls && clip.generationMetadata.referenceImageUrls.length > 0) {
            // Use reference-to-video if available (Vidu Q1 supports this)
            requestBody.reference_image_urls = clip.generationMetadata.referenceImageUrls.slice(0, 4)
            console.log(`📝 [${index + 1}/${clipsNeedingVideo.length}] Using reference-to-video for "${clipName}" with ${requestBody.reference_image_urls.length} reference images`)
          } else {
            // Pure text-to-video
            console.log(`📝 [${index + 1}/${clipsNeedingVideo.length}] Using text-to-video for "${clipName}" with model: ${selectedVideoModel}`)
          }
        }

        // Get session token for authentication BEFORE creating AbortController
        // This prevents abort signals from interfering with Supabase's internal auth locks
        let headers: HeadersInit = { 'Content-Type': 'application/json' }
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) {
            console.warn(`⚠️ [${index + 1}/${clipsNeedingVideo.length}] Session error for "${clipName}":`, sessionError.message)
          }
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        } catch (authError: any) {
          // Handle auth errors gracefully - don't block video generation
          // If auth fails, the API will handle it and return appropriate error
          console.warn(`⚠️ [${index + 1}/${clipsNeedingVideo.length}] Auth error for "${clipName}":`, authError.message)
        }

        // Create timeout controller AFTER auth is complete
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          console.warn(`⏱️ [${index + 1}/${clipsNeedingVideo.length}] Timeout triggered for "${clipName}" after 5 minutes`)
          controller.abort()
        }, 300000) // 5 minute timeout for videos

        let videoResponse
        try {
          console.log(`📤 [${index + 1}/${clipsNeedingVideo.length}] Sending request to /api/generate-video for "${clipName}"`)
          
          // Add project_id and clip_id to request body for storage
          const requestBodyWithIds = {
            ...requestBody,
            project_id: currentProject.id,
            clip_id: clipId,
          }
          
          videoResponse = await fetch('/api/generate-video', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBodyWithIds),
            signal: controller.signal,
          })

          const requestDuration = Date.now() - requestStartTime
          console.log(`📥 [${index + 1}/${clipsNeedingVideo.length}] Response received for "${clipName}"`, {
            status: videoResponse.status,
            statusText: videoResponse.statusText,
            ok: videoResponse.ok,
            duration: `${requestDuration}ms`
          })
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          const requestDuration = Date.now() - requestStartTime

          console.error(`❌ [${index + 1}/${clipsNeedingVideo.length}] Fetch error for "${clipName}"`, {
            errorName: fetchError.name,
            errorMessage: fetchError.message,
            duration: `${requestDuration}ms`,
            isAbort: fetchError.name === 'AbortError'
          })

          if (fetchError.name === 'AbortError') {
            throw new Error('Video generation timed out after 5 minutes')
          }
          throw fetchError
        } finally {
          clearTimeout(timeoutId)
        }

        if (!videoResponse) {
          throw new Error('No response received from video generation API')
        }

        if (!videoResponse.ok) {
          let errorMessage = 'Unknown error'
          try {
            const errorData = await videoResponse.json()
            errorMessage = errorData.error || errorData.message || JSON.stringify(errorData)
          } catch (e) {
            errorMessage = `HTTP ${videoResponse.status}: ${videoResponse.statusText}`
          }
          console.error(`❌ [${index + 1}/${clipsNeedingVideo.length}] API error for "${clipName}"`, {
            status: videoResponse.status,
            errorMessage
          })
          throw new Error(errorMessage)
        }

        let responseData
        try {
          responseData = await videoResponse.json()
          console.log(`📦 [${index + 1}/${clipsNeedingVideo.length}] Response parsed for "${clipName}"`, {
            hasVideoUrl: !!responseData.videoUrl,
            duration: responseData.duration
          })
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${parseError}`)
        }

        const videoUrl = responseData.videoUrl
        if (!videoUrl) {
          throw new Error(`No video URL in response: ${JSON.stringify(responseData)}`)
        }

        console.log(`✅ [${index + 1}/${clipsNeedingVideo.length}] Video URL extracted for "${clipName}"`, {
          videoUrl: videoUrl.substring(0, 100) + '...'
        })

        // Update clip with generated video
        // API now handles storage automatically - check if storage succeeded
        if (responseData.storageSuccess) {
          console.log(`✅ [${index + 1}/${clipsNeedingVideo.length}] Video generated and stored in Supabase Storage for "${clipName}"`, {
            videoUrl: videoUrl.substring(0, 50) + '...',
            storagePath: responseData.storagePath,
            model: responseData.model
          })
        } else if (responseData.fallbackUrl) {
          console.warn(`⚠️ [${index + 1}/${clipsNeedingVideo.length}] Video generated but storage failed, using Fal.ai URL as fallback for "${clipName}"`, {
            videoUrl: videoUrl.substring(0, 50) + '...',
            warning: 'Video URL is temporary (7-day expiry)'
          })
        } else {
          console.log(`✅ [${index + 1}/${clipsNeedingVideo.length}] Video generated successfully for "${clipName}"`, {
            videoUrl: videoUrl.substring(0, 50) + '...',
            model: responseData.model
          })
        }
        
        console.log(`💾 [${index + 1}/${clipsNeedingVideo.length}] Updating clip "${clipName}" with generated video...`)
        updateClip(clipId, {
          generatedVideo: videoUrl,
          previewVideo: videoUrl,
          duration: responseData.duration || clip.duration
        })
        console.log(`✓ [${index + 1}/${clipsNeedingVideo.length}] Clip "${clipName}" updated successfully`)
        
        // Note: API now handles storage automatically - no need for client-side saveUserVideo() call

        const totalDuration = Date.now() - requestStartTime
        console.log(`✅ [${index + 1}/${clipsNeedingVideo.length}] Video generation completed for "${clipName}"`, {
          duration: `${totalDuration}ms`
        })

        setClipGeneratingStatus(clipId, null)
        
        // CRITICAL: Save project immediately after each video generation to prevent data loss
        // Get the latest project state from store to ensure we have the updated clip
        if (user?.id) {
          try {
            // Get the latest project state from the store (it should have the updated clip)
            const latestProject = useAppStore.getState().currentProject
            if (!latestProject) {
              throw new Error('Current project is null - cannot save')
            }
            
            console.log(`💾 [${index + 1}/${clipsNeedingVideo.length}] Saving project after video generation for "${clipName}"...`)
            const saveResult = await saveProjectNow(latestProject.id, true)
            
            // Check if save actually succeeded
            if (saveResult === undefined) {
              // saveProjectNow doesn't return anything, check the project state
              const lastSaved = useAppStore.getState().projectLastSaved[latestProject.id]
              if (!lastSaved) {
                throw new Error('Project save did not complete - no lastSaved timestamp')
              }
              console.log(`✅ [${index + 1}/${clipsNeedingVideo.length}] Project saved after "${clipName}" video generation`, {
                lastSaved: lastSaved.toISOString()
              })
            }
          } catch (saveErr: any) {
            const errorMsg = saveErr?.message || 'Unknown error'
            console.error(`❌ [${index + 1}/${clipsNeedingVideo.length}] CRITICAL: Failed to save project after video generation:`, {
              error: errorMsg,
              clipName,
              clipId,
              projectId: currentProject.id,
              stack: saveErr?.stack
            })
            // Show user-facing error
            toast.error(`CRITICAL: Project save failed after video generation: ${errorMsg}`, { 
              duration: 8000,
              id: `save-error-${clipId}`
            })
            // Don't throw - continue with other videos, but this is critical
          }
        } else {
          console.warn(`⚠️ [${index + 1}/${clipsNeedingVideo.length}] Skipping project save - user not authenticated`)
        }
        
        return { success: true, clipId, clipName, videoUrl, duration: totalDuration }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error'
        const totalDuration = Date.now() - requestStartTime

        if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
          console.error(`⏱️ [${index + 1}/${clipsNeedingVideo.length}] Timeout generating video for "${clipName}"`, {
            duration: `${totalDuration}ms`
          })
        } else {
          console.error(`❌ [${index + 1}/${clipsNeedingVideo.length}] Error generating video for "${clipName}"`, {
            error: errorMessage,
            duration: `${totalDuration}ms`
          })
        }

        setClipGeneratingStatus(clipId, null)
        return { success: false, clipId, clipName, error: errorMessage, duration: totalDuration }
      }
    })

    // Wait for all video generations to complete
    console.log('⏳ Waiting for all video generation requests to complete...')
    let results: Array<{ success: boolean; clipId: string; clipName: string; videoUrl?: string; error?: string; duration: number }>
    try {
      results = await Promise.all(videoGenerationPromises)
    } catch (error) {
      console.error('❌ Error in Promise.all for video generation:', error)
      // Ensure we still process what we can
      results = []
    }
    
    const totalDuration = Date.now() - startTime

    // Process results
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    console.log(`\n📊 Timeline Generation Summary:`, {
      total: clipsNeedingVideo.length,
      successful: successful.length,
      failed: failed.length,
      totalDuration: `${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`
    })

    // CRITICAL: Always clear generating status, even if there were errors
    setIsGeneratingTimeline(false)
    
    // Ensure all clip generating statuses are cleared
    clipsNeedingVideo.forEach(({ clip }) => {
      setClipGeneratingStatus(clip.id, null)
    })

    // CRITICAL: Final save after all videos are generated
    // Get the latest project state to ensure all updates are included
    if (user?.id) {
      try {
        // Wait a bit to ensure all Zustand updates have propagated
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const latestProject = useAppStore.getState().currentProject
        if (!latestProject) {
          throw new Error('Current project is null - cannot perform final save')
        }
        
        console.log('💾 Performing final project save after all video generations...', {
          projectId: latestProject.id,
          totalClips: latestProject.scenes?.reduce((sum, s) => sum + (s.clips?.length || 0), 0) || 0,
          videosGenerated: latestProject.scenes?.flatMap(s => s.clips || []).filter(c => c.generatedVideo).length || 0
        })
        
        await saveProjectNow(latestProject.id, true)
        
        // Verify save succeeded by checking lastSaved timestamp
        await new Promise(resolve => setTimeout(resolve, 100))
        const lastSaved = useAppStore.getState().projectLastSaved[latestProject.id]
        if (lastSaved) {
          console.log('✅ Final project save completed successfully', {
            lastSaved: lastSaved.toISOString(),
            projectId: latestProject.id
          })
          toast.success(`All videos generated and project saved successfully!`, { duration: 4000 })
        } else {
          throw new Error('Final save did not complete - no lastSaved timestamp')
        }
      } catch (saveErr: any) {
        const errorMsg = saveErr?.message || 'Unknown error'
        console.error('❌ CRITICAL: Failed to save project after batch video generation:', {
          error: errorMsg,
          stack: saveErr?.stack
        })
        toast.error(`CRITICAL: Videos generated but project save failed: ${errorMsg}. Please save manually!`, { 
          duration: 10000,
          id: 'final-save-error'
        })
      }
    }

    if (failed.length > 0) {
      toast.error(`Timeline generation completed: ${successful.length} succeeded, ${failed.length} failed`, {
        id: 'timeline-generation',
        duration: 5000
      })
    } else {
      toast.success(`All ${successful.length} videos generated successfully!`, {
        id: 'timeline-generation',
        duration: 3000
      })
    }
  }

  // Check if any clips are generating - sync with isGeneratingTimeline state
  const isAnyClipGenerating = isGeneratingTimeline || allClips.some(clip => clipGeneratingStatus[clip.id] === 'video')

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Video Clips</h2>
          <p className="text-gray-400">
            Review your final clips and generate the full video timeline.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Duration</p>
            <p className="text-lg font-semibold text-white">{totalDuration}s</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Cost</p>
            <p className="text-lg font-semibold text-[#FFC44D]">${totalCost.toFixed(2)}</p>
          </div>
          {/* Generate Timeline Button with Model Selection */}
          {allClips.length > 0 && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {/* Model Selection Dropdown */}
                <div className="relative">
                  <Select
                    value={selectedVideoModel}
                    onChange={(e) => setSelectedVideoModel(e.target.value)}
                    options={VIDEO_MODELS}
                    disabled={isGeneratingTimeline}
                    className="w-52 bg-[#1E1F22] border-[#3AAFA9]/30 text-white"
                  />
                </div>
                
                <Button
                  onClick={handleGenerateTimeline}
                  disabled={isGeneratingTimeline || allClips.every(clip => clip.generatedVideo)}
                  className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-3 rounded-xl
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGeneratingTimeline ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Timeline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Timeline
                    </>
                  )}
                </Button>
              </div>
              {/* Model Description */}
              {!isGeneratingTimeline && (
                <p className="text-xs text-gray-400 text-right max-w-md">
                  {VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Preview Window */}
      {allClips.length > 0 && (
        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-xl font-semibold text-white mb-4">Video Preview</h3>
          <div className="relative bg-[#0C0C0C] rounded-xl overflow-hidden min-h-[300px] max-h-[500px] flex items-center justify-center">
            {currentClip && (
              <>
                {/* Video State */}
                {currentClipType === 'video' && currentClip.generatedVideo ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    src={currentClip.generatedVideo}
                    onEnded={handleVideoEnd}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedData={() => {
                      // Video loaded, sync time
                      if (videoRef.current && videoRef.current.currentTime > 0) {
                        setCurrentTime(videoRef.current.currentTime)
                      }
                    }}
                    onCanPlay={() => {
                      // Video can play, ensure smooth transition
                      if (videoRef.current && isPlaying && videoRef.current.paused) {
                        videoRef.current.play().catch(() => {
                          // Ignore play errors during transitions
                        })
                      }
                    }}
                    onError={(e) => {
                      console.error('Video playback error:', e)
                    }}
                    muted={isMuted}
                    playsInline
                    preload="auto"
                    crossOrigin="anonymous"
                  />
                ) : currentClipType === 'image' && currentClip.generatedImage ? (
                  /* Image State */
                  <img
                    src={currentClip.generatedImage}
                    alt={currentClip.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  /* Script State - Show video prompt as script lines */
                  <div className="w-full h-full p-8 flex items-center justify-center overflow-y-auto">
                    <div className="max-w-3xl w-full">
                      <div className="bg-[#1E1F22] rounded-lg p-6 border border-[#3AAFA9]/20">
                        <div className="flex items-center gap-2 mb-4">
                          <Play className="w-5 h-5 text-[#00FFF0]/50" />
                          <h4 className="text-lg font-medium text-white">{currentClip.name}</h4>
                        </div>
                        
                        {/* Video Prompt as Script */}
                        {currentClip.videoPrompt ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Video Script / Prompt</p>
                              <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/10">
                                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
                                  {currentClip.videoPrompt}
                                </p>
                              </div>
                            </div>
                            
                            {/* Image Prompt if available */}
                            {currentClip.imagePrompt && (
                              <div>
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Image Prompt</p>
                                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/10">
                                  <p className="text-sm text-gray-300 leading-relaxed">
                                    {currentClip.imagePrompt}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            <div className="pt-2 border-t border-[#3AAFA9]/20">
                              <p className="text-xs text-gray-500">
                                💡 Generate image or video from the prompts above to see preview
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-400 mb-2">No script/prompt available</p>
                            <p className="text-xs text-gray-500">This clip needs a video or image prompt</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Controls Overlay - Show for all clip types */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3 mb-3">
                <Button
                  onClick={handlePlayPause}
                  size="sm"
                  className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1 text-xs text-white">
                  {formatTime(calculateTimelineTime())} / {formatTime(totalDuration)}
                </div>
                
                <div className="text-xs text-gray-400">
                  Clip {currentClipIndex + 1} of {allClips.length}
                  {currentClipType === 'script' && ' (Script)'}
                  {currentClipType === 'image' && ' (Image)'}
                  {currentClipType === 'video' && ' (Video)'}
                </div>
                
                {currentClipType === 'video' && (
                  <Button
                    onClick={() => setIsMuted(!isMuted)}
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              
              {/* Progress Bar - Clickable for all types */}
              <div 
                ref={timelineRef}
                className="w-full h-2 bg-[#0C0C0C] rounded-full cursor-pointer relative group"
                onClick={handleTimelineClick}
              >
                <div 
                  className="h-full bg-[#00FFF0] rounded-full transition-all"
                  style={{ width: `${(calculateTimelineTime() / totalDuration) * 100}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#00FFF0] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${(calculateTimelineTime() / totalDuration) * 100}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-20 left-4 right-4 flex items-center justify-between">
              <Button
                onClick={() => {
                  setCurrentClipIndex(Math.max(0, currentClipIndex - 1))
                  setIsPlaying(false)
                }}
                  disabled={currentClipIndex === 0}
                  size="sm"
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  ← Previous
                </Button>
                
                <div className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                  Clip {currentClipIndex + 1} of {allClips.length}
                </div>
                
                <Button
                  onClick={() => {
                    setCurrentClipIndex(Math.min(allClips.length - 1, currentClipIndex + 1))
                    setIsPlaying(false)
                  }}
                  disabled={currentClipIndex === allClips.length - 1}
                  size="sm"
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  Next →
                </Button>
              </div>
          </div>
          
          {/* Current Clip Info */}
          {currentClip && (
            <div className="mt-4 p-3 bg-[#0C0C0C] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{currentClip.name}</p>
                  <p className="text-xs text-gray-400">{currentClip.sceneName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentClipType === 'video' && '📹 Video'}
                    {currentClipType === 'image' && '🖼️ Image'}
                    {currentClipType === 'script' && '📝 Script Only'}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {currentClipType === 'video' 
                    ? `${formatTime(currentTime)} / ${formatTime(currentClip.duration || 0)}`
                    : `${formatTime(currentClip.duration || 0)}s`
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Controls */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Timeline Controls</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayPause}
              disabled={allClips.length === 0 || currentClipType !== 'video'}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            {currentClipIndex > 0 && (
              <Button
                onClick={() => setCurrentClipIndex(Math.max(0, currentClipIndex - 1))}
                variant="outline"
                className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl"
              >
                ← Prev
              </Button>
            )}
            {currentClipIndex < allClips.length - 1 && (
              <Button
                onClick={() => setCurrentClipIndex(Math.min(allClips.length - 1, currentClipIndex + 1))}
                variant="outline"
                className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl"
              >
                Next →
              </Button>
            )}
            <Button
              onClick={handleExportZip}
              disabled={isExporting || allClips.length === 0}
              variant="outline"
              className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {isExporting ? 'Zipping...' : 'Export ZIP'}
            </Button>
          </div>
        </div>

        {/* Timeline Track */}
        <div className="bg-[#0C0C0C] rounded-xl p-4 overflow-x-auto relative">
          {/* Magical Animation Overlay - Shows when generating */}
          {isAnyClipGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-[#00FFF0]/10 via-[#3AAFA9]/20 to-[#00FFF0]/10 rounded-xl z-10 pointer-events-none overflow-hidden">
              {/* Animated sparkles */}
              <div className="absolute inset-0">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-[#00FFF0] rounded-full animate-pulse"
                    style={{
                      left: `${(i * 5) % 100}%`,
                      top: `${(i * 7) % 100}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: `${2 + (i % 3)}s`,
                      opacity: 0.6 + (i % 3) * 0.1
                    }}
                  />
                ))}
              </div>
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                style={{
                  backgroundSize: '200% 100%'
                }}
              />
              {/* Glowing border */}
              <div className="absolute inset-0 border-2 border-[#00FFF0]/50 rounded-xl animate-pulse" />
              {/* Text overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#0C0C0C]/90 backdrop-blur-sm rounded-xl px-6 py-4 border border-[#00FFF0]/30">
                  <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-[#00FFF0] animate-pulse" />
                    <div>
                      <p className="text-white font-semibold">Generating Timeline...</p>
                      <p className="text-xs text-gray-400">Creating magical videos for your story</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 min-w-max">
            {allClips.length === 0 ? (
              <div className="text-center py-16 w-full">
                <div className="w-16 h-16 bg-[#1E1F22] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-[#00FFF0]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Clips Yet</h3>
                <p className="text-gray-400">
                  Generate some clips in the Sequence tab to see them here
                </p>
              </div>
            ) : (
              allClips.map((clip, index) => {
                const isGenerating = clipGeneratingStatus[clip.id] === 'video'
                return (
                  <div
                    key={clip.id}
                    className={`bg-[#1E1F22] rounded-lg p-3 min-w-[200px] border transition-all relative ${
                      isGenerating 
                        ? 'border-[#00FFF0] shadow-lg shadow-[#00FFF0]/20 animate-pulse' 
                        : 'border-[#3AAFA9]/20 hover:border-[#00FFF0]/40'
                    }`}
                  >
                    {/* Generating Indicator Badge */}
                    {isGenerating && (
                      <div className="absolute -top-2 -right-2 z-20 bg-[#00FFF0] text-black rounded-full px-2 py-1 flex items-center gap-1 shadow-lg">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px] font-semibold">Generating</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white text-sm truncate">{clip.name}</h4>
                      <span className="text-xs text-gray-400">{clip.duration}s</span>
                    </div>
                    
                    <div className="h-16 bg-[#0C0C0C] rounded mb-2 flex items-center justify-center relative overflow-hidden">
                      {isGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#00FFF0]/10 to-[#3AAFA9]/10">
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 mx-auto mb-1 text-[#00FFF0] animate-spin" />
                            <p className="text-xs text-[#00FFF0] font-medium">Generating video</p>
                          </div>
                        </div>
                      ) : clip.generatedVideo ? (
                        <video 
                          src={clip.generatedVideo}
                          className="w-full h-full object-cover rounded"
                          muted
                        />
                      ) : (
                        <div className="text-center text-gray-500">
                          <Play className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-xs">Pending</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{clip.sceneName}</span>
                      <span className="text-[#FFC44D]">${clip.actualCost.toFixed(2)}</span>
                    </div>
                    
                    {/* Generation Status Chip */}
                    {isGenerating && (
                      <div className="mt-2 flex items-center gap-1 px-2 py-0.5 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-full w-fit">
                        <Clock className="w-2.5 h-2.5 text-[#00FFF0]" />
                        <span className="text-[10px] text-[#00FFF0] font-medium">
                          Generating video
                        </span>
                      </div>
                    )}
                    
                    {/* SFX Controls */}
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`p-1 h-6 w-6 ${hasLipsync ? 'text-[#00FFF0]' : 'text-gray-400'}`}
                        onClick={() => setHasLipsync(!hasLipsync)}
                      >
                        <Volume2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`p-1 h-6 w-6 ${hasSFX ? 'text-[#00FFF0]' : 'text-gray-400'}`}
                        onClick={() => setHasSFX(!hasSFX)}
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Audio Settings */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#00FFF0]" />
            Lipsync Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Auto-detect speech</span>
              <Button
                size="sm"
                variant={hasLipsync ? "default" : "outline"}
                className={hasLipsync ? "bg-[#00FFF0] text-black" : "border-[#3AAFA9] text-[#3AAFA9]"}
                onClick={() => setHasLipsync(!hasLipsync)}
              >
                {hasLipsync ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Automatically detect speech patterns and sync with video
            </div>
          </div>
        </div>

        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00FFF0]" />
            Sound Effects
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Background music</span>
              <Button
                size="sm"
                variant={hasSFX ? "default" : "outline"}
                className={hasSFX ? "bg-[#00FFF0] text-black" : "border-[#3AAFA9] text-[#3AAFA9]"}
                onClick={() => setHasSFX(!hasSFX)}
              >
                {hasSFX ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Add ambient sounds and background music
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">FCPXML</span>
            <span className="text-xs text-gray-400">Final Cut Pro</span>
          </Button>
          
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">AAF</span>
            <span className="text-xs text-gray-400">Premiere Pro</span>
          </Button>
          
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">JSON</span>
            <span className="text-xs text-gray-400">Raw Data</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
