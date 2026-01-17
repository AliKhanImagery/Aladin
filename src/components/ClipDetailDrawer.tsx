'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { X, Play, Settings, Image, Video, Zap, Loader2, Plus, Info, Maximize2, Sparkles, Palette, Trash2, Upload, ChevronRight, Wand2, Clock, History } from 'lucide-react'
import { FileUpload } from '@/components/ui/fileUpload'
import ImageModal from './ImageModal'
import AssetLibraryModal from './AssetLibraryModal'
import { saveUserImage, saveUserVideo, saveUserAsset, getUserImages } from '@/lib/userMedia'

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
  
  // OMNI EDITOR STATE
  const [activeMode, setActiveMode] = useState<'visualize' | 'animate'>('visualize')

  // IMAGE GENERATION STATE
  const [imageModel, setImageModel] = useState<'flux-2-pro' | 'nano-banana' | 'reeve'>((currentProject?.settings?.imageModel as any) || 'flux-2-pro')
  const [nanoBananaMode, setNanoBananaMode] = useState<'text-to-image' | 'multi-image-edit'>('text-to-image')
  const [remixMode, setRemixMode] = useState<'edit' | 'remix' | 'text-to-image'>('remix')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([''])
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
  const [activeAssetContext, setActiveAssetContext] = useState<'image_reference' | 'video_start' | 'video_reference' | 'nano_input'>('image_reference')
  const [activeAssetIndex, setActiveAssetIndex] = useState<number>(0)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  // HISTORY STATE
  const [generationHistory, setGenerationHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const historyStripRef = useRef<HTMLDivElement>(null)

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
        setIsGeneratingImage(false)
        setIsGeneratingVideo(false)
      }

      // Auto-set initial mode based on content
      if (selectedClip.generatedVideo) {
        setActiveMode('animate')
      } else {
        setActiveMode('visualize')
      }

      // Fetch generation history for this clip
      fetchHistory()
    }
  }, [selectedClip?.id, selectedClip?.imagePrompt, selectedClip?.videoPrompt, clipGeneratingStatus, currentProject?.settings?.imageModel])

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

  // Auto-scroll to latest item in history strip when history updates
  useEffect(() => {
    if (historyStripRef.current && generationHistory.length > 0) {
      // Scroll to the rightmost (latest) item
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

  // Auto-switch video model based on metadata
  useEffect(() => {
    if (selectedClip?.generationMetadata?.videoEngine && activeMode === 'animate') {
      const engineFromMetadata = selectedClip.generationMetadata.videoEngine as 'kling' | 'ltx'
      if (engineFromMetadata === 'ltx' && videoModel !== 'ltx' && !videoStartImageUrl) {
        setVideoModel('ltx')
      } else if (engineFromMetadata === 'kling' && videoModel !== 'kling' && !videoStartImageUrl) {
        setVideoModel('kling')
      }
    }
  }, [activeMode, selectedClip?.generationMetadata?.videoEngine, videoModel, videoStartImageUrl])

  if (!selectedClip || !isDrawerOpen) return null

  // Manual update wrapper to ensure immediate UI feedback
  const handleUpdateClip = (updates: any) => {
    if (selectedClip) {
      // 1. Update global store (this is async/debounced in some implementations)
      updateClip(selectedClip.id, updates)
      
      // 2. Force local update if we're setting the currently selected clip
      // This is a bit of a hack but ensures the UI reacts instantly to clicks
      // The store update will follow through and keep things consistent
      if (updates.generatedImage) {
        setSelectedClip({ ...selectedClip, ...updates })
      }
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

  const handleAssetSelect = (url: string) => {
    if (activeAssetContext === 'image_reference') {
      const updated = [...referenceImageUrls]
      updated[activeAssetIndex] = url
      setReferenceImageUrls(updated)
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
      await saveUserAsset({
        name: file.name,
        type: 'product', // Defaulting to product/generic for now
        asset_url: url,
        metadata: { originalFilename: file.name, fileSize: file.size }
      })
      
      // AssetLibraryModal will refresh automatically, but we want to know it's done
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
      const validReferences = referenceImageUrls.filter(url => url.trim() !== '')
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
      
      // Save and refresh history
      await saveUserImage({
        image_url: imageUrl,
        prompt: promptToUse,
        model: imageModel,
        aspect_ratio: aspectRatioToUse,
        project_id: currentProject?.id,
        clip_id: selectedClip?.id,
        storeExternally: true
      })
      
      // Fetch history again to show the new image in the strip
      fetchHistory()

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

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // --- RENDER HELPERS ---
  const addReferenceImageUrl = () => setReferenceImageUrls([...referenceImageUrls, ''])
  const removeReferenceImageUrl = (index: number) => {
    const updated = referenceImageUrls.filter((_, i) => i !== index)
    setReferenceImageUrls(updated.length > 0 ? updated : [''])
  }
  const addVideoReferenceUrl = () => setVideoReferenceUrls([...videoReferenceUrls, ''])
  const removeVideoReferenceUrl = (index: number) => {
    const updated = videoReferenceUrls.filter((_, i) => i !== index)
    setVideoReferenceUrls(updated.length > 0 ? updated : [''])
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      
      {/* Omni Drawer */}
      <div className="w-96 bg-[#1E1F22] border-l border-[#3AAFA9]/20 flex flex-col shadow-2xl">
        
        {/* 1. THE STAGE (Top) */}
        <div className="relative bg-[#000000] border-b border-[#3AAFA9]/20 flex flex-col">
          {/* Main Visual Stage - Fixed Aspect Ratio Container */}
          <div className="relative w-full aspect-video flex items-center justify-center bg-[#0C0C0C] overflow-hidden group">
            {activeMode === 'animate' && selectedClip.generatedVideo ? (
              <video 
                src={selectedClip.generatedVideo} 
                controls 
                className="w-full h-full object-contain"
              />
            ) : selectedClip.generatedImage ? (
              <>
                <img 
                  src={selectedClip.generatedImage} 
                  alt={selectedClip.name}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setModalImageUrl(selectedClip.generatedImage || null)
                      setIsImageModalOpen(true)
                    }}
                    className="bg-black/50 hover:bg-black/70 rounded-full text-white border border-white/20"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-600">
                {activeMode === 'animate' ? (
                    <Video className="w-12 h-12 mb-2 opacity-20" />
                ) : (
                    <Image className="w-12 h-12 mb-2 opacity-20" />
                )}
                <p className="text-xs uppercase tracking-widest font-bold opacity-50">Empty Canvas</p>
              </div>
            )}
            
            {/* Header / Close (Overlay) */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider drop-shadow-md px-1">{selectedClip.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} className="h-6 w-6 text-white/80 hover:bg-white/10 pointer-events-auto">
                    <X className="w-4 h-4" />
                </Button>
            </div>
          </div>

           {/* GENERATIONS STRIP (History) */}
           {activeMode === 'visualize' && generationHistory.length > 0 && (
            <div 
              ref={historyStripRef}
              className="w-full h-16 bg-[#151619] border-t border-[#3AAFA9]/10 flex items-center gap-2 px-3 overflow-x-auto no-scrollbar"
            >
                <div className="flex-shrink-0 text-[10px] uppercase font-bold text-gray-500 mr-2 flex flex-col items-center">
                    <History className="w-3 h-3 mb-1" />
                    <span>History</span>
                </div>
                {generationHistory.map((historyItem) => (
                    <button
                        key={historyItem.id}
                        onClick={() => handleRestoreHistory(historyItem)}
                        className={`relative h-12 aspect-square rounded-md overflow-hidden border transition-all flex-shrink-0 ${
                            selectedClip.generatedImage === historyItem.image_url 
                                ? 'border-[#00FFF0] ring-1 ring-[#00FFF0]/50' 
                                : 'border-[#3AAFA9]/20 hover:border-[#00FFF0]/50 opacity-60 hover:opacity-100'
                        }`}
                        title={historyItem.prompt}
                    >
                        <img src={historyItem.image_url} className="w-full h-full object-cover" />
                    </button>
                ))}
            </div>
           )}
        </div>

        {/* 2. MODE SWITCHER */}
        <div className="flex p-2 gap-2 border-b border-[#3AAFA9]/10 bg-[#151619]">
          <button
            onClick={() => setActiveMode('visualize')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeMode === 'visualize' 
                ? 'bg-[#00FFF0] text-black shadow-lg shadow-[#00FFF0]/20' 
                : 'bg-[#1E1F22] text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            Visualize
          </button>
          <button
            onClick={() => setActiveMode('animate')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeMode === 'animate' 
                ? 'bg-[#00FFF0] text-black shadow-lg shadow-[#00FFF0]/20' 
                : 'bg-[#1E1F22] text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Animate
          </button>
        </div>

        {/* 3. INSPECTOR (Scrollable Controls) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          {/* --- VISUALIZE MODE CONTROLS --- */}
          {activeMode === 'visualize' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Prompt Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <Wand2 className="w-3 h-3 text-[#00FFF0]" />
                   The Director (Prompt)
                </label>
                <Textarea
                  value={localImagePrompt}
                  onChange={(e) => handleImagePromptChange(e.target.value)}
                  placeholder="Describe what you want to see..."
                  className="bg-[#0C0C0C] border-[#3AAFA9]/20 focus:border-[#00FFF0] min-h-[100px] text-sm resize-none"
                />
              </div>

              {/* Influences Section (Assets) */}
              <div className="space-y-3">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <Sparkles className="w-3 h-3 text-[#00FFF0]" />
                   Influences (Reference Assets)
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                    {referenceImageUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square bg-[#0C0C0C] rounded-lg border border-[#3AAFA9]/20 overflow-hidden group">
                            {url ? (
                                <>
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeReferenceImageUrl(idx)}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => handleOpenAssetPicker('image_reference', idx)}
                                    className="w-full h-full flex items-center justify-center text-gray-600 hover:text-[#00FFF0] hover:bg-[#00FFF0]/5 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                    {referenceImageUrls.length < 3 && (
                        <button 
                            onClick={addReferenceImageUrl}
                            className="aspect-square rounded-lg border border-dashed border-[#3AAFA9]/20 flex items-center justify-center text-gray-600 hover:text-[#00FFF0] hover:border-[#00FFF0]/50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
              </div>

              {/* Engine Settings (Collapsed/Simplified) */}
              <div className="pt-4 border-t border-[#3AAFA9]/10">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="w-3 h-3 text-[#00FFF0]" />
                        Engine Settings
                    </label>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <select 
                        value={imageModel}
                        onChange={(e: any) => setImageModel(e.target.value)}
                        className="bg-[#0C0C0C] text-xs text-white border border-[#3AAFA9]/20 rounded-md p-2 outline-none focus:border-[#00FFF0]"
                    >
                        <option value="flux-2-pro">Flux 2 Pro (Premium)</option>
                        <option value="nano-banana">Nano Banana (Fast)</option>
                        <option value="reeve">Reeve (Artistic)</option>
                    </select>
                    
                    <select 
                        disabled // Aspect ratio locked to project for now
                        className="bg-[#0C0C0C] text-xs text-gray-400 border border-[#3AAFA9]/10 rounded-md p-2 outline-none cursor-not-allowed"
                    >
                        <option>{aspectRatio} (Locked)</option>
                    </select>
                </div>

                {/* Sub-modes for Reeve/Nano */}
                {imageModel === 'reeve' && (
                    <div className="mt-2 flex gap-1">
                        {['edit', 'remix', 'text-to-image'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setRemixMode(m as any)}
                                className={`flex-1 py-1 text-[10px] uppercase font-bold rounded ${remixMode === m ? 'bg-[#00FFF0]/20 text-[#00FFF0]' : 'bg-[#0C0C0C] text-gray-500'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}
              </div>
            </div>
          )}

          {/* --- ANIMATE MODE CONTROLS --- */}
          {activeMode === 'animate' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               
               {/* Motion Prompt */}
               <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <Wand2 className="w-3 h-3 text-[#00FFF0]" />
                   The Action (Motion Prompt)
                </label>
                <Textarea
                  value={localVideoPrompt}
                  onChange={(e) => handleVideoPromptChange(e.target.value)}
                  placeholder="Describe the movement and action..."
                  className="bg-[#0C0C0C] border-[#3AAFA9]/20 focus:border-[#00FFF0] min-h-[100px] text-sm resize-none"
                />
              </div>

              {/* Start Frame */}
              <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <Image className="w-3 h-3 text-[#00FFF0]" />
                   Start Frame
                </label>
                
                <div className="relative w-full h-24 bg-[#0C0C0C] rounded-lg border border-[#3AAFA9]/20 overflow-hidden flex items-center justify-center">
                    {(videoStartImageUrl || selectedClip.generatedImage) ? (
                        <img 
                            src={videoStartImageUrl || selectedClip.generatedImage || ''} 
                            className="h-full w-full object-cover opacity-60"
                        />
                    ) : (
                        <p className="text-xs text-gray-600">No image selected</p>
                    )}
                    
                    <button 
                        onClick={() => handleOpenAssetPicker('video_start')}
                        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity"
                    >
                        <span className="bg-[#1E1F22] text-xs px-3 py-1 rounded-full border border-white/10 text-white">Change Image</span>
                    </button>
                </div>
                {(!videoStartImageUrl && selectedClip.generatedImage) && (
                    <p className="text-[10px] text-[#00FFF0]">✓ Using generated image automatically</p>
                )}
              </div>

              {/* Engine Selection */}
              <div className="pt-4 border-t border-[#3AAFA9]/10">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Settings className="w-3 h-3 text-[#00FFF0]" />
                    Engine & Duration
                </label>
                
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                         <button
                            onClick={() => setVideoModel('kling')}
                            className={`p-3 rounded-lg border text-left transition-all ${videoModel === 'kling' ? 'border-[#00FFF0] bg-[#00FFF0]/10' : 'border-[#3AAFA9]/20 bg-[#0C0C0C] hover:border-[#3AAFA9]/50'}`}
                         >
                            <p className={`text-xs font-bold ${videoModel === 'kling' ? 'text-[#00FFF0]' : 'text-gray-300'}`}>Kling AI</p>
                            <p className="text-[10px] text-gray-500 mt-1">Cinematic (5s)</p>
                         </button>

                         <button
                            onClick={() => setVideoModel('ltx')}
                            className={`p-3 rounded-lg border text-left transition-all ${videoModel === 'ltx' ? 'border-[#00FFF0] bg-[#00FFF0]/10' : 'border-[#3AAFA9]/20 bg-[#0C0C0C] hover:border-[#3AAFA9]/50'}`}
                         >
                            <p className={`text-xs font-bold ${videoModel === 'ltx' ? 'text-[#00FFF0]' : 'text-gray-300'}`}>LTX Studio</p>
                            <p className="text-[10px] text-gray-500 mt-1">Fast Cuts (1-2s)</p>
                         </button>
                    </div>

                    {/* Duration - Only for Kling mostly, but good to show */}
                    {videoModel === 'kling' && (
                        <div className="flex items-center gap-2 bg-[#0C0C0C] p-1 rounded-lg border border-[#3AAFA9]/10">
                            {[5, 10].map(sec => (
                                <button
                                    key={sec}
                                    onClick={() => handleUpdateClip({ duration: sec })}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedClip.duration === sec ? 'bg-[#3AAFA9] text-black' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {sec}s
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* 4. ACTION BAR (Bottom Fixed) */}
        <div className="p-4 bg-[#1E1F22] border-t border-[#3AAFA9]/20">
          <Button
            onClick={activeMode === 'visualize' ? handleGenerateImage : handleGenerateVideo}
            disabled={
                activeMode === 'visualize' 
                    ? (isGeneratingImage || clipGeneratingStatus[selectedClip.id] === 'image' || !localImagePrompt.trim())
                    : (isGeneratingVideo || clipGeneratingStatus[selectedClip.id] === 'video' || !localVideoPrompt.trim())
            }
            className={`w-full h-11 font-bold tracking-wide uppercase transition-all ${
                activeMode === 'visualize'
                    ? 'bg-[#00FFF0] text-black hover:bg-[#00FFF0]/80'
                    : 'bg-[#FF0055] text-white hover:bg-[#FF0055]/80' // Different color for video action? Or keep uniform? Let's use brand teal for visual, maybe standard for video. Actually sticking to Teal is safer for brand consistency.
            }`}
          >
            {activeMode === 'visualize' ? (
                isGeneratingImage ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Preview...</>
                ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate Visual</>
                )
            ) : (
                isGeneratingVideo ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering Scene...</>
                ) : (
                    <><Play className="w-4 h-4 mr-2" /> Animate Scene</>
                )
            )}
          </Button>
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
        onSelect={handleAssetSelect}
        onUpload={handleAssetUpload}
        isUploading={isUploadingAsset}
      />
    </div>
  )
}
