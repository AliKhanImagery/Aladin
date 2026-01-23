'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function CreditsBadge() {
  const { user } = useAppStore()
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchCredits = async () => {
    if (!user) return
    // Don't show loading spinner on periodic refetch to avoid UI flicker
    if (credits === null) setLoading(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        const res = await fetch('/api/user/credits', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setCredits(data.balance)
        }
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    } finally {
      if (credits === null) setLoading(false)
    }
  }

  useEffect(() => {
    if (user && mounted) {
      fetchCredits()
      const interval = setInterval(fetchCredits, 30000)
      return () => clearInterval(interval)
    }
  }, [user, mounted])

  if (!mounted || !user) return null

  return (
    <Link href="/pricing">
      <div 
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer group select-none"
        title="Get more credits"
      >
        <div className={`w-5 h-5 rounded-full bg-brand-emerald/10 flex items-center justify-center text-brand-emerald group-hover:scale-110 transition-transform ${loading ? 'animate-pulse' : ''}`}>
          <Coins className="w-3 h-3" />
        </div>
        <span className="text-xs font-bold text-white tabular-nums tracking-wide">
          {credits !== null ? credits.toLocaleString() : <span className="opacity-50">...</span>}
        </span>
      </div>
    </Link>
  )
}
