'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { X } from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface EditProjectNameModalProps {
  isOpen: boolean
  onClose: () => void
  currentName: string
}

export default function EditProjectNameModal({ isOpen, onClose, currentName }: EditProjectNameModalProps) {
  const { currentProject, updateProject, user } = useAppStore()
  const [projectName, setProjectName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setProjectName(currentName)
    }
  }, [isOpen, currentName])

  if (!isOpen || !currentProject) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    
    setIsSaving(true)
    try {
      // Update in store
      updateProject(currentProject.id, {
        name: projectName.trim()
      })
      
      // Save to database if user is authenticated
      if (user?.id) {
        try {
          const { saveProject } = await import('@/lib/db')
          const updatedProject = { ...currentProject, name: projectName.trim() }
          await saveProject(updatedProject, user.id)
          console.log('✅ Project name updated in database')
        } catch (error) {
          console.error('Error saving project name to database:', error)
          // Continue anyway - project is updated in local state
        }
      }
      
      onClose()
    } catch (error) {
      console.error('Error updating project name:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/20">
          <h2 className="text-xl font-bold text-white">Rename Project</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Name *
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              required
              autoFocus
              className="bg-[#0C0C0C] border-[#3AAFA9]/30 text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[#3AAFA9]/30 text-gray-300 hover:bg-[#3AAFA9]/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectName.trim() || isSaving}
              className="flex-1 bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

