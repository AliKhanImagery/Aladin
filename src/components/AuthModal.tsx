'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { X } from 'lucide-react'
import { signUp, signIn } from '@/lib/auth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setError(error.message)
        } else {
          onSuccess()
          onClose()
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          onSuccess()
          onClose()
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/20">
          <h2 className="text-xl font-bold text-white">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
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
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
              }}
              className="text-sm text-[#00FFF0] hover:text-[#00FFF0]/80"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
