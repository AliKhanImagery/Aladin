'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Upload, Sparkles, Palette, Wand2, RefreshCw, User, Package, MapPin } from 'lucide-react'
import { IdeaAnalysis, DetectedItem, AssetActionState } from '@/types'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface IdeaAnalysisScreenProps {
  analysis: IdeaAnalysis
  onContinue: (assetContext: any) => void
  onBack: () => void
}

export default function IdeaAnalysisScreen({ analysis, onContinue, onBack }: IdeaAnalysisScreenProps) {
  const { user, updateAnalysisSettings, updateAssetAction, analysisScreenState } = useAppStore()
  
  // Initialize state from analysis
  const [tone, setTone] = useState<string[]>(analysis.analysis.recommendedTone || [])
  const [brandCues, setBrandCues] = useState<string[]>(analysis.analysis.recommendedBrandCues || [])
  const [toneInput, setToneInput] = useState('')
  const [brandCueInput, setBrandCueInput] = useState('')
  const [settingsConfirmed, setSettingsConfirmed] = useState(false)
  
  // Initialize asset states from detected items
  const [assets, setAssets] = useState<AssetActionState[]>(() => {
    return analysis.analysis.detectedItems.map(item => ({
      assetId: item.id,
      type: item.type,
      name: item.name,
      role: item.role,
      action: null,
      prompt: item.suggestedPrompt,
      error: undefined
    }))
  })

  // Update store when assets change
  useEffect(() => {
    updateAnalysisSettings({
      tone,
      brandCues,
      type: analysis.analysis.type,
      confirmed: settingsConfirmed
    })
  }, [tone, brandCues, settingsConfirmed, analysis.analysis.type, updateAnalysisSettings])

  // Handle tone tag management
  const addTone = () => {
    if (toneInput.trim() && !tone.includes(toneInput.trim())) {
      setTone([...tone, toneInput.trim()])
      setToneInput('')
    }
  }

  const removeTone = (index: number) => {
    setTone(tone.filter((_, i) => i !== index))
  }

  // Handle brand cue tag management
  const addBrandCue = () => {
    if (brandCueInput.trim() && !brandCues.includes(brandCueInput.trim())) {
      setBrandCues([...brandCues, brandCueInput.trim()])
      setBrandCueInput('')
    }
  }

  const removeBrandCue = (index: number) => {
    setBrandCues(brandCues.filter((_, i) => i !== index))
  }

  // Handle asset action selection
  const handleAssetAction = (assetId: string, action: 'upload' | 'generate' | 'remix' | 'auto' | null) => {
    setAssets(assets.map(asset => 
      asset.assetId === assetId 
        ? { ...asset, action, error: undefined }
        : asset
    ))
    updateAssetAction(assetId, action)
  }

  // Handle file upload
  const handleFileUpload = async (assetId: string, file: File) => {
    if (!user?.id) {
      toast.error('Please sign in to upload files')
      return
    }

    // Validate file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setAssets(assets.map(a => 
        a.assetId === assetId 
          ? { ...a, error: 'Invalid file type. Please upload JPG, PNG, or WebP.' }
          : a
      ))
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setAssets(assets.map(a => 
        a.assetId === assetId 
          ? { ...a, error: 'File size too large. Maximum size is 10MB.' }
          : a
      ))
      return
    }

    try {
      // Upload to Supabase Storage (using 'assets' bucket or create one)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/assets/${assetId}/${Date.now()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        // If bucket doesn't exist, try 'avatars' as fallback or create assets bucket
        console.warn('Assets bucket not found, using avatars as fallback')
        const fallbackFileName = `${user.id}/assets/${Date.now()}.${fileExt}`
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('avatars')
          .upload(fallbackFileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (fallbackError) {
          throw new Error(fallbackError.message)
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fallbackData.path)

        setAssets(assets.map(a => 
          a.assetId === assetId 
            ? { ...a, resultImageUrl: urlData.publicUrl, uploadedFile: file }
            : a
        ))
        toast.success('File uploaded successfully!')
        return
      }

      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(data.path)

      setAssets(assets.map(a => 
        a.assetId === assetId 
          ? { ...a, resultImageUrl: urlData.publicUrl, uploadedFile: file }
          : a
      ))
      toast.success('File uploaded successfully!')
    } catch (error: any) {
      console.error('Upload error:', error)
      setAssets(assets.map(a => 
        a.assetId === assetId 
          ? { ...a, error: error.message || 'Failed to upload file' }
          : a
      ))
      toast.error('Failed to upload file')
    }
  }

  // Handle image generation
  const handleGenerateImage = async (asset: AssetActionState) => {
    if (!asset.prompt) {
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, error: 'Please provide a prompt for generation' }
          : a
      ))
      return
    }

    try {
      const response = await fetch('/api/generate-image-remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'text-to-image',
          prompt: asset.prompt,
          aspect_ratio: '16:9',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const { imageUrl } = await response.json()
      
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, resultImageUrl: imageUrl }
          : a
      ))
      toast.success('Image generated successfully!')
    } catch (error: any) {
      console.error('Generation error:', error)
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, error: error.message || 'Failed to generate image' }
          : a
      ))
      toast.error('Failed to generate image')
    }
  }

  // Handle remix
  const handleRemixImage = async (asset: AssetActionState) => {
    if (!asset.baseImageUrl && !asset.uploadedFile) {
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, error: 'Please upload a base image to use Remix mode' }
          : a
      ))
      return
    }

    if (!asset.prompt) {
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, error: 'Please provide a prompt for remix' }
          : a
      ))
      return
    }

    try {
      const baseImageUrl = asset.baseImageUrl || asset.resultImageUrl
      if (!baseImageUrl) {
        throw new Error('No base image available')
      }

      const response = await fetch('/api/generate-image-remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'remix',
          prompt: asset.prompt,
          reference_image_urls: [baseImageUrl],
          aspect_ratio: '16:9',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remix image')
      }

      const { imageUrl } = await response.json()
      
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, resultImageUrl: imageUrl }
          : a
      ))
      toast.success('Image remixed successfully!')
    } catch (error: any) {
      console.error('Remix error:', error)
      setAssets(assets.map(a => 
        a.assetId === asset.assetId 
          ? { ...a, error: error.message || 'Failed to remix image' }
          : a
      ))
      toast.error('Failed to remix image')
    }
  }

  // Handle continue
  const handleContinue = () => {
    if (!settingsConfirmed) {
      toast.error('Please confirm the settings before continuing')
      return
    }

    // Build asset context from assets
    const assetContext = {
      characters: assets
        .filter(a => a.type === 'character')
        .map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
          role: (a.role as 'protagonist' | 'antagonist' | 'supporting') || 'supporting',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
          appearanceDetails: a.prompt || analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.suggestedPrompt || '',
          createdAt: new Date()
        })),
      products: assets
        .filter(a => a.type === 'product')
        .map(a => ({
          id: a.assetId,
          name: a.name,
          description: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.description || '',
          assetUrl: a.resultImageUrl,
          assetAction: a.action || 'auto',
          needsExactMatch: analysis.analysis.detectedItems.find(item => item.id === a.assetId)?.needsExactMatch || false,
          createdAt: new Date()
        })),
      locations: assets
        .filter(a => a.type === 'location')
        .map(a => ({
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

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'character':
        return <User className="w-5 h-5" />
      case 'product':
        return <Package className="w-5 h-5" />
      case 'location':
        return <MapPin className="w-5 h-5" />
      default:
        return <Sparkles className="w-5 h-5" />
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center pb-[53px]">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00FFF0]/10 rounded-full mb-4 shadow-[0_0_20px_rgba(0,255,240,0.3)]">
          <Sparkles className="w-8 h-8 text-[#00FFF0]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 neon-text">We Analyzed Your Idea!</h2>
        <p className="text-gray-400">Review and customize the detected elements</p>
      </div>

      {/* Story Preview */}
      <div className="bg-[#1A1A24] rounded-2xl p-6 border border-[#00FFF0]/30 shadow-[0_0_15px_rgba(0,255,240,0.1)]">
        <h3 className="text-lg font-semibold text-white mb-2">Story Preview</h3>
        <p className="text-gray-300 italic">"{analysis.preview}"</p>
      </div>

      {/* Settings Section */}
      <div className="bg-[#1A1A24] rounded-2xl p-6 border border-[#00FFF0]/30 shadow-[0_0_15px_rgba(0,255,240,0.1)]">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#00FFF0]" />
          Story Settings (AI Recommended)
        </h3>

        {/* Tone & Mood */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Tone & Mood</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tone.map((t, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-full text-sm text-[#00FFF0]"
              >
                {t}
                <button
                  onClick={() => removeTone(index)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={toneInput}
              onChange={(e) => setToneInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTone()}
              placeholder="Add tone keyword..."
              className="bg-[#0C0C0C] border-[#00FFF0]/30 text-white"
            />
            <Button
              onClick={addTone}
              className="bg-[#00FFF0]/20 hover:bg-[#00FFF0]/30 text-[#00FFF0] border border-[#00FFF0]/30"
            >
              Add
            </Button>
          </div>
        </div>

        {/* Brand Cues */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Brand Cues</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {brandCues.map((cue, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-full text-sm text-[#00FFF0]"
              >
                {cue}
                <button
                  onClick={() => removeBrandCue(index)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={brandCueInput}
              onChange={(e) => setBrandCueInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addBrandCue()}
              placeholder="Add brand cue..."
              className="bg-[#0C0C0C] border-[#00FFF0]/30 text-white"
            />
            <Button
              onClick={addBrandCue}
              className="bg-[#00FFF0]/20 hover:bg-[#00FFF0]/30 text-[#00FFF0] border border-[#00FFF0]/30"
            >
              Add
            </Button>
          </div>
        </div>

        {/* Content Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
          <span className="inline-block px-3 py-1 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-full text-sm text-[#00FFF0]">
            {analysis.analysis.type} (detected)
          </span>
        </div>

        {/* Confirmation Checkbox */}
        <div className="flex items-center gap-2 pt-4 border-t border-[#00FFF0]/20">
          <Checkbox
            id="confirm-settings"
            checked={settingsConfirmed}
            onChange={(e) => setSettingsConfirmed(e.target.checked)}
          />
          <label htmlFor="confirm-settings" className="text-sm text-gray-300 cursor-pointer">
            I confirm these settings
          </label>
        </div>
      </div>

      {/* Detected Assets */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">📋 Detected Assets</h3>
        <div className="space-y-4">
          {assets.map((asset) => {
            const detectedItem = analysis.analysis.detectedItems.find(item => item.id === asset.assetId)
            return (
              <div
                key={asset.assetId}
                className="bg-[#1A1A24] rounded-xl p-6 border border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-2 bg-[#00FFF0]/10 rounded-lg">
                    {getAssetIcon(asset.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {asset.name}
                      {asset.role && <span className="text-sm text-gray-400 ml-2">({asset.role})</span>}
                    </h4>
                    <p className="text-sm text-gray-400 mb-2">
                      {detectedItem?.description || 'No description available'}
                    </p>
                    {detectedItem?.mentionedInIdea && (
                      <span className="inline-block px-2 py-0.5 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded text-xs text-[#00FFF0]">
                        Mentioned in your idea
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    onClick={() => handleAssetAction(asset.assetId, 'upload')}
                    variant={asset.action === 'upload' ? 'default' : 'outline'}
                    className={asset.action === 'upload' 
                      ? 'bg-[#00FFF0] text-black shadow-[0_0_10px_rgba(0,255,240,0.5)]' 
                      : 'border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10'}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  <Button
                    onClick={() => handleAssetAction(asset.assetId, 'generate')}
                    variant={asset.action === 'generate' ? 'default' : 'outline'}
                    className={asset.action === 'generate' 
                      ? 'bg-[#00FFF0] text-black shadow-[0_0_10px_rgba(0,255,240,0.5)]' 
                      : 'border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10'}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                  <Button
                    onClick={() => handleAssetAction(asset.assetId, 'remix')}
                    variant={asset.action === 'remix' ? 'default' : 'outline'}
                    className={asset.action === 'remix' 
                      ? 'bg-[#00FFF0] text-black shadow-[0_0_10px_rgba(0,255,240,0.5)]' 
                      : 'border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10'}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Remix
                  </Button>
                  <Button
                    onClick={() => handleAssetAction(asset.assetId, 'auto')}
                    variant={asset.action === 'auto' ? 'default' : 'outline'}
                    className={asset.action === 'auto' 
                      ? 'bg-[#00FFF0] text-black shadow-[0_0_10px_rgba(0,255,240,0.5)]' 
                      : 'border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10'}
                  >
                    Let StoryGinnie decide
                  </Button>
                </div>

                {/* Action-specific UI */}
                {asset.action === 'upload' && (
                  <div className="mb-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(asset.assetId, file)
                      }}
                      className="hidden"
                      id={`upload-${asset.assetId}`}
                    />
                    <label
                      htmlFor={`upload-${asset.assetId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] border border-[#00FFF0]/30 rounded-lg text-white cursor-pointer hover:bg-[#00FFF0]/10 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Choose File
                    </label>
                    {asset.resultImageUrl && (
                      <div className="mt-2">
                        <img src={asset.resultImageUrl} alt={asset.name} className="w-32 h-32 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                )}

                {asset.action === 'generate' && (
                  <div className="mb-4">
                    <Textarea
                      value={asset.prompt || ''}
                      onChange={(e) => {
                        setAssets(assets.map(a => 
                          a.assetId === asset.assetId 
                            ? { ...a, prompt: e.target.value }
                            : a
                        ))
                      }}
                      placeholder="Edit the prompt for generation..."
                      className="w-full h-24 bg-[#0C0C0C] border-[#00FFF0]/30 text-white mb-2"
                    />
                    <Button
                      onClick={() => handleGenerateImage(asset)}
                      className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Image
                    </Button>
                    {asset.resultImageUrl && (
                      <div className="mt-2">
                        <img src={asset.resultImageUrl} alt={asset.name} className="w-32 h-32 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                )}

                {asset.action === 'remix' && (
                  <div className="mb-4">
                    <div className="mb-2">
                      <label className="block text-sm text-gray-300 mb-1">Base Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (e) => {
                              setAssets(assets.map(a => 
                                a.assetId === asset.assetId 
                                  ? { ...a, baseImageUrl: e.target?.result as string, uploadedFile: file }
                                  : a
                              ))
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="hidden"
                        id={`remix-base-${asset.assetId}`}
                      />
                      <label
                        htmlFor={`remix-base-${asset.assetId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] border border-[#00FFF0]/30 rounded-lg text-white cursor-pointer hover:bg-[#00FFF0]/10 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Base Image
                      </label>
                    </div>
                    <Textarea
                      value={asset.prompt || ''}
                      onChange={(e) => {
                        setAssets(assets.map(a => 
                          a.assetId === asset.assetId 
                            ? { ...a, prompt: e.target.value }
                            : a
                        ))
                      }}
                      placeholder="Edit the prompt for remix..."
                      className="w-full h-24 bg-[#0C0C0C] border-[#00FFF0]/30 text-white mb-2"
                    />
                    <Button
                      onClick={() => handleRemixImage(asset)}
                      className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Remix Image
                    </Button>
                    {!asset.baseImageUrl && !asset.uploadedFile && (
                      <div className="mt-2 p-3 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-lg">
                        <p className="text-sm text-[#00FFF0]">⚠️ Please upload a base image to use Remix mode</p>
                        <p className="text-xs text-gray-400 mt-1">
                          ℹ️ Remix mode requires a base image. You can upload one or use Generate mode instead.
                        </p>
                      </div>
                    )}
                    {asset.resultImageUrl && (
                      <div className="mt-2">
                        <img src={asset.resultImageUrl} alt={asset.name} className="w-32 h-32 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {asset.error && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{asset.error}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-[#00FFF0]/20">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10"
        >
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!settingsConfirmed}
          className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-8 py-3 rounded-xl
                   shadow-[0_0_15px_rgba(0,255,240,0.5)] hover:shadow-[0_0_25px_rgba(0,255,240,0.8)]
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300"
        >
          Continue to Story →
        </Button>
      </div>
    </div>
  )
}

