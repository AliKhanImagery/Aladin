'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updatePassword, getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Lock, CheckCircle, XCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)

  // Check if we have a valid session/token from the URL
  useEffect(() => {
    const checkSession = async () => {
      // Supabase automatically processes the hash token from the email link
      // Check if we have a valid session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Check if there's a hash in the URL (token might be processing)
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          // Wait a bit for Supabase to process the hash
          setTimeout(async () => {
            const { data: { session: newSession } } = await supabase.auth.getSession()
            if (!newSession) {
              setIsValidToken(false)
              setError('Invalid or expired reset link. Please request a new one.')
            } else {
              setIsValidToken(true)
            }
          }, 1000)
        } else {
          setIsValidToken(false)
          setError('No reset token found. Please request a new password reset link.')
        }
      } else {
        setIsValidToken(true)
      }
    }

    checkSession()
  }, [])

  // Check password strength
  useEffect(() => {
    if (newPassword.length === 0) {
      setPasswordStrength(null)
      return
    }

    if (newPassword.length < 6) {
      setPasswordStrength('weak')
    } else if (newPassword.length < 10) {
      setPasswordStrength('medium')
    } else {
      setPasswordStrength('strong')
    }
  }, [newPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await updatePassword(newPassword)
      if (error) {
        setError(error.message || 'Failed to update password. The link may have expired.')
      } else {
        setSuccess(true)
        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'strong':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00FFF0]/10 rounded-full mb-4">
              <Lock className="w-8 h-8 text-[#00FFF0]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
            <p className="text-sm text-gray-400">
              Enter your new password below
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-400 font-medium">
                  Password updated successfully! Redirecting...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !success && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isValidToken === null && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-[#00FFF0] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-400">Verifying reset link...</p>
            </div>
          )}

          {/* Form */}
          {!success && isValidToken === true && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
                  placeholder="Enter new password"
                />
                {passwordStrength && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
                          style={{
                            width:
                              passwordStrength === 'weak'
                                ? '33%'
                                : passwordStrength === 'medium'
                                ? '66%'
                                : '100%',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 capitalize">
                        {passwordStrength}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#3AAFA9]/30 rounded-lg text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
                  placeholder="Confirm new password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 6}
                className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Updating Password...' : 'Update Password'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-sm text-gray-400 hover:text-[#00FFF0]"
                >
                  Back to Home
                </button>
              </div>
            </form>
          )}

          {/* Invalid Token Message */}
          {isValidToken === false && (
            <div className="text-center space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400 mb-4">{error}</p>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="w-full border-[#3AAFA9]/30 text-gray-300 hover:bg-[#3AAFA9]/10"
                >
                  Back to Home
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

