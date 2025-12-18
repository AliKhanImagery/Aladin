'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[#3AAFA9]/30 bg-[#0C0C0C] px-3 py-2 text-sm text-white',
          'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFF0] focus-visible:ring-offset-2',
          'focus-visible:border-[#00FFF0]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#0C0C0C] text-white">
            {option.label}
          </option>
        ))}
      </select>
    )
  }
)
Select.displayName = 'Select'

