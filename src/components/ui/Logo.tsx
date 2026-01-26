'use client'

import { Play, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'emerald'
}

export default function Logo({ 
  className, 
  iconOnly = false, 
  size = 'md',
  variant = 'default' 
}: LogoProps) {
  const sizeClasses = {
    sm: {
      container: 'w-7 h-7',
      icon: 'w-3.5 h-3.5',
      text: 'text-base',
      sparkle: 'w-2 h-2',
      gap: 'gap-2'
    },
    md: {
      container: 'w-9 h-9',
      icon: 'w-4.5 h-4.5',
      text: 'text-xl',
      sparkle: 'w-3 h-3',
      gap: 'gap-3'
    },
    lg: {
      container: 'w-12 h-12',
      icon: 'w-6 h-6',
      text: 'text-3xl',
      sparkle: 'w-4 h-4',
      gap: 'gap-4'
    },
    xl: {
      container: 'w-16 h-16',
      icon: 'w-8 h-8',
      text: 'text-5xl',
      sparkle: 'w-6 h-6',
      gap: 'gap-6'
    }
  }

  const currentSize = sizeClasses[size]

  return (
    <div className={cn("flex items-center group cursor-default", currentSize.gap, className)}>
      {/* Icon Container */}
      <div className={cn(
        "relative rounded-xl flex items-center justify-center transition-all duration-700 overflow-hidden",
        currentSize.container,
        variant === 'emerald' || variant === 'default' 
          ? "bg-brand-emerald glow-emerald group-hover:scale-105" 
          : "bg-white group-hover:rotate-[360deg]"
      )}>
        <Play className={cn(
          "fill-current transition-colors duration-500",
          currentSize.icon,
          variant === 'emerald' || variant === 'default' ? "text-brand-obsidian" : "text-black"
        )} />
        
        {/* Subtle AI Sparkle Overlay */}
        <div className="absolute top-0 right-0 p-0.5">
          <Sparkles className={cn(
            "animate-pulse",
            currentSize.sparkle,
            variant === 'emerald' || variant === 'default' ? "text-brand-obsidian/40" : "text-black/20"
          )} />
        </div>
      </div>

      {/* Text Logo */}
      {!iconOnly && (
        <div className={cn(
          "font-bold tracking-tight flex items-baseline leading-none transition-colors duration-500",
          currentSize.text,
          variant === 'emerald' || variant === 'default' ? "text-white" : "text-white"
        )}>
          <span className="font-black">genifer</span>
          <span className="text-brand-emerald ml-0.5 opacity-90">AI</span>
        </div>
      )}
    </div>
  )
}
