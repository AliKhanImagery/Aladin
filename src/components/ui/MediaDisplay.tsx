'use client'

import { useState } from 'react'
import { Image as ImageIcon, Video as VideoIcon, AlertCircle } from 'lucide-react'

interface MediaDisplayProps {
  src?: string | null
  alt?: string
  type?: 'image' | 'video'
  className?: string
  onError?: () => void
  fallbackMessage?: string
}

/**
 * MediaDisplay component with graceful error handling
 * 
 * Displays images or videos with fallback UI if:
 * - Source URL is missing
 * - File fails to load
 * - File is not found in storage
 */
export function MediaDisplay({
  src,
  alt = '',
  type = 'image',
  className = '',
  onError,
  fallbackMessage,
}: MediaDisplayProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    console.warn('⚠️ Media failed to load:', src?.substring(0, 100))
    setHasError(true)
    setIsLoading(false)
    onError?.()
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  // No source provided
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg ${className}`}>
        <div className="text-center p-4">
          {type === 'image' ? (
            <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          ) : (
            <VideoIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          )}
          <p className="text-xs text-gray-500">
            {fallbackMessage || 'No media available'}
          </p>
        </div>
      </div>
    )
  }

  // Error loading media
  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-[#1E1F22] border border-[#3AAFA9]/30 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-xs text-amber-500 mb-1">Media unavailable</p>
          <p className="text-xs text-gray-500">
            {fallbackMessage || 'File may have been deleted or moved'}
          </p>
        </div>
      </div>
    )
  }

  // Render media
  if (type === 'video') {
    return (
      <div className={`relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1E1F22] rounded-lg">
            <div className="text-center">
              <VideoIcon className="w-6 h-6 text-gray-500 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-gray-500">Loading video...</p>
            </div>
          </div>
        )}
        <video
          src={src}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          onError={handleError}
          onLoadedData={handleLoad}
          controls
          preload="auto"
          playsInline
        >
          Your browser does not support the video tag.
        </video>
      </div>
    )
  }

  // Image
  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1E1F22] rounded-lg">
          <div className="text-center">
            <ImageIcon className="w-6 h-6 text-gray-500 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-gray-500">Loading image...</p>
          </div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  )
}

