'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { X, User, Upload, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { updateUserProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ProfileSettingsModal() {
  const { 
    user, 
    setUser,
    showProfileSettingsModal, 
    setShowProfileSettingsModal 
  } = useAppStore()
  
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize form with user data
  useEffect(() => {
    if (user && showProfileSettingsModal) {
      setName(user.name || '')
      setAvatarUrl(user.avatar || null)
    }
  }, [user, showProfileSettingsModal])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPG, PNG, or WebP image.')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size too large. Maximum size is 5MB.')
      return
    }

    setIsUploading(true)
    try {
      if (!user?.id) {
        toast.error('User not authenticated')
        setIsUploading(false)
        return
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload directly to Supabase Storage from client (has user session)
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError)
        
        // Provide user-friendly error messages
        const errorMessage = uploadError.message || ''
        if (errorMessage.includes('Bucket not found') || errorMessage.includes('bucket') || errorMessage.includes('404')) {
          throw new Error(
            'Storage bucket not found. Please create an "avatars" bucket in Supabase Storage. ' +
            'Go to Supabase Dashboard → Storage → Create Bucket → Name: "avatars" → Set to Public'
          )
        }
        
        throw new Error(errorMessage || 'Failed to upload avatar')
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path)

      setAvatarUrl(urlData.publicUrl)
      toast.success('Avatar uploaded successfully!')
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(`Failed to upload avatar: ${error.message || 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    if (!user) return

    // Validate name
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setIsSaving(true)
    try {
      console.log('Saving profile:', { name: name.trim(), avatarUrl })
      const result = await updateUserProfile(name.trim(), avatarUrl || undefined)
      
      if (result.success) {
        // Update user in store
        setUser({
          ...user,
          name: name.trim(),
          avatar: avatarUrl || undefined,
        })
        toast.success('Profile updated successfully!')
        setShowProfileSettingsModal(false)
      } else {
        const errorMessage = result.error?.message || result.error?.code || 'Failed to update profile'
        console.error('Profile update failed:', result.error)
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setShowProfileSettingsModal(false)
    // Reset form
    if (user) {
      setName(user.name || '')
      setAvatarUrl(user.avatar || null)
    }
  }

  if (!showProfileSettingsModal || !user) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/20">
          <h2 className="text-xl font-bold text-white">Profile Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={user.name || 'User'} 
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#3AAFA9]/30"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00FFF0] to-[#3AAFA9] flex items-center justify-center border-2 border-[#3AAFA9]/30">
                  <User className="w-12 h-12 text-black" />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#00FFF0] animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-gray-300 hover:text-white border-[#3AAFA9]/30 hover:border-[#3AAFA9]"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Avatar'}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              JPG, PNG, or WebP. Max 5MB
            </p>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="bg-[#0C0C0C] border-[#3AAFA9]/30 text-white placeholder:text-gray-500 focus:border-[#00FFF0]"
            />
          </div>

          {/* Email Field (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <Input
              type="email"
              value={user.email || ''}
              disabled
              className="bg-[#0C0C0C]/50 border-[#3AAFA9]/20 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-[#3AAFA9]/30 text-gray-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="flex-1 bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}