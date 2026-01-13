'use client'

import { X, Download } from 'lucide-react'
import { Button } from './ui/button'

interface ImageModalProps {
  imageUrl: string
  alt?: string
  isOpen: boolean
  onClose: () => void
}

export default function ImageModal({ imageUrl, alt = 'Preview', isOpen, onClose }: ImageModalProps) {
  if (!isOpen) return null

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `image-${Date.now()}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-2 sm:p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview modal"
    >
      {/* Action Bar (Top Right) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-[110]">
      <Button
        variant="ghost"
        size="icon"
          onClick={handleDownload}
          className="bg-white/5 hover:bg-white/10 text-white hover:text-brand-emerald rounded-full border border-white/10 backdrop-blur-xl h-10 w-10 sm:h-12 sm:w-12 transition-all duration-300 shadow-lg"
          aria-label="Download image"
      >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
          onClick={onClose}
          className="bg-white/5 hover:bg-white/10 text-white hover:text-red-400 rounded-full border border-white/10 backdrop-blur-xl h-10 w-10 sm:h-12 sm:w-12 transition-all duration-300 shadow-lg"
          aria-label="Close image preview"
      >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
      </Button>
      </div>

      {/* Image - Fills available space while maintaining aspect ratio */}
        <img
          src={imageUrl}
          alt={alt}
        className="block rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500 ease-out cursor-default"
        style={{
          maxWidth: 'calc(100vw - 1rem)',
          maxHeight: 'calc(100vh - 5rem)',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
        }}
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZjIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+'
          }}
        />
    </div>
  )
}

