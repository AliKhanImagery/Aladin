'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, Image, Trash2 } from 'lucide-react'
import { getUserImages, deleteUserImage } from '@/lib/userMedia'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function MyImagesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAppStore()
  const [images, setImages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    // Small delay to ensure auth state is fully loaded
    const timer = setTimeout(() => {
      if (user?.id) {
        loadImages()
      }
    }, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, user?.id])

  const loadImages = async () => {
    if (!user?.id) {
      console.log('⚠️ loadImages: No user ID, cannot load images')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    console.log('📸 loadImages: Starting, user ID:', user.id)
    
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
      })

      const dataPromise = getUserImages()
      
      const data = await Promise.race([dataPromise, timeoutPromise])
      
      console.log('📸 loadImages: Received data, count:', data.length)
      setImages(data || [])
      if (!data || data.length === 0) {
        console.log('⚠️ No images found. Make sure:')
        console.log('1. Database migration has been run (002_user_media_tables.sql)')
        console.log('2. You have generated images while logged in')
        console.log('3. Check browser console for save errors')
      }
    } catch (error: any) {
      console.error('❌ loadImages: Error caught:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      toast.error(error?.message || 'Failed to load images')
      setImages([])
    } finally {
      console.log('📸 loadImages: Setting isLoading to false')
      setIsLoading(false)
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return
    }

    setDeletingId(imageId)
    try {
      await deleteUserImage(imageId)
      setImages(images.filter(img => img.id !== imageId))
      toast.success('Image deleted')
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0C0C0C]/95 backdrop-blur-sm border-b border-[#3AAFA9]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className="w-6 h-6 text-[#00FFF0]" />
              <h1 className="text-3xl font-bold text-white">My Images</h1>
              <span className="text-gray-400 text-sm">({images.length})</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#00FFF0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Loading images...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No images generated yet.</p>
            <p className="text-sm mt-2">Generate images in your projects to see them here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="bg-[#0C0C0C] rounded-xl overflow-hidden border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors group relative"
              >
                <div className="relative aspect-video bg-[#1E1F22]">
                  <img
                    src={image.image_url}
                    alt={image.prompt || 'Generated image'}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleDelete(image.id)}
                    disabled={deletingId === image.id}
                    className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-red-500/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white mb-1 truncate">
                    {image.model || 'Unknown model'}
                  </p>
                  <p className="text-[8px] text-gray-500 truncate leading-tight mb-1">
                    {image.prompt || 'No prompt'}
                  </p>
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(image.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

