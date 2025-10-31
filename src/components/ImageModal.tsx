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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview modal"
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-[#1E1F22]/90 hover:bg-[#1E1F22] text-white hover:text-[#00FFF0] rounded-full border border-[#3AAFA9]/30 backdrop-blur-sm"
        aria-label="Close image preview"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Download Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        className="absolute top-4 right-16 z-10 bg-[#1E1F22]/90 hover:bg-[#1E1F22] text-white hover:text-[#00FFF0] rounded-full border border-[#3AAFA9]/30 backdrop-blur-sm"
        aria-label="Download image"
      >
        <Download className="w-5 h-5" />
      </Button>

      {/* Image Container */}
      <div className="relative max-w-[95vw] max-h-[95vh] w-full h-full flex items-center justify-center p-4">
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZjIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+'
          }}
        />
      </div>
    </div>
  )
}

