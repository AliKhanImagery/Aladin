'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { X, Play, Settings, Image, Video, Zap, Loader2, Plus, Info, Maximize2 } from 'lucide-react'
import { FileUpload } from '@/components/ui/fileUpload'
import ImageModal from './ImageModal'

export default function ClipDetailDrawer() {
  const { 
    selectedClip, 
    setSelectedClip, 
    isDrawerOpen, 
    setDrawerOpen,
    updateClip,
    currentProject
  } = useAppStore()
  
  // Get aspect ratio from project story (default to 16:9)
  const aspectRatio = currentProject?.story?.aspectRatio || '16:9'
  
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'elements' | 'settings'>('image')
  const [imageModel, setImageModel] = useState<'openai' | 'fal-ai' | 'nano-banana' | 'remix'>('openai')
  const [nanoBananaMode, setNanoBananaMode] = useState<'text-to-image' | 'multi-image-edit'>('text-to-image')
  const [remixMode, setRemixMode] = useState<'edit' | 'remix' | 'text-to-image'>('remix')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([''])
  const [nanoBananaInputImages, setNanoBananaInputImages] = useState<string[]>([''])
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoModel, setVideoModel] = useState<'text-to-video' | 'image-to-video' | 'reference-to-video'>('text-to-video')
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
    }
  }, [selectedClip?.id, selectedClip?.imagePrompt, selectedClip?.videoPrompt])

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
    let lastError: { model: string; error: string } | null = null

    try {
      if (imageModel === 'openai') {
        // OpenAI DALL-E - uses pixel dimensions, not aspect ratio strings
        // Map aspect ratio to DALL-E size
        const aspectRatioToUse = aspectRatio || '16:9'
        let dallESize = '1024x1024' // default 1:1
        if (aspectRatioToUse === '16:9') {
          dallESize = '1792x1024' // landscape
        } else if (aspectRatioToUse === '9:16') {
          dallESize = '1024x1792' // portrait
        } else if (aspectRatioToUse === '1:1') {
          dallESize = '1024x1024' // square
        }
        
        console.log('🎨 OpenAI DALL-E - Mapped aspect ratio:', { aspectRatio: aspectRatioToUse, size: dallESize })

        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptToUse,
            model: 'dall-e-3',
            size: dallESize,
            quality: 'hd',
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          lastError = { model: 'OpenAI DALL-E', error: errorData.error || 'Failed to generate image' }
          throw new Error(errorData.error || 'Failed to generate image')
        }

        const { imageUrl } = await response.json()
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
      } else if (imageModel === 'fal-ai') {
        // Fal AI Vidu with reference images
        const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
        
        if (validReferences.length === 0) {
          alert('Please add at least one reference image URL for Fal AI')
          setIsGeneratingImage(false)
          return
        }

        const aspectRatioToUse = aspectRatio || '16:9'
        console.log('🎨 Fal AI Vidu - Aspect ratio:', aspectRatioToUse)
        
        const response = await fetch('/api/generate-image-fal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptToUse,
            reference_image_urls: validReferences,
            aspect_ratio: aspectRatioToUse, // String format: "16:9", "9:16", "1:1"
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          lastError = { model: 'Fal AI Vidu', error: errorData.error || 'Failed to generate image' }
          throw new Error(errorData.error || 'Failed to generate image')
        }

        const { imageUrl } = await response.json()
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
      } else if (imageModel === 'remix') {
        const aspectRatioToUse = aspectRatio || '16:9'
        console.log('🎨 Fal AI Reve Remix - Mode:', remixMode, 'Aspect ratio:', aspectRatioToUse)

        // Validate inputs based on mode
        if (remixMode === 'edit') {
          // Edit mode: requires reference images, prompt is optional
          const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
          if (validReferences.length === 0) {
            alert('Please add at least one reference image URL for Edit mode')
            setIsGeneratingImage(false)
            return
          }
        } else if (remixMode === 'remix') {
          // Remix mode: requires both prompt and reference images
          const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
          if (validReferences.length === 0) {
            alert('Please add at least one reference image URL for Remix mode')
            setIsGeneratingImage(false)
            return
          }
          if (!promptToUse) {
            alert('Please enter a prompt for Remix mode')
            setIsGeneratingImage(false)
            return
          }
        } else if (remixMode === 'text-to-image') {
          // Text-to-image mode: requires only prompt, no images
          if (!promptToUse) {
            alert('Please enter a prompt for Text-to-Image mode')
            setIsGeneratingImage(false)
            return
          }
        }

        // Prepare request body based on mode
        const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
        const requestBody: any = {
          mode: remixMode,
          aspect_ratio: aspectRatioToUse, // String format: "16:9", "9:16", "1:1"
        }

        // Add prompt only for remix and text-to-image modes
        if (remixMode === 'remix' || remixMode === 'text-to-image') {
          requestBody.prompt = promptToUse
        }

        // Add reference images only for edit and remix modes
        if (remixMode === 'edit' || remixMode === 'remix') {
          requestBody.reference_image_urls = validReferences
        }
        
        const response = await fetch('/api/generate-image-remix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          
          // Parse error details for better user experience
          let errorMessage = errorData.error || 'Failed to generate image'
          let errorDetails = errorData.details || ''
          const errorHint = errorData.hint || ''
          const statusCode = errorData.statusCode || response.status
          
          // For ValidationError (422), format the details nicely
          if (statusCode === 422 && errorDetails) {
            errorMessage = 'Validation Error: Invalid Parameters'
            if (typeof errorDetails === 'string') {
              errorDetails = errorDetails
            } else {
              errorDetails = JSON.stringify(errorDetails)
            }
          }
          
          // Combine message and details
          let fullErrorMessage = errorMessage
          if (errorDetails && errorDetails !== errorMessage) {
            fullErrorMessage += `\n\nDetails: ${errorDetails}`
          }
          if (errorHint) {
            fullErrorMessage += `\n\n💡 ${errorHint}`
          }
          
          lastError = { 
            model: 'Fal AI Reve Remix', 
            error: fullErrorMessage
          }
          throw new Error(errorMessage)
        }

        const { imageUrl } = await response.json()
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
      } else if (imageModel === 'nano-banana') {
        // Fal AI Nano Banana - supports two modes
        const aspectRatioToUse = aspectRatio || '16:9'
        console.log('🎨 Fal AI Nano Banana - Aspect ratio:', aspectRatioToUse, 'Mode:', nanoBananaMode)
        
        let requestBody: any = {
          prompt: promptToUse,
          mode: nanoBananaMode,
          aspect_ratio: aspectRatioToUse, // String format: "16:9", "9:16", "1:1"
        }

        // Multi-image-edit mode requires input images
        if (nanoBananaMode === 'multi-image-edit') {
          const validInputImages = nanoBananaInputImages.filter(url => url.trim() !== '')
          
          if (validInputImages.length === 0) {
            alert('Please add at least one input image for Multi-image-edit mode')
            setIsGeneratingImage(false)
            return
          }
          
          requestBody.input_images = validInputImages
        }

        const response = await fetch('/api/generate-image-nano-banana', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          lastError = { model: 'Fal AI Nano Banana', error: errorData.error || 'Failed to generate image' }
          throw new Error(errorData.error || 'Failed to generate image')
        }

        const { imageUrl } = await response.json()
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
      }
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

    try {
      let requestBody: any = {
        prompt: promptToUse,
        duration: selectedClip.duration || 5,
        resolution: '720p',
      }

      // Add model-specific inputs
      if (videoModel === 'image-to-video') {
        if (!videoStartImageUrl.trim() && !selectedClip.generatedImage) {
          alert('Please provide a start image URL or generate an image first')
          setIsGeneratingVideo(false)
          return
        }
        requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
      } else if (videoModel === 'reference-to-video') {
        const validRefs = videoReferenceUrls.filter(url => url.trim() !== '')
        if (validRefs.length === 0) {
          alert('Please add at least one reference image URL for reference-to-video')
          setIsGeneratingVideo(false)
          return
        }
        requestBody.reference_image_urls = validRefs
        requestBody.aspect_ratio = aspectRatio
      }

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate video')
      }

      const { videoUrl, duration: generatedDuration } = await response.json()
      handleUpdateClip({ 
        generatedVideo: videoUrl, 
        previewVideo: videoUrl,
        duration: generatedDuration || selectedClip.duration
      })
    } catch (error: any) {
      console.error('Video generation error:', error)
      alert(`Failed to generate video: ${error.message}`)
    } finally {
      setIsGeneratingVideo(false)
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Image Model
                </label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <Button
                    variant={imageModel === 'openai' ? 'default' : 'outline'}
                    onClick={() => setImageModel('openai')}
                    className={imageModel === 'openai' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    OpenAI DALL-E
                  </Button>
                  <Button
                    variant={imageModel === 'fal-ai' ? 'default' : 'outline'}
                    onClick={() => setImageModel('fal-ai')}
                    className={imageModel === 'fal-ai' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Fal AI Vidu
                  </Button>
                  <Button
                    variant={imageModel === 'nano-banana' ? 'default' : 'outline'}
                    onClick={() => setImageModel('nano-banana')}
                    className={imageModel === 'nano-banana' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Ultra Mode
                  </Button>
                  <Button
                    variant={imageModel === 'remix' ? 'default' : 'outline'}
                    onClick={() => setImageModel('remix')}
                    className={imageModel === 'remix' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Remix
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

              {/* Mode Selection for Remix - Sub-selection */}
              {imageModel === 'remix' && (
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
                    <div className="mb-3 p-2 bg-[#00FFF0]/10 border border-[#00FFF0]/20 rounded-lg">
                      <p className="text-xs text-[#00FFF0]">
                        💡 Text-to-Image mode: Generate images purely from text. Enter a detailed prompt describing your desired image.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Image Prompt - Hidden for Remix Edit mode, shown for others */}
              {(imageModel !== 'remix' || remixMode !== 'edit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Image Prompt
                    {imageModel === 'remix' && remixMode === 'remix' && (
                      <span className="text-xs text-gray-400 ml-2">(Required for Remix mode)</span>
                    )}
                    {imageModel === 'remix' && remixMode === 'text-to-image' && (
                      <span className="text-xs text-gray-400 ml-2">(Required for Text-to-Image mode)</span>
                    )}
                  </label>
                  <Textarea
                    value={localImagePrompt}
                    onChange={(e) => handleImagePromptChange(e.target.value)}
                    placeholder={
                      imageModel === 'nano-banana' && nanoBananaMode === 'multi-image-edit'
                        ? "Describe how to manipulate and combine the input images (e.g., 'Blend the first image's style with the second image's subject')..."
                        : imageModel === 'remix' && remixMode === 'text-to-image'
                        ? "Describe the image you want to generate from text..."
                        : imageModel === 'remix' && remixMode === 'remix'
                        ? "Describe how to combine and transform the reference images (e.g., 'Blend the style of the first image with the content of the second')..."
                        : "Describe the image you want to generate..."
                    }
                    className="w-full h-24 bg-[#0C0C0C] border-[#3AAFA9] text-white placeholder:text-gray-400 
                             focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/20 focus:outline-none
                             rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
              )}

              {/* Reference Images - Only shown for Fal AI Vidu and Remix (Edit/Remix modes) */}
              {(imageModel === 'fal-ai' || (imageModel === 'remix' && (remixMode === 'edit' || remixMode === 'remix'))) && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reference Images
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    {imageModel === 'remix' && remixMode === 'edit'
                      ? 'Upload one or more reference images to edit and transform them. No prompt needed for edit mode.'
                      : imageModel === 'remix' && remixMode === 'remix'
                      ? 'Upload reference images to combine and transform via your prompt. Remix lets you blend multiple images together.'
                      : 'Upload reference images to maintain consistent character appearance across generations'
                    }
                  </p>
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
                  {imageModel === 'remix' && remixMode === 'edit' && (
                    <div className="mt-3 p-2 bg-[#1E1F22] rounded text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">About Edit Mode:</p>
                      <p className="ml-2">
                        Edit mode transforms your reference images directly. Upload one or more images to edit them. Prompt is optional for this mode.
                      </p>
                    </div>
                  )}
                  {imageModel === 'remix' && remixMode === 'remix' && (
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
                  (imageModel === 'remix' && remixMode === 'edit' && referenceImageUrls.filter(url => url.trim() !== '').length === 0) ||
                  (imageModel === 'remix' && remixMode === 'remix' && (!localImagePrompt?.trim() || referenceImageUrls.filter(url => url.trim() !== '').length === 0)) ||
                  (imageModel === 'remix' && remixMode === 'text-to-image' && !localImagePrompt?.trim()) ||
                  (imageModel !== 'remix' && !localImagePrompt?.trim())
                }
                className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingImage ? (
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
                    Text to Video
                  </Button>
                  <Button
                    variant={videoModel === 'image-to-video' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('image-to-video')}
                    className={videoModel === 'image-to-video' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Image to Video
                  </Button>
                  <Button
                    variant={videoModel === 'reference-to-video' ? 'default' : 'outline'}
                    onClick={() => setVideoModel('reference-to-video')}
                    className={videoModel === 'reference-to-video' 
                      ? 'bg-[#00FFF0] text-black' 
                      : 'border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black'}
                  >
                    Reference to Video
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

              {videoModel === 'image-to-video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Image
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
                  {selectedClip.generatedImage && !videoStartImageUrl && (
                    <p className="text-xs text-[#00FFF0] mt-2">
                      ✓ Will use the generated image above automatically if no custom image is provided
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
                disabled={!localVideoPrompt?.trim() || isGeneratingVideo}
                className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingVideo ? (
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
