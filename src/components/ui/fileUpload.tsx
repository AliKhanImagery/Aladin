'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, X, Loader2, Image as ImageIcon, File } from 'lucide-react'
import { Button } from './button'

interface FileUploadProps {
  onFileSelect: (url: string, file?: File) => void
  accept?: string
  multiple?: boolean
  label?: string
  placeholder?: string
  currentUrl?: string
  disabled?: boolean
  className?: string
}

export function FileUpload({
  onFileSelect,
  accept = 'image/*',
  multiple = false,
  label,
  placeholder = 'Drag and drop files here or click to browse',
  currentUrl,
  disabled = false,
  className = '',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url } = await response.json()
      onFileSelect(url, file)
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`Failed to upload file: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      if (accept.includes('image/*')) {
        return file.type.startsWith('image/')
      }
      return true
    })

    if (validFiles.length === 0) {
      alert('Please drop valid files')
      return
    }

    // Handle first file (or all if multiple)
    const filesToProcess = multiple ? validFiles : [validFiles[0]]
    for (const file of filesToProcess) {
      await uploadFile(file)
    }
  }

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const filesToProcess = multiple ? Array.from(files) : [files[0]]
    for (const file of filesToProcess) {
      await uploadFile(file)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors
          ${isDragging 
            ? 'border-[#00FFF0] bg-[#00FFF0]/10' 
            : 'border-[#3AAFA9] hover:border-[#00FFF0]/50 hover:bg-[#1E1F22]/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-[#00FFF0] animate-spin" />
            <p className="text-sm text-gray-400">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className={`w-8 h-8 ${isDragging ? 'text-[#00FFF0]' : 'text-gray-400'}`} />
            <p className="text-sm text-gray-400 text-center">
              {placeholder}
            </p>
            <p className="text-xs text-gray-500">
              {accept === 'image/*' ? 'PNG, JPG, GIF up to 10MB' : 'All file types'}
            </p>
          </div>
        )}

        {currentUrl && (
          <div className="mt-3 p-2 bg-[#1E1F22] rounded flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ImageIcon className="w-4 h-4 text-[#00FFF0] flex-shrink-0" />
              <span className="text-xs text-gray-300 truncate">{currentUrl}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onFileSelect('')
              }}
              className="text-red-400 hover:text-red-300 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

