'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  X, 
  Trash2, 
  RefreshCw, 
  Plus,
  Mic,
  Play,
  Pause,
  Loader2,
  Upload,
  User,
  AlertCircle,
  Music,
  Settings
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import { getSessionSafe } from '@/lib/auth'
import { CREDIT_PRICING_KEYS, getDisplayCredits } from '@/constants/billing'

interface Voice {
    id: string
    name: string
    provider_voice_id: string
    preview_url: string | null
    created_at: string
    provider?: string
}

interface ElevenLabsVoice {
    voice_id: string
    name: string
    preview_url: string | null
    category?: string | null
    source_name?: string
    source_id?: string
}

export default function VoicesPage() {
  const router = useRouter()
  const { user, isAuthenticated, setShowProfileSettingsModal } = useAppStore()
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // Audio Playback
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Add Voice Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newVoiceName, setNewVoiceName] = useState('')
  const [newVoiceFile, setNewVoiceFile] = useState<File | null>(null)
  const [newVoiceRefText, setNewVoiceRefText] = useState('')
  const [transcribeLanguage, setTranscribeLanguage] = useState<string>('auto')
  const [isCloning, setIsCloning] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [samplePlayUrl, setSamplePlayUrl] = useState<string | null>(null)
  const [samplePlaying, setSamplePlaying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)

  // ElevenLabs BYOA
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [elevenLabsConnected, setElevenLabsConnected] = useState(false)
  const [elevenLabsLoading, setElevenLabsLoading] = useState(false)
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null)
  const [elevenLabsPlayingId, setElevenLabsPlayingId] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all')
  const [sourceOptions, setSourceOptions] = useState<Array<{ value: string, label: string }>>([])

  useEffect(() => {
    const uniqueIds = Array.from(new Set(elevenLabsVoices.map(v => v.source_id).filter(Boolean))) as string[]
    
    if (uniqueIds.length > 0) {
        const options = uniqueIds.map(id => {
            const v = elevenLabsVoices.find(voice => voice.source_id === id)
            return { value: id, label: v?.source_name || 'Account' }
        })
        setSourceOptions([{ value: 'all', label: 'All Accounts' }, ...options])
    } else {
        setSourceOptions([])
    }
  }, [elevenLabsVoices])

  const filteredElevenLabsVoices = selectedSourceId === 'all' 
    ? elevenLabsVoices 
    : elevenLabsVoices.filter(v => v.source_id === selectedSourceId)

  const loadVoices = useCallback(async (silent = false) => {
    if (!user?.id) return
    if (!silent) setIsLoading(true)
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) {
        if (!silent) setIsLoading(false)
        return
      }
      const response = await fetch('/api/user/voices', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        // My Character Cast: only F5 clones (from Voice Lab uploads)
        const list = (data.voices || []).filter((v: Voice) => v.provider === 'fal-f5' || !v.provider)
        setVoices(list)
      }
    } catch (error) {
      console.error('Error loading voices:', error)
      toast.error('Failed to load voices')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated) return
    if (user?.id) loadVoices()
  }, [isAuthenticated, user?.id, loadVoices])

  const loadElevenLabsVoices = useCallback(async () => {
    if (!user?.id) return
    setElevenLabsLoading(true)
    setElevenLabsError(null)
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/user/voices/elevenlabs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      setElevenLabsConnected(!!data.connected)
      setElevenLabsVoices(data.voices || [])
      if (data.error === 'invalid_key') {
        setElevenLabsError(data.details && data.details !== 'Invalid API key' ? data.details : 'invalid_key')
      } else if (data.error) {
        setElevenLabsError(data.details || 'api_error')
      }
    } catch (e) {
      setElevenLabsConnected(false)
      setElevenLabsVoices([])
      setElevenLabsError('network_error')
    } finally {
      setElevenLabsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id && isAuthenticated) loadElevenLabsVoices()
  }, [user?.id, isAuthenticated, loadElevenLabsVoices])

  const fetchPricing = useCallback(async () => {
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/user/credits/pricing', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setPricing(data.pricing || {})
      }
    } catch (e) {
      console.error('Failed to fetch pricing', e)
    }
  }, [])

  useEffect(() => {
    if (isAddModalOpen) fetchPricing()
  }, [isAddModalOpen, fetchPricing])

  useEffect(() => {
    if (!newVoiceFile) {
      setSamplePlayUrl(null)
      setSamplePlaying(false)
      return
    }
    const url = URL.createObjectURL(newVoiceFile)
    setSamplePlayUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [newVoiceFile])

  const handlePlay = (url: string | null, id: string) => {
      if (!url) return

      if (playingId === id) {
          audioRef.current?.pause()
          setPlayingId(null)
          return
      }

      if (audioRef.current) {
          audioRef.current.pause()
      }

      const audio = new Audio(url)
      audio.onended = () => setPlayingId(null)
      audio.play()
      audioRef.current = audio
      setPlayingId(id)
  }

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to remove this character? This cannot be undone.')) return
      
      setDeletingId(id)
      try {
          const { data: { session } } = await getSessionSafe()
          const token = session?.access_token
          if (!token) {
            toast.error('Please sign in to remove a character')
            return
          }
          const response = await fetch('/api/user/voices', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ id })
          })

          if (!response.ok) throw new Error('Failed to delete')
          
          setVoices(voices.filter(v => v.id !== id))
          toast.success('Character removed')
      } catch (error) {
          toast.error('Failed to remove character')
      } finally {
          setDeletingId(null)
      }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large (max 10MB)')
        return
      }
      setNewVoiceFile(file)
    }
  }

  const handlePlaySample = () => {
    if (!samplePlayUrl) return
    if (samplePlaying && sampleAudioRef.current) {
      sampleAudioRef.current.pause()
      setSamplePlaying(false)
      return
    }
    if (sampleAudioRef.current) sampleAudioRef.current.pause()
    const audio = new Audio(samplePlayUrl)
    audio.onended = () => setSamplePlaying(false)
    audio.play()
    sampleAudioRef.current = audio
    setSamplePlaying(true)
  }

  const handleTranscribe = async () => {
    if (!newVoiceFile) return
    setIsTranscribing(true)
    const toastId = toast.loading('Transcribing…')
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token || ''
      if (!token) {
        toast.error('Please sign in to use Transcribe', { id: toastId })
        return
      }
      const formData = new FormData()
      formData.append('file', newVoiceFile)
      formData.append('language', transcribeLanguage)
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) {
          toast.error(`Insufficient credits (need ${data.required ?? '?'})`, { id: toastId })
          return
        }
        throw new Error(data.error || 'Transcription failed')
      }
      setNewVoiceRefText(data.text || '')
      toast.success('Transcript added — check and edit for Urdu/other languages.', { id: toastId })
    } catch (e: any) {
      toast.error(e.message || 'Transcription failed', { id: toastId })
    } finally {
      setIsTranscribing(false)
    }
  }

  const transcribeCost = pricing[CREDIT_PRICING_KEYS.AUDIO_WHISPER_TRANSCRIBE] ?? 3
  const transcribeDisplayCoins = getDisplayCredits(transcribeCost)

  const handleClone = async () => {
      if (!newVoiceName || !newVoiceFile) return

      setIsCloning(true)
      const toastId = toast.loading('Cloning voice... This may take a moment.')

      try {
          const formData = new FormData()
          formData.append('name', newVoiceName)
          formData.append('file', newVoiceFile)
          if (newVoiceRefText.trim()) formData.append('ref_text', newVoiceRefText.trim())

          const { data: { session } } = await getSessionSafe()
          const token = session?.access_token || ''
          if (!token) {
            toast.error('Please sign in to add a character', { id: toastId })
            return
          }
          const response = await fetch('/api/voice/clone', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              },
              body: formData
          })

          const data = await response.json()

          if (!response.ok) {
              throw new Error(data.error || 'Cloning failed')
          }

          toast.success('Voice cloned successfully!', { id: toastId })
          setIsAddModalOpen(false)
          setNewVoiceName('')
          setNewVoiceFile(null)
          setNewVoiceRefText('')
          loadVoices(true)

      } catch (error: any) {
          console.error('Cloning error:', error)
          toast.error(`Cloning failed: ${error.message}`, { id: toastId })
      } finally {
          setIsCloning(false)
      }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-[#00FFF0] selection:text-black">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#00FFF0]/5 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#3AAFA9]/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo size="sm" />
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <h1 className="text-sm font-bold uppercase tracking-widest text-[#00FFF0]">Voice Lab</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/">
                <Button variant="ghost" className="text-xs text-gray-400 hover:text-white">
                    Back to Studio
                </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">My Character Cast</h2>
                <p className="text-gray-400 max-w-lg">
                    Create up to 5 custom AI voice clones from your own audio samples. 
                    Use them directly in your stories.
                </p>
            </div>
            
            <Button 
                onClick={() => setIsAddModalOpen(true)}
                disabled={voices.length >= 5}
                className={`h-12 px-6 rounded-xl font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                    voices.length >= 5 
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#00FFF0] text-black hover:bg-[#00FFF0]/90 shadow-[0_0_20px_rgba(0,255,240,0.3)] hover:shadow-[0_0_30px_rgba(0,255,240,0.5)]'
                }`}
            >
                <Plus className="w-5 h-5" />
                New Character
            </Button>
        </div>

        {/* Voice Grid */}
        {isLoading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#00FFF0] animate-spin" />
            </div>
        ) : voices.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center bg-white/[0.02]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <Mic className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No characters yet</h3>
                <p className="text-gray-500 max-w-sm mb-8">
                    Upload ~10–30 seconds of clear speech to add a character voice. Use it in Dialogue in the studio.
                </p>
                <Button 
                    onClick={() => setIsAddModalOpen(true)}
                    variant="outline" 
                    className="border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10"
                >
                    Create First Character
                </Button>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {voices.map((voice) => (
                    <div key={voice.id} className="group bg-[#151619] border border-white/5 rounded-2xl p-6 hover:border-[#00FFF0]/30 transition-all duration-300 relative overflow-hidden">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FFF0]/20 to-[#3AAFA9]/20 flex items-center justify-center border border-[#00FFF0]/20">
                                <User className="w-6 h-6 text-[#00FFF0]" />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(voice.id)}
                                disabled={deletingId === voice.id}
                                className="text-gray-600 hover:text-red-400 hover:bg-red-400/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-white mb-1">{voice.name}</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Clone • {new Date(voice.created_at).toLocaleDateString()}</p>
                        </div>

                        {voice.preview_url && (
                            <div className="bg-black/40 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                                <button 
                                    onClick={() => handlePlay(voice.preview_url, voice.id)}
                                    className="w-10 h-10 rounded-full bg-[#00FFF0]/10 flex items-center justify-center text-[#00FFF0] hover:bg-[#00FFF0] hover:text-black transition-all"
                                >
                                    {playingId === voice.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                </button>
                                <div className="flex-1">
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full bg-[#00FFF0] transition-all duration-300 ${playingId === voice.id ? 'w-full animate-pulse' : 'w-0'}`} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}

        {/* ElevenLabs voices (BYOA) */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">ElevenLabs voices</h2>
              <div className="flex items-center gap-2 relative z-10">
                {sourceOptions.length > 2 && (
                    <div className="w-[140px]">
                        <Select
                            options={sourceOptions}
                            value={selectedSourceId}
                            onChange={(e) => setSelectedSourceId(e.target.value)}
                            className="h-7 text-xs py-0 border-[#3AAFA9]/30 bg-transparent focus:ring-0 focus:ring-offset-0 min-h-[28px]"
                        />
                    </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    console.log('Refresh clicked')
                    loadElevenLabsVoices()
                  }}
                  disabled={elevenLabsLoading}
                  className="h-7 px-3 text-xs border-[#3AAFA9]/30 text-gray-400 hover:text-[#00FFF0] hover:border-[#00FFF0]/40 bg-transparent"
                >
                  {elevenLabsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    console.log('Settings clicked')
                    setShowProfileSettingsModal(true, 'connections')
                  }}
                  className="text-gray-500 hover:text-[#00FFF0] transition-colors p-1"
                  title="Manage Connection"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-6 max-w-lg">
            Voices from your ElevenLabs account. Connect your API key in Settings to see them here. Use them in the studio when generating voiceover.
          </p>

          <div className="space-y-8">
            {elevenLabsLoading && elevenLabsVoices.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#00FFF0]" />
              </div>
            ) : !elevenLabsConnected ? (
              <div className="flex overflow-x-auto pb-2 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setShowProfileSettingsModal(true, 'connections')}
                  className="shrink-0 w-[140px] min-h-[120px] rounded-2xl border border-dashed border-[#3AAFA9]/30 bg-[#151619]/50 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-[#00FFF0]/40 hover:text-[#00FFF0] transition-colors"
                >
                  <Music className="w-8 h-8" />
                  <span className="text-xs font-medium text-center px-2">Connect ElevenLabs in Settings</span>
                </button>
              </div>
            ) : elevenLabsError ? (
              <div className="shrink-0 w-[240px] min-h-[120px] rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex flex-col justify-between">
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <h3 className="font-medium text-sm text-red-200">Connection Error</h3>
                    <p className="text-xs text-red-400/80 mt-0.5">
                      {elevenLabsError === 'invalid_key' 
                        ? 'Your API key is invalid.' 
                        : (elevenLabsError === 'api_error' || elevenLabsError === 'network_error' ? 'Connection failed.' : elevenLabsError)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowProfileSettingsModal(true, 'connections')}
                    className="h-8 text-xs border-red-500/30 text-red-200 hover:bg-red-500/20 flex-1"
                  >
                    Fix Key
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => loadElevenLabsVoices()}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-200 hover:bg-red-500/10"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* My Clones Row */}
                {filteredElevenLabsVoices.filter(v => v.category === 'cloned' || v.category === 'generated').length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Your Clones</h3>
                    <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-[#3AAFA9]/30 scrollbar-track-transparent">
                      {filteredElevenLabsVoices
                        .filter(v => v.category === 'cloned' || v.category === 'generated')
                        .map((v) => (
                          <div key={v.voice_id} className="group shrink-0 w-[140px] min-h-[120px] bg-[#151619] border border-white/5 rounded-2xl p-4 hover:border-[#00FFF0]/30 transition-all flex flex-col items-center justify-center gap-2 relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FFF0]/20 to-[#3AAFA9]/20 flex items-center justify-center border border-[#00FFF0]/20">
                              <User className="w-5 h-5 text-[#00FFF0]" />
                            </div>
                            <span className="text-sm font-medium text-white truncate w-full text-center" title={v.name}>{v.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide truncate w-full text-center">{v.category}</span>
                            {v.source_name && (
                              <span className="text-[9px] text-[#00FFF0]/60 uppercase tracking-wide truncate w-full text-center" title={`From: ${v.source_name}`}>
                                {v.source_name}
                              </span>
                            )}
                            {v.preview_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (elevenLabsPlayingId === v.voice_id) {
                                    setElevenLabsPlayingId(null)
                                    return
                                  }
                                  const audio = new Audio(v.preview_url!)
                                  audio.onended = () => setElevenLabsPlayingId(null)
                                  audio.play()
                                  setElevenLabsPlayingId(v.voice_id)
                                }}
                                className="w-8 h-8 rounded-full bg-[#00FFF0]/10 flex items-center justify-center text-[#00FFF0] hover:bg-[#00FFF0] hover:text-black transition-all mt-1"
                              >
                                {elevenLabsPlayingId === v.voice_id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Library Row */}
                {filteredElevenLabsVoices.filter(v => v.category !== 'cloned' && v.category !== 'generated').length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Voice Library</h3>
                    <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-[#3AAFA9]/30 scrollbar-track-transparent">
                      {filteredElevenLabsVoices
                        .filter(v => v.category !== 'cloned' && v.category !== 'generated')
                        .map((v) => (
                          <div key={v.voice_id} className="group shrink-0 w-[140px] min-h-[120px] bg-[#151619] border border-white/5 rounded-2xl p-4 hover:border-[#00FFF0]/30 transition-all flex flex-col items-center justify-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                              <User className="w-5 h-5 text-gray-400 group-hover:text-white" />
                            </div>
                            <span className="text-sm font-medium text-white truncate w-full text-center" title={v.name}>{v.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide truncate w-full text-center">{v.category || 'Premade'}</span>
                            {v.source_name && (
                              <span className="text-[9px] text-[#00FFF0]/60 uppercase tracking-wide truncate w-full text-center" title={`From: ${v.source_name}`}>
                                {v.source_name}
                              </span>
                            )}
                            {v.preview_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (elevenLabsPlayingId === v.voice_id) {
                                    setElevenLabsPlayingId(null)
                                    return
                                  }
                                  const audio = new Audio(v.preview_url!)
                                  audio.onended = () => setElevenLabsPlayingId(null)
                                  audio.play()
                                  setElevenLabsPlayingId(v.voice_id)
                                }}
                                className="w-8 h-8 rounded-full bg-[#00FFF0]/10 flex items-center justify-center text-[#00FFF0] hover:bg-[#00FFF0] hover:text-black transition-all mt-1"
                              >
                                {elevenLabsPlayingId === v.voice_id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {elevenLabsConnected && elevenLabsVoices.length === 0 && (
                  <div className="shrink-0 w-[180px] min-h-[100px] rounded-2xl border border-white/10 bg-[#151619] p-4 flex items-center justify-center text-center">
                    <p className="text-xs text-gray-500">No voices found in your account.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Add Voice Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-[#151619] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                      <h3 className="font-bold text-white">New Character Voice</h3>
                      <button
                        onClick={() => {
                          setIsAddModalOpen(false)
                          setNewVoiceFile(null)
                          setNewVoiceRefText('')
                        }}
                        className="text-gray-500 hover:text-white"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Character Name</label>
                          <input 
                              type="text" 
                              value={newVoiceName}
                              onChange={(e) => setNewVoiceName(e.target.value)}
                              placeholder="e.g. The Narrator"
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00FFF0]/50 outline-none transition-all"
                          />
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Voice Sample</label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                                newVoiceFile 
                                    ? 'border-[#00FFF0]/50 bg-[#00FFF0]/5' 
                                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                            }`}
                          >
                              <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  onChange={handleFileSelect} 
                                  accept="audio/*" 
                                  className="hidden" 
                              />
                              {newVoiceFile ? (
                                  <>
                                    <Music className="w-8 h-8 text-[#00FFF0]" />
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-white">{newVoiceFile.name}</p>
                                        <p className="text-xs text-[#00FFF0]">{(newVoiceFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); handlePlaySample(); }}
                                        className="text-xs border-white/20 text-gray-300 hover:bg-white/10"
                                        title="Play sample"
                                      >
                                        {samplePlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setNewVoiceFile(null); }} className="text-xs text-red-400 hover:text-red-300">Remove</Button>
                                    </div>
                                  </>
                              ) : (
                                  <>
                                    <Upload className="w-8 h-8 text-gray-600" />
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-300">Click to upload audio</p>
                                        <p className="text-xs text-gray-600 mt-1">~10–30 seconds of clear speech. MP3, WAV, M4A (max 10MB)</p>
                                    </div>
                                  </>
                              )}
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">What&apos;s said in this clip (optional)</label>
                          <div className="flex gap-2 flex-wrap items-center">
                            <select
                              value={transcribeLanguage}
                              onChange={(e) => setTranscribeLanguage(e.target.value)}
                              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00FFF0]/50 outline-none"
                            >
                              <option value="auto">Auto</option>
                              <option value="ur">Urdu</option>
                              <option value="en">English</option>
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!newVoiceFile || isTranscribing}
                              onClick={handleTranscribe}
                              className="border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/10"
                            >
                              {isTranscribing ? (
                                <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Transcribing…</>
                              ) : (
                                `Transcribe (${transcribeDisplayCoins} coins)`
                              )}
                            </Button>
                          </div>
                          <input 
                              type="text" 
                              value={newVoiceRefText}
                              onChange={(e) => setNewVoiceRefText(e.target.value)}
                              placeholder="e.g. the exact words spoken in the sample"
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00FFF0]/50 outline-none transition-all text-sm"
                          />
                          <p className="text-xs text-gray-500">Helps quality for Urdu/Hindi and other languages.</p>
                      </div>

                      <div className="bg-[#00FFF0]/5 border border-[#00FFF0]/10 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-[#00FFF0] mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-400 leading-relaxed">
                              Use ~10–30 seconds of clear speech with minimal background noise for best results.
                          </p>
                      </div>

                      <Button 
                        onClick={handleClone} 
                        disabled={!newVoiceName || !newVoiceFile || isCloning}
                        className="w-full h-12 bg-[#00FFF0] text-black font-bold uppercase tracking-widest hover:bg-[#00FFF0]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isCloning ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Cloning Voice...
                              </>
                          ) : 'Create Character'}
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}
