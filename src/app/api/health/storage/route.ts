/**
 * Storage Health Check API Endpoint
 * 
 * GET /api/health/storage
 * 
 * Returns comprehensive health status of storage system
 * Use for pre-deployment verification, monitoring, and debugging
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateStorageHealth } from '@/lib/storageHealthCheck'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Try to get user from request (optional - can check without user)
    let userId: string | undefined

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Try to get user from auth header or cookie
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          userId = user.id
        }
      } else {
        // Try from session
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
        }
      }
    } catch (authError) {
      // Continue without userId - health check can still run
      console.warn('⚠️ Could not get user for health check:', authError)
    }

    // Run comprehensive health check
    const healthStatus = await validateStorageHealth(userId)

    // Return health status
    return NextResponse.json(healthStatus, {
      status: healthStatus.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('❌ Health check API error:', error)
    return NextResponse.json(
      {
        healthy: false,
        error: 'Health check failed',
        details: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
