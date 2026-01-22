import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabaseClient } from '@/lib/mediaStorage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getAuthenticatedUserAndToken(request: NextRequest) {
  // 1) Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (user && !error) return { user, accessToken: token }
  }

  // 2) Supabase cookie fallback (sb-<ref>-auth-token)
  const cookieHeader = request.headers.get('cookie') || ''
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
  const cookiePattern = new RegExp(
    `sb-${projectRef.replace(/[^a-z0-9]/gi, '')}-auth-token=([^;]+)`,
    'i'
  )
  const match =
    cookieHeader.match(cookiePattern) || cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/i)

  if (match?.[1]) {
    let token = match[1]
    try {
      const sessionData = JSON.parse(decodeURIComponent(match[1]))
      token = sessionData.access_token || sessionData.accessToken || token
    } catch {
      // token is already raw
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
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

    const { data: balance, error: balanceError } = await supabase.rpc('get_my_credit_balance')
    if (balanceError) {
      return NextResponse.json(
        { error: 'Failed to fetch credit balance', details: balanceError.message },
        { status: 500 }
      )
    }

    const { data: ledger, error: ledgerError } = await supabase
      .from('credit_ledger')
      .select('id, delta, reason, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(25)

    if (ledgerError) {
      return NextResponse.json(
        { error: 'Failed to fetch credit ledger', details: ledgerError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      balance: typeof balance === 'number' ? balance : Number(balance),
      ledger: ledger || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch credits', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

