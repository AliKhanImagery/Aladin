'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Settings, LogOut, User, ChevronDown } from 'lucide-react'

interface UserMenuProps {
  user?: {
    name?: string
    email?: string
    avatar?: string
  } | null
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log('Logout clicked')
    setIsOpen(false)
    // Could dispatch a logout action or clear user state
  }

  const handleSettings = () => {
    // TODO: Navigate to settings or open settings modal
    console.log('Settings clicked')
    setIsOpen(false)
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FFF0] to-[#3AAFA9] flex items-center justify-center">
          <User className="w-5 h-5 text-black" />
        </div>
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#1E1F22] rounded-xl border border-[#3AAFA9]/30 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
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
              onClick={handleSettings}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0C0C0C] transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

