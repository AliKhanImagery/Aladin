import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET - Fetch user assets
export async function GET(request: NextRequest) {
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

    // Query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const projectId = searchParams.get('project_id')

    // Build query
    let query = supabase
      .from('user_assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
    }

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user assets:', error)
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
    }

    return NextResponse.json({ assets: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/user/assets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save new asset
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
    const { 
      name, 
      type, 
      asset_url, 
      storage_path, 
      storage_bucket, 
      description, 
      prompt, 
      project_id, 
      metadata 
    } = body

    if (!name || !type || !asset_url) {
      return NextResponse.json({ error: 'name, type, and asset_url are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_assets')
      .insert({
        user_id: user.id,
        name,
        type,
        asset_url,
        storage_path: storage_path || null,
        storage_bucket: storage_bucket || 'user-media',
        description: description || null,
        prompt: prompt || null,
        project_id: project_id || null,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving user asset:', error)
      return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 })
    }

    return NextResponse.json({ asset: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/user/assets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
