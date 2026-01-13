'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { X, Play, Settings, Image, Video, Zap, Loader2, Plus, Info, Maximize2, Sparkles, Palette } from 'lucide-react'
import { FileUpload } from '@/components/ui/fileUpload'
import ImageModal from './ImageModal'
import { saveUserImage, saveUserVideo } from '@/lib/userMedia'

export default function ClipDetailDrawer() {
  const { 
    selectedClip, 
    setSelectedClip, 
    isDrawerOpen, 
    setDrawerOpen,
    updateClip,
    currentProject,
    setClipGeneratingStatus,
    clipGeneratingStatus
  } = useAppStore()
  
  // Get aspect ratio from project story (default to 16:9)
  const aspectRatio = currentProject?.story?.aspectRatio || '16:9'
  
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'elements' | 'settings'>('image')
  const [imageModel, setImageModel] = useState<'flux-2-pro' | 'nano-banana' | 'reeve'>((currentProject?.settings?.imageModel as any) || 'flux-2-pro')
  const [nanoBananaMode, setNanoBananaMode] = useState<'text-to-image' | 'multi-image-edit'>('text-to-image')
  const [remixMode, setRemixMode] = useState<'edit' | 'remix' | 'text-to-image'>('remix')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([''])
  const [nanoBananaInputImages, setNanoBananaInputImages] = useState<string[]>([''])
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoModel, setVideoModel] = useState<'text-to-video' | 'image-to-video' | 'reference-to-video' | 'kling'>('text-to-video')
  const [videoReferenceUrls, setVideoReferenceUrls] = useState<string[]>([''])
  const [videoStartImageUrl, setVideoStartImageUrl] = useState('')
  
  // Local state for editable prompts to ensure they're always editable
  const [localImagePrompt, setLocalImagePrompt] = useState(selectedClip?.imagePrompt || '')
  const [localVideoPrompt, setLocalVideoPrompt] = useState(selectedClip?.videoPrompt || '')
  
  // Image modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)
  
  // Sync local state when selectedClip changes
  useEffect(() => {
    if (selectedClip) {
      setLocalImagePrompt(selectedClip.imagePrompt || '')
      setLocalVideoPrompt(selectedClip.videoPrompt || '')
      
      // Update image model from project settings if not manually changed
      if (currentProject?.settings?.imageModel) {
        setImageModel(currentProject.settings.imageModel as any)
      }
      
      // Sync generating status from global state
      const currentStatus = clipGeneratingStatus[selectedClip.id]
      if (currentStatus === 'image') {
        setIsGeneratingImage(true)
      } else if (currentStatus === 'video') {
        setIsGeneratingVideo(true)
      } else {
        // Only reset if this clip is not generating
        setIsGeneratingImage(false)
        setIsGeneratingVideo(false)
      }
    }
  }, [selectedClip?.id, selectedClip?.imagePrompt, selectedClip?.videoPrompt, clipGeneratingStatus, currentProject?.settings?.imageModel])

  // Auto-switch to image-to-video when image is generated
  useEffect(() => {
    if (selectedClip?.generatedImage && activeTab === 'video') {
      // Check if we should auto-switch to image-to-video
      if (videoModel === 'text-to-video' && !videoStartImageUrl) {
        setVideoModel('image-to-video')
        // Don't auto-set the URL, let it use the generatedImage automatically
      }
    }
  }, [selectedClip?.generatedImage, activeTab, videoModel, videoStartImageUrl])

  // Auto-switch video tab to image-to-video when image is generated and user switches to video tab
  useEffect(() => {
    if (selectedClip?.generatedImage && activeTab === 'video' && videoModel !== 'image-to-video') {
      setVideoModel('image-to-video')
    }
  }, [activeTab, selectedClip?.generatedImage])

  if (!selectedClip || !isDrawerOpen) return null

  const handleUpdateClip = (updates: any) => {
    if (selectedClip) {
      updateClip(selectedClip.id, updates)
    }
  }

  const handleImagePromptChange = (value: string) => {
    setLocalImagePrompt(value)
    // Debounce the update to store to avoid too many updates
    handleUpdateClip({ imagePrompt: value })
  }

  const handleVideoPromptChange = (value: string) => {
    setLocalVideoPrompt(value)
    // Debounce the update to store to avoid too many updates
    handleUpdateClip({ videoPrompt: value })
  }

  const handleGenerateImage = async () => {
    const promptToUse = localImagePrompt.trim()
    if (!promptToUse) {
      alert('Please enter an image prompt first')
      return
    }

    // Validate and log aspect ratio
    const aspectRatioToUse = aspectRatio || '16:9'
    console.log('🎨 Image Generation - Aspect Ratio:', {
      fromProject: currentProject?.story?.aspectRatio,
      resolved: aspectRatioToUse,
      imageModel
    })

    setIsGeneratingImage(true)
    if (selectedClip?.id) {
      setClipGeneratingStatus(selectedClip.id, 'image')
    }
    let lastError: { model: string; error: string } | null = null

    try {
      // Handle flux-2-pro, nano-banana, or reeve via the unified remix API
        const aspectRatioToUse = aspectRatio || '16:9'
        const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
        
      // Prepare request body
      const requestBody: any = {
        imageModel,
        mode: remixMode,
        aspect_ratio: aspectRatioToUse,
            prompt: promptToUse,
          project_id: currentProject?.id,
          clip_id: selectedClip?.id,
      }

      if (validReferences.length > 0) {
        requestBody.reference_image_urls = validReferences
        if (imageModel === 'flux-2-pro') {
          requestBody.mode = 'edit' // Best for consistency
        }
        }
        
        // Get session token for authentication
        const { supabase } = await import('@/lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        
        const response = await fetch('/api/generate-image-remix', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          lastError = { 
          model: imageModel.toUpperCase(), 
          error: errorData.error || 'Failed to generate image'
          }
        throw new Error(errorData.error || 'Failed to generate image')
        }

        const { imageUrl } = await response.json()
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
        if (selectedClip?.id) {
          setClipGeneratingStatus(selectedClip.id, null)
        }
      // Save to user_images table
        await saveUserImage({
          image_url: imageUrl,
          prompt: promptToUse,
        model: imageModel,
          aspect_ratio: aspectRatioToUse,
          project_id: currentProject?.id,
          clip_id: selectedClip?.id,
        storeExternally: true
      })
    } catch (error: any) {
      console.error('Image generation error:', error)
      
      // Show informative error message with model name
      if (lastError) {
        alert(
          `❌ ${lastError.model} Failed\n\n` +
          `Error: ${lastError.error}\n\n` +
          `Please try:\n` +
          `1. Check your API keys\n` +
          `2. Verify your inputs\n` +
          `3. Try a different model`
        )
      } else {
        alert(`Failed to generate image: ${error.message}`)
      }
    } finally {
      setIsGeneratingImage(false)
      if (selectedClip?.id) {
        setClipGeneratingStatus(selectedClip.id, null)
      }
    }
  }

  const addReferenceImageUrl = () => {
    setReferenceImageUrls([...referenceImageUrls, ''])
  }

  const updateReferenceImageUrl = (index: number, value: string) => {
    const updated = [...referenceImageUrls]
    updated[index] = value
    setReferenceImageUrls(updated)
  }

  const removeReferenceImageUrl = (index: number) => {
    const updated = referenceImageUrls.filter((_, i) => i !== index)
    setReferenceImageUrls(updated.length > 0 ? updated : [''])
  }

  const addNanoBananaInputImage = () => {
    setNanoBananaInputImages([...nanoBananaInputImages, ''])
  }

  const updateNanoBananaInputImage = (index: number, value: string) => {
    const updated = [...nanoBananaInputImages]
    updated[index] = value
    setNanoBananaInputImages(updated)
  }

  const removeNanoBananaInputImage = (index: number) => {
    const updated = nanoBananaInputImages.filter((_, i) => i !== index)
    setNanoBananaInputImages(updated.length > 0 ? updated : [''])
  }

  const handleGenerateVideo = async () => {
    const promptToUse = localVideoPrompt.trim()
    if (!promptToUse) {
      alert('Please enter a video prompt first')
      return
    }

    setIsGeneratingVideo(true)
    if (selectedClip?.id) {
      setClipGeneratingStatus(selectedClip.id, 'video')
    }

    try {
      let requestBody: any = {
        prompt: promptToUse,
        duration: selectedClip.duration || 5,
        resolution: '720p',
      }

      // Add model-specific inputs
      if (videoModel === 'kling') {
        // Kling model supports image-to-video
        requestBody.videoModel = 'kling'
        requestBody.aspect_ratio = aspectRatio
        
        // Add image if available (Kling supports image-to-video)
        if (videoStartImageUrl.trim() || selectedClip.generatedImage) {
          requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
        }
      } else if (videoModel === 'image-to-video') {
        requestBody.videoModel = 'vidu'
        if (!videoStartImageUrl.trim() && !selectedClip.generatedImage) {
          alert('Please provide a start image URL or generate an image first')
          setIsGeneratingVideo(false)
          if (selectedClip?.id) {
            setClipGeneratingStatus(selectedClip.id, null)
          }
          return
        }
        requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
      } else if (videoModel === 'reference-to-video') {
        requestBody.videoModel = 'vidu'
        const validRefs = videoReferenceUrls.filter(url => url.trim() !== '')
        if (validRefs.length === 0) {
          alert('Please add at least one reference image URL for reference-to-video')
          setIsGeneratingVideo(false)
          if (selectedClip?.id) {
            setClipGeneratingStatus(selectedClip.id, null)
          }
          return
        }
        requestBody.reference_image_urls = validRefs
        requestBody.aspect_ratio = aspectRatio
      } else {
        // text-to-video
        requestBody.videoModel = 'vidu'
      }

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      // Check content type to handle both JSON and HTML responses
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        let errorData
        let errorText = ''
        
        try {
          if (isJson) {
            errorData = await response.json()
          } else {
            errorText = await response.text()
            console.error('❌ Video generation API error (HTML response):', {
              status: response.status,
              statusText: response.statusText,
              contentType: contentType,
              preview: errorText.substring(0, 500),
            })
            
            // Try to extract error from HTML if it's a Next.js error page
            if (errorText.includes('Error:')) {
              const errorMatch = errorText.match(/Error:([^<]+)/)
              if (errorMatch) {
                throw new Error(`Server error: ${errorMatch[1].trim()}`)
              }
            }
            
            throw new Error(
              `Failed to generate video: Server returned HTML instead of JSON. ` +
              `Status: ${response.status} ${response.statusText}. ` +
              `This usually means the API route encountered an error. Check server logs.`
            )
          }
        } catch (e: any) {
          // If we already have an error from above, rethrow it
          if (e.message && e.message.includes('Failed to generate video')) {
            throw e
          }
          // Otherwise, if parsing failed
          console.error('❌ Video generation API error (parse failed):', e)
          throw new Error(
            `Failed to generate video: ${response.status} ${response.statusText}. ` +
            `Could not parse response as JSON. Check server logs for details.`
          )
        }
        
        console.error('❌ Video generation API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          fullErrorData: JSON.stringify(errorData, null, 2),
        })
        
        // Build a detailed error message from all available fields
        let errorMessage = errorData.error || 'Failed to generate video'
        
        // PRIORITY 1: Show validation message if available (most specific error)
        if (errorData.validationMessage) {
          errorMessage += `\n\nValidation Error:\n${errorData.validationMessage}`
        }
        
        // PRIORITY 2: Show Fal AI validation error if available
        if (errorData.falAiValidationError) {
          const validationError = typeof errorData.falAiValidationError === 'string'
            ? errorData.falAiValidationError
            : JSON.stringify(errorData.falAiValidationError, null, 2)
          errorMessage += `\n\nFal AI Validation Error:\n${validationError.substring(0, 1000)}`
        }
        
        // PRIORITY 3: Show details if available
        if (errorData.details && errorData.details !== errorMessage) {
          errorMessage += `\n\nDetails: ${errorData.details}`
        }
        
        // PRIORITY 4: Show Fal AI error if available and different
        if (errorData.falAiError && 
            errorData.falAiError !== 'No additional details available' &&
            errorData.falAiError !== errorData.details &&
            !errorData.validationMessage) {
          errorMessage += `\n\nFal AI Error: ${errorData.falAiError}`
        }
        
        // Show Kling input if available (for debugging)
        if (errorData.klingInput) {
          console.error('📋 Kling input that failed:', errorData.klingInput)
        }
        
        // Show full error if available (for debugging)
        if (errorData.fullError) {
          console.error('📋 Full error details:', errorData.fullError)
        }
        
        // Add error type if available
        if (errorData.errorType && errorData.errorType !== 'UnknownError') {
          errorMessage += `\n\nError Type: ${errorData.errorType}`
        }
        
        // Add status code if available
        if (errorData.statusCode) {
          errorMessage += `\n\nStatus Code: ${errorData.statusCode}`
        }
        
        throw new Error(errorMessage)
      }

      // Handle successful response
      let responseData
      try {
        if (!isJson) {
          const text = await response.text()
          console.error('❌ Video generation succeeded but got HTML response:', text.substring(0, 500))
          throw new Error(
            'Server returned HTML instead of JSON. This usually indicates a server-side error. ' +
            'Please check the server logs for details.'
          )
        }
        responseData = await response.json()
      } catch (e: any) {
        // If it's already our error, rethrow it
        if (e.message && e.message.includes('Server returned HTML')) {
          throw e
        }
        // Otherwise it's a JSON parse error
        console.error('❌ Failed to parse successful response as JSON:', e)
        throw new Error('Failed to parse server response. The API may have returned invalid JSON.')
      }

      const { videoUrl, duration: generatedDuration } = responseData || {}
      
      if (!videoUrl) {
        console.error('❌ No videoUrl in response:', responseData)
        throw new Error(
          'No video URL returned from server. ' +
          `Response: ${JSON.stringify(responseData).substring(0, 200)}`
        )
      }

      handleUpdateClip({ 
        generatedVideo: videoUrl, 
        previewVideo: videoUrl,
        duration: generatedDuration || selectedClip.duration
      })
      if (selectedClip?.id) {
        setClipGeneratingStatus(selectedClip.id, null)
      }
      // Save to user_videos table and store in Supabase Storage
      await saveUserVideo({
        video_url: videoUrl,
        prompt: promptToUse,
        model: videoModel || 'vidu',
        duration: generatedDuration || selectedClip.duration,
        aspect_ratio: aspectRatio,
        project_id: currentProject?.id,
        clip_id: selectedClip?.id,
        thumbnail_url: selectedClip.generatedImage || undefined,
        storeExternally: true // Automatically download and store in Supabase Storage
      })
    } catch (error: any) {
      console.error('❌ Video generation error:', {
        message: error.message,
        stack: error.stack,
        error: error,
      })
      
      // Display error with more details
      const errorMessage = error.message || 'Failed to generate video'
      alert(errorMessage)
    } finally {
      setIsGeneratingVideo(false)
      if (selectedClip?.id) {
        setClipGeneratingStatus(selectedClip.id, null)
      }
    }
  }

  const addVideoReferenceUrl = () => {
    setVideoReferenceUrls([...videoReferenceUrls, ''])
  }

  const updateVideoReferenceUrl = (index: number, value: string) => {
    const updated = [...videoReferenceUrls]
    updated[index] = value
    setVideoReferenceUrls(updated)
  }

  const removeVideoReferenceUrl = (index: number) => {
    const updated = videoReferenceUrls.filter((_, i) => i !== index)
    setVideoReferenceUrls(updated.length > 0 ? updated : [''])
  }

  const tabs = [
    { id: 'image', label: 'Image', icon: Image },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'elements', label: 'Elements', icon: Zap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={() => setDrawerOpen(false)}
      />
      
      {/* Drawer */}
      <div className="w-96 bg-[#1E1F22] border-l border-[#3AAFA9]/20 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#3AAFA9]/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">{selectedClip.name}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Preview */}
          <div className="h-32 bg-[#0C0C0C] rounded-lg flex items-center justify-center mb-4 relative group">
            {selectedClip.generatedImage ? (
              <>
              <img 
                src={selectedClip.generatedImage} 
                alt={selectedClip.name}
                className="w-full h-full object-cover rounded-lg"
              />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setModalImageUrl(selectedClip.generatedImage || null)
                    setIsImageModalOpen(true)
                  }}
                  className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 rounded-full border border-[#00FFF0]/50 backdrop-blur-sm"
                  aria-label="Expand image preview"
                >
                  <Maximize2 className="w-6 h-6 text-[#00FFF0]" />
                </Button>
              </>
            ) : (
              <div className="text-center text-gray-500">
                <Play className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Preview Pending</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#3AAFA9]/20">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[#00FFF0] border-b-2 border-[#00FFF0]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'image' && (
            <div className="space-y-4">
              {/* General Help Info for Reeve/Remix */}
              {imageModel === 'reeve' && (
                <div className="p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/30 mb-4">
                  <p className="text-sm text-blue-300 font-medium mb-2">
                    🎨 About Reeve Remix
                  </p>
                  <p className="text-xs text-blue-200/90 leading-relaxed">
                    Reeve offers three modes: <strong>Edit</strong> and <strong>Remix</strong> require reference images, 
                    while <strong>Text-to-Image</strong> uses a dedicated endpoint for pure text-to-image generation (no reference images needed).
                  </p>
                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                    <p className="text-xs text-blue-300 font-medium">Quick Guide:</p>
                    <ul className="text-xs text-blue-200/80 mt-1 space-y-1 ml-4 list-disc">
                      <li><strong>Edit Mode:</strong> Reference images required, prompt optional</li>
                      <li><strong>Remix Mode:</strong> Both prompt and reference images required</li>
                      <li><strong>Text-to-Image Mode:</strong> Only prompt required (pure text-to-image)</li>
                    </ul>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cinematography Engine
                </label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <Button
                    variant={imageModel === 'flux-2-pro' ? 'default' : 'outline'}
                    onClick={() => setImageModel('flux-2-pro')}
                    className={imageModel === 'flux-2-pro' 
                      ? 'bg-[#00FFF0] text-black border-[#00FFF0]' 
                      : 'border-[#3AAFA9]/50 text-gray-400 hover:text-white hover:border-[#00FFF0]'}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Premium (FLUX.2 Pro)</span>
                    </div>
                  </Button>
                  <Button
                    variant={imageModel === 'nano-banana' ? 'default' : 'outline'}
                    onClick={() => setImageModel('nano-banana')}
                    className={imageModel === 'nano-banana' 
                      ? 'bg-[#00FFF0] text-black border-[#00FFF0]' 
                      : 'border-[#3AAFA9]/50 text-gray-400 hover:text-white hover:border-[#00FFF0]'}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Hyper-Fast (Nano Banana)</span>
                    </div>
                  </Button>
                  <Button
                    variant={imageModel === 'reeve' ? 'default' : 'outline'}
                    onClick={() => setImageModel('reeve')}
                    className={imageModel === 'reeve' 
                      ? 'bg-[#00FFF0] text-black border-[#00FFF0]' 
                      : 'border-[#3AAFA9]/50 text-gray-400 hover:text-white hover:border-[#00FFF0]'}
                  >
                    <div className="flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" />
                      <span>Artistic (Reeve)</span>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Mode Selection for Nano Banana - Sub-selection */}
              {imageModel === 'nano-banana' && (
                <div className="ml-4 pl-4 border-l-2 border-[#00FFF0]/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Mode Selection
                  </label>
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <Button
                      variant={nanoBananaMode === 'text-to-image' ? 'default' : 'outline'}
                      onClick={() => setNanoBananaMode('text-to-image')}
                      size="sm"
                      className={nanoBananaMode === 'text-to-image' 
                        ? 'bg-[#00FFF0] text-black' 
                        : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black text-xs'}
                    >
                      Text to Image
                    </Button>
                    <Button
                      variant={nanoBananaMode === 'multi-image-edit' ? 'default' : 'outline'}
                      onClick={() => setNanoBananaMode('multi-image-edit')}
                      size="sm"
                      className={nanoBananaMode === 'multi-image-edit' 
                        ? 'bg-[#00FFF0] text-black' 
                        : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black text-xs'}
                    >
                      Multi-Image Edit
                    </Button>
                  </div>
                  {nanoBananaMode === 'text-to-image' && (
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/20 rounded-lg">
                      <p className="text-xs text-[#00FFF0]">
                        💡 Generate images purely from text. Enter a detailed prompt describing your desired image.
                      </p>
                    </div>
                  )}
                  {nanoBananaMode === 'multi-image-edit' && (
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/20 rounded-lg">
                      <p className="text-xs text-[#00FFF0]">
                        💡 Manipulate and combine multiple input images. Upload 2+ images and describe how to blend, transform, or merge them.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode Selection for Reeve/Remix - Sub-selection */}
              {imageModel === 'reeve' && (
                <div className="ml-4 pl-4 border-l-2 border-[#00FFF0]/30">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Mode Selection
                  </label>
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <Button
                      variant={remixMode === 'edit' ? 'default' : 'outline'}
                      onClick={() => setRemixMode('edit')}
                      size="sm"
                      className={remixMode === 'edit' 
                        ? 'bg-[#00FFF0] text-black' 
                        : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black text-xs'}
                    >
                      Edit
                    </Button>
                    <Button
                      variant={remixMode === 'remix' ? 'default' : 'outline'}
                      onClick={() => setRemixMode('remix')}
                      size="sm"
                      className={remixMode === 'remix' 
                        ? 'bg-[#00FFF0] text-black' 
                        : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black text-xs'}
                    >
                      Remix
                    </Button>
                    <Button
                      variant={remixMode === 'text-to-image' ? 'default' : 'outline'}
                      onClick={() => setRemixMode('text-to-image')}
                      size="sm"
                      className={remixMode === 'text-to-image' 
                        ? 'bg-[#00FFF0] text-black' 
                        : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black text-xs'}
                    >
                      Text to Image
                    </Button>
                  </div>
                  {remixMode === 'edit' && (
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/20 rounded-lg">
                      <p className="text-xs text-[#00FFF0]">
                        💡 Edit mode: Transform images using reference images. Upload one or more images to edit and transform them.
                      </p>
                    </div>
                  )}
                  {remixMode === 'remix' && (
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/20 rounded-lg">
                      <p className="text-xs text-[#00FFF0]">
                        💡 Remix mode: Combine and transform reference images with a prompt. Perfect for style transfers and creative transformations.
                      </p>
                    </div>
                  )}
                  {remixMode === 'text-to-image' && (
                    <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-xs text-green-300 font-medium mb-1">
                        ✨ Pure Text-to-Image Generation
                      </p>
                      <p className="text-xs text-green-200/90 leading-relaxed">
                        This mode uses <strong>fal-ai/reve/text-to-image</strong> endpoint for true text-to-image generation. 
                        No reference images needed - just enter your prompt and generate!
                      </p>
                      <ul className="text-xs text-green-200/80 space-y-1 ml-4 mt-2 list-disc">
                        <li>Only requires a text prompt</li>
                        <li>No reference images needed</li>
                        <li>Perfect for generating images from scratch</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Image Prompt - Hidden for Reeve Edit mode, shown for others */}
              {(imageModel !== 'reeve' || remixMode !== 'edit') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Image Prompt
                    {imageModel === 'reeve' && remixMode === 'remix' && (
                      <span className="text-xs text-gray-400 ml-2">(Required for Remix mode)</span>
                    )}
                    {imageModel === 'reeve' && remixMode === 'text-to-image' && (
                      <span className="text-xs text-gray-400 ml-2">(Required for Text-to-Image mode)</span>
                    )}
                </label>
                <Textarea
                    value={localImagePrompt}
                    onChange={(e) => handleImagePromptChange(e.target.value)}
                    placeholder={
                      imageModel === 'nano-banana' && nanoBananaMode === 'multi-image-edit'
                        ? "Describe how to manipulate and combine the input images (e.g., 'Blend the first image's style with the second image's subject')..."
                        : imageModel === 'reeve' && remixMode === 'text-to-image'
                        ? "Describe the image you want to generate from text..."
                        : imageModel === 'reeve' && remixMode === 'remix'
                        ? "Describe how to combine and transform the reference images (e.g., 'Blend the style of the first image with the content of the second')..."
                        : "Describe the image you want to generate..."
                    }
                  className="w-full h-24 bg-[#0C0C0C] border-[#3AAFA9] text-white placeholder:text-gray-400 
                           focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/20 focus:outline-none
                           rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              )}

              {/* Reference Images - Required for Reeve (Edit/Remix modes only, not Text-to-Image) */}
              {imageModel === 'reeve' && remixMode !== 'text-to-image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reference Images
                  </label>
                  <div className="mb-3 space-y-2">
                    {remixMode === 'edit' && (
                      <div className="p-2 bg-[#1E1F22] rounded-lg border border-[#3AAFA9]/20">
                        <p className="text-xs text-gray-300 mb-1">
                          <strong>Edit Mode:</strong> Upload reference images to edit and transform them.
                        </p>
                        <p className="text-xs text-gray-400">
                          • Add 1-3 reference images<br/>
                          • Prompt is optional - helps guide the transformation<br/>
                          • Images will be edited based on your prompt (if provided)
                        </p>
                      </div>
                    )}
                    {remixMode === 'remix' && (
                      <div className="p-2 bg-[#1E1F22] rounded-lg border border-[#3AAFA9]/20">
                        <p className="text-xs text-gray-300 mb-1">
                          <strong>Remix Mode:</strong> Combine and transform reference images with your prompt.
                        </p>
                        <p className="text-xs text-gray-400">
                          • Add 1-3 reference images (required)<br/>
                          • Enter a prompt describing how to blend/transform them (required)<br/>
                          • Perfect for style transfers and creative combinations
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {referenceImageUrls.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <FileUpload
                          onFileSelect={(uploadedUrl) => {
                            if (uploadedUrl) {
                              updateReferenceImageUrl(index, uploadedUrl)
                            } else {
                              removeReferenceImageUrl(index)
                            }
                          }}
                          accept="image/*"
                          currentUrl={url || undefined}
                          label={`Reference Image ${index + 1}`}
                          placeholder="Drag & drop or click to upload reference image"
                          className="mb-2"
                        />
                        {url && (
                          <div className="flex gap-2">
                            <Input
                              value={url}
                              onChange={(e) => updateReferenceImageUrl(index, e.target.value)}
                              placeholder="Or paste image URL here"
                              className="flex-1 bg-[#0C0C0C] border-[#3AAFA9] text-white text-sm"
                            />
                            {referenceImageUrls.length > 1 && (
              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeReferenceImageUrl(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addReferenceImageUrl}
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Reference Image
                    </Button>
                  </div>
                  {remixMode === 'edit' && (
                    <div className="mt-3 p-2 bg-[#1E1F22] rounded text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">About Edit Mode:</p>
                      <p className="ml-2">
                        Edit mode transforms your reference images directly. Upload one or more images to edit them. Prompt is optional for this mode.
                      </p>
                    </div>
                  )}
                  {remixMode === 'remix' && (
                    <div className="mt-3 p-2 bg-[#1E1F22] rounded text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">About Remix Mode:</p>
                      <p className="ml-2">
                        Remix combines and transforms your reference images based on your prompt. Perfect for style transfers, combining elements, and creative image transformations.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Input Images Section - Only shown for Multi-Image Edit mode */}
              {imageModel === 'nano-banana' && nanoBananaMode === 'multi-image-edit' && (
                <div className="ml-4 pl-4 border-l-2 border-[#00FFF0]/30">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Input Images - Provide multiple images to manipulate and combine
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Add 2 or more images that will be manipulated, blended, or transformed based on your prompt
                  </p>
                  <div className="space-y-3">
                    {nanoBananaInputImages.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <FileUpload
                          onFileSelect={(uploadedUrl) => {
                            if (uploadedUrl) {
                              updateNanoBananaInputImage(index, uploadedUrl)
                            } else {
                              removeNanoBananaInputImage(index)
                            }
                          }}
                          accept="image/*"
                          currentUrl={url || undefined}
                          label={`Input Image ${index + 1}`}
                          placeholder="Drag & drop or click to upload input image"
                        />
                        {url && (
                          <div className="flex gap-2">
                            <Input
                              value={url}
                              onChange={(e) => updateNanoBananaInputImage(index, e.target.value)}
                              placeholder="Or paste image URL here"
                              className="flex-1 bg-[#0C0C0C] border-[#3AAFA9] text-white text-sm"
                            />
                            {nanoBananaInputImages.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeNanoBananaInputImage(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addNanoBananaInputImage}
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Input Image
                    </Button>
                  </div>
                  <div className="mt-3 p-2 bg-[#1E1F22] rounded text-xs text-gray-400">
                    <p className="font-medium text-gray-300 mb-1">Example Use Cases:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Blend multiple images together</li>
                      <li>Transfer styles between images</li>
                      <li>Combine elements from different images</li>
                      <li>Transform images based on prompt</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Help text for Text to Image mode */}
              {imageModel === 'nano-banana' && nanoBananaMode === 'text-to-image' && (
                <div className="ml-4 pl-4 border-l-2 border-[#00FFF0]/30">
                  <div className="p-2 bg-[#1E1F22] rounded-lg border border-[#3AAFA9]/20">
                    <p className="text-xs text-gray-400">
                      ✨ Text to Image mode generates images purely from your text prompt. No input images required - just enter a detailed description.
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleGenerateImage}
                disabled={
                  isGeneratingImage || 
                  clipGeneratingStatus[selectedClip.id] === 'image' ||
                  (imageModel === 'reeve' && remixMode === 'edit' && referenceImageUrls.filter(url => url.trim() !== '').length === 0) ||
                  (imageModel === 'reeve' && remixMode === 'remix' && (!localImagePrompt?.trim() || referenceImageUrls.filter(url => url.trim() !== '').length === 0)) ||
                  (imageModel === 'reeve' && remixMode === 'text-to-image' && !localImagePrompt?.trim()) ||
                  (imageModel !== 'reeve' && !localImagePrompt?.trim())
                }
                className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isGeneratingImage || clipGeneratingStatus[selectedClip.id] === 'image') ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                <Image className="w-4 h-4 mr-2" />
                    Generate Preview Image
                  </>
                )}
              </Button>

              {selectedClip.generatedImage && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Generated Preview
                  </label>
                  <div className="bg-[#0C0C0C] rounded-lg p-2 relative group">
                    <img 
                      src={selectedClip.generatedImage} 
                      alt="Generated preview"
                      className="w-full rounded-lg"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setModalImageUrl(selectedClip.generatedImage || null)
                        setIsImageModalOpen(true)
                      }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 rounded-full border border-[#00FFF0]/50 backdrop-blur-sm"
                      aria-label="Expand image preview"
                    >
                      <Maximize2 className="w-5 h-5 text-[#00FFF0]" />
              </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Model
                </label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <Button
                    variant={videoModel === 'text-to-video' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('text-to-video')}
                    className={videoModel === 'text-to-video' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Text to Video (Vidu)
                  </Button>
                  <Button
                    variant={videoModel === 'image-to-video' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('image-to-video')}
                    className={videoModel === 'image-to-video' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Image to Video (Vidu)
                  </Button>
                  <Button
                    variant={videoModel === 'reference-to-video' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('reference-to-video')}
                    className={videoModel === 'reference-to-video' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Reference to Video (Vidu)
                  </Button>
                  <Button
                    variant={videoModel === 'kling' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('kling')}
                    className={videoModel === 'kling' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Kling v1.6 (Standard Elements)
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Prompt
                </label>
                <Textarea
                  value={localVideoPrompt}
                  onChange={(e) => handleVideoPromptChange(e.target.value)}
                  placeholder="Describe the video motion you want..."
                  className="w-full h-24 bg-[#0C0C0C] border-[#3AAFA9] text-white placeholder:text-gray-400 
                           focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/20 focus:outline-none
                           rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              
              {(videoModel === 'image-to-video' || videoModel === 'kling') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Image {videoModel === 'kling' && '(Optional)'}
                  </label>
                  {selectedClip.generatedImage && (
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-[#00FFF0] mb-2">
                        <Image className="w-3 h-3" />
                        <span>Using generated image from Image tab automatically</span>
                      </div>
                      <img 
                        src={selectedClip.generatedImage} 
                        alt="Generated image" 
                        className="w-full rounded max-h-32 object-cover"
                      />
                    </div>
                  )}
                  <FileUpload
                    onFileSelect={(uploadedUrl) => {
                      setVideoStartImageUrl(uploadedUrl)
                    }}
                    accept="image/*"
                    currentUrl={videoStartImageUrl || undefined}
                    label={selectedClip.generatedImage ? "Or upload custom start image" : "Upload start image"}
                    placeholder="Drag & drop or click to upload start image"
                    className="mb-2"
                  />
                  {videoStartImageUrl && (
                    <Input
                      value={videoStartImageUrl}
                      onChange={(e) => setVideoStartImageUrl(e.target.value)}
                      placeholder="Or paste image URL here"
                      className="w-full bg-[#0C0C0C] border-[#3AAFA9] text-white text-sm mt-2"
                    />
                  )}
                  {videoModel === 'image-to-video' && selectedClip.generatedImage && !videoStartImageUrl && (
                    <p className="text-xs text-[#00FFF0] mt-2">
                      ✓ Will use the generated image above automatically if no custom image is provided
                    </p>
                  )}
                  {videoModel === 'kling' && (
                    <p className="text-xs text-gray-400 mt-2">
                      💡 Kling supports both text-to-video and image-to-video. Image is optional but recommended for better results.
                    </p>
                  )}
                </div>
              )}

              {videoModel === 'reference-to-video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reference Images - For consistent characters
                  </label>
                  <div className="space-y-3">
                    {videoReferenceUrls.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <FileUpload
                          onFileSelect={(uploadedUrl) => {
                            if (uploadedUrl) {
                              updateVideoReferenceUrl(index, uploadedUrl)
                            } else {
                              removeVideoReferenceUrl(index)
                            }
                          }}
                          accept="image/*"
                          currentUrl={url || undefined}
                          label={`Reference Image ${index + 1}`}
                          placeholder="Drag & drop or click to upload reference image"
                        />
                        {url && (
                          <div className="flex gap-2">
                            <Input
                              value={url}
                              onChange={(e) => updateVideoReferenceUrl(index, e.target.value)}
                              placeholder="Or paste image URL here"
                              className="flex-1 bg-[#0C0C0C] border-[#3AAFA9] text-white text-sm"
                            />
                            {videoReferenceUrls.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeVideoReferenceUrl(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                <Button
                  variant="outline"
                      size="sm"
                      onClick={addVideoReferenceUrl}
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Reference Image
                    </Button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedClip.duration === 5 ? 'default' : 'outline'}
                    className={selectedClip.duration === 5 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  onClick={() => handleUpdateClip({ duration: 5 })}
                >
                  5s
                </Button>
                <Button
                    variant={selectedClip.duration === 10 ? 'default' : 'outline'}
                    className={selectedClip.duration === 10 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  onClick={() => handleUpdateClip({ duration: 10 })}
                >
                  10s
                </Button>
                </div>
              </div>
              
              <Button
                onClick={handleGenerateVideo}
                disabled={!localVideoPrompt?.trim() || isGeneratingVideo || clipGeneratingStatus[selectedClip.id] === 'video'}
                className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isGeneratingVideo || clipGeneratingStatus[selectedClip.id] === 'video') ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                <Video className="w-4 h-4 mr-2" />
                Generate Video
                  </>
                )}
              </Button>

              {selectedClip.generatedVideo && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Generated Video
                  </label>
                  <div className="bg-[#0C0C0C] rounded-lg p-2">
                    <video
                      src={selectedClip.generatedVideo}
                      controls
                      className="w-full rounded-lg"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className="mt-2">
                    <a
                      href={selectedClip.generatedVideo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00FFF0] hover:underline text-sm"
                    >
                      Open video in new tab
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'elements' && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">Kling AI Elements</h3>
                <p className="text-sm text-gray-400">
                  Apply advanced post-processing effects to your generated videos using Kling AI's editing capabilities.
                  These elements modify your existing video to add or remove elements while maintaining consistency.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/20">
                  <div className="flex items-start gap-2 mb-3">
                    <h4 className="font-medium text-white">Face Swap</h4>
                    <div className="group relative">
                      <Info className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Replace faces in your video with reference faces. Upload a face image and it will be swapped consistently throughout the video.
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Input Required:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Face reference image (JPG/PNG)</li>
                        <li>Video with person's face visible</li>
                      </ul>
                    </div>
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Output:</p>
                      <p className="ml-2">Video with faces replaced while maintaining motion and scene consistency</p>
                    </div>
                  <Button
                    variant="outline"
                    size="sm"
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                  >
                    Upload Face Reference
                  </Button>
                  </div>
                </div>
                
                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/20">
                  <div className="flex items-start gap-2 mb-3">
                    <h4 className="font-medium text-white">Object Replace</h4>
                    <div className="group relative">
                      <Info className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Replace specific objects in your video with different objects while preserving the scene and motion.
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Input Required:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Original object to replace (select from video)</li>
                        <li>Replacement object image or description</li>
                      </ul>
                    </div>
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Output:</p>
                      <p className="ml-2">Video with objects swapped seamlessly throughout all frames</p>
                    </div>
                  <Button
                    variant="outline"
                    size="sm"
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                  >
                      Add Object Replacement
                  </Button>
                  </div>
                </div>
                
                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/20">
                  <div className="flex items-start gap-2 mb-3">
                    <h4 className="font-medium text-white">Object Remove</h4>
                    <div className="group relative">
                      <Info className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Remove unwanted objects from your video. The AI will intelligently fill in the background and maintain scene consistency.
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Input Required:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Video with object to remove</li>
                        <li>Selection of object/area to remove (brush or bounding box)</li>
                      </ul>
                    </div>
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Output:</p>
                      <p className="ml-2">Clean video with object removed and background seamlessly filled</p>
                    </div>
                  <Button
                    variant="outline"
                    size="sm"
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                  >
                      Select Object to Remove
                  </Button>
                  </div>
                </div>

                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/20">
                  <div className="flex items-start gap-2 mb-3">
                    <h4 className="font-medium text-white">Style Transfer</h4>
                    <div className="group relative">
                      <Info className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Apply artistic styles to your video while preserving motion and content. Transform your video into different visual styles.
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Input Required:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Video to style</li>
                        <li>Style reference image or style name</li>
                      </ul>
                    </div>
                    <div className="bg-[#1E1F22] rounded p-2 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Output:</p>
                      <p className="ml-2">Video with new style applied consistently across all frames</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      Apply Style
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#1E1F22]/50 rounded-lg border border-[#00FFF0]/20">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#00FFF0] mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-gray-400">
                    <p className="font-medium text-[#00FFF0] mb-1">How it works:</p>
                    <p className="mb-2">All Kling Elements work on your generated video clips. They use AI to modify existing videos rather than generating new ones from scratch.</p>
                    <p className="mb-2">After generating a video, you can apply these elements to refine and enhance it. Each element processes the video frame-by-frame to maintain consistency.</p>
                    <p>Note: Elements are applied to the final generated video, not the source images or prompts.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Clip Name
                </label>
                <Input
                  value={selectedClip.name}
                  onChange={(e) => handleUpdateClip({ name: e.target.value })}
                  className="w-full bg-[#0C0C0C] border-[#3AAFA9] text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quality
                </label>
                <select
                  value={selectedClip.quality}
                  onChange={(e) => handleUpdateClip({ quality: e.target.value })}
                  className="w-full bg-[#0C0C0C] border border-[#3AAFA9] text-white rounded-lg px-3 py-2"
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Lock Clip</span>
                <Button
                  size="sm"
                  variant={selectedClip.locked ? "default" : "outline"}
                  className={selectedClip.locked ? "bg-[#00FFF0] text-black" : "border-[#3AAFA9] text-[#3AAFA9]"}
                  onClick={() => handleUpdateClip({ locked: !selectedClip.locked })}
                >
                  {selectedClip.locked ? 'Locked' : 'Unlocked'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Image Modal */}
      <ImageModal
        imageUrl={modalImageUrl || ''}
        alt={selectedClip?.name || 'Preview'}
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false)
          setModalImageUrl(null)
        }}
      />
    </div>
  )
}
