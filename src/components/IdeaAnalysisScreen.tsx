'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  X, 
  Upload, 
  Sparkles, 
  Palette, 
  Wand2, 
  RefreshCw, 
  User, 
  Package, 
  MapPin, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  ClipboardList,
  ChevronRight,
  ShieldCheck,
  Trash2,
  ZoomIn,
  ChevronDown,
  Film,
  Video,
  Sparkles as SparklesIcon
} from 'lucide-react'
import { IdeaAnalysis, DetectedItem, AssetActionState, AssetContext } from '@/types'
import { supabase } from '@/lib/supabase'
import { saveUserAsset } from '@/lib/userMedia'
import toast from 'react-hot-toast'
import AssetLibraryModal from './AssetLibraryModal'

interface IdeaAnalysisScreenProps {
  analysis: IdeaAnalysis
  aspectRatio?: '16:9' | '9:16' | '1:1'
  onContinue: (assetContext: AssetContext) => void
  onBack: () => void
}

export default function IdeaAnalysisScreen({ analysis, aspectRatio = '16:9', onContinue, onBack }: IdeaAnalysisScreenProps) {
  const { user, updateAnalysisSettings, updateAssetAction } = useAppStore()
  
  const [tone, setTone] = useState<string[]>(analysis.analysis.recommendedTone || [])
  const [brandCues, setBrandCues] = useState<string[]>(analysis.analysis.recommendedBrandCues || [])
  const [toneInput, setToneInput] = useState('')
  const [brandCueInput, setBrandCueInput] = useState('')
  const [settingsConfirmed, setSettingsConfirmed] = useState(false)
  const [mediaType, setMediaType] = useState<string>(analysis.analysis.type)
  const [isMediaTypeDropdownOpen, setIsMediaTypeDropdownOpen] = useState(false)
  const [isMediaTypeOverridden, setIsMediaTypeOverridden] = useState(false)
  
  const [assets, setAssets] = useState<AssetActionState[]>(() => {
    return analysis.analysis.detectedItems.map(item => ({
      assetId: item.id,
      type: item.type,
      name: item.name,
      role: item.role,
      action: 'auto', // Default to auto for the best 'win' experience
      prompt: item.suggestedPrompt,
      error: undefined
    }))
  })

  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'uploaded' | 'generating'>>({})
  const [isGeneratingAutoAssets, setIsGeneratingAutoAssets] = useState(false)
  const [selectedImageModal, setSelectedImageModal] = useState<{ assetId: string; imageUrl: string; assetName: string } | null>(null)
  
  // New state for asset library picker
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)

  useEffect(() => {
    updateAnalysisSettings({
      tone,
      brandCues,
      type: mediaType,
      confirmed: settingsConfirmed
    })
  }, [tone, brandCues, settingsConfirmed, mediaType, updateAnalysisSettings])

  const handleMediaTypeChange = (newType: string) => {
    setMediaType(newType)
    setIsMediaTypeOverridden(newType !== analysis.analysis.type)
    setIsMediaTypeDropdownOpen(false)
  }

  const resetMediaType = () => {
    setMediaType(analysis.analysis.type)
    setIsMediaTypeOverridden(false)
    setIsMediaTypeDropdownOpen(false)
  }

  const MEDIA_TYPES = [
    { id: 'DVC', label: 'DVC', description: 'Digital Video Content (short-form, social media)', icon: Video },
    { id: 'TVC', label: 'TVC', description: 'Television Commercial', icon: Film },
    { id: 'Film', label: 'Film', description: 'Traditional film or video production', icon: Film },
    { id: 'Content/UGC', label: 'Content/UGC', description: 'User-generated content style', icon: SparklesIcon },
    { id: 'Animated/3D/ComputerGenerated', label: 'Animated/3D', description: 'Animated or CGI content', icon: SparklesIcon }
  ]

  const addTone = () => {
    if (toneInput.trim() && !tone.includes(toneInput.trim())) {
      setTone([...tone, toneInput.trim()])
      setToneInput('')
    }
  }

  const addBrandCue = () => {
    if (brandCueInput.trim() && !brandCues.includes(brandCueInput.trim())) {
      setBrandCues([...brandCues, brandCueInput.trim()])
      setBrandCueInput('')
    }
  }

  const handleAssetAction = (assetId: string, action: 'upload' | 'generate' | 'remix' | 'auto' | null) => {
    setAssets(assets.map(asset => 
      asset.assetId === assetId ? { ...asset, action, error: undefined } : asset
    ))
    updateAssetAction(assetId, action)
  }

  const handleFileUpload = async (assetId: string, file: File) => {
    if (!user?.id) {
      toast.error('Please sign in to upload files')
      return
    }

    console.log(`📤 Starting upload for asset ${assetId}:`, { fileName: file.name, fileSize: file.size })
    setUploadStatus(prev => ({ ...prev, [assetId]: 'uploading' }))

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/assets/${assetId}/${Date.now()}.${fileExt}`

      // Try assets bucket first, fallback to avatars if it doesn't exist
      let bucket = 'assets'
      let uploadData
      let uploadError

      console.log(`📦 Uploading to ${bucket} bucket:`, fileName)
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      uploadData = data
      uploadError = error

      // If assets bucket fails, try avatars as fallback
      if (uploadError && (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket'))) {
        console.warn(`⚠️ Assets bucket not found, trying avatars bucket...`)
        bucket = 'avatars'
        const fallbackFileName = `${user.id}/${assetId}/${Date.now()}.${fileExt}`
        console.log(`📦 Uploading to fallback ${bucket} bucket:`, fallbackFileName)
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from(bucket)
          .upload(fallbackFileName, file, {
            cacheControl: '3600',
            upsert: false
          })
        uploadData = fallbackData
        uploadError = fallbackError
      }

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw new Error(uploadError.message || 'Upload failed')
      }

      if (!uploadData) {
        throw new Error('Upload succeeded but no data returned')
      }

      console.log(`✅ Upload successful, getting public URL for path:`, uploadData.path)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path)
      
      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }

      console.log(`✅ Public URL obtained:`, urlData.publicUrl.substring(0, 50) + '...')

      // Update assets state with the new image URL
      setAssets(prevAssets => prevAssets.map(a => 
        a.assetId === assetId ? { ...a, resultImageUrl: urlData.publicUrl, uploadedFile: file } : a
      ))

      // Save to user_assets bin
      const currentAsset = assets.find(a => a.assetId === assetId)
      if (currentAsset) {
        saveUserAsset({
          name: currentAsset.name,
          type: currentAsset.type,
          asset_url: urlData.publicUrl,
          storage_path: uploadData.path,
          storage_bucket: bucket,
          description: analysis.analysis.detectedItems.find(item => item.id === assetId)?.description,
          metadata: {
            source: 'upload',
            originalFilename: file.name,
            fileSize: file.size,
          }
        }).catch(err => console.error('⚠️ Failed to save uploaded asset to library:', err))
      }
      
      // Clear upload status immediately to show the image
      setUploadStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[assetId] // Remove status entirely to hide loader
        return newStatus
      })
      
      toast.success('Asset uploaded successfully')
      console.log(`✅ Upload complete for asset ${assetId}`)
    } catch (error: any) {
      console.error('❌ File upload error:', error)
      // Clear upload status on error
      setUploadStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[assetId]
        return newStatus
      })
      toast.error(error?.message || 'Failed to upload asset. Please check bucket configuration.')
    }
  }

  const handleGenerateImage = async (asset: AssetActionState) => {
    if (!asset.prompt) {
      toast.error('Please provide a prompt for generation')
      return
    }
    setUploadStatus(prev => ({ ...prev, [asset.assetId]: 'generating' }))

    try {
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
        body: JSON.stringify({
          mode: 'text-to-image',
          prompt: `Professional production asset: ${asset.prompt}. Studio quality, photorealistic, 8k resolution.`,
          aspect_ratio: aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || 'Generation failed')
      }
      const { imageUrl } = await response.json()
      
      if (!imageUrl) {
        throw new Error('No image URL returned from generation')
      }
      
      setAssets(assets.map(a => 
        a.assetId === asset.assetId ? { ...a, resultImageUrl: imageUrl } : a
      ))

      // Save to user_assets bin
      saveUserAsset({
        name: asset.name,
        type: asset.type,
        asset_url: imageUrl,
        prompt: asset.prompt,
        description: analysis.analysis.detectedItems.find(item => item.id === asset.assetId)?.description,
        metadata: {
          source: 'generation',
          generationMode: 'text-to-image',
        }
      }).catch(err => console.error('⚠️ Failed to save generated asset to library:', err))

      // Clear upload status after a brief delay to show success
      setTimeout(() => {
        setUploadStatus(prev => {
          const newStatus = { ...prev }
          delete newStatus[asset.assetId] // Remove status entirely to hide loader
          return newStatus
        })
      }, 500)
      toast.success('Asset generated successfully')
    } catch (error: any) {
      console.error('❌ Generate image error:', error)
      setUploadStatus(prev => ({ ...prev, [asset.assetId]: 'idle' }))
      toast.error(error?.message || 'Failed to generate asset image')
    }
  }

  const handleRemixImage = async (asset: AssetActionState) => {
    if (!asset.prompt) {
      toast.error('Please provide a prompt for remix')
      return
    }

    // Get base image - prefer result image (public URL), then base image
    const baseImageUrl = asset.resultImageUrl || asset.baseImageUrl

    if (!baseImageUrl) {
      toast.error('Please upload or generate an image first to remix')
      return
    }

    setUploadStatus(prev => ({ ...prev, [asset.assetId]: 'generating' }))

    try {
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
        body: JSON.stringify({
          mode: 'remix',
          prompt: `Remix this asset: ${asset.prompt}. Maintain visual consistency while applying new style. Professional studio quality, 8k resolution.`,
          aspect_ratio: aspectRatio,
          image_url: baseImageUrl, // Reve Remix uses singular image_url
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || 'Remix failed')
      }
      const { imageUrl } = await response.json()
      
      if (!imageUrl) {
        throw new Error('No image URL returned from remix')
      }
      
      setAssets(assets.map(a => 
        a.assetId === asset.assetId ? { ...a, resultImageUrl: imageUrl, baseImageUrl: baseImageUrl } : a
      ))

      // Save to user_assets bin
      saveUserAsset({
        name: asset.name,
        type: asset.type,
        asset_url: imageUrl,
        prompt: asset.prompt,
        description: analysis.analysis.detectedItems.find(item => item.id === asset.assetId)?.description,
        metadata: {
          source: 'generation',
          generationMode: 'remix',
          baseImageUrl: baseImageUrl
        }
      }).catch(err => console.error('⚠️ Failed to save remixed asset to library:', err))

      // Clear upload status after a brief delay to show success
      setTimeout(() => {
        setUploadStatus(prev => {
          const newStatus = { ...prev }
          delete newStatus[asset.assetId] // Remove status entirely to hide loader
          return newStatus
        })
      }, 500)
      toast.success('Asset remixed successfully')
    } catch (error: any) {
      console.error('❌ Remix image error:', error)
      setUploadStatus(prev => ({ ...prev, [asset.assetId]: 'idle' }))
      toast.error(error?.message || 'Failed to remix asset image')
    }
  }

  const finalizeAndContinue = (dnaByAssetId?: Record<string, string>) => {
    const assetContext: AssetContext = {
      characters: assets.filter(a => a.type === 'character').map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
        role: (a.role as any) || 'supporting',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
        appearanceDetails: a.prompt || '',
          ...((dnaByAssetId?.[a.assetId] ?? a.visualDna) && { visualDna: dnaByAssetId?.[a.assetId] ?? a.visualDna }),
          createdAt: new Date()
        })),
      products: assets.filter(a => a.type === 'product').map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
          needsExactMatch: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.needsExactMatch || false,
          ...((dnaByAssetId?.[a.assetId] ?? a.visualDna) && { visualDna: dnaByAssetId?.[a.assetId] ?? a.visualDna }),
          createdAt: new Date()
        })),
      locations: assets.filter(a => a.type === 'location').map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
          createdAt: new Date()
        })),
      settings: {
        tone,
        brandCues,
        type: mediaType,
        confirmed: true
      }
    }
    onContinue(assetContext)
  }

  const handleContinue = async () => {
    if (!settingsConfirmed) {
      toast.error('Please confirm the production briefing settings')
      return
    }

    const pendingAutoAssets = assets.filter(a => a.action === 'auto' && !a.resultImageUrl)
    if (pendingAutoAssets.length > 0) {
      setIsGeneratingAutoAssets(true)
      for (const asset of pendingAutoAssets) {
        await handleGenerateImage(asset)
      }
      setIsGeneratingAutoAssets(false)
    }

    // Extract visual DNA once for each character/product with an image (saves cost, runs at init only)
    const dnaByAssetId: Record<string, string> = {}
    const withImage = assets.filter(
      a => (a.type === 'character' || a.type === 'product') && a.resultImageUrl
    )
    if (withImage.length > 0) {
      setIsGeneratingAutoAssets(true)
      const assetTypeForApi = (t: string) => (t === 'character' ? 'character' : 'product')
      for (const asset of withImage) {
        try {
          const res = await fetch('/api/extract-asset-dna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: asset.resultImageUrl,
              assetType: assetTypeForApi(asset.type),
            }),
          })
          const data = await res.json().catch(() => ({}))
          const dna = data?.dna
          if (dna) {
             console.log(`🧬 Visual DNA Extracted for ${asset.name}:`, dna)
             dnaByAssetId[asset.assetId] = dna
          }
        } catch (err) {
          console.warn('Vision DNA extraction failed for asset', asset.assetId, err)
        }
      }
      setIsGeneratingAutoAssets(false)
    }

    finalizeAndContinue(dnaByAssetId)
  }

  return (
      <div className="max-w-6xl mx-auto space-y-12 pb-20 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-emerald/10 rounded-3xl mb-4 glow-emerald">
          <ClipboardList className="w-10 h-10 text-brand-emerald" />
        </div>
        <h2 className="text-4xl font-bold text-white tracking-tight">Production Analysis</h2>
        <p className="text-gray-400 text-lg">We’ve mapped your concept. Confirm your production settings.</p>
      </div>

      {/* Media Type Badge with Dropdown */}
      <div className="flex items-center justify-center">
        <div className="relative">
          <button
            onClick={() => setIsMediaTypeDropdownOpen(!isMediaTypeDropdownOpen)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 group ${
              isMediaTypeOverridden
                ? 'bg-brand-amber/10 border-brand-amber/30 hover:bg-brand-amber/15'
                : 'bg-brand-emerald/10 border-brand-emerald/30 hover:bg-brand-emerald/15'
            }`}
          >
            <div className={`flex items-center gap-2 ${isMediaTypeOverridden ? 'text-brand-amber' : 'text-brand-emerald'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                {isMediaTypeOverridden ? 'Overridden' : 'Detected'}:
              </span>
              <span className="text-sm font-bold tracking-tight">
                {MEDIA_TYPES.find(m => m.id === mediaType)?.label || mediaType}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isMediaTypeOverridden ? 'text-brand-amber/60' : 'text-brand-emerald/60'} ${isMediaTypeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMediaTypeDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsMediaTypeDropdownOpen(false)}
              />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#09090b]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-2">
                  {MEDIA_TYPES.map((type) => {
                    const Icon = type.icon
                    const isActive = mediaType === type.id
                    const isDetected = type.id === analysis.analysis.type
                    return (
                      <button
                        key={type.id}
                        onClick={() => handleMediaTypeChange(type.id)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all duration-300 ${
                          isActive 
                            ? 'bg-brand-emerald/10 border border-brand-emerald/30' 
                            : 'hover:bg-white/[0.05] border border-transparent'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          isActive ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/20'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold tracking-tight transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/70'}`}>
                              {type.label}
                            </span>
                            {isDetected && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-brand-emerald/60">
                                DETECTED
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-medium transition-colors duration-300 ${isActive ? 'text-brand-emerald' : 'text-white/40'}`}>
                            {type.description}
                          </div>
                        </div>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)] flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                  {isMediaTypeOverridden && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <button
                        onClick={resetMediaType}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-brand-amber hover:bg-brand-amber/10 transition-colors duration-300"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset to Detected
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Parameters Sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-8 space-y-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Palette className="w-5 h-5 text-brand-emerald" />
              Visual Tone
        </h3>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Visual Atmosphere</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tone.map((t, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-brand-emerald/10 border border-brand-emerald/20 rounded-lg text-xs font-bold text-brand-emerald">
                {t}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setTone(tone.filter((_, i) => i !== idx))} />
              </span>
            ))}
          </div>
          <div className="flex gap-2">
                  <Input value={toneInput} onChange={(e) => setToneInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTone()} placeholder="Add tone..." className="bg-brand-obsidian/40 border-white/10 text-white rounded-xl h-10" />
                  <Button onClick={addTone} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 h-10 px-4">Add</Button>
          </div>
        </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Identity Cues</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {brandCues.map((cue, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-xs font-bold text-brand-amber">
                {cue}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setBrandCues(brandCues.filter((_, i) => i !== idx))} />
              </span>
            ))}
          </div>
          <div className="flex gap-2">
                  <Input value={brandCueInput} onChange={(e) => setBrandCueInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addBrandCue()} placeholder="Add cue..." className="bg-brand-obsidian/40 border-white/10 text-white rounded-xl h-10" />
                  <Button onClick={addBrandCue} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 h-10 px-4">Add</Button>
          </div>
        </div>
        </div>

            <div className="pt-6 border-t border-white/5 flex items-center gap-3">
              <Checkbox id="confirm-briefing" checked={settingsConfirmed} onChange={(e) => setSettingsConfirmed(e.target.checked)} className="border-white/20" />
              <label htmlFor="confirm-briefing" className="text-sm font-medium text-gray-400 cursor-pointer">Confirm briefing parameters</label>
            </div>
        </div>
      </div>

        {/* Asset Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-brand-emerald" />
              Production Assets
            </h3>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{assets.length} Elements Detected</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
          {assets.map((asset) => {
              const Icon = asset.type === 'character' ? User : asset.type === 'product' ? Package : MapPin
            const status = uploadStatus[asset.assetId] || 'idle'
            const hasImage = !!asset.resultImageUrl

            return (
                <div key={asset.assetId} className="glass-card rounded-3xl p-6 border-white/5 group relative">
                  <div className="aspect-video rounded-2xl bg-brand-obsidian/60 border border-white/5 mb-6 overflow-hidden relative group/image-container">
                  {hasImage ? (
                    <>
                      <img 
                        src={asset.resultImageUrl} 
                        alt={asset.name} 
                          className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover/image-container:scale-105" 
                          onClick={() => setSelectedImageModal({ 
                            assetId: asset.assetId, 
                            imageUrl: asset.resultImageUrl || '', 
                            assetName: asset.name 
                          })}
                          onError={(e) => {
                            console.error('❌ Image failed to load:', asset.resultImageUrl)
                            // Clear the image URL if it fails to load
                            setAssets(prevAssets => prevAssets.map(a => 
                              a.assetId === asset.assetId ? { ...a, resultImageUrl: undefined } : a
                            ))
                            toast.error('Failed to load image. Please try uploading again.')
                          }}
                          onLoad={() => {
                            console.log('✅ Image loaded successfully:', asset.resultImageUrl?.substring(0, 50))
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/image-container:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover/image-container:opacity-100">
                          <div className="flex items-center gap-2">
                            <ZoomIn className="w-5 h-5 text-white" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Click to View</span>
                          </div>
                      </div>
                    </>
                  ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Awaiting Visualization</span>
                        </div>
                      )}
                    {(status === 'uploading' || status === 'generating') && !hasImage ? (
                      <div className="absolute inset-0 bg-brand-obsidian/80 backdrop-blur-sm flex items-center justify-center z-10">
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 text-brand-emerald animate-spin mx-auto mb-2" />
                          <span className="text-xs text-brand-emerald font-bold uppercase tracking-wider">
                            {status === 'uploading' ? 'Uploading...' : 'Generating...'}
                          </span>
                        </div>
                    </div>
                    ) : null}
                    {/* Show loader overlay only if image is loading (not if image exists) */}
                    {(status === 'uploading' || status === 'generating') && hasImage ? (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none">
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-brand-emerald animate-spin mx-auto mb-1" />
                          <span className="text-[10px] text-brand-emerald font-bold uppercase tracking-wider">
                            {status === 'uploading' ? 'Processing...' : 'Generating...'}
                          </span>
                        </div>
                      </div>
                    ) : null}
                </div>

                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-emerald transition-colors">
                      <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{asset.name}</h4>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mt-1">{asset.type} {asset.role ? `• ${asset.role}` : ''}</p>
                  </div>
                </div>

                  {/* Character Detail Prompt Editor */}
                  {asset.type === 'character' && (
                    <div className="mb-4 space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                        Character Appearance Details
                      </label>
                      <Textarea
                        value={asset.prompt || ''}
                        onChange={(e) => {
                          setAssets(assets.map(a => 
                            a.assetId === asset.assetId ? { ...a, prompt: e.target.value } : a
                          ))
                        }}
                        placeholder="Describe the character's appearance, style, clothing, features..."
                        rows={3}
                        className="bg-brand-obsidian/40 border-white/10 text-white text-xs rounded-xl resize-none focus:border-brand-emerald/40"
                      />
                    </div>
                  )}

                {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button 
                      onClick={() => handleAssetAction(asset.assetId, 'auto')}
                      className={`h-9 rounded-xl text-[10px] font-bold uppercase transition-all ${asset.action === 'auto' ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald border' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
                    >
                      Auto
                    </button>
                    <button 
                    onClick={() => handleAssetAction(asset.assetId, 'generate')}
                      className={`h-9 rounded-xl text-[10px] font-bold uppercase transition-all ${asset.action === 'generate' ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald border' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
                    >
                    Generate
                    </button>
                    <button 
                      onClick={() => handleAssetAction(asset.assetId, 'upload')}
                      className={`h-9 rounded-xl text-[10px] font-bold uppercase transition-all ${asset.action === 'upload' ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald border' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
                    >
                      Upload
                    </button>
                    <button 
                    onClick={() => handleAssetAction(asset.assetId, 'remix')}
                      disabled={!asset.resultImageUrl && !asset.uploadedFile && !asset.baseImageUrl}
                      className={`h-9 rounded-xl text-[10px] font-bold uppercase transition-all ${asset.action === 'remix' ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald border' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'} ${!asset.resultImageUrl && !asset.uploadedFile && !asset.baseImageUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                    Remix
                    </button>
                </div>

                {/* Action-specific UI */}
                {asset.action === 'upload' && (
                  <div className="mt-2 pt-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        setActiveAssetId(asset.assetId)
                        setIsLibraryOpen(true)
                      }}
                      className="w-full flex items-center justify-center gap-2 h-10 bg-brand-obsidian/60 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer hover:bg-white/5 transition-all"
                    >
                      <ImageIcon className="w-3 h-3" />
                      {status === 'uploading' ? 'Uploading...' : 'Choose Image'}
                    </button>
                  </div>
                )}

                {asset.action === 'generate' && (
                    <div className="mt-2 pt-3 border-t border-white/5">
                      <button
                      onClick={() => handleGenerateImage(asset)}
                        disabled={!asset.prompt || status === 'generating'}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-brand-obsidian/60 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'generating' ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" /> Generate Image
                          </>
                        )}
                      </button>
                  </div>
                )}

                {asset.action === 'remix' && (
                    <div className="mt-2 pt-3 border-t border-white/5">
                      <button
                      onClick={() => handleRemixImage(asset)}
                        disabled={(!asset.resultImageUrl && !asset.uploadedFile && !asset.baseImageUrl) || status === 'generating' || !asset.prompt}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-brand-obsidian/60 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status === 'generating' ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Remixing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" /> Remix Image
                          </>
                        )}
                      </button>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-12 border-t border-white/5">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white transition-colors">
          Cancel
        </button>
        <Button onClick={handleContinue} disabled={!settingsConfirmed || isGeneratingAutoAssets} className="btn-primary min-w-[300px] h-14 rounded-2xl flex items-center justify-center gap-3 text-lg">
          {isGeneratingAutoAssets ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generating Assets...</>
          ) : (
            <>Continue to Storyboard <ChevronRight className="w-5 h-5" /></>
          )}
        </Button>
      </div>

      {/* Asset Library Modal — presetName skips "Name this Reference" for detected assets */}
      {isLibraryOpen && activeAssetId && (
        <AssetLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => { setActiveAssetId(null); setIsLibraryOpen(false) }}
          onSelect={(url) => {
            setAssets(prev => prev.map(a => 
              a.assetId === activeAssetId ? { ...a, resultImageUrl: url } : a
            ))
            setActiveAssetId(null)
            setIsLibraryOpen(false)
          }}
          onUpload={async (file) => {
            await handleFileUpload(activeAssetId, file)
            setActiveAssetId(null)
            setIsLibraryOpen(false)
          }}
          isUploading={uploadStatus[activeAssetId] === 'uploading'}
          presetName={assets.find(a => a.assetId === activeAssetId)?.name}
        />
      )}

      {/* Image Zoom Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedImageModal(null)}
        >
          {/* Image Container - Tight fit */}
          <div 
            className="relative inline-block max-w-full max-h-full overflow-hidden rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={selectedImageModal.imageUrl} 
              alt={selectedImageModal.assetName}
              className="block w-auto h-auto object-contain cursor-default"
              style={{
                maxWidth: '100vw',
                maxHeight: '100vh',
              }}
            />
            
            {/* Action Buttons (Overlay - Top Right) */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-[110]">
              <button
                onClick={() => setSelectedImageModal(null)}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white transition-all duration-300 backdrop-blur-md shadow-lg hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Badge Overlay - Bottom Center */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[90%] flex justify-center pointer-events-none">
              <div className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl animate-in slide-in-from-bottom-2 duration-500 pointer-events-auto flex items-center gap-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest truncate max-w-[150px] sm:max-w-[200px]">{selectedImageModal.assetName}</h3>
                  <p className="text-[9px] text-gray-300 font-bold uppercase mt-0.5">Production Asset</p>
                </div>
                <div className="h-6 w-[1px] bg-white/20" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      setAssets(assets.map(a => 
                        a.assetId === selectedImageModal.assetId 
                          ? { ...a, resultImageUrl: undefined, uploadedFile: undefined, baseImageUrl: undefined } 
                          : a
                      ))
                      toast.success('Image removed')
                      setSelectedImageModal(null)
                    }}
                    className="p-2 hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition-colors rounded-lg"
                    title="Delete Image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      handleAssetAction(selectedImageModal.assetId, 'upload')
                      setSelectedImageModal(null)
                      setTimeout(() => {
                        const fileInput = document.getElementById(`up-${selectedImageModal.assetId}`) as HTMLInputElement
                        if (fileInput) fileInput.click()
                      }, 100)
                    }}
                    className="p-2 hover:bg-brand-emerald/20 text-gray-300 hover:text-brand-emerald transition-colors rounded-lg"
                    title="Upload New"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
