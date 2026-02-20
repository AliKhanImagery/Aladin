'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, User, Layout, Image, Video, Package, Music2, ChevronDown, Sparkles, Mic } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  user?: {
    id?: string
    name?: string
    email?: string
    avatar?: string
  } | null
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { setUser, setShowProfileSettingsModal, setShowAuthModal } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleMenuClick = async (action: string) => {
    setIsOpen(false)
    switch (action) {
      case 'settings':
        setShowProfileSettingsModal(true)
        break
      case 'projects':
        router.push('/my-projects')
        break
      case 'photos':
        router.push('/my-images')
        break
      case 'videos':
        router.push('/my-videos')
        break
      case 'assets':
        router.push('/my-assets')
        break
      case 'audio':
        router.push('/audio-library')
        break
      case 'voices':
        router.push('/dashboard/voices')
        break
      case 'logout':
        try {
          await signOut()
          setUser(null)
          router.push('/')
          router.refresh()
        } catch (error) {
          console.error('Logout error:', error)
        }
        break
    }
  }

  if (!user) {
    return (
      <button
        onClick={() => setShowAuthModal(true)}
        className="h-11 px-8 rounded-full bg-white text-black hover:bg-brand-emerald hover:text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 shadow-xl"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Initialize Engine
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Premium European Style User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 pl-3 pr-4 py-1.5 rounded-full border transition-all duration-500 ${
          isOpen 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
        }`}
      >
        <div className="relative">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name || 'User'} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-emerald/20 flex items-center justify-center text-brand-emerald">
              <User className="w-4 h-4" />
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-brand-emerald rounded-full border-2 border-[#020617]" />
        </div>
        
        <div className="hidden sm:flex flex-col items-start leading-none text-left">
          <span className="text-[12px] font-black text-white uppercase tracking-[-0.02em] truncate max-w-[120px]">
            {user.name || 'User'}
          </span>
          <span className="text-[8px] font-black text-brand-emerald uppercase tracking-[0.2em] mt-1 opacity-80">
            Premium
          </span>
        </div>
        
        <ChevronDown className={`w-3.5 h-3.5 text-white/20 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Redesigned Glassmorphism Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-64 bg-[#09090b]/80 backdrop-blur-2xl rounded-[1.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 z-50">
          <div className="px-6 py-5 border-b border-white/[0.05]">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-bold text-white tracking-tight">{user.name || 'User'}</span>
              <div className="px-1.5 py-0.5 rounded-md bg-brand-emerald/10 border border-brand-emerald/20">
                <span className="text-[8px] font-black text-brand-emerald uppercase tracking-widest">Premium</span>
              </div>
            </div>
            <p className="text-[11px] text-white/30 truncate font-medium">{user.email}</p>
          </div>

          <div className="p-2">
            <div className="grid grid-cols-1 gap-1">
              <MenuAction 
                onClick={() => handleMenuClick('photos')} 
                icon={<Image className="w-4 h-4" />} 
                label="Image Library" 
              />
              <MenuAction 
                onClick={() => handleMenuClick('assets')} 
                icon={<Package className="w-4 h-4" />} 
                label="Asset Bin" 
              />
              <MenuAction 
                onClick={() => handleMenuClick('videos')} 
                icon={<Video className="w-4 h-4" />} 
                label="Video Library" 
                shortcut="⌘B"
              />
              <MenuAction 
                onClick={() => handleMenuClick('audio')} 
                icon={<Music2 className="w-4 h-4" />} 
                label="Audio Library" 
              />
              <MenuAction 
                onClick={() => handleMenuClick('voices')} 
                icon={<Mic className="w-4 h-4" />} 
                label="Voice Lab" 
              />
              <MenuAction 
                onClick={() => handleMenuClick('projects')} 
                icon={<Layout className="w-4 h-4" />} 
                label="My Projects" 
                shortcut="⌘P"
              />
              <div className="my-2 h-px bg-white/[0.05] mx-4" />
              <MenuAction 
                onClick={() => handleMenuClick('settings')} 
                icon={<Settings className="w-4 h-4" />} 
                label="Settings" 
              />
              <button
                onClick={() => handleMenuClick('logout')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[13px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4" />
                  <span className="uppercase tracking-widest">Sign Out</span>
                </div>
              </button>
            </div>
          </div>
          
          <div className="bg-brand-emerald/[0.03] px-6 py-4 flex items-center justify-between">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">geniferAI Studio</span>
            <Sparkles className="w-3 h-3 text-brand-emerald/40" />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuAction({ onClick, icon, label, shortcut }: { onClick: () => void, icon: any, label: string, shortcut?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/[0.04] group transition-all duration-300"
    >
      <div className="flex items-center gap-3">
        <div className="text-white/20 group-hover:text-brand-emerald transition-colors duration-300">
          {icon}
        </div>
        <span className="text-[13px] font-bold text-white/60 group-hover:text-white uppercase tracking-widest transition-colors duration-300">
          {label}
        </span>
      </div>
      {shortcut && (
        <span className="text-[9px] font-bold text-white/10 group-hover:text-white/20 transition-colors">
          {shortcut}
        </span>
      )}
    </button>
  )
}
