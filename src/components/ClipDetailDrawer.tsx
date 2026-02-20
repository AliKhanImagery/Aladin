'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getSessionSafe } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Play, Image, Video, Loader2, Plus, Maximize2, Sparkles, Upload, History, Mic, Music, Eye } from 'lucide-react'
import ImageModal from './ImageModal'
import AssetLibraryModal from './AssetLibraryModal'
import { saveUserVideo, saveUserAsset, getUserImages } from '@/lib/userMedia'
import { CREDIT_PRICING_KEYS, getDisplayCredits } from '@/constants/billing'

interface ReferenceAsset {
  url: string;
  name?: string;
}

export default function ClipDetailDrawer() {
  const { 
    selectedClip, 
    setSelectedClip, 
    isDrawerOpen, 
    setDrawerOpen,
    updateClip,
    currentProject,
    setClipGeneratingStatus,
    clipGeneratingStatus,
    drawerMode // New destructuring
  } = useAppStore()
  
  // Get aspect ratio from project story (default to 16:9)
  const aspectRatio = currentProject?.story?.aspectRatio || '16:9'
  
  // OMNI EDITOR STATE
  const [activeMode, setActiveMode] = useState<'visualize' | 'animate' | 'dub'>('visualize')

  // DUBBING STATE
  const [dubAudioUrl, setDubAudioUrl] = useState('')
  const [dubAudioDuration, setDubAudioDuration] = useState(0)
  const [isDubbing, setIsDubbing] = useState(false)
  const [dubbingStatus, setDubbingStatus] = useState<string | null>(null)

  // IMAGE GENERATION STATE
  const [imageModel, setImageModel] = useState<'flux-2-pro' | 'nano-banana' | 'nano-banana-flash' | 'reeve'>((currentProject?.settings?.imageModel as any) || 'flux-2-pro')
  const [nanoBananaMode, setNanoBananaMode] = useState<'text-to-image' | 'multi-image-edit'>('text-to-image')
  const [remixMode, setRemixMode] = useState<'edit' | 'remix' | 'text-to-image'>('remix')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([{ url: '' }])
  const [nanoBananaInputImages, setNanoBananaInputImages] = useState<string[]>([''])
  const [localImagePrompt, setLocalImagePrompt] = useState(selectedClip?.imagePrompt || '')
  
  // VIDEO GENERATION STATE
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoModel, setVideoModel] = useState<'text-to-video' | 'image-to-video' | 'reference-to-video' | 'kling' | 'ltx'>('text-to-video')
  const [videoReferenceUrls, setVideoReferenceUrls] = useState<string[]>([''])
  const [videoStartImageUrl, setVideoStartImageUrl] = useState('')
  const [localVideoPrompt, setLocalVideoPrompt] = useState(selectedClip?.videoPrompt || '')
  
  // MODAL STATE
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [activeAssetContext, setActiveAssetContext] = useState<'image_reference' | 'video_start' | 'video_reference' | 'nano_input' | 'clip_media' | 'dub_audio'>('image_reference')
  const [activeAssetIndex, setActiveAssetIndex] = useState<number>(0)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  // HISTORY STATE
  const [generationHistory, setGenerationHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const historyStripRef = useRef<HTMLDivElement>(null)

  // PRICING (2.5x display)
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const fetchPricing = useCallback(async () => {
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/user/credits/pricing', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setPricing(data.pricing || {})
      }
    } catch (e) {
      console.error('Failed to fetch pricing', e)
    }
  }, [])
  useEffect(() => {
    if (isDrawerOpen && selectedClip?.id) fetchPricing()
  }, [isDrawerOpen, selectedClip?.id, fetchPricing])

  const hasImageRefs = referenceAssets.some((a) => a?.url?.trim())
  const isNanoImage = imageModel === 'nano-banana' || imageModel === 'nano-banana-flash'
  const imagePricingKey = isNanoImage
    ? hasImageRefs && (remixMode === 'edit' || remixMode === 'remix')
      ? CREDIT_PRICING_KEYS.IMAGE_NANO_BANANA_EDIT
      : CREDIT_PRICING_KEYS.IMAGE_NANO_BANANA_TEXT
    : imageModel === 'flux-2-pro'
      ? remixMode === 'edit'
        ? CREDIT_PRICING_KEYS.IMAGE_FLUX_EDIT
        : CREDIT_PRICING_KEYS.IMAGE_FLUX_TEXT
      : imageModel === 'reeve'
        ? remixMode === 'edit'
          ? CREDIT_PRICING_KEYS.IMAGE_REEVE_EDIT
          : remixMode === 'remix'
            ? CREDIT_PRICING_KEYS.IMAGE_REEVE_REMIX
            : CREDIT_PRICING_KEYS.IMAGE_REEVE_TEXT
        : CREDIT_PRICING_KEYS.IMAGE_REEVE_TEXT
  const imageCost = pricing[imagePricingKey] ?? 0
  const imageDisplayCoins = getDisplayCredits(imageCost)

  const videoDuration = selectedClip?.duration ?? 5
  const videoDurationBucket = typeof videoDuration === 'number' ? (videoDuration <= 5 ? 5 : 10) : 5
  const videoPricingKey =
    videoModel === 'ltx'
      ? CREDIT_PRICING_KEYS.VIDEO_LTX_2S
      : videoModel === 'kling'
        ? videoDurationBucket === 10
          ? CREDIT_PRICING_KEYS.VIDEO_KLING_10S
          : CREDIT_PRICING_KEYS.VIDEO_KLING_5S
        : videoDurationBucket === 10
          ? CREDIT_PRICING_KEYS.VIDEO_VIDU_10S
          : CREDIT_PRICING_KEYS.VIDEO_VIDU_5S
  const videoCost = pricing[videoPricingKey] ?? 0
  const videoDisplayCoins = getDisplayCredits(videoCost)
  
  // ASPECT RATIO PROMPT HELPER
  const injectAspectRatioPrompt = (basePrompt: string) => {
    // Defines optimized suffixes for each model & aspect ratio combination
    const ASPECT_RATIO_PROMPTS: Record<string, Record<string, string>> = {
      'flux-2-pro': {
        '16:9': ', cinematic 16:9 composition',
        '9:16': ', tall 9:16 portrait composition',
        '1:1': ', square 1:1 composition'
      },
      'nano-banana': {
        '16:9': ', (16:9 aspect ratio), wide shot',
        '9:16': ', (9:16 aspect ratio), tall shot',
        '1:1': ', (1:1 aspect ratio), square shot'
      },
      'nano-banana-flash': {
        '16:9': ', (16:9 aspect ratio), wide shot',
        '9:16': ', (9:16 aspect ratio), tall shot',
        '1:1': ', (1:1 aspect ratio), square shot'
      },
      'reeve': {
        '16:9': ', wide 16:9 format',
        '9:16': ', tall 9:16 format',
        '1:1': ', square 1:1 format'
      }
    }

    const currentModel = imageModel || 'flux-2-pro'
    const currentRatio = aspectRatio || '16:9'
    
    // Get the suffix for current model/ratio
    const suffix = ASPECT_RATIO_PROMPTS[currentModel]?.[currentRatio] || ''
    
    // Check if the prompt already contains this suffix (or similar key terms to avoid duplication)
    // We check for the core ratio "16:9" or "9:16" to be safe, but specifically the suffix helps consistency
    if (suffix && !basePrompt.includes(suffix.trim()) && !basePrompt.includes(`aspect ratio`)) {
        // If prompt is empty, just return the text (without leading comma if possible, or keep it consistent)
        if (!basePrompt.trim()) return suffix.replace(/^, /, '') // Remove leading comma
        return `${basePrompt}${suffix}`
    }
    
    return basePrompt
  }

  // 1. Selection Change Effect: Run only when a NEW clip is selected or drawer opens
  useEffect(() => {
    if (selectedClip?.id && isDrawerOpen) {
      // Priority 1: Explicit mode passed via setDrawerOpen
      if (drawerMode) {
        setActiveMode(drawerMode)
        return
      }

      // Priority 2: Auto-detect based on content
      if (selectedClip.generatedVideo) {
        setActiveMode('animate')
      } else {
        setActiveMode('visualize')
        
        // AUTO-INJECT ASPECT RATIO PROMPT
        // Only if we have a prompt (or even if empty) to ensure dimensions are respected
        const currentPrompt = selectedClip.imagePrompt || ''
        const enhancedPrompt = injectAspectRatioPrompt(currentPrompt)
        
        if (enhancedPrompt !== currentPrompt) {
            setLocalImagePrompt(enhancedPrompt)
            // We update the local state so the user sees it immediately
            // We DON'T auto-save to DB yet to let user confirm/edit
        }
      }

      // Fetch generation history for this clip
      fetchHistory()
      
      // Auto-populate reference with generated image if available (User Request)
      if (selectedClip.generatedImage) {
        setReferenceAssets([{ url: selectedClip.generatedImage }])
      } else {
        setReferenceAssets([{ url: '' }])
      }
    }
  }, [selectedClip?.id, isDrawerOpen, drawerMode])

  // 2. Prompt Sync Effect: Keep local prompts in sync with global store
  useEffect(() => {
    if (selectedClip) {
      if (selectedClip.imagePrompt !== localImagePrompt) setLocalImagePrompt(selectedClip.imagePrompt || '')
      if (selectedClip.videoPrompt !== localVideoPrompt) setLocalVideoPrompt(selectedClip.videoPrompt || '')
    }
  }, [selectedClip?.imagePrompt, selectedClip?.videoPrompt])

  // 3. Status & Settings Sync Effect
  useEffect(() => {
    if (selectedClip?.id) {
       // Update image model from project settings
       if (currentProject?.settings?.imageModel) {
        setImageModel(currentProject.settings.imageModel as any)
      }
      
      // Sync generating status
      const currentStatus = clipGeneratingStatus[selectedClip.id]
      if (currentStatus === 'image') {
        setIsGeneratingImage(true)
      } else if (currentStatus === 'video') {
        setIsGeneratingVideo(true)
      } else {
        setIsGeneratingImage(false)
        setIsGeneratingVideo(false)
      }
    }
  }, [selectedClip?.id, clipGeneratingStatus, currentProject?.settings?.imageModel])

  const fetchHistory = async () => {
    if (!selectedClip?.id) return
    setIsLoadingHistory(true)
    try {
      const history = await getUserImages(currentProject?.id, selectedClip.id)
      setGenerationHistory(history || [])
    } catch (error) {
      console.error('Failed to fetch generation history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Auto-scroll to latest item in history strip when history updates (horizontal strip)
  useEffect(() => {
    if (historyStripRef.current && generationHistory.length > 0) {
      historyStripRef.current.scrollTo({
        left: historyStripRef.current.scrollWidth,
        behavior: 'smooth'
      })
    }
  }, [generationHistory])

  // Auto-switch to image-to-video when image is generated
  useEffect(() => {
    if (selectedClip?.generatedImage && activeMode === 'animate') {
      if (videoModel === 'text-to-video' && !videoStartImageUrl) {
        setVideoModel('image-to-video')
      }
    }
  }, [selectedClip?.generatedImage, activeMode, videoModel, videoStartImageUrl])

  // Auto-switch video model based on metadata (only on initial load, not on user changes)
  useEffect(() => {
    if (selectedClip?.generationMetadata?.videoEngine && activeMode === 'animate') {
      const engineFromMetadata = selectedClip.generationMetadata.videoEngine as 'kling' | 'ltx'
      // Only auto-set if videoModel is still the default or matches the auto-switch logic
      // Don't override user's manual selection
      if ((videoModel === 'text-to-video' || videoModel === 'image-to-video') && !videoStartImageUrl) {
        if (engineFromMetadata === 'ltx') {
          setVideoModel('ltx')
        } else if (engineFromMetadata === 'kling') {
          setVideoModel('kling')
        }
      }
    }
  }, [activeMode, selectedClip?.generationMetadata?.videoEngine, videoStartImageUrl]) // Removed videoModel from deps to avoid loops

  if (!selectedClip || !isDrawerOpen) return null

  // Manual update wrapper to ensure immediate UI feedback
  const handleUpdateClip = (updates: any) => {
    if (selectedClip) {
      // 1. Update global store (this is async/debounced in some implementations)
      updateClip(selectedClip.id, updates)
      
      // 2. Force local update if we're setting the currently selected clip
      // This is a bit of a hack but ensures the UI reacts instantly to clicks
      // The store update will follow through and keep things consistent
      setSelectedClip({ ...selectedClip, ...updates })
    }
  }

  const handleRestoreHistory = (historyItem: any) => {
    if (!selectedClip) return
    
    // Force immediate local update first (for instant UI feedback)
    const updatedClip = { 
      ...selectedClip,
      generatedImage: historyItem.image_url,
      previewImage: historyItem.image_url,
      imagePrompt: historyItem.prompt || selectedClip.imagePrompt 
    }
    setSelectedClip(updatedClip)
    
    // Auto-add to reference assets ONLY if the first slot is empty (User Request)
    if (historyItem.image_url) {
      // Only auto-fill the first slot if it's empty. Do not append or overwrite if full.
      if (referenceAssets.length > 0 && !referenceAssets[0].url) {
        const newRefs = [...referenceAssets]
        newRefs[0] = { url: historyItem.image_url }
        setReferenceAssets(newRefs)
      }
    }
    
    // Update prompt text area
    if (historyItem.prompt) {
      setLocalImagePrompt(historyItem.prompt)
    }
    
    // Then update store (async, but UI already updated)
    updateClip(selectedClip.id, { 
      generatedImage: historyItem.image_url,
      previewImage: historyItem.image_url,
      imagePrompt: historyItem.prompt || selectedClip.imagePrompt 
    })
  }

  const handleImagePromptChange = (value: string) => {
    setLocalImagePrompt(value)
    handleUpdateClip({ imagePrompt: value })
  }

  const handleVideoPromptChange = (value: string) => {
    setLocalVideoPrompt(value)
    handleUpdateClip({ videoPrompt: value })
  }

  // --- ASSET PICKER HANDLERS ---
  const handleOpenAssetPicker = (context: typeof activeAssetContext, index: number = 0) => {
    setActiveAssetContext(context)
    setActiveAssetIndex(index)
    setIsAssetPickerOpen(true)
  }

  const handleAssetSelect = (url: string, name?: string) => {
    if (activeAssetContext === 'image_reference') {
      const updated = [...referenceAssets]
      updated[activeAssetIndex] = { url, name: name || '' }
      setReferenceAssets(updated)
    } else if (activeAssetContext === 'video_start') {
      setVideoStartImageUrl(url)
    } else if (activeAssetContext === 'video_reference') {
      const updated = [...videoReferenceUrls]
      updated[activeAssetIndex] = url
      setVideoReferenceUrls(updated)
    } else if (activeAssetContext === 'nano_input') {
      const updated = [...nanoBananaInputImages]
      updated[activeAssetIndex] = url
      setNanoBananaInputImages(updated)
    } else if (activeAssetContext === 'clip_media') {
      handleUpdateClip({ 
        generatedImage: url,
        previewImage: url
      })
    } else if (activeAssetContext === 'dub_audio') {
      setDubAudioUrl(url)
      // Attempt to get duration if possible
      const audio = new Audio(url)
      audio.onloadedmetadata = () => {
        setDubAudioDuration(audio.duration)
      }
    }
    setIsAssetPickerOpen(false)
  }

  const handleAssetUpload = async (file: File) => {
    setIsUploadingAsset(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload-file', { method: 'POST', body: formData })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      const { url } = await response.json()
      
      // Save to user_assets library
      // If we are in dub_audio context, save as audio type
      const assetType = activeAssetContext === 'dub_audio' ? 'audio' : 'product'
      
      await saveUserAsset({
        name: file.name,
        type: assetType as any, 
        asset_url: url,
        metadata: { originalFilename: file.name, fileSize: file.size }
      })
      
      // If direct upload in dubbing mode (though we are moving to modal, handleAssetUpload is used by modal too)
      // The modal calls onUpload.
      // If we are using the modal, we don't need to setDubAudioUrl here, handleAssetSelect will be called by the modal after user selects the uploaded file?
      // Actually AssetLibraryModal logic: 
      // await onUpload(file) -> refresh list. User then clicks the file.
      // So this is correct.
      
    } catch (e: any) {
      console.error('Asset upload failed:', e)
      alert(`Upload failed: ${e.message}`)
    } finally {
      setIsUploadingAsset(false)
    }
  }

  // --- GENERATION HANDLERS ---
  const handleGenerateImage = async () => {
    const promptToUse = localImagePrompt.trim()
    if (!promptToUse) {
      alert('Please enter an image prompt first')
          return
        }

        const aspectRatioToUse = aspectRatio || '16:9'
    setIsGeneratingImage(true)
    if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, 'image')
    
    let lastError: { model: string; error: string } | null = null

    try {
      const validReferences = referenceAssets.map(a => a.url).filter(url => url.trim() !== '')
      // FIX: If no reference images, force text-to-image mode where applicable
      const modeToUse = (imageModel === 'reeve' || imageModel === 'flux-2-pro') && validReferences.length === 0 
        ? 'text-to-image' 
        : remixMode
      
      const requestBody: any = {
        imageModel,
        mode: modeToUse,
        aspect_ratio: aspectRatioToUse,
          prompt: promptToUse,
          project_id: currentProject?.id,
          clip_id: selectedClip?.id,
      }

      if (validReferences.length > 0) {
          requestBody.reference_image_urls = validReferences
        if (imageModel === 'flux-2-pro') requestBody.mode = 'edit'
        }
        
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
        
        const response = await fetch('/api/generate-image-remix', {
          method: 'POST',
        headers,
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
        lastError = { model: imageModel.toUpperCase(), error: errorData.error || 'Failed' }
        throw new Error(errorData.error)
        }

        const { imageUrl } = await response.json()
      
      // Update UI immediately
        handleUpdateClip({ generatedImage: imageUrl, previewImage: imageUrl })
      
      if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, null)
      
      // Note: Image is already saved by the API route (generate-image-remix)
      // No need to call saveUserImage here - it would create duplicates
      
      // Fetch history again to show the new image in the strip
      // Small delay to ensure API route has finished saving
      setTimeout(() => {
        fetchHistory()
      }, 500)

    } catch (error: any) {
      console.error('Image generation error:', error)
      if (lastError) {
        alert(`❌ ${lastError.model} Failed: ${lastError.error}`)
      } else {
        alert(`Failed: ${error.message}`)
      }
    } finally {
      setIsGeneratingImage(false)
      if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, null)
    }
  }

  const handleGenerateVideo = async () => {
    const promptToUse = localVideoPrompt.trim()
    if (!promptToUse) {
      alert('Please enter a video prompt first')
      return
    }

    setIsGeneratingVideo(true)
    if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, 'video')

    try {
      let requestBody: any = {
        prompt: promptToUse,
        duration: selectedClip.duration || 5,
        resolution: '720p',
      }

      if (videoModel === 'ltx') {
        requestBody.videoModel = 'ltx'
        requestBody.aspect_ratio = aspectRatio
        if (!videoStartImageUrl.trim() && !selectedClip.generatedImage) {
          alert('LTX requires a start image.')
          throw new Error('LTX requires start image')
        }
        requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
      } else if (videoModel === 'kling') {
        requestBody.videoModel = 'kling'
        requestBody.aspect_ratio = aspectRatio
        if (videoStartImageUrl.trim() || selectedClip.generatedImage) {
          requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
        }
      } else if (videoModel === 'image-to-video') {
        requestBody.videoModel = 'vidu'
        if (!videoStartImageUrl.trim() && !selectedClip.generatedImage) throw new Error('Image required')
        requestBody.image_url = videoStartImageUrl.trim() || selectedClip.generatedImage
      } else if (videoModel === 'reference-to-video') {
        requestBody.videoModel = 'vidu'
        const validRefs = videoReferenceUrls.filter(url => url.trim() !== '')
        if (validRefs.length === 0) throw new Error('Reference image required')
        requestBody.reference_image_urls = validRefs
        requestBody.aspect_ratio = aspectRatio
      } else {
        requestBody.videoModel = 'vidu'
      }

      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate video')
      }

      const { videoUrl, duration: generatedDuration } = await response.json()

      handleUpdateClip({ 
        generatedVideo: videoUrl, 
        previewVideo: videoUrl,
        duration: generatedDuration || selectedClip.duration
      })
      if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, null)
      
      await saveUserVideo({
        video_url: videoUrl,
        prompt: promptToUse,
        model: videoModel || 'vidu',
        duration: generatedDuration || selectedClip.duration,
        aspect_ratio: aspectRatio,
        project_id: currentProject?.id,
        clip_id: selectedClip?.id,
        thumbnail_url: selectedClip.generatedImage || undefined,
        storeExternally: true
      })
    } catch (error: any) {
      console.error('Video generation error:', error)
      alert(error.message || 'Failed to generate video')
    } finally {
      setIsGeneratingVideo(false)
      if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, null)
    }
  }

  const handleGenerateDub = async () => {
    if (!selectedClip?.generatedVideo) {
      alert('Please generate or upload a video for this clip first.')
      return
    }
    if (!dubAudioUrl) {
      alert('Please upload an audio file.')
      return
    }

    setIsDubbing(true)
    setDubbingStatus('Processing...')
    if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, 'video') // Reuse video status for spinner

    try {
      const response = await fetch('/api/process-dub-and-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: selectedClip.generatedVideo,
          audioUrl: dubAudioUrl,
          videoDuration: selectedClip.duration || 5,
          audioDuration: dubAudioDuration,
          prompt: selectedClip.videoPrompt || "Continue the scene naturally, maintaining the same style and motion."
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Dubbing failed')
      }

      handleUpdateClip({
        generatedVideo: data.videoUrl,
        previewVideo: data.videoUrl,
        // Update duration if it was extended
        duration: data.wasExtended ? Math.max(selectedClip.duration, Math.ceil(dubAudioDuration)) : selectedClip.duration
      })

      // Save the new video record
      await saveUserVideo({
        video_url: data.videoUrl,
        prompt: `Lip Sync: ${selectedClip.videoPrompt || 'Original scene'}`,
        model: 'kling-lipsync',
        duration: data.wasExtended ? Math.ceil(dubAudioDuration) : selectedClip.duration,
        aspect_ratio: aspectRatio,
        project_id: currentProject?.id,
        clip_id: selectedClip?.id,
        thumbnail_url: selectedClip.generatedImage || undefined,
        storeExternally: true
      })

      alert('Lip Sync Complete!')
    } catch (error: any) {
      console.error('Dubbing error:', error)
      alert(`Dubbing Failed: ${error.message}`)
    } finally {
      setIsDubbing(false)
      setDubbingStatus(null)
      if (selectedClip?.id) setClipGeneratingStatus(selectedClip.id, null)
    }
  }

  // --- RENDER HELPERS ---
  const addReferenceAsset = () => setReferenceAssets([...referenceAssets, { url: '' }])
  const removeReferenceAsset = (index: number) => {
    const updated = referenceAssets.filter((_, i) => i !== index)
    setReferenceAssets(updated.length > 0 ? updated : [{ url: '' }])
  }
  const addVideoReferenceUrl = () => setVideoReferenceUrls([...videoReferenceUrls, ''])
  const removeVideoReferenceUrl = (index: number) => {
    const updated = videoReferenceUrls.filter((_, i) => i !== index)
    setVideoReferenceUrls(updated.length > 0 ? updated : [''])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - soft, cinematic */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" onClick={() => setDrawerOpen(false)} />
      
      {/* Director Suite - Google Flow / Higgsfield inspired */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0f1114] rounded-2xl border border-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_80px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
        
        {/* Header - minimal */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <span className="text-sm font-medium text-white/90 truncate">{selectedClip.name}</span>
          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mode Tabs - underline style, Higgsfield-like */}
        <div className="flex px-6 gap-6 border-b border-white/[0.04] shrink-0">
          <button
            onClick={() => setActiveMode('visualize')}
            className={`flex items-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeMode === 'visualize' 
                ? 'text-brand-emerald border-brand-emerald' 
                : 'text-white/40 border-transparent hover:text-white/70'
            }`}
          >
            <Image className="w-4 h-4" />
            Visualize
          </button>
          <button
            onClick={() => setActiveMode('animate')}
            className={`flex items-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeMode === 'animate' 
                ? 'text-brand-emerald border-brand-emerald' 
                : 'text-white/40 border-transparent hover:text-white/70'
            }`}
          >
            <Video className="w-4 h-4" />
            Animate
          </button>
          <button
            onClick={() => setActiveMode('dub')}
            className={`flex items-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeMode === 'dub' 
                ? 'text-brand-emerald border-brand-emerald' 
                : 'text-white/40 border-transparent hover:text-white/70'
            }`}
          >
            <Mic className="w-4 h-4" />
            Lip Sync
          </button>
        </div>
        
        {/* Stage - cinematic output area */}
        <div className="relative flex-1 min-h-0 flex flex-col bg-[#08090b]">
          {/* Main Preview Area */}
          <div className="relative flex-1 flex flex-col min-h-0">
             {/* Output Header */}
             <div className="absolute top-4 left-6 z-10 pointer-events-none">
                <span className="px-2 py-1 rounded bg-black/40 text-[10px] font-medium text-white/40 uppercase tracking-wider border border-white/5 backdrop-blur-sm">
                  {activeMode === 'visualize' ? 'Result Preview' : 'Video Output'}
                </span>
             </div>

             <div className="w-full flex-1 flex items-center justify-center overflow-hidden group p-4">
               <div className="w-full max-w-4xl mx-auto aspect-video max-h-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center ring-1 ring-white/[0.08] shadow-2xl relative">
               {activeMode === 'animate' && selectedClip.generatedVideo ? (
                 <video
                   src={selectedClip.generatedVideo}
                   controls
                   preload="auto"
                   playsInline
                   className="w-full h-full object-contain"
                 />
               ) : selectedClip.generatedImage ? (
                 <>
                 <img 
                   src={selectedClip.generatedImage} 
                   alt={selectedClip.name}
                     className="w-full h-full object-contain"
                 />
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-10 w-10 rounded-full bg-black/60 text-white hover:bg-brand-emerald hover:text-black transition-all"
                     onClick={() => window.open(selectedClip.generatedImage!, '_blank')}
                     title="View full size"
                   >
                     <Eye className="w-5 h-5" />
                   </Button>
                   </div>
                 </>
               ) : (
                   <div className="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent">
                     <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4 ring-1 ring-white/[0.05]">
                       <Image className="w-6 h-6 text-white/20" />
                     </div>
                   <p className="text-sm font-medium text-white/40 mb-1">Canvas Empty</p>
                   <span className="text-xs text-white/20">Enter a prompt below to generate</span>
                   </div>
                 )}
               </div>
             </div>
          </div>

           {/* History strip - Bottom of Stage */}
           {activeMode === 'visualize' && generationHistory.length > 0 && (
            <div 
              ref={historyStripRef}
              className="w-full px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 border-t border-white/[0.04] bg-[#0f1114] opacity-75 hover:opacity-100 transition-opacity"
            >
                <span className="text-[10px] font-medium text-white/30 shrink-0 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  History
                </span>
                {generationHistory.map((historyItem) => (
                    <div key={historyItem.id} className="relative group/history">
                        <button
                            onClick={() => handleRestoreHistory(historyItem)}
                            className={`relative h-8 w-8 rounded-md overflow-hidden flex-shrink-0 transition-all ${
                                selectedClip.generatedImage === historyItem.image_url 
                                    ? 'ring-1 ring-brand-emerald ring-offset-1 ring-offset-[#0f1114]' 
                                    : 'opacity-60 hover:opacity-100 hover:ring-1 hover:ring-white/20'
                            }`}
                            title={historyItem.prompt}
                        >
                            <img src={historyItem.image_url} className="w-full h-full object-cover" />
                        </button>
                        {/* Quick-Seed Interaction */}
                        <div className="absolute -top-1 -right-1 opacity-0 group-hover/history:opacity-100 transition-opacity z-10 pointer-events-none">
                            <div className="bg-brand-emerald text-brand-obsidian rounded-full p-[1px] shadow-sm border border-white/10">
                                <Plus className="w-2 h-2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          )}
        </div>

        {/* Secondary controls - Model Selector Only */}
        <div className="px-6 py-2 border-t border-white/[0.06] bg-[#141516] shrink-0 flex items-center justify-end min-h-[40px]">
          {activeMode === 'visualize' && (
              <div className="flex items-center gap-3 bg-black/20 rounded-lg p-1 pr-3 border border-white/5">
                <select 
                  value={imageModel}
                  onChange={(e: any) => setImageModel(e.target.value)}
                  className="bg-transparent text-xs text-white/80 border-0 rounded px-2 py-1 outline-none focus:ring-0 cursor-pointer font-medium hover:text-white"
                >
                  <option value="flux-2-pro">Flux 2 Pro</option>
                  <option value="nano-banana">Nano Pro</option>
                  <option value="nano-banana-flash">Nano Fast</option>
                  <option value="reeve">Reeve</option>
                </select>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-[10px] font-medium text-white/40 tracking-wider">{aspectRatio}</span>
                
                {imageModel === 'reeve' && (
                  <>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <div className="flex gap-0.5 bg-white/5 rounded p-0.5">
                      {(['text-to-image', 'edit', 'remix'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setRemixMode(m)}
                          className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-sm transition-all ${
                            remixMode === m ? 'bg-brand-emerald text-brand-obsidian' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          {m === 'text-to-image' ? 'New' : m}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
          )}

          {activeMode === 'dub' && (
            <div className="w-full flex justify-center">
              <p className="text-xs font-medium text-white/40 bg-white/5 px-3 py-1.5 rounded-full">
                Audio &gt; Video (≤10s) extends video automatically
              </p>
            </div>
          )}

          {activeMode === 'animate' && (
            <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Start</span>
                <div 
                  className="w-14 h-9 rounded-md overflow-hidden bg-white/5 cursor-pointer ring-1 ring-white/10 hover:ring-brand-emerald/50 transition-all flex items-center justify-center group"
                  onClick={() => handleOpenAssetPicker('video_start')}
                >
                  {(videoStartImageUrl || selectedClip.generatedImage) ? (
                    <img src={videoStartImageUrl || selectedClip.generatedImage || ''} className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-black/20 rounded-lg p-1 border border-white/5">
                <div className="flex gap-0.5 bg-white/5 rounded p-0.5">
                  {['kling', 'ltx'].map((m) => (
                    <button
                      key={m}
                      onClick={(e) => { e.preventDefault(); setVideoModel(m as any) }}
                      className={`px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all ${
                        videoModel === m ? 'bg-brand-emerald text-brand-obsidian shadow-sm' : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {m === 'kling' ? 'Kling' : 'LTX'}
                    </button>
                  ))}
                </div>
                
                <div className="w-px h-3 bg-white/10" />
                
                {videoModel === 'ltx' ? (
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] font-medium text-white/40">{selectedClip.duration}s</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={selectedClip.duration || 1}
                      onChange={(e) => handleUpdateClip({ duration: parseInt(e.target.value) })}
                      className="w-16 h-1 accent-brand-emerald bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-emerald"
                    />
                  </div>
                ) : (
                  <div className="flex gap-0.5 px-1">
                    {[5, 10].map(sec => (
                      <button
                        key={sec}
                        onClick={(e) => { e.preventDefault(); handleUpdateClip({ duration: sec }) }}
                        className={`w-6 py-0.5 text-[10px] font-bold rounded-sm transition-all ${
                          selectedClip.duration === sec ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat bar - Flow/Gemini-style input */}
        <div className="p-6 pt-2 pb-6 border-t border-white/[0.04] shrink-0 bg-[#141516]">
          {activeMode === 'visualize' && (
            <div className="flex flex-col gap-4">
              <div className="group bg-[#0f1114] border border-white/10 focus-within:border-brand-emerald/50 focus-within:ring-1 focus-within:ring-brand-emerald/50 rounded-2xl transition-all shadow-sm flex flex-col">
                {/* Reference Images (REF) - Moved inside prompt container */}
                <div className="flex items-center gap-3 px-4 pt-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">Ref</span>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {referenceAssets.map((asset, idx) => (
                        <div 
                          key={idx} 
                          className={`relative w-12 h-12 rounded-lg overflow-hidden group/ref cursor-pointer transition-all ${
                              asset.url 
                                  ? 'ring-1 ring-white/10 hover:ring-brand-emerald/50' 
                                  : 'border border-dashed border-brand-emerald/50 hover:bg-brand-emerald/5'
                          }`}
                        >
                          {asset.url ? (
                            <>
                              <img src={asset.url} className="w-full h-full object-cover" />
                              <button onClick={() => removeReferenceAsset(idx)} className="absolute inset-0 bg-black/60 opacity-0 group-hover/ref:opacity-100 flex items-center justify-center transition-opacity">
                                <X className="w-4 h-4 text-white" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleOpenAssetPicker('image_reference', idx)} className="w-full h-full flex items-center justify-center text-white/20 hover:text-brand-emerald transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {referenceAssets.length < 3 && (
                        <button onClick={addReferenceAsset} className="w-12 h-12 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-white/20 hover:text-brand-emerald hover:border-brand-emerald/30 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                </div>

                <Textarea
                  value={localImagePrompt}
                  onChange={(e) => handleImagePromptChange(e.target.value)}
                  placeholder="Describe what you want to see..."
                  className="w-full min-h-[100px] max-h-[300px] bg-transparent border-0 focus:ring-0 rounded-b-2xl px-4 py-3 text-sm resize-none placeholder:text-white/30 custom-scrollbar leading-relaxed mt-1"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || clipGeneratingStatus[selectedClip.id] === 'image' || !localImagePrompt.trim()}
                  className="h-11 px-8 bg-brand-emerald hover:bg-brand-emerald/90 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-emerald/20 w-full sm:w-auto"
                >
                  {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" />Generate Visual{imageDisplayCoins > 0 ? ` (${imageDisplayCoins} coins)` : ''}</>}
                </Button>
              </div>
            </div>
          )}
          {activeMode === 'animate' && (
            <div className="flex flex-col gap-4">
              <div className="group bg-[#0f1114] border border-white/10 focus-within:border-brand-emerald/50 focus-within:ring-1 focus-within:ring-brand-emerald/50 rounded-2xl transition-all shadow-sm">
                <Textarea
                  value={localVideoPrompt}
                  onChange={(e) => handleVideoPromptChange(e.target.value)}
                  placeholder="Describe the movement and action..."
                  className="w-full min-h-[120px] max-h-[300px] bg-transparent border-0 focus:ring-0 rounded-2xl px-4 py-4 text-sm resize-none placeholder:text-white/30 custom-scrollbar leading-relaxed"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo || clipGeneratingStatus[selectedClip.id] === 'video' || !localVideoPrompt.trim()}
                  className="h-11 px-8 bg-brand-emerald hover:bg-brand-emerald/90 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-emerald/20 w-full sm:w-auto"
                >
                  {isGeneratingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-5 h-5 mr-2" />Generate Animation{videoDisplayCoins > 0 ? ` (${videoDisplayCoins} coins)` : ''}</>}
                </Button>
              </div>
            </div>
          )}
          {activeMode === 'dub' && (
            <div className="flex gap-3 items-center">
              {!dubAudioUrl ? (
                <button 
                  onClick={() => handleOpenAssetPicker('dub_audio')}
                  className="flex-1 h-[56px] border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/40 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.02] transition-colors group"
                >
                  <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Select audio file</span>
                </button>
              ) : (
                <div className="flex-1 flex items-center gap-3 bg-[#0f1114] rounded-2xl px-4 py-2 border border-white/10">
                  <Music className="w-4 h-4 text-brand-emerald" />
                  <audio src={dubAudioUrl} controls className="flex-1 h-10 max-w-full [&::-webkit-media-controls-panel]:bg-transparent" />
                  <button onClick={() => setDubAudioUrl('')} className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <Button
                onClick={handleGenerateDub}
                disabled={isDubbing || !dubAudioUrl || !selectedClip.generatedVideo}
                className="h-[56px] px-8 shrink-0 bg-brand-emerald hover:bg-brand-emerald/90 text-white font-bold rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-brand-emerald/20"
              >
                {isDubbing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mic className="w-5 h-5 mr-2" />Lip Sync</>}
              </Button>
            </div>
          )}
        </div>

      </div>
      
      {/* MODALS */}
      <ImageModal
        imageUrl={modalImageUrl || ''}
        alt={selectedClip?.name || 'Preview'}
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false)
          setModalImageUrl(null)
        }}
      />
      
      <AssetLibraryModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        onSelect={(url, name) => handleAssetSelect(url, name)}
        onUpload={handleAssetUpload}
        isUploading={isUploadingAsset}
        projectContext={currentProject}
        initialTab={activeAssetContext === 'dub_audio' ? 'audio' : 'assets'}
        allowedTypes={activeAssetContext === 'dub_audio' ? ['audio'] : ['assets', 'generated']}
      />
    </div>
  )
}
