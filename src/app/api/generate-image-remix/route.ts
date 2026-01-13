import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { downloadAndStoreMedia, getServerSupabaseClient } from '@/lib/mediaStorage'
import { quickStorageCheck } from '@/lib/storageHealthCheck'

// Configure Fal AI client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Get authenticated user from request
 * In Next.js App Router, we need to extract the session from cookies or headers
 */
async function getAuthenticatedUser(request: NextRequest) {
  try {
    // Method 1: Check Authorization header (if frontend sends it)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        return user
      }
    }
    
    // Method 2: Extract from cookies
    // Supabase client-side stores session in localStorage, but cookies might be set by middleware
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Try to parse Supabase session from cookies
    // Supabase SSR pattern: sb-{project-ref}-auth-token
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
    const cookiePattern = new RegExp(`sb-${projectRef.replace(/[^a-z0-9]/gi, '')}-auth-token=([^;]+)`, 'i')
    const match = cookieHeader.match(cookiePattern) || cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/i)
    
    if (match && match[1]) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(match[1]))
        const accessToken = sessionData.access_token || sessionData.accessToken
        if (accessToken) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)
          const { data: { user }, error } = await supabase.auth.getUser(accessToken)
          if (user && !error) {
            return user
          }
        }
      } catch {
        // Cookie might be the token directly
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: { user }, error } = await supabase.auth.getUser(match[1])
        if (user && !error) {
          return user
        }
      }
    }
    
    // Method 3: Create client that can read cookies from request
    // This works if Supabase middleware sets cookies properly
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      },
    })
    
    const { data: { user }, error } = await supabase.auth.getUser()
    if (user && !error) {
      return user
    }
    
    return null
  } catch (error: any) {
    console.error('❌ Error getting authenticated user:', error.message)
    return null
  }
}

export async function POST(request: NextRequest) {
  // Declare mode at function scope so it's accessible in catch block
  let mode: string = 'remix'
  
  try {
    // Step 1: Authentication Check - get user from cookies/headers
    const user = await getAuthenticatedUser(request)
    if (!user) {
      console.error('❌ Image generation API: Authentication failed - no user found')
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User authentication required. Please log in.' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log(`✅ Image generation API: User authenticated (${userId.substring(0, 8)}...)`)
    // Parse and validate request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: 'Failed to parse request JSON' },
        { status: 400 }
      )
    }

    const {
      mode: requestMode = 'remix', // 'edit', 'remix', or 'text-to-image'
      prompt,
      reference_image_urls = [],
      aspect_ratio = '16:9',
      num_images = 1,
      seed,
      project_id,
      clip_id,
      imageModel = 'flux-2-pro' // New parameter for multi-model dispatching
    } = requestBody
    
    mode = requestMode

    // Step 2: Quick Storage Check (warning only, don't block generation)
    const storageReady = await quickStorageCheck(userId)
    if (!storageReady) {
      console.warn('⚠️ Image generation API: Storage check failed, but proceeding with generation.')
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured', details: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Sanitize inputs early
    const sanitizedPrompt = typeof prompt === 'string' ? prompt.trim() : ''
    const sanitizedReferenceUrls = Array.isArray(reference_image_urls)
      ? reference_image_urls
          .filter((url) => typeof url === 'string' && url.trim().length > 0)
          .map((url) => url.trim())
      : []

    // Validate aspect ratio
    const validAspectRatios = ['16:9', '9:16', '1:1']
    const aspectRatioFormatted = 
      typeof aspect_ratio === 'string' && validAspectRatios.includes(aspect_ratio)
        ? aspect_ratio
        : '16:9'

    // Build Fal AI input object based on mode and model
    let falInput: any = {
      aspect_ratio: aspectRatioFormatted,
    }
    
    let endpoint = ''

    // Model-Specific Dispatching Logic
    if (imageModel === 'nano-banana') {
      // Nano Banana Strategy: Hyper-fast, instruction-dense
      endpoint = 'fal-ai/nano-banana'
      falInput.prompt = sanitizedPrompt
      if (mode === 'remix' || mode === 'edit') {
        falInput.image_url = sanitizedReferenceUrls[0]
      }
    } else if (imageModel === 'reeve') {
      // Reeve Strategy: Naturalistic, story-driven
      endpoint = 'fal-ai/reve/text-to-image' // Defaulting to Reve for Reeve artistic style
      if (mode === 'remix') endpoint = 'fal-ai/reve/remix'
      
      falInput.prompt = sanitizedPrompt
      if (mode === 'remix') falInput.image_url = sanitizedReferenceUrls[0]
    } else {
      // Default / FLUX.2 Pro Strategy
      if (mode === 'text-to-image') {
        endpoint = 'fal-ai/flux-2-pro'
        falInput.prompt = sanitizedPrompt
    } else {
        // Use flux-2-pro/edit for remix and edit modes for best instruction following
      endpoint = 'fal-ai/flux-2-pro/edit'
        falInput.prompt = sanitizedPrompt
      if (sanitizedReferenceUrls.length > 0) {
          falInput.image_urls = sanitizedReferenceUrls.slice(0, 8)
          falInput.strength = 0.85 // Maintain high consistency
      }
      }
      falInput.num_inference_steps = 50
      falInput.guidance_scale = 9.0
    }

    // Call Fal AI
    console.log(`📤 Sending request to Fal AI (${endpoint}) [Model: ${imageModel}] with input:`, JSON.stringify(falInput, null, 2))
    
    const result = await fal.subscribe(endpoint as any, {
      input: falInput,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`🔄 Fal AI progress (${endpoint}):`, update.logs?.map((log: any) => log.message))
        }
      },
    })

    console.log(`📥 Fal AI (${endpoint}) response:`, JSON.stringify(result, null, 2))

    const imageUrl = result.data?.images?.[0]?.url || result.data?.image?.url || result.data?.url

    if (!imageUrl) {
      console.error('❌ No image URL in response. Full result:', result)
      throw new Error(`No image URL returned from Fal AI (${endpoint}). Response: ` + JSON.stringify(result.data))
    }

    console.log(`✅ Fal AI (${endpoint}) image generated:`, imageUrl)

    // Step 3: IMMEDIATE STORAGE (Industry Standard - store before returning)
    let finalImageUrl = imageUrl
    let storageSuccess = false
    let storagePath: string | null = null
    let storageBucket: string | null = null

    try {
      console.log(`📦 Storing image in Supabase Storage for user ${userId.substring(0, 8)}...`)
      
      // Get user's access token from Authorization header for RLS policy compliance
      // Industry Standard: Use user's token so auth.uid() works in RLS policies
      const authHeader = request.headers.get('authorization')
      const accessToken = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : undefined
      
      if (!accessToken) {
        console.warn('⚠️ No access token available - storage may fail RLS check')
      }
      
      const storageResult = await downloadAndStoreMedia(
        imageUrl, // Fal.ai temporary URL
        userId,
        'image',
        {
          projectId: project_id,
          clipId: clip_id,
          contentType: 'image/jpeg',
          accessToken,  // Pass user's access token for RLS compliance
        }
      )

      if (storageResult.success && storageResult.publicUrl) {
        finalImageUrl = storageResult.publicUrl
        storagePath = storageResult.storagePath || null
        storageBucket = storageResult.bucket || null
        storageSuccess = true

        console.log(`✅ Image stored in Supabase Storage:`, {
          storagePath,
          bucket: storageBucket,
          publicUrl: finalImageUrl.substring(0, 50) + '...'
        })

        // Step 4: Save metadata to database (only when storage succeeded)
        try {
          // Use authenticated client to respect RLS
          const authHeader = request.headers.get('authorization')
          const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
          const supabase = await getServerSupabaseClient(accessToken)
          
          const modelName = endpoint.replace('fal-ai/', '').replace(/\//g, '-')
          const { data: dbData, error: dbError } = await supabase
            .from('user_images')
            .insert({
              user_id: userId,
              image_url: finalImageUrl, // Supabase permanent URL
              storage_path: storagePath,
              storage_bucket: storageBucket,
              prompt: sanitizedPrompt || null,
              model: modelName,
              aspect_ratio: aspectRatioFormatted,
              project_id: project_id || null,
              clip_id: clip_id || null,
              metadata: {
                falRequestId: result.requestId,
                endpoint,
                mode,
              }
            })
            .select()
            .single()

          if (dbError) {
            console.error('❌ Failed to save image metadata to database:', dbError)
            // Continue - file is stored, just metadata failed
          } else {
            console.log(`✅ Image metadata saved to database:`, { imageId: dbData?.id })
          }
        } catch (dbException: any) {
          console.error('❌ Exception saving image metadata:', dbException)
          // Continue - file is stored, just metadata failed
        }
      } else {
        console.warn('⚠️ Storage failed, using Fal.ai URL as fallback:', {
          error: storageResult.error,
          errorCode: storageResult.errorCode,
          userId: userId.substring(0, 8),
          imageUrl: imageUrl.substring(0, 50) + '...'
        })
        // Continue with Fal.ai URL as fallback
      }
    } catch (storageException: any) {
      console.error('❌ Exception during storage:', {
        message: storageException.message,
        stack: storageException.stack?.substring(0, 200),
        userId: userId.substring(0, 8),
        imageUrl: imageUrl.substring(0, 50) + '...'
      })
      // Continue with Fal.ai URL as fallback
    }

    // Ensure image metadata is saved to user_images even if storage failed
    // This keeps the user's image library in sync, using Fal.ai URLs as a fallback.
    if (!storageSuccess) {
      try {
        console.log('📚 Saving image metadata to user_images with Fal.ai URL fallback...')
        
        // Use authenticated client to respect RLS
        const authHeader = request.headers.get('authorization')
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
        const supabase = await getServerSupabaseClient(accessToken)
        
        const modelName = endpoint.replace('fal-ai/', '').replace(/\//g, '-')

        const { data: dbData, error: dbError } = await supabase
          .from('user_images')
          .insert({
            user_id: userId,
            image_url: finalImageUrl, // Fal.ai URL (temporary) or Supabase URL if storage somehow succeeded
            storage_path: storagePath, // May be null if storage failed
            storage_bucket: storageBucket, // May be null if storage failed
            prompt: sanitizedPrompt || null,
            model: modelName,
            aspect_ratio: aspectRatioFormatted,
            project_id: project_id || null,
            clip_id: clip_id || null,
            metadata: {
              falRequestId: result.requestId,
              endpoint,
              mode,
              storageSuccess,
              storageError: storageSuccess ? null : 'Storage failed - using Fal.ai URL as fallback',
            }
          })
          .select()
          .single()

        if (dbError) {
          console.error('❌ Failed to save image metadata (fallback) to database:', dbError)
        } else {
          console.log(`✅ Image metadata saved to database (fallback):`, { imageId: dbData?.id })
        }
      } catch (fallbackDbException: any) {
        console.error('❌ Exception saving image metadata (fallback):', {
          message: fallbackDbException.message,
          stack: fallbackDbException.stack?.substring(0, 200),
        })
      }
    }

    // Return response with Supabase URL (or Fal.ai URL as fallback)
    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl, // Supabase URL if storage succeeded, Fal.ai URL otherwise
      storageSuccess, // Flag indicating if storage succeeded
      storagePath,
      storageBucket,
      fallbackUrl: !storageSuccess, // True if using Fal.ai URL as fallback
      model: endpoint.replace('fal-ai/', ''),
      endpoint,
      requestId: result.requestId,
      allImages: result.data?.images || [],
    })
  } catch (error: any) {
    const endpoint = mode === 'text-to-image'
      ? 'fal-ai/reve/text-to-image'
      : mode === 'remix'
        ? 'fal-ai/reve/remix'
        : 'fal-ai/flux-2-pro/edit'
    console.error(`❌ Fal AI (${endpoint}) Error:`, error)
    
    // Handle ValidationError specifically (422 status)
    if (error.name === 'ValidationError' || error.status === 422) {
      console.error('Validation Error Details:', {
        name: error.name,
        status: error.status,
        body: error.body,
        detail: error.body?.detail,
      })
      
      // Parse validation error details
      let validationDetails = 'Invalid request parameters'
      if (error.body?.detail) {
        if (Array.isArray(error.body.detail)) {
          const errors = error.body.detail.map((err: any) => {
            const loc = Array.isArray(err.loc) ? err.loc.join('.') : 'unknown'
            const msg = err.msg || 'validation error'
            return `${loc}: ${msg}`
          })
          validationDetails = errors.join('; ')
        } else if (typeof error.body.detail === 'string') {
          validationDetails = error.body.detail
        } else {
          validationDetails = JSON.stringify(error.body.detail)
        }
      }
      
      return NextResponse.json(
        {
          error: 'Validation Error: Invalid request parameters',
          details: validationDetails,
          model: 'flux-2-pro-edit',
          endpoint,
          hint: mode === 'text-to-image' 
            ? 'Check that prompt is provided. Reve text-to-image requires prompt and aspect_ratio.'
            : mode === 'remix'
              ? 'Check that prompt and image_url are provided. Reve remix requires both.'
              : 'Check that prompt or image_urls are provided. FLUX.2 Pro edit supports prompt-only (text-to-image) or image_urls (up to 10) for multi-image consistency.',
          statusCode: 422,
        },
        { status: 422 }
      )
    }
    
    // Handle other error types
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      status: error.status,
      code: error.code,
      body: error.body,
      response: error.response?.data,
      stack: error.stack?.substring(0, 500), // First 500 chars of stack
    })
    
    // Extract detailed error information
    let errorMessage = 'Failed to generate image'
    let errorDetails = error.message || 'Unknown error'
    
    // Try to extract Fal AI specific error from various possible locations
    if (error.body) {
      errorDetails = typeof error.body === 'string' 
        ? error.body 
        : JSON.stringify(error.body)
    } else if (error.response?.data) {
      errorDetails = JSON.stringify(error.response.data)
    } else if (error.details) {
      errorDetails = error.details
    } else if (typeof error === 'object' && error !== null) {
      // Try to serialize the error object
      try {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      } catch (e) {
        errorDetails = error.message || String(error)
      }
    }
    
    // Determine appropriate status code
    const statusCode = error.status || (error.name === 'ValidationError' ? 422 : 500)
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        model: mode === 'edit' ? 'flux-2-pro-edit' : mode === 'remix' ? 'reve-remix' : 'reve-text-to-image',
        endpoint,
        hint: 'Check console logs for more details. Common issues: invalid API key, missing required parameters, or unsupported parameter combination. FLUX.2 Pro edit supports prompt-only or up to 10 reference images for consistency.',
        statusCode,
      },
      { status: statusCode }
    )
  }
}

