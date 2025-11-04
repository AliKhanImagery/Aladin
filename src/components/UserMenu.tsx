'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Settings, LogOut, User, UserCircle, FolderOpen, Image, Video } from 'lucide-react'
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
  const { setProjectManagerOpen, setUser } = useAppStore()
  const router = useRouter()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMenuClick = async (action: string) => {
    setIsOpen(false)
    
    switch (action) {
      case 'profile':
        // TODO: Navigate to profile page or open profile modal
        alert('Profile page coming soon!')
        break
      case 'settings':
        // TODO: Navigate to settings page or open settings modal
        alert('Settings page coming soon!')
        break
      case 'projects':
        setProjectManagerOpen(true)
        break
      case 'photos':
        // TODO: Navigate to photos page
        alert('My Photos page coming soon!')
        break
      case 'videos':
        // TODO: Navigate to videos page
        alert('My Videos page coming soon!')
        break
      case 'logout':
        try {
          await signOut()
          setUser(null)
          router.push('/')
          router.refresh()
        } catch (error) {
          console.error('Logout error:', error)
          alert('Error logging out. Please try again.')
        }
        break
    }
  }

  // Show login prompt if no user
  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          // Will be handled by AuthProvider or page-level auth check
          alert('Please sign in to access your profile')
        }}
        className="text-gray-400 hover:text-white hover:bg-[#1E1F22]"
      >
        <User className="w-5 h-5 mr-2" />
        Sign In
      </Button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar/Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-white hover:bg-[#1E1F22] rounded-full"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {user.avatar ? (
          <img 
            src={user.avatar} 
            alt={user.name || 'User'} 
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FFF0] to-[#3AAFA9] flex items-center justify-center">
            <User className="w-5 h-5 text-black" />
          </div>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-56 bg-[#1E1F22] rounded-xl border border-[#3AAFA9]/30 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          {/* User Info */}
          {user && (
            <div className="px-4 py-3 border-b border-[#3AAFA9]/20">
              <p className="text-sm font-medium text-white truncate">
                {user.name || 'User'}
              </p>
              {user.email && (
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => handleMenuClick('profile')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <UserCircle className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => handleMenuClick('settings')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => handleMenuClick('projects')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              My Projects
            </button>
            <button
              onClick={() => handleMenuClick('photos')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <Image className="w-4 h-4" />
              My Photos
            </button>
            <button
              onClick={() => handleMenuClick('videos')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <Video className="w-4 h-4" />
              My Videos
            </button>
            <div className="my-1 h-px bg-[#3AAFA9]/20" />
            <button
              onClick={() => handleMenuClick('logout')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

