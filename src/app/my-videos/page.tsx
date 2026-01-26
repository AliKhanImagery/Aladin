'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, Video, Trash2, RefreshCw, Play, ArrowLeft, Layers, Sparkles, Clock, AlertCircle } from 'lucide-react'
import { getUserVideos, deleteUserVideo } from '@/lib/userMedia'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function MyVideosPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAppStore()
  const [videos, setVideos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const loadVideos = useCallback(async (silent = false, retryAttempt = 0) => {
    if (!user?.id) {
      setIsLoading(false)
      setError('User not authenticated')
      return
    }

    if (!silent) {
      setIsLoading(true)
      setError(null)
    }
    
    try {
      const data = await getUserVideos()
      console.log('🎬 Video Library: Loaded', data.length, 'sequences')
      setVideos(data || [])
      setError(null)
      setRetryCount(0)
    } catch (error: any) {
      console.error('❌ Video Library Error:', error)
      const errorMessage = error?.message || 'Failed to sync video library'
      setError(errorMessage)
      
      // Auto-retry up to 2 times with exponential backoff
      if (retryAttempt < 2) {
        const delay = Math.pow(2, retryAttempt) * 1000 // 1s, 2s
        console.log(`🔄 Video Library: Retrying in ${delay}ms (attempt ${retryAttempt + 1}/2)...`)
        setTimeout(() => {
          loadVideos(true, retryAttempt + 1)
        }, delay)
      } else {
        toast.error(errorMessage)
        setRetryCount(retryAttempt)
      }
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    
    // Initial load
    if (user?.id) {
      loadVideos()
    }
  }, [isAuthenticated, router, user?.id, loadVideos])

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to deactivate this sequence?')) {
      return
    }

    setDeletingId(videoId)
    try {
      await deleteUserVideo(videoId)
      setVideos(videos.filter(vid => vid.id !== videoId))
      toast.success('Sequence deactivated')
    } catch (error) {
      console.error('Error deleting video:', error)
      toast.error('Failed to deactivate sequence')
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
              <Logo size="sm" />
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-brand-emerald" />
              <h1 className="text-xl font-bold tracking-tight">Video Library</h1>
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{videos.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadVideos(false)}
              disabled={isLoading}
              className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 h-10 px-4 rounded-full border border-white/5 hover:bg-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Bin
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
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Syncing Foundry Assets...</p>
            {retryCount > 0 && (
              <p className="text-xs text-white/10 mt-4">Retry attempt {retryCount}/2</p>
            )}
          </div>
        ) : error && videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-center mb-8">
              <AlertCircle className="w-8 h-8 text-red-500/40" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 text-white/60">Sync Failed</h2>
            <p className="text-sm text-white/30 font-medium leading-relaxed mb-6">
              {error}
            </p>
            <div className="flex gap-4">
              <Button
                onClick={() => loadVideos(false, 0)}
                className="h-12 px-6 rounded-xl bg-brand-emerald text-black hover:bg-brand-emerald/90 transition-all duration-500 font-black uppercase tracking-widest text-[11px]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Sync
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push('/')}
                className="h-12 px-6 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all duration-500 font-black uppercase tracking-widest text-[11px]"
              >
                Go Back
              </Button>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] flex items-center justify-center mb-8">
              <Video className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 italic serif text-white/60">Bin is Vacant.</h2>
            <p className="text-sm text-white/20 font-medium leading-relaxed mb-10">
              No sequences have been orchestrated in the foundry yet. <br />
              Initialize a production to begin generation.
            </p>
            <Link href="/">
              <Button className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]">
                Enter Foundry
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group relative flex flex-col glass-panel bg-white/[0.01] border-white/[0.08] rounded-[2rem] overflow-hidden transition-all duration-700 hover:border-brand-emerald/30 hover:shadow-2xl hover:shadow-brand-emerald/5"
              >
                <div className="relative aspect-video bg-[#09090b] overflow-hidden">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.prompt || 'Sequence'}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-12 h-12 text-white/5" />
                    </div>
                  )}
                  
                  {/* Premium Overlay UI */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                    <div className="w-14 h-14 bg-brand-emerald rounded-full flex items-center justify-center shadow-2xl shadow-brand-emerald/40 cursor-pointer hover:scale-110 transition-transform active:scale-95"
                         onClick={() => window.open(video.video_url, '_blank')}>
                      <Play className="w-6 h-6 text-brand-obsidian fill-current ml-1" />
                    </div>
                  </div>

                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                        {video.model || 'Foundry v1'}
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <div className="px-2 py-1 rounded-md bg-brand-emerald/10 backdrop-blur-md border border-brand-emerald/20">
                      <span className="text-[9px] font-black text-brand-emerald uppercase tracking-widest">
                        {video.duration || 5}s
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(video.id)}
                    disabled={deletingId === video.id}
                    className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Sequence No. {video.id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-white/30 line-clamp-2 leading-relaxed font-medium mb-6 group-hover:text-white/60 transition-colors">
                    {video.prompt || 'No orchestration blueprint provided.'}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.03]">
                    <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      {new Date(video.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                      <Sparkles className="w-3 h-3 text-brand-emerald" />
                    </div>
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
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Protocol 2.6.0</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em]">
            geniferAI Studio | Video Library
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">geniferAI © 2026</span>
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
