'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, Image as ImageIcon, Package, User, MapPin, Search, Loader2 } from 'lucide-react'
import { getUserAssets, getUserImages } from '@/lib/userMedia'
import toast from 'react-hot-toast'

interface AssetLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string) => void
  onUpload: (file: File) => Promise<void>
  isUploading?: boolean
}

type Tab = 'assets' | 'generated'

export default function AssetLibraryModal({ isOpen, onClose, onSelect, onUpload, isUploading = false }: AssetLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('assets')
  const [assets, setAssets] = useState<any[]>([])
  const [images, setImages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load data function - memoized to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [assetsData, imagesData] = await Promise.all([
        getUserAssets(),
        getUserImages()
      ])
      setAssets(assetsData || [])
      setImages(imagesData || [])
    } catch (error) {
      console.error('Failed to load library data:', error)
      toast.error('Failed to load library')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load data on open
  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
        onSelect(duplicateAsset.asset_url)
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
    loadData()
  }

  // Filter items based on search
  const filteredAssets = assets.filter(a => a.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredImages = images.filter(i => i.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-[#09090b] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Media Library</h2>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
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
                            onClick={() => onSelect(asset.asset_url)}
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
                        onClick={() => onSelect(image.image_url)}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
