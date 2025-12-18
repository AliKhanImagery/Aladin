import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET - Fetch user images
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
      .from('user_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user images:', error)
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    return NextResponse.json({ images: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/user/images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save new image
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
    const { image_url, prompt, model, aspect_ratio, project_id, clip_id, metadata } = body

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        image_url,
        prompt: prompt || null,
        model: model || null,
        aspect_ratio: aspect_ratio || null,
        project_id: project_id || null,
        clip_id: clip_id || null,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving user image:', error)
      return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
    }

    return NextResponse.json({ image: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/user/images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

