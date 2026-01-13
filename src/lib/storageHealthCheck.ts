/**
 * Storage Health Check Utility
 * 
 * Comprehensive system checkup to ensure storage will work properly
 * before media generation begins. Critical for preventing data loss.
 */

import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client for health checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface HealthCheckResult {
  status: 'pass' | 'fail'
  details: string
  error?: string
}

export interface StorageHealthStatus {
  healthy: boolean
  checks: {
    buckets: HealthCheckResult
    authentication: HealthCheckResult
    database: HealthCheckResult
    writePermissions: HealthCheckResult
    environment: HealthCheckResult
  }
  timestamp: string
  errors: string[]
}

/**
 * Check if bucket exists and is accessible
 */
async function checkBucketExists(bucket: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).list('', { limit: 1 })
    return !error
  } catch {
    return false
  }
}

/**
 * Full health check with detailed status
 */
export async function validateStorageHealth(userId?: string): Promise<StorageHealthStatus> {
  const timestamp = new Date().toISOString()
  const errors: string[] = []
  const checks: StorageHealthStatus['checks'] = {
    buckets: { status: 'fail', details: 'Not checked yet' },
    authentication: { status: 'fail', details: 'Not checked yet' },
    database: { status: 'fail', details: 'Not checked yet' },
    writePermissions: { status: 'fail', details: 'Not checked yet' },
    environment: { status: 'fail', details: 'Not checked yet' },
  }

  // 1. Environment Variables Check
  try {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'FAL_KEY'
    ]
    const missingVars: string[] = []
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      missingVars.push('SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    }
    if (!process.env.FAL_KEY) {
      missingVars.push('FAL_KEY')
    }

    if (missingVars.length === 0) {
      checks.environment = {
        status: 'pass',
        details: 'All required environment variables are set'
      }
    } else {
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`
      checks.environment = {
        status: 'fail',
        details: errorMsg,
        error: errorMsg
      }
      errors.push(errorMsg)
    }
  } catch (error: any) {
    const errorMsg = `Environment check failed: ${error.message}`
    checks.environment = {
      status: 'fail',
      details: errorMsg,
      error: errorMsg
    }
    errors.push(errorMsg)
  }

  // 2. Storage Buckets Check
  try {
    const bucketExists = await checkBucketExists('user-media')
    if (bucketExists) {
      checks.buckets = {
        status: 'pass',
        details: 'user-media bucket exists and is accessible'
      }
    } else {
      const errorMsg = 'user-media bucket not found or not accessible'
      checks.buckets = {
        status: 'fail',
        details: errorMsg,
        error: errorMsg
      }
      errors.push(errorMsg)
    }
  } catch (error: any) {
    const errorMsg = `Bucket check failed: ${error.message}`
    checks.buckets = {
      status: 'fail',
      details: errorMsg,
      error: errorMsg
    }
    errors.push(errorMsg)
  }

  // 3. Authentication Check (if userId provided)
  if (userId) {
    try {
      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId)
      if (!error && user) {
        checks.authentication = {
          status: 'pass',
          details: `User authenticated: ${user.email || userId}`
        }
      } else {
        // Try regular getUser instead
        const { data: { user: regularUser }, error: regularError } = await supabase.auth.getUser()
        if (!regularError && regularUser && regularUser.id === userId) {
          checks.authentication = {
            status: 'pass',
            details: `User authenticated: ${regularUser.email || userId}`
          }
        } else {
          const errorMsg = `Authentication failed: ${error?.message || regularError?.message || 'User not found'}`
          checks.authentication = {
            status: 'fail',
            details: errorMsg,
            error: errorMsg
          }
          errors.push(errorMsg)
        }
      }
    } catch (error: any) {
      const errorMsg = `Authentication check failed: ${error.message}`
      checks.authentication = {
        status: 'fail',
        details: errorMsg,
        error: errorMsg
      }
      errors.push(errorMsg)
    }
  } else {
    checks.authentication = {
      status: 'pass',
      details: 'Authentication check skipped (no userId provided)'
    }
  }

  // 4. Database Tables Check
  try {
    const { error: imagesError } = await supabase
      .from('user_images')
      .select('id')
      .limit(1)

    const { error: videosError } = await supabase
      .from('user_videos')
      .select('id')
      .limit(1)

    if (!imagesError && !videosError) {
      checks.database = {
        status: 'pass',
        details: 'Database tables (user_images, user_videos) are accessible'
      }
    } else {
      const errors = []
      if (imagesError) errors.push(`user_images: ${imagesError.message}`)
      if (videosError) errors.push(`user_videos: ${videosError.message}`)
      const errorMsg = `Database access failed: ${errors.join('; ')}`
      checks.database = {
        status: 'fail',
        details: errorMsg,
        error: errorMsg
      }
      errors.push(errorMsg)
    }
  } catch (error: any) {
    const errorMsg = `Database check failed: ${error.message}`
    checks.database = {
      status: 'fail',
      details: errorMsg,
      error: errorMsg
    }
    errors.push(errorMsg)
  }

  // 5. Write Permissions Test
  if (userId) {
    try {
      const testFile = new Blob(['health-check-test'], { type: 'text/plain' })
      const testPath = `test/${userId}/health-check-${Date.now()}.txt`
      
      const { error: uploadError } = await supabase.storage
        .from('user-media')
        .upload(testPath, testFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (!uploadError) {
        // Clean up test file
        await supabase.storage
          .from('user-media')
          .remove([testPath])

        checks.writePermissions = {
          status: 'pass',
          details: 'Write permissions verified (test file uploaded and removed)'
        }
      } else {
        const errorMsg = `Write permission test failed: ${uploadError.message}`
        checks.writePermissions = {
          status: 'fail',
          details: errorMsg,
          error: errorMsg
        }
        errors.push(errorMsg)
      }
    } catch (error: any) {
      const errorMsg = `Write permission check failed: ${error.message}`
      checks.writePermissions = {
        status: 'fail',
        details: errorMsg,
        error: errorMsg
      }
      errors.push(errorMsg)
    }
  } else {
    checks.writePermissions = {
      status: 'pass',
      details: 'Write permission check skipped (no userId provided)'
    }
  }

  // Determine overall health
  const healthy = Object.values(checks).every(check => check.status === 'pass')

  return {
    healthy,
    checks,
    timestamp,
    errors
  }
}

/**
 * Quick storage check for pre-generation validation
 * Fast validation that checks only critical prerequisites
 * NOTE: User is already authenticated by the calling API route - no need to re-authenticate
 */
export async function quickStorageCheck(userId: string): Promise<boolean> {
  try {
    // 1. Check environment variables (fast)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || 
        (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      console.error('❌ Quick storage check failed: Missing environment variables')
      return false
    }

    // 2. Validate userId format (user is already authenticated by API route)
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.error('❌ Quick storage check failed: Invalid userId provided')
      return false
    }

    // 3. Check bucket exists (fast)
    const bucketExists = await checkBucketExists('user-media')
    if (!bucketExists) {
      console.error('❌ Quick storage check failed: user-media bucket not accessible')
      return false
    }

    // 4. Quick write test to verify permissions (skip cleanup for speed)
    try {
      const testFile = new Blob(['quick-check'], { type: 'text/plain' })
      const testPath = `test/${userId}/quick-check-${Date.now()}.txt`
      
      const { error: uploadError } = await supabase.storage
        .from('user-media')
        .upload(testPath, testFile, { upsert: false })

      if (uploadError) {
        console.error('❌ Quick storage check failed: Write permission test failed', uploadError.message)
        return false
      }

      // Clean up immediately
      await supabase.storage.from('user-media').remove([testPath])
    } catch (writeError: any) {
      console.error('❌ Quick storage check failed: Write test exception', writeError.message)
      return false
    }

    console.log('✅ Quick storage check passed')
    return true
  } catch (error: any) {
    console.error('❌ Quick storage check exception:', error.message)
    return false
  }
}
