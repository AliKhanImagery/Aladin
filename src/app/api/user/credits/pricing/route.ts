import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabaseClient } from '@/lib/mediaStorage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getAuthenticatedUserAndToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) return { user, accessToken: token }
  }
  const cookieHeader = request.headers.get('cookie') || ''
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
  const cookiePattern = new RegExp(`sb-${projectRef.replace(/[^a-z0-9]/gi, '')}-auth-token=([^;]+)`, 'i')
  const match = cookieHeader.match(cookiePattern) || cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/i)
  if (match?.[1]) {
    let token = match[1]
    try {
      const sessionData = JSON.parse(decodeURIComponent(match[1]))
      token = sessionData.access_token || sessionData.accessToken || token
    } catch { /* token as-is */ }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) return { user, accessToken: token }
  }
  return { user: null, accessToken: null }
}

export async function GET(request: NextRequest) {
  try {
    const { user, accessToken } = await getAuthenticatedUserAndToken(request)
    if (!user || !accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User authentication required' },
        { status: 401 }
      )
    }
    const supabase = await getServerSupabaseClient(accessToken)
    const { data: rows, error } = await supabase
      .from('credit_pricing')
      .select('key, cost')
      .eq('active', true)
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch pricing', details: error.message },
        { status: 500 }
      )
    }
    const pricing: Record<string, number> = {}
    for (const row of rows || []) {
      pricing[row.key] = Number(row.cost)
    }
    return NextResponse.json({ pricing })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch pricing', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
