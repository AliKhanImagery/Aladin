'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, Music2, RefreshCw, Play, Pause, Clock, FolderOpen, Sparkles, AlertCircle } from 'lucide-react'
import { loadUserProjects } from '@/lib/db'
import { useAppStore } from '@/lib/store'
import { Project } from '@/types'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export type AudioLibraryItem = {
  projectId: string
  projectName: string
  projectUpdatedAt: Date
  clipId: string
  clipName: string
  assetUrl: string
  duration: number
  trackType: 'bg_music' | 'sfx' | 'voiceover'
  startTime: number
  /** How the audio was generated (for chip display) */
  generationMethod?: 'voice_changer' | 'tts' | 'sfx' | 'music'
}

function flattenProjectsToAudioList(projects: Project[]): AudioLibraryItem[] {
  const list: AudioLibraryItem[] = []
  for (const project of projects) {
    const tracks = project.timeline?.audioTracks ?? []
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.assetUrl || clip.status === 'generating' || clip.status === 'failed') continue
        list.push({
          projectId: project.id,
          projectName: project.name,
          projectUpdatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
          clipId: clip.id,
          clipName: clip.name,
          assetUrl: clip.assetUrl,
          duration: clip.duration,
          trackType: track.type,
          startTime: clip.startTime,
          generationMethod: (clip as { generationMethod?: AudioLibraryItem['generationMethod'] }).generationMethod,
        })
      }
    }
  }
  // Sort by project updated desc, then by startTime
  list.sort((a, b) => {
    const tA = a.projectUpdatedAt.getTime()
    const tB = b.projectUpdatedAt.getTime()
    if (tB !== tA) return tB - tA
    return a.startTime - b.startTime
  })
  return list
}

function getMethodLabel(item: AudioLibraryItem): string {
  if (item.generationMethod === 'voice_changer') return 'Voice Changer'
  if (item.generationMethod === 'tts') return 'TTS'
  if (item.generationMethod === 'sfx') return 'SFX'
  if (item.generationMethod === 'music') return 'Music'
  // Fallback from track type for legacy clips
  if (item.trackType === 'voiceover') return 'Voice'
  if (item.trackType === 'sfx') return 'SFX'
  if (item.trackType === 'bg_music') return 'Music'
  return 'Audio'
}

export default function AudioLibraryPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAppStore()
  const [items, setItems] = useState<AudioLibraryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  const loadLibrary = useCallback(async (silent = false) => {
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
      const projects = await loadUserProjects(user.id)
      const list = flattenProjectsToAudioList(projects)
      setItems(list)
      setError(null)
    } catch (err: any) {
      console.error('❌ Audio Library Error:', err)
      setError(err?.message || 'Failed to load audio library')
      if (!silent) toast.error('Failed to load audio library')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    if (user?.id) loadLibrary()
  }, [isAuthenticated, router, user?.id, loadLibrary])

  const handlePlay = (item: AudioLibraryItem) => {
    if (playingId === item.clipId && audioEl) {
      audioEl.pause()
      setPlayingId(null)
      setAudioEl(null)
      return
    }
    if (audioEl) audioEl.pause()
    const a = new Audio(item.assetUrl)
    a.play()
    a.onended = () => { setPlayingId(null); setAudioEl(null) }
    a.onpause = () => { setPlayingId(null); setAudioEl(null) }
    setAudioEl(a)
    setPlayingId(item.clipId)
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-x-hidden selection:bg-brand-emerald selection:text-brand-obsidian">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-brand-emerald/5 blur-[140px] rounded-full rotate-12" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-brand-amber/5 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.02]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo size="sm" />
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-3">
              <Music2 className="w-5 h-5 text-brand-emerald" />
              <h1 className="text-xl font-bold tracking-tight">Audio Library</h1>
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{items.length}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadLibrary(false)}
              disabled={isLoading}
              className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 h-10 px-4 rounded-full border border-white/5 hover:bg-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/20">
            <div className="w-12 h-12 border-2 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Loading audio library...</p>
          </div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-center mb-8">
              <AlertCircle className="w-8 h-8 text-red-500/40" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 text-white/60">Load failed</h2>
            <p className="text-sm text-white/30 font-medium leading-relaxed mb-6">{error}</p>
            <Button
              onClick={() => loadLibrary(false)}
              className="h-12 px-6 rounded-xl bg-brand-emerald text-black hover:bg-brand-emerald/90 font-black uppercase tracking-widest text-[11px]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] flex items-center justify-center mb-8">
              <Music2 className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 italic serif text-white/60">No audio yet.</h2>
            <p className="text-sm text-white/20 font-medium leading-relaxed mb-10">
              Audio generated in the timeline will appear here. <br />
              Open a project and add audio to get started.
            </p>
            <Link href="/">
              <Button className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]">
                Open Projects
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table-like list header */}
            <div className="grid grid-cols-[auto_1fr_1fr_120px_80px_80px_100px] gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[10px] font-black uppercase tracking-widest text-white/30">
              <div className="w-10" />
              <span>Clip name</span>
              <span>Project</span>
              <span>Method</span>
              <span>Duration</span>
              <span>Track</span>
              <span>Updated</span>
            </div>
            {items.map((item) => (
              <div
                key={`${item.projectId}-${item.clipId}`}
                className="group grid grid-cols-[auto_1fr_1fr_120px_80px_80px_100px] gap-4 items-center px-4 py-3 rounded-xl bg-white/[0.01] border border-white/[0.06] hover:border-brand-emerald/20 hover:bg-white/[0.02] transition-all duration-300"
              >
                <button
                  onClick={() => handlePlay(item)}
                  className="w-10 h-10 rounded-full bg-brand-emerald/10 border border-brand-emerald/20 hover:bg-brand-emerald/20 flex items-center justify-center text-brand-emerald shrink-0"
                >
                  {playingId === item.clipId ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <span className="text-sm font-medium text-white truncate" title={item.clipName}>
                  {item.clipName}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <Link
                    href="/"
                    onClick={(e) => {
                      e.preventDefault()
                      router.push('/')
                    }}
                    className="text-sm font-medium text-white/60 hover:text-brand-emerald truncate"
                    title={item.projectName}
                  >
                    {item.projectName}
                  </Link>
                </div>
                <span className="inline-flex">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                    {getMethodLabel(item)}
                  </span>
                </span>
                <span className="text-[11px] font-medium text-white/50 tabular-nums">
                  {item.duration.toFixed(1)}s
                </span>
                <span className="text-[11px] font-medium text-white/40 capitalize">
                  {item.trackType.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-medium text-white/30">
                  {item.projectUpdatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-16 px-8 border-t border-white/[0.03] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-white/10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-brand-emerald opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Audio Library</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em]">
            geniferAI Studio | Audio Library
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
