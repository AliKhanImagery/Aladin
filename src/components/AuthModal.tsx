'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { X, Mail, ArrowLeft } from 'lucide-react'
import { signUp, signIn, resetPasswordForEmail } from '@/lib/auth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  context?: 'project-creation' | 'general'
  message?: string
}

type AuthView = 'signin' | 'signup' | 'forgot-password' | 'reset-sent'

export default function AuthModal({ isOpen, onClose, onSuccess, context = 'general', message }: AuthModalProps) {
  const [view, setView] = useState<AuthView>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (view === 'signup') {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setError(error.message)
        } else {
          onSuccess()
          onClose()
        }
      } else if (view === 'signin') {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          onSuccess()
          onClose()
        }
      } else if (view === 'forgot-password') {
        const { error } = await resetPasswordForEmail(email)
        if (error) {
          setError(error.message)
        } else {
          setResetEmailSent(true)
          setView('reset-sent')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToSignIn = () => {
    setView('signin')
    setError(null)
    setResetEmailSent(false)
    setEmail('')
    setPassword('')
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/20">
          <div className="flex items-center gap-3">
            {view === 'forgot-password' || view === 'reset-sent' ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToSignIn}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : null}
            <h2 className="text-xl font-bold text-white">
              {view === 'signup' ? 'Sign Up' : 
               view === 'forgot-password' ? 'Reset Password' :
               view === 'reset-sent' ? 'Check Your Email' :
               'Sign In'}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Context-specific messaging */}
        {context === 'project-creation' && view === 'signin' && (
          <div className="px-6 pt-6 pb-0">
            <div className="bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-[#00FFF0] font-medium mb-2">
                {message || 'Sign up to save your project and continue creating'}
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>✓ Save your work automatically</li>
                <li>✓ Access from anywhere</li>
                <li>✓ Generate unlimited stories</li>
              </ul>
            </div>
          </div>
        )}

        {/* Reset Email Sent Success View */}
        {view === 'reset-sent' ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-[#00FFF0]/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-[#00FFF0]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Check Your Email</h3>
                <p className="text-sm text-gray-400">
                  We've sent a password reset link to <strong className="text-white">{email}</strong>
                </p>
              </div>
              <div className="bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-lg p-4 w-full">
                <p className="text-xs text-gray-400">
                  Click the link in the email to reset your password. The link will expire in 1 hour.
                </p>
              </div>
              <Button
                onClick={handleBackToSignIn}
                variant="outline"
                className="w-full border-[#3AAFA9]/30 text-gray-300 hover:bg-[#3AAFA9]/10"
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {view === 'signup' && (
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

            {view !== 'forgot-password' && (
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
            )}

            {view === 'forgot-password' && (
              <div className="bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-lg p-4">
                <p className="text-sm text-gray-400">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
            )}

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
              {isLoading 
                ? 'Loading...' 
                : view === 'signup' 
                  ? 'Sign Up' 
                  : view === 'forgot-password'
                    ? 'Send Reset Link'
                    : 'Sign In'}
            </Button>

            <div className="text-center space-y-2">
              {view === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setView('forgot-password')
                    setError(null)
                  }}
                  className="block w-full text-sm text-[#00FFF0] hover:text-[#00FFF0]/80"
                >
                  Forgot password?
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setView(view === 'signup' ? 'signin' : 'signup')
                  setError(null)
                }}
                className="text-sm text-gray-400 hover:text-[#00FFF0]"
              >
                {view === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
