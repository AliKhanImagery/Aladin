'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { X, User, Upload, Loader2, Link2, Plus, Settings as SettingsIcon, AlertCircle, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { updateUserProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSessionSafe } from '@/lib/auth'
import toast from 'react-hot-toast'

export default function ProfileSettingsModal() {
  const { 
    user, 
    setUser,
    showProfileSettingsModal, 
    setShowProfileSettingsModal,
    profileModalTab 
  } = useAppStore()
  
  const [activeTab, setActiveTab] = useState<'profile' | 'connections'>(profileModalTab)

  useEffect(() => {
    if (showProfileSettingsModal) {
      setActiveTab(profileModalTab)
    }
  }, [showProfileSettingsModal, profileModalTab])

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Connecting apps: ElevenLabs
  interface Connection {
    id: string
    name: string
    created_at: string
  }
  const [elevenLabsConnections, setElevenLabsConnections] = useState<Connection[]>([])
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, { status: string, message?: string }>>({})
  const [elevenLabsKey, setElevenLabsKey] = useState('')
  const [elevenLabsName, setElevenLabsName] = useState('')
  const [elevenLabsLoading, setElevenLabsLoading] = useState(false)
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const checkStatuses = useCallback(async () => {
    try {
        const { data: { session } } = await getSessionSafe()
        const token = session?.access_token
        if (!token) return
        // We use the voices endpoint to validate keys
        const res = await fetch('/api/user/voices/elevenlabs', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json().catch(() => ({}))
        if (data.connectionStatuses) {
            setConnectionStatuses(data.connectionStatuses)
        }
    } catch (e) {
        console.error('Check statuses failed', e)
    }
  }, [])

  const fetchIntegrations = useCallback(async () => {
    if (!user || !showProfileSettingsModal) return
    setIntegrationsLoading(true)
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/user/integrations?provider=elevenlabs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setElevenLabsConnections(data.connections || [])
        checkStatuses()
      }
    } catch (e) {
      console.error('Fetch integrations:', e)
    } finally {
      setIntegrationsLoading(false)
    }
  }, [user, showProfileSettingsModal, checkStatuses])

  // Initialize form with user data + integrations
  useEffect(() => {
    if (user && showProfileSettingsModal) {
      setName(user.name || '')
      setAvatarUrl(user.avatar || null)
      fetchIntegrations()
    }
  }, [user, showProfileSettingsModal, fetchIntegrations])

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
    setElevenLabsKey('')
    if (user) {
      setName(user.name || '')
      setAvatarUrl(user.avatar || null)
    }
  }

  const handleElevenLabsConnect = async () => {
    const key = elevenLabsKey.trim()
    const name = elevenLabsName.trim() || `Account ${elevenLabsConnections.length + 1}`
    
    if (!editingId && !key) {
      toast.error('Enter your ElevenLabs API key')
      return
    }
    setElevenLabsLoading(true)
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) {
        toast.error('Please sign in again')
        return
      }
      
      let res
      if (editingId) {
          // Update
          res = await fetch('/api/user/integrations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: editingId, name, api_key: key || undefined }), // Only update key if provided
          })
      } else {
          // Create
          res = await fetch('/api/user/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ provider: 'elevenlabs', api_key: key, name }),
          })
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to save API key')
        return
      }
      
      setElevenLabsKey('')
      setElevenLabsName('')
      setIsAddingNew(false)
      setEditingId(null)
      toast.success(editingId ? 'Connection updated' : 'Connection added')
      fetchIntegrations()
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect')
    } finally {
      setElevenLabsLoading(false)
    }
  }

  const handleElevenLabsDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to remove this connection?')) return
    setElevenLabsLoading(true)
    try {
      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`/api/user/integrations?provider=elevenlabs&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Connection removed')
        fetchIntegrations()
      } else {
        toast.error('Failed to disconnect')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect')
    } finally {
      setElevenLabsLoading(false)
    }
  }

  if (!showProfileSettingsModal || !user) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-2xl flex overflow-hidden h-[600px]">
        {/* Sidebar */}
        <div className="w-64 bg-[#151619] border-r border-[#3AAFA9]/20 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-8">Settings</h2>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'profile'
                    ? 'bg-[#00FFF0]/10 text-[#00FFF0]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'connections'
                    ? 'bg-[#00FFF0]/10 text-[#00FFF0]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Link2 className="w-4 h-4" />
                Connections
              </button>
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/5">
             <div className="flex items-center gap-3 px-2">
                {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FFF0] to-[#3AAFA9] flex items-center justify-center">
                        <User className="w-4 h-4 text-black" />
                    </div>
                )}
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative">
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors z-10"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'profile' && (
                    <div className="space-y-8 max-w-md mx-auto">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">My Profile</h3>
                            <p className="text-gray-400 text-sm">Manage your account settings and preferences.</p>
                        </div>

                        {/* Avatar Section */}
                        <div className="flex items-center gap-6">
                            <div className="relative shrink-0">
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
                            <div className="flex flex-col gap-2">
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
                                    {isUploading ? 'Uploading...' : 'Upload New Picture'}
                                </Button>
                                <p className="text-xs text-gray-500">
                                    JPG, PNG, or WebP. Max 5MB.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Name Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Display Name
                                </label>
                                <Input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="bg-[#0C0C0C] border-[#3AAFA9]/30 text-white placeholder:text-gray-500 focus:border-[#00FFF0] h-11"
                                />
                            </div>

                            {/* Email Field (Read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email Address
                                </label>
                                <Input
                                    type="email"
                                    value={user.email || ''}
                                    disabled
                                    className="bg-[#0C0C0C]/50 border-[#3AAFA9]/20 text-gray-400 cursor-not-allowed h-11"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || !name.trim()}
                                className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-bold h-11 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
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
                )}

                {activeTab === 'connections' && (
                    <div className="space-y-8 max-w-md mx-auto">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Connected Apps</h3>
                            <p className="text-gray-400 text-sm">Connect third-party services to use your assets in the studio.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-[#151619] rounded-xl border border-[#3AAFA9]/20 p-6 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-lg font-bold text-white">ElevenLabs</h4>
                                            {elevenLabsConnections.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-[#00FFF0]/10 text-[#00FFF0] text-[10px] font-bold uppercase tracking-wider">
                                                    Connected
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            Sync your ElevenLabs voice clones to use them for voiceovers in StoryFlow.
                                        </p>
                                    </div>
                                    <div className="shrink-0">
                                       {/* Placeholder for logo if needed */}
                                    </div>
                                </div>

                                {elevenLabsConnections.length > 0 && (
                                    <div className="space-y-3">
                                        {elevenLabsConnections.map((conn) => {
                                            const status = connectionStatuses[conn.id]
                                            return (
                                            <div key={conn.id} className="bg-[#00FFF0]/5 rounded-lg p-4 border border-[#00FFF0]/10 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {status?.status === 'error' ? (
                                                            <div className="text-red-400" title={status.message}>
                                                                <AlertCircle className="w-5 h-5" />
                                                            </div>
                                                        ) : status?.status === 'connected' ? (
                                                            <div className="text-[#00FFF0]" title="Connected">
                                                                <CheckCircle className="w-5 h-5" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-medium text-white">{conn.name || 'Personal Account'}</p>
                                                            <p className="text-xs text-gray-500">Connected {new Date(conn.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingId(conn.id)
                                                                setElevenLabsName(conn.name)
                                                                setElevenLabsKey('') // Don't show existing key for security
                                                                setIsAddingNew(true)
                                                            }}
                                                            className="text-gray-400 hover:text-white h-8 w-8 p-0"
                                                        >
                                                            <SettingsIcon className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleElevenLabsDisconnect(conn.id)}
                                                            disabled={elevenLabsLoading}
                                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 text-xs h-8"
                                                        >
                                                            {elevenLabsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                                                        </Button>
                                                    </div>
                                                </div>
                                                {status?.status === 'error' && (
                                                    <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-400 flex items-start gap-2">
                                                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                                        <span>{status.message}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                    </div>
                                )}

                                {isAddingNew || (elevenLabsConnections.length === 0 && !integrationsLoading) ? (
                                    <div className="space-y-3 pt-2 bg-[#1E1F22] rounded-lg p-4 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                {editingId ? 'Edit Connection' : 'Add New Connection'}
                                            </label>
                                            {(elevenLabsConnections.length > 0 || editingId) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setIsAddingNew(false)
                                                        setEditingId(null)
                                                        setElevenLabsName('')
                                                        setElevenLabsKey('')
                                                    }}
                                                    className="text-xs text-gray-400 hover:text-white h-6 px-2"
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <Input
                                                type="text"
                                                placeholder="Connection Name (e.g. Work, Personal)"
                                                value={elevenLabsName}
                                                onChange={(e) => setElevenLabsName(e.target.value)}
                                                className="bg-[#0C0C0C] border-[#3AAFA9]/20 text-white text-sm placeholder:text-gray-600 h-10"
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    type="password"
                                                    placeholder={editingId ? "Enter new API Key (leave blank to keep current)" : "API Key (sk_...)"}
                                                    value={elevenLabsKey}
                                                    onChange={(e) => setElevenLabsKey(e.target.value)}
                                                    className="bg-[#0C0C0C] border-[#3AAFA9]/20 text-white text-sm placeholder:text-gray-600 flex-1 h-10"
                                                />
                                                <Button
                                                    onClick={handleElevenLabsConnect}
                                                    disabled={elevenLabsLoading || (!editingId && !elevenLabsKey.trim())}
                                                    className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-bold h-10 px-6 shrink-0"
                                                >
                                                    {elevenLabsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Find your key at <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#00FFF0] hover:underline">elevenlabs.io/app/settings/api-keys</a>
                                        </p>
                                    </div>
                                ) : (
                                    elevenLabsConnections.length < 5 && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsAddingNew(true)}
                                            className="w-full border-dashed border-[#3AAFA9]/30 text-gray-400 hover:text-[#00FFF0] hover:border-[#00FFF0]/50"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Another Account
                                        </Button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )

}