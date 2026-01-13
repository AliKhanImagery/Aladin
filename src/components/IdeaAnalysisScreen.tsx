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
  ZoomIn
} from 'lucide-react'
import { IdeaAnalysis, DetectedItem, AssetActionState, AssetContext } from '@/types'
import { supabase } from '@/lib/supabase'
import { saveUserAsset } from '@/lib/userMedia'
import toast from 'react-hot-toast'

interface IdeaAnalysisScreenProps {
  analysis: IdeaAnalysis
  onContinue: (assetContext: AssetContext) => void
  onBack: () => void
}

export default function IdeaAnalysisScreen({ analysis, onContinue, onBack }: IdeaAnalysisScreenProps) {
  const { user, updateAnalysisSettings, updateAssetAction } = useAppStore()
  
  const [tone, setTone] = useState<string[]>(analysis.analysis.recommendedTone || [])
  const [brandCues, setBrandCues] = useState<string[]>(analysis.analysis.recommendedBrandCues || [])
  const [toneInput, setToneInput] = useState('')
  const [brandCueInput, setBrandCueInput] = useState('')
  const [settingsConfirmed, setSettingsConfirmed] = useState(false)
  
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

  useEffect(() => {
    updateAnalysisSettings({
      tone,
      brandCues,
      type: analysis.analysis.type,
      confirmed: settingsConfirmed
    })
  }, [tone, brandCues, settingsConfirmed, analysis.analysis.type, updateAnalysisSettings])

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
          aspect_ratio: '16:9',
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

    // Get base image - prefer uploaded file, then result image, then base image
    const baseImageUrl = asset.uploadedFile 
      ? URL.createObjectURL(asset.uploadedFile)
      : asset.resultImageUrl || asset.baseImageUrl

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
          aspect_ratio: '16:9',
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

  const finalizeAndContinue = () => {
    const assetContext: AssetContext = {
      characters: assets.filter(a => a.type === 'character').map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
        role: (a.role as any) || 'supporting',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
        appearanceDetails: a.prompt || '',
          createdAt: new Date()
        })),
      products: assets.filter(a => a.type === 'product').map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
          needsExactMatch: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.needsExactMatch || false,
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
        type: analysis.analysis.type,
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
      finalizeAndContinue()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-emerald/10 rounded-3xl mb-4 glow-emerald">
          <ClipboardList className="w-10 h-10 text-brand-emerald" />
        </div>
        <h2 className="text-4xl font-bold text-white tracking-tight">Project Analysis</h2>
        <p className="text-gray-400 text-lg">We've mapped your concept. Confirm your project settings.</p>
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
              Project Assets
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
                    <input
                      type="file"
                        id={`up-${asset.assetId}`} 
                        className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(asset.assetId, file)
                          }
                      }}
                    />
                    <label
                        htmlFor={`up-${asset.assetId}`} 
                        className="flex items-center justify-center gap-2 h-10 bg-brand-obsidian/60 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer hover:bg-white/5 transition-all"
                    >
                      <Upload className="w-3 h-3" />
                        {status === 'uploading' ? 'Uploading...' : 'Select Frame'}
                    </label>
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

      {/* Image Zoom Modal */}
      {selectedImageModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setSelectedImageModal(null)}
        >
          {/* Action Header */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-[110]">
            <button
              onClick={() => setSelectedImageModal(null)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all duration-300 backdrop-blur-xl shadow-lg hover:text-red-400"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Image Container - Properly constrained */}
          <div 
            className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-8 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={selectedImageModal.imageUrl} 
              alt={selectedImageModal.assetName}
              className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] sm:max-w-[calc(100vw-4rem)] sm:max-h-[calc(100vh-12rem)] w-auto h-auto object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500 ease-out pointer-events-auto"
            />
            
            {/* Info Badge */}
            <div className="mt-4 sm:mt-6 px-4 py-2 sm:px-6 sm:py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl animate-in slide-in-from-bottom-2 duration-500 pointer-events-auto">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest">{selectedImageModal.assetName}</h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase mt-0.5">Project Asset • Resolution Verified</p>
                </div>
                <div className="h-6 sm:h-8 w-[1px] bg-white/10 mx-1 sm:mx-2" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      // Delete the image
                      setAssets(assets.map(a => 
                        a.assetId === selectedImageModal.assetId 
                          ? { ...a, resultImageUrl: undefined, uploadedFile: undefined, baseImageUrl: undefined } 
                          : a
                      ))
                      toast.success('Image removed')
                      setSelectedImageModal(null)
                    }}
                    className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors rounded-lg"
                    title="Delete Image"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                    className="p-2 hover:bg-brand-emerald/10 text-gray-400 hover:text-brand-emerald transition-colors rounded-lg"
                    title="Upload New"
                  >
                    <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
