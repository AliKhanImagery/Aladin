'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { X, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { signUp, signIn, resetPasswordForEmail } from '@/lib/auth'
import toast from 'react-hot-toast'

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
  const [showPassword, setShowPassword] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRequestPendingRef = useRef<boolean>(false)

  // Cleanup on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      isRequestPendingRef.current = false
    }
  }, [])

  // Reset loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false)
      setError(null)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Set timeout (90 seconds - increased for slow connections)
    const TIMEOUT_MS = 90000
    isRequestPendingRef.current = true
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        if (isRequestPendingRef.current) {
          isRequestPendingRef.current = false
          setIsLoading(false)
          const errorMessage = view === 'signin' 
            ? 'Sign-in request timed out. Please check your connection and try again.'
            : view === 'signup'
            ? 'Sign-up request timed out. Please check your connection and try again.'
            : 'Request timed out. Please try again.'
          
          setError(errorMessage)
          
          // Show toast with helpful message
          toast.error(
            <div>
              <p className="font-semibold">Request Timeout</p>
              <p className="text-sm mt-1">{errorMessage}</p>
              <p className="text-xs mt-2 text-gray-400">
                💡 Help: Check your internet connection, verify Supabase is accessible, or try again in a moment.
              </p>
            </div>,
            {
              duration: 6000,
            }
          )
          
          reject(new Error(errorMessage))
        }
      }, TIMEOUT_MS)
    })

    try {
      if (view === 'signup') {
        const signUpPromise = signUp(email, password, fullName)
        const result = await Promise.race([
          signUpPromise.then(result => ({ type: 'result' as const, result })),
          timeoutPromise
        ])
        
        isRequestPendingRef.current = false
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        // If we got here, it wasn't a timeout
        if (result.type === 'result') {
          const { error } = result.result
          if (error) {
            const errorMsg = error.message || 'Failed to sign up'
            setError(errorMsg)
            toast.error(
              <div>
                <p className="font-semibold">Sign Up Failed</p>
                <p className="text-sm mt-1">{errorMsg}</p>
                <p className="text-xs mt-2 text-gray-400">
                  💡 Help: Check your email format, ensure password is at least 6 characters, or try signing in if you already have an account.
                </p>
              </div>,
              { duration: 5000 }
            )
          } else {
            toast.success('Account created successfully!')
            onSuccess()
            onClose()
          }
        }
      } else if (view === 'signin') {
        console.log('🔐 Attempting sign in for:', email)
        const signInPromise = signIn(email, password)
        const result = await Promise.race([
          signInPromise.then(result => ({ type: 'result' as const, result })),
          timeoutPromise
        ])
        
        isRequestPendingRef.current = false
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        // If we got here, it wasn't a timeout
        if (result.type === 'result') {
          const { error } = result.result
            if (error) {
            let errorMsg = error.message || 'Failed to sign in'
            
            // Handle schema/database errors specifically
            if (errorMsg.toLowerCase().includes('schema') || 
                errorMsg.toLowerCase().includes('querying') ||
                errorMsg.toLowerCase().includes('does not exist') ||
                error.code === '42P01') {
              errorMsg = 'Database configuration error. Please contact support or check your database setup.'
              console.error('❌ Database schema error during sign in:', {
                message: error.message,
                code: error.code,
                hint: 'Database migrations may not have been run. Check Supabase setup.'
              })
            }
            
            setError(errorMsg)
            
            // Provide helpful error messages based on error type
            let helpText = '💡 Help: '
            if (errorMsg.toLowerCase().includes('database') || errorMsg.toLowerCase().includes('schema')) {
              helpText += 'Database setup issue detected. Please ensure database migrations have been run in Supabase.'
            } else if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('credentials')) {
              helpText += 'Check your email and password. Use "Forgot password?" if you need to reset it.'
            } else if (errorMsg.toLowerCase().includes('email')) {
              helpText += 'Verify your email address is correct and try again.'
            } else if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch')) {
              helpText += 'Check your internet connection and ensure Supabase is accessible.'
            } else {
              helpText += 'Please try again. If the problem persists, check your internet connection.'
            }
            
            toast.error(
              <div>
                <p className="font-semibold">Sign In Failed</p>
                <p className="text-sm mt-1">{errorMsg}</p>
                <p className="text-xs mt-2 text-gray-400">{helpText}</p>
              </div>,
              { duration: 6000 }
            )
          } else {
            toast.success('Signed in successfully!')
            onSuccess()
            onClose()
          }
        }
      } else if (view === 'forgot-password') {
        const resetPromise = resetPasswordForEmail(email)
        const result = await Promise.race([
          resetPromise.then(result => ({ type: 'result' as const, result })),
          timeoutPromise
        ])
        
        isRequestPendingRef.current = false
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        // If we got here, it wasn't a timeout
        if (result.type === 'result') {
          const { error } = result.result
          if (error) {
            const errorMsg = error.message || 'Failed to send reset email'
            setError(errorMsg)
            toast.error(
              <div>
                <p className="font-semibold">Reset Email Failed</p>
                <p className="text-sm mt-1">{errorMsg}</p>
                <p className="text-xs mt-2 text-gray-400">
                  💡 Help: Verify your email address is correct and try again.
                </p>
              </div>,
              { duration: 5000 }
            )
          } else {
            toast.success('Password reset email sent! Check your inbox.')
            setResetEmailSent(true)
            setView('reset-sent')
          }
        }
      }
    } catch (err: any) {
      isRequestPendingRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      // Don't show error if it was a timeout (already handled)
      if (err.message && err.message.includes('timed out')) {
        return
      }
      
      console.error('❌ Auth error:', err)
      const errorMsg = err.message || 'An unexpected error occurred'
      setError(errorMsg)
      toast.error(
        <div>
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{errorMsg}</p>
          <p className="text-xs mt-2 text-gray-400">
            💡 Help: Please try again. If the problem persists, check your connection or contact support.
          </p>
        </div>,
        { duration: 5000 }
      )
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
    setIsLoading(false)
    isRequestPendingRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1A1A24] rounded-2xl border border-[#00FFF0]/30 shadow-[0_0_20px_rgba(0,255,240,0.2)] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#00FFF0]/20">
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
            onClick={() => {
              setIsLoading(false)
              isRequestPendingRef.current = false
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
              }
              setError(null)
              setPassword('')
              setEmail('')
              setFullName('')
              setShowPassword(false)
              onClose()
            }}
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
                className="w-full border-[#00FFF0]/30 text-gray-300 hover:bg-[#00FFF0]/10 hover:border-[#00FFF0]/50 hover:shadow-[0_0_5px_rgba(0,255,240,0.2)] transition-all duration-300"
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
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#00FFF0]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,240,0.2)] transition-all duration-300"
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 pr-10 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00FFF0] transition-colors focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
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
              className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg 
                       shadow-[0_0_15px_rgba(0,255,240,0.5)] hover:shadow-[0_0_25px_rgba(0,255,240,0.8)]
                       transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
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
                    setIsLoading(false)
                    isRequestPendingRef.current = false
                    if (timeoutRef.current) {
                      clearTimeout(timeoutRef.current)
                      timeoutRef.current = null
                    }
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
                  setIsLoading(false)
                  isRequestPendingRef.current = false
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                    timeoutRef.current = null
                  }
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
