'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, Image, Trash2, RefreshCw, ArrowLeft, Clock, Sparkles } from 'lucide-react'
import { getUserImages, deleteUserImage } from '@/lib/userMedia'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function MyImagesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAppStore()
  const [images, setImages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadImages = useCallback(async (silent = false) => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    if (!silent) setIsLoading(true)
    
    try {
      const data = await getUserImages()
      console.log('📸 My Images: Loaded', data.length, 'items')
      setImages(data || [])
    } catch (error: any) {
      console.error('❌ My Images Error:', error)
      toast.error(error?.message || 'Failed to sync library')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    
    if (user?.id) {
      loadImages()
    }
  }, [isAuthenticated, router, user?.id, loadImages])

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

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-brand-obsidian text-white flex flex-col relative overflow-x-hidden selection:bg-brand-emerald selection:text-brand-obsidian">
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-brand-emerald/5 blur-[140px] rounded-full rotate-12" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-brand-amber/5 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all duration-500">
                <ArrowLeft className="w-4 h-4 text-white/40 group-hover:text-white" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-white transition-colors">
                Dashboard
              </span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-brand-emerald" />
              <h1 className="text-xl font-bold tracking-tight italic serif">My Images</h1>
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{images.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadImages(false)}
              disabled={isLoading}
              className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 h-10 px-4 rounded-full border border-white/5 hover:bg-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full border border-white/5 hover:bg-white/10 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/20">
            <div className="w-12 h-12 border-2 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Syncing Library Items...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] flex items-center justify-center mb-8">
              <Image className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 italic serif text-white/60">Your library is empty.</h2>
            <p className="text-sm text-white/20 font-medium leading-relaxed mb-10">
              No images have been created yet. <br />
              Start a new project to begin generating assets.
            </p>
            <Link href="/">
              <Button className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]">
                Create Image
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative flex flex-col glass-panel bg-white/[0.01] border-white/[0.08] rounded-[2rem] overflow-hidden transition-all duration-700 hover:border-brand-emerald/30 hover:shadow-2xl hover:shadow-brand-emerald/5"
              >
                <div className="relative aspect-video bg-[#09090b] overflow-hidden">
                  <img
                    src={image.image_url}
                    alt={image.prompt || 'Image'}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-100"
                  />
                  
                  {/* Premium Overlay UI */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-obsidian/80 via-transparent to-transparent opacity-40" />
                  
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                        {image.model || 'v1.0'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(image.id)}
                    disabled={deletingId === image.id}
                    className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                  </button>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Item ID {image.id.substring(0, 8)}</span>
                  </div>
                  <p className="text-[10px] text-white/20 line-clamp-2 leading-relaxed font-medium mb-4 group-hover:text-white/40 transition-colors">
                    {image.prompt || 'No image prompt provided.'}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.03]">
                    <div className="flex items-center gap-2 text-[9px] font-black text-white/10 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      {new Date(image.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <Sparkles className="w-3 h-3 text-brand-emerald opacity-20 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-16 px-8 border-t border-white/[0.03] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-white/10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-brand-emerald opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Version v2.6.0</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em]">
            Image Library
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Flowboard © 2026</span>
          </div>
      </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;700;900&display=swap');
        .serif { font-family: 'Playfair Display', serif; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  )
}
