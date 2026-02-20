import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Use service role key to bypass RLS if needed, but here we likely want user context
// However, in Next.js API routes, it's safer to use the service key and manually verify the user
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user using the token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('voice_characters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching voices:', error)
      return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
    }

    return NextResponse.json({ voices: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/user/voices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, provider_voice_id, preview_url, ref_text, provider } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    // fal-f5 uses preview_url as ref_audio_url; provider_voice_id can be placeholder if missing
    const effectiveProvider = provider || 'elevenlabs'
    const effectiveVoiceId = provider_voice_id || (effectiveProvider === 'fal-f5' ? crypto.randomUUID() : null)
    if (!effectiveVoiceId && effectiveProvider !== 'fal-f5') {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
    }
    if (effectiveProvider === 'fal-f5' && !preview_url) {
      return NextResponse.json({ error: 'preview_url (ref audio) is required for fal-f5' }, { status: 400 })
    }

    // Check limit (5 voices per user)
    const { count, error: countError } = await supabase
      .from('voice_characters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
       console.error('Error checking voice limit:', countError)
       return NextResponse.json({ error: 'Failed to check limit' }, { status: 500 })
    }

    if ((count || 0) >= 5) {
        return NextResponse.json({ error: 'Voice limit reached (max 5)' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('voice_characters')
      .insert({
        user_id: user.id,
        name,
        provider: effectiveProvider,
        provider_voice_id: effectiveVoiceId,
        preview_url: preview_url || null,
        ref_text: ref_text || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving voice:', error)
      return NextResponse.json({ error: 'Failed to save voice' }, { status: 500 })
    }

    return NextResponse.json({ voice: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/user/voices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        const authHeader = request.headers.get('authorization')
        if (!authHeader) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        
        if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await request.json()

        if (!id) {
            return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
        }

        // Also delete from ElevenLabs if possible, but for now just delete record
        // Ideally we should call ElevenLabs delete API here too to keep things clean

        const { error } = await supabase
            .from('voice_characters')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            console.error('Error deleting voice:', error)
            return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Error in DELETE /api/user/voices:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
