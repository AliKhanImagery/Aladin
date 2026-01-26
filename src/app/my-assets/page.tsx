'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  X, 
  Trash2, 
  RefreshCw, 
  ArrowLeft, 
  Clock, 
  User, 
  Package, 
  MapPin,
  Search,
  Boxes
} from 'lucide-react'
import { getUserAssets, deleteUserAsset } from '@/lib/userMedia'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function MyAssetsPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAppStore()
  const [assets, setAssets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadAssets = useCallback(async (silent = false) => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    if (!silent) setIsLoading(true)
    
    try {
      const data = await getUserAssets()
      console.log('📦 My Assets: Loaded', data.length, 'items')
      setAssets(data || [])
    } catch (error: any) {
      console.error('❌ My Assets Error:', error)
      toast.error(error?.message || 'Failed to sync asset library')
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
      loadAssets()
    }
  }, [isAuthenticated, router, user?.id, loadAssets])

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset from your library?')) {
      return
    }

    setDeletingId(assetId)
    try {
      await deleteUserAsset(assetId)
      setAssets(assets.filter(a => a.id !== assetId))
      toast.success('Asset deleted from library')
    } catch (error) {
      console.error('Error deleting asset:', error)
      toast.error('Failed to delete asset')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredAssets = assets.filter(asset => {
    const matchesType = !filterType || asset.type === filterType
    const matchesSearch = !searchQuery || 
    (asset.name && asset.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (asset.prompt && asset.prompt.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesType && matchesSearch
  })

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
              <Boxes className="w-5 h-5 text-brand-emerald" />
              <h1 className="text-xl font-bold tracking-tight italic serif">Asset Bin</h1>
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{filteredAssets.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-4 bg-white/5 border border-white/10 rounded-full text-xs font-medium focus:outline-none focus:border-brand-emerald/50 transition-all w-64"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadAssets(false)}
              disabled={isLoading}
              className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text:white flex items-center gap-2 h-10 px-4 rounded-full border border-white/5 hover:bg-white/5"
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

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto w-full px-8 pt-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button
            onClick={() => setFilterType(null)}
            className={`px-6 h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!filterType ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
          >
            All Assets
          </button>
          <button
            onClick={() => setFilterType('character')}
            className={`px-6 h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterType === 'character' ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <User className="w-3.5 h-3.5" />
            Characters
          </button>
          <button
            onClick={() => setFilterType('product')}
            className={`px-6 h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterType === 'product' ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <Package className="w-3.5 h-3.5" />
            Products
          </button>
          <button
            onClick={() => setFilterType('location')}
            className={`px-6 h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterType === 'location' ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Locations
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-8 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/20">
            <div className="w-12 h-12 border-2 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Syncing Asset Bin...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] flex items-center justify-center mb-8">
              <Package className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 italic serif text-white/60">No assets found.</h2>
            <p className="text-sm text-white/20 font-medium leading-relaxed mb-10">
              Your asset bin is currently empty. <br />
              Generated or uploaded assets during project analysis will appear here.
            </p>
            <Link href="/">
              <Button className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]">
                Start New Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredAssets.map((asset) => {
              const Icon = asset.type === 'character' ? User : asset.type === 'product' ? Package : MapPin
              return (
                <div
                  key={asset.id}
                  className="group relative flex flex-col glass-panel bg-white/[0.01] border-white/[0.08] rounded-[2rem] overflow-hidden transition-all duration-700 hover:border-brand-emerald/30 hover:shadow-2xl hover:shadow-brand-emerald/5"
                >
                  <div className="relative aspect-square bg-[#09090b] overflow-hidden">
                    {asset.asset_url && (
                    <img
                      src={asset.asset_url}
                      alt={asset.name}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-100"
                    />
                    )}
                    
                    {/* Premium Overlay UI */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-obsidian/80 via-transparent to-transparent opacity-40" />
                    
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-brand-emerald" />
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                          {asset.type}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(asset.id)}
                      disabled={deletingId === asset.id}
                      className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <h4 className="text-sm font-bold text-white truncate">{asset.name || 'Untitled Asset'}</h4>
                    </div>
                    {(asset.description || asset.prompt) && (
                      <p className="text-[10px] text-white/20 line-clamp-2 leading-relaxed font-medium mb-3 group-hover:text-white/40 transition-colors">
                        {asset.description || asset.prompt}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.03]">
                      <div className="flex items-center gap-2 text-[9px] font-black text-white/10 uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        {new Date(asset.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                          {asset.metadata?.source || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="py-16 px-8 border-t border-white/[0.03] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-white/10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-brand-emerald opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Bin Protocol v1.0</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em]">
            geniferAI Studio | Asset Orchestration Bin
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
