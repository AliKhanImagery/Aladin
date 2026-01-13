'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { X, Mail, ArrowLeft, Eye, EyeOff, Sparkles, ShieldCheck, Lock, User } from 'lucide-react'
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

    const TIMEOUT_MS = 90000
    isRequestPendingRef.current = true
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        if (isRequestPendingRef.current) {
          isRequestPendingRef.current = false
          setIsLoading(false)
          const errorMessage = view === 'signin' 
            ? 'Access synchronization timed out. Please verify your connection.'
            : view === 'signup'
            ? 'Account initialization timed out. Please verify your connection.'
            : 'Request synchronization timed out.'
          
          setError(errorMessage)
          toast.error(
            <div className="font-medium">
              <p className="font-bold">Sync Timeout</p>
              <p className="text-xs mt-1">{errorMessage}</p>
            </div>
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
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        
        if (result.type === 'result') {
          const { error } = result.result
          if (error) {
            setError(error.message)
            toast.error(error.message)
          } else {
            toast.success('Foundry identity initialized.')
            onSuccess()
            onClose()
          }
        }
      } else if (view === 'signin') {
        const signInPromise = signIn(email, password)
        const result = await Promise.race([
          signInPromise.then(result => ({ type: 'result' as const, result })),
          timeoutPromise
        ])
        
        isRequestPendingRef.current = false
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        
        if (result.type === 'result') {
          const { error } = result.result
            if (error) {
            setError(error.message)
            toast.error(error.message)
          } else {
            toast.success('Identity synchronized.')
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
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        
        if (result.type === 'result') {
          const { error } = result.result
          if (error) {
            setError(error.message)
            toast.error(error.message)
          } else {
            toast.success('Recovery blueprint sent.')
            setResetEmailSent(true)
            setView('reset-sent')
          }
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('timed out')) {
        setError(err.message || 'An unexpected error occurred.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToSignIn = () => {
    setView('signin')
    setError(null)
    setResetEmailSent(false)
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#020617]/90 backdrop-blur-2xl p-4 animate-in fade-in duration-500">
      {/* Background Accents */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-emerald/5 blur-[120px] rounded-full" />
      </div>

      <div className="bg-[#09090b] w-full max-w-xl rounded-[3rem] border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-10 border-b border-white/[0.03] relative">
          <div className="flex items-center gap-6">
            {view === 'forgot-password' || view === 'reset-sent' ? (
              <button
                onClick={handleBackToSignIn}
                className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-brand-emerald" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white uppercase tracking-widest italic serif">
                {view === 'signup' ? 'Identity Initialization' : 
                 view === 'forgot-password' ? 'Access Recovery' :
                 view === 'reset-sent' ? 'Transmission Sent' :
                 'Secure Access'}
            </h2>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1.5">Foundry Authentication Protocol</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPassword(''); setEmail(''); setFullName('');
              setShowPassword(false); onClose();
            }}
            className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 custom-scrollbar max-h-[70vh] overflow-y-auto">
          {/* Context Messaging */}
        {context === 'project-creation' && view === 'signin' && (
            <div className="mb-10 bg-brand-emerald/[0.03] border border-brand-emerald/10 rounded-[1.5rem] p-6">
              <div className="flex items-center gap-3 mb-3 text-brand-emerald">
                <Sparkles className="w-4 h-4" />
                <span className="text-[11px] font-black uppercase tracking-widest">Premium Provisioning</span>
              </div>
              <p className="text-sm text-white/60 font-medium leading-relaxed">
                {message || 'Synchronize your identity to preserve your current orchestration and unlock unlimited foundry assets.'}
              </p>
          </div>
        )}

        {view === 'reset-sent' ? (
            <div className="flex flex-col items-center text-center space-y-8 py-6">
              <div className="w-24 h-24 bg-brand-emerald/10 rounded-full flex items-center justify-center animate-pulse">
                <Mail className="w-10 h-10 text-brand-emerald" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-3">Sync Sent.</h3>
                <p className="text-sm text-white/30 font-medium leading-relaxed max-w-sm">
                  We've transmitted a recovery blueprint to <br />
                  <strong className="text-white font-black">{email}</strong>
                </p>
              </div>
              <Button
                onClick={handleBackToSignIn}
                className="w-full h-16 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]"
              >
                Return to Access
              </Button>
          </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
            {view === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Full Identity</label>
                    <div className="relative">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10"><User className="w-4 h-4" /></div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                        className="w-full h-16 bg-white/[0.02] border border-white/10 rounded-2xl px-14 text-white placeholder:text-white/5 focus:border-brand-emerald/40 focus:ring-0 transition-all font-medium"
                        placeholder="Director Name"
                />
                    </div>
              </div>
            )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Email Terminal</label>
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10"><Mail className="w-4 h-4" /></div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                      className="w-full h-16 bg-white/[0.02] border border-white/10 rounded-2xl px-14 text-white placeholder:text-white/5 focus:border-brand-emerald/40 focus:ring-0 transition-all font-medium"
                      placeholder="address@studio.com"
              />
                  </div>
            </div>

            {view !== 'forgot-password' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Security Key</label>
                <div className="relative">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10"><Lock className="w-4 h-4" /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                        className="w-full h-16 bg-white/[0.02] border border-white/10 rounded-2xl px-14 pr-16 text-white placeholder:text-white/5 focus:border-brand-emerald/40 focus:ring-0 transition-all font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-white/10 hover:text-white/40 transition-colors"
                  >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
              </div>

            {error && (
                <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl">
                  <p className="text-xs text-red-400 font-bold uppercase tracking-widest">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
                className="w-full h-16 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-700 font-black uppercase tracking-widest text-[11px] shadow-2xl"
            >
              {isLoading 
                  ? <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                : view === 'signup' 
                    ? 'Initialize Identity' 
                  : view === 'forgot-password'
                      ? 'Transmit Recovery'
                      : 'Grant Access'}
            </Button>

              <div className="flex flex-col gap-4 text-center">
              {view === 'signin' && (
                <button
                  type="button"
                    onClick={() => { setView('forgot-password'); setError(null); }}
                    className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-colors"
                >
                    Key Recovery
                </button>
              )}
              <button
                type="button"
                  onClick={() => { setView(view === 'signup' ? 'signin' : 'signup'); setError(null); }}
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-brand-emerald transition-colors"
              >
                  {view === 'signup' ? 'Switch to Existing Identity' : 'Initialize New Identity'}
              </button>
            </div>
          </form>
        )}
      </div>

        {/* Footer Protocol */}
        <div className="px-10 py-6 bg-brand-emerald/[0.02] border-t border-white/[0.03] flex items-center justify-between">
          <span className="text-[9px] font-bold text-white/10 uppercase tracking-[0.4em]">Auth Protocol v2.6.0</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-brand-emerald/40" />
            <div className="w-1 h-1 rounded-full bg-brand-emerald/20" />
            <div className="w-1 h-1 rounded-full bg-brand-emerald/10" />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;700;900&display=swap');
        .serif { font-family: 'Playfair Display', serif; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  )
}
