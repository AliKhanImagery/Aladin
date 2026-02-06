'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, Image as ImageIcon, Package, User, MapPin, Search, Loader2, Music, Play, Pause } from 'lucide-react'
import { getUserAssets, getUserImages, getUserAudio } from '@/lib/userMedia'
import toast from 'react-hot-toast'

interface AssetLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string, name?: string) => void
  onUpload: (file: File) => Promise<void>
  isUploading?: boolean
  projectContext?: any // Optional project context for suggestions
  initialTab?: 'assets' | 'generated' | 'audio'
  allowedTypes?: ('assets' | 'generated' | 'audio')[]
}

type Tab = 'assets' | 'generated' | 'audio'

export default function AssetLibraryModal({ isOpen, onClose, onSelect, onUpload, isUploading = false, projectContext, initialTab = 'assets', allowedTypes }: AssetLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [assets, setAssets] = useState<any[]>([])
  const [images, setImages] = useState<any[]>([])
  const [audioFiles, setAudioFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Naming Modal State
  const [namingAsset, setNamingAsset] = useState<{ url: string, type: 'asset' | 'generated' } | null>(null)
  const [assetName, setAssetName] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Suggestions from project context
  const suggestions = projectContext ? [
    ...(projectContext.characters?.map((c: any) => c.name) || []),
    ...(projectContext.assetContext?.products?.map((p: any) => p.name) || []),
    ...(projectContext.assetContext?.locations?.map((l: any) => l.name) || [])
  ] : []
  
  // Load data function - memoized to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [assetsData, imagesData, audioData] = await Promise.all([
        getUserAssets(undefined, undefined), // Get all general assets (excluding filtered ones if needed, but getUserAssets returns based on type param if provided. Here we want generic assets, but getUserAssets(userId) returns everything in user_assets. We might need to filter client side or split queries.)
        // Actually getUserAssets implementation: executeAssetQuery(userId, projectId, type). 
        // If type is undefined, it returns all.
        // But we want to separate 'audio' from 'assets' (character/product/location).
        // Let's filter on client side for now to keep it simple, or call separately.
        getUserImages(),
        getUserAudio()
      ])
      
      // Filter audio out of generic assets if they are mixed
      const nonAudioAssets = (assetsData || []).filter((a: any) => a.type !== 'audio')
      
      setAssets(nonAudioAssets)
      setImages(imagesData || [])
      setAudioFiles(audioData || [])
    } catch (error) {
      console.error('Failed to load library data:', error)
      toast.error('Failed to load library')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Cleanup audio on close
  useEffect(() => {
    if (!isOpen) {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }
        setPlayingAudioId(null)
    }
  }, [isOpen])

  // Load data on open
  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Enforce size limits for specific tabs
    if (activeTab === 'audio') {
      const maxBytes = 2 * 1024 * 1024 // 2MB
      if (file.size > maxBytes) {
        toast.error('Audio file too large. Please upload a file under 2MB.')
        // Reset file input to allow re-selecting the same file
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
    }

    // Duplicate check logic
    const isDuplicate = assets.some(asset => 
      asset.metadata?.originalFilename === file.name && 
      asset.metadata?.fileSize === file.size
    )

    if (isDuplicate) {
      const duplicateAsset = assets.find(asset => 
        asset.metadata?.originalFilename === file.name && 
        asset.metadata?.fileSize === file.size
      )
      
      if (duplicateAsset && window.confirm(`File "${file.name}" already exists in your library. Use existing file instead?`)) {
        handleAssetClick(duplicateAsset.asset_url, 'asset')
        return
      }
    }

    // Proceed with upload if not duplicate or user chose to proceed
    await onUpload(file)
    
    // Reset file input to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    // Refresh list after upload
    await loadData()
    // NOTE: Ideally onUpload should return the new URL so we can open naming immediately.
    // For now, user will see it in the grid and click it.
  }

  const handleAssetClick = (url: string, type: 'asset' | 'generated') => {
    setNamingAsset({ url, type })
    setAssetName('') // Reset name
  }

  const handleConfirmName = () => {
    if (namingAsset) {
      onSelect(namingAsset.url, assetName.trim())
      setNamingAsset(null)
      setAssetName('')
    }
  }

  const handleSkipName = () => {
    if (namingAsset) {
      onSelect(namingAsset.url, '')
      setNamingAsset(null)
      setAssetName('')
    }
  }

  // Filter items based on search
  const filteredAssets = assets.filter(a => a.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredImages = images.filter(i => i.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredAudio = audioFiles.filter(a => a.name?.toLowerCase().includes(searchQuery.toLowerCase()))

  const handlePlayAudio = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation()
    if (playingAudioId === id) {
        if (audioRef.current) audioRef.current.pause()
        setPlayingAudioId(null)
    } else {
        if (audioRef.current) audioRef.current.pause()
        audioRef.current = new Audio(url)
        audioRef.current.play()
        audioRef.current.onended = () => setPlayingAudioId(null)
        setPlayingAudioId(id)
    }
  }

  if (!isOpen) return null

  // Naming Modal View
  if (namingAsset) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 p-4">
        <div className="w-full max-w-md bg-[#151619] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Name this Reference</h3>
            <button onClick={() => setNamingAsset(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-white/10 bg-black/50">
                <img src={namingAsset.url} className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-gray-400 font-medium">Asset Name (Optional)</label>
              <input 
                type="text" 
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Imran Khan, Living Room..."
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-brand-emerald/50 outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmName()
                }}
              />
              
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion: string, i: number) => (
                    <button 
                      key={i}
                      onClick={() => setAssetName(suggestion)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-xs text-gray-300 transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleSkipName}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Skip
              </button>
              <button 
                onClick={handleConfirmName}
                className="flex-1 py-2.5 rounded-lg bg-brand-emerald text-brand-obsidian hover:bg-brand-emerald/90 text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-brand-emerald/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-[#09090b] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Media Library</h2>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
              {(!allowedTypes || allowedTypes.includes('assets')) && (
              <button
                onClick={() => setActiveTab('assets')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'assets' 
                    ? 'bg-brand-emerald text-brand-obsidian shadow-lg shadow-brand-emerald/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Asset Bin
              </button>
              )}
              {(!allowedTypes || allowedTypes.includes('generated')) && (
              <button
                onClick={() => setActiveTab('generated')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'generated' 
                    ? 'bg-brand-emerald text-brand-obsidian shadow-lg shadow-brand-emerald/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Generated
              </button>
              )}
              {(!allowedTypes || allowedTypes.includes('audio')) && (
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'audio' 
                    ? 'bg-brand-emerald text-brand-obsidian shadow-lg shadow-brand-emerald/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Audio
              </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 pr-4 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-emerald/50 w-64 transition-all focus:w-80"
              />
            </div>
            
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand-emerald animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'assets' && (
                <>
                  {/* Upload New Section - Only in Asset Bin */}
                  <div className="mb-8">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-brand-emerald hover:border-brand-emerald/30 hover:bg-brand-emerald/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin text-brand-emerald" />
                          <span className="text-sm font-bold uppercase tracking-widest">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold uppercase tracking-widest">Upload New Asset</p>
                            <p className="text-xs text-gray-600 mt-1">Supports JPG, PNG, WEBP up to 10MB</p>
                          </div>
                        </>
                      )}
                    </button>
                  </div>

                  {filteredAssets.length === 0 ? (
                    <div className="text-center py-20 text-gray-600">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No assets found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {filteredAssets.map((asset) => {
                        const Icon = asset.type === 'character' ? User : asset.type === 'product' ? Package : MapPin
                        return (
                          <div
                            key={asset.id}
                            onClick={() => handleAssetClick(asset.asset_url, 'asset')}
                            className="group relative aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-brand-emerald/50 transition-all"
                          >
                            <img
                              src={asset.asset_url}
                              alt={asset.name}
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="w-3 h-3 text-brand-emerald" />
                                <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-wider">{asset.type}</span>
                              </div>
                              <p className="text-xs font-medium text-white truncate">{asset.name}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'generated' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredImages.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-gray-600">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No generated images found</p>
                    </div>
                  ) : (
                    filteredImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleAssetClick(image.image_url, 'generated')}
                        className="group relative aspect-video rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-brand-emerald/50 transition-all"
                      >
                        <img
                          src={image.image_url}
                          alt="Generated"
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-xs font-medium text-white line-clamp-2">{image.prompt}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'audio' && (
                <>
                   {/* Upload New Audio Section */}
                   <div className="mb-8">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="audio/*"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full h-24 border-2 border-dashed border-white/10 rounded-2xl flex flex-row items-center justify-center gap-4 text-gray-500 hover:text-brand-emerald hover:border-brand-emerald/30 hover:bg-brand-emerald/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-brand-emerald" />
                          <span className="text-sm font-bold uppercase tracking-widest">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold uppercase tracking-widest">Upload New Audio</p>
                            <p className="text-xs text-gray-600 mt-1">MP3, WAV, M4A up to 2MB</p>
                          </div>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAudio.length === 0 ? (
                      <div className="col-span-full text-center py-20 text-gray-600">
                        <Music className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No audio files found</p>
                      </div>
                    ) : (
                      filteredAudio.map((audio) => (
                        <div
                          key={audio.id}
                          onClick={() => handleAssetClick(audio.asset_url, 'asset')}
                          className="group relative flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-brand-emerald/50 hover:bg-white/10 transition-all"
                        >
                          <button
                             onClick={(e) => handlePlayAudio(e, audio.asset_url, audio.id)}
                             className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-brand-emerald hover:bg-brand-emerald hover:text-black transition-colors shrink-0"
                          >
                             {playingAudioId === audio.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-white truncate">{audio.name}</p>
                             <p className="text-[10px] text-gray-500 uppercase tracking-wider">{audio.type}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
