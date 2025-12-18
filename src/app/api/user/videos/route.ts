import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET - Fetch user videos
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from Authorization header or session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const projectId = searchParams.get('project_id')

    // Build query
    let query = supabase
      .from('user_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user videos:', error)
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
    }

    return NextResponse.json({ videos: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/user/videos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save new video
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from Authorization header
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
    const { video_url, prompt, model, duration, aspect_ratio, project_id, clip_id, thumbnail_url, metadata } = body

    if (!video_url) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_videos')
      .insert({
        user_id: user.id,
        video_url,
        prompt: prompt || null,
        model: model || null,
        duration: duration || null,
        aspect_ratio: aspect_ratio || null,
        project_id: project_id || null,
        clip_id: clip_id || null,
        thumbnail_url: thumbnail_url || null,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving user video:', error)
      return NextResponse.json({ error: 'Failed to save video' }, { status: 500 })
    }

    return NextResponse.json({ video: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/user/videos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

