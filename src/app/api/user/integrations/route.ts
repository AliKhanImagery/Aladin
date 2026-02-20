import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const provider = request.nextUrl.searchParams.get('provider') || 'elevenlabs'

    const { data, error } = await supabase
      .from('user_integrations')
      .select('id, provider, name, created_at')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Integrations GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    return NextResponse.json({
      connected: data && data.length > 0,
      connections: data || [],
      provider,
    })
  } catch (e: any) {
    console.error('Integrations GET:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { provider = 'elevenlabs', api_key, name } = body

    const key = typeof api_key === 'string' ? api_key.trim() : ''
    if (!key) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

    // Check limit
    const { count, error: countError } = await supabase
      .from('user_integrations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (countError) {
      return NextResponse.json({ error: 'Failed to check limit' }, { status: 500 })
    }

    if (count !== null && count >= 5) {
      return NextResponse.json({ error: 'Maximum 5 connections allowed per provider' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('user_integrations')
      .insert({
        user_id: user.id,
        provider,
        api_key: key,
        name: name || `Account ${(count || 0) + 1}`,
        updated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Integrations POST error:', insertError)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true, connected: true })
  } catch (e: any) {
    console.error('Integrations POST:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, name, api_key } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updates: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (api_key) updates.api_key = api_key.trim()

    const { error: updateError } = await supabase
      .from('user_integrations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Integrations PUT error:', updateError)
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Integrations PUT:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const provider = request.nextUrl.searchParams.get('provider') || 'elevenlabs'
    const id = request.nextUrl.searchParams.get('id')

    let query = supabase.from('user_integrations').delete().eq('user_id', user.id)

    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('provider', provider)
    }

    const { error } = await query

    if (error) {
      console.error('Integrations DELETE error:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true, connected: false })
  } catch (e: any) {
    console.error('Integrations DELETE:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
