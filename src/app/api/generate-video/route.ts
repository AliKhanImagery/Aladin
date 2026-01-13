import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { downloadAndStoreMedia, getServerSupabaseClient } from '@/lib/mediaStorage'
import { quickStorageCheck } from '@/lib/storageHealthCheck'

// Configure Fal AI client
if (process.env.FAL_KEY) {
  try {
    fal.config({
      credentials: process.env.FAL_KEY,
    })
    console.log('✅ Fal AI client configured successfully')
  } catch (configError: any) {
    console.error('❌ Failed to configure Fal AI client:', configError)
  }
} else {
  console.warn('⚠️ FAL_KEY environment variable not set')
}

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Get authenticated user from request
 */
async function getAuthenticatedUser(request: NextRequest) {
  try {
    // Check Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user && !error) {
        return user
      }
    }
    
    // Try cookies as fallback
    const cookieHeader = request.headers.get('cookie') || ''
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
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: { user }, error } = await supabase.auth.getUser(match[1])
        if (user && !error) {
          return user
        }
      }
    }
    
    return null
  } catch (error: any) {
    console.error('❌ Error getting authenticated user:', error.message)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 /api/generate-video: Request received')
    
    // Step 1: Authentication Check
    const user = await getAuthenticatedUser(request)
    if (!user) {
      console.error('❌ Video generation API: Authentication failed - no user found')
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User authentication required. Please log in.' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log(`✅ Video generation API: User authenticated (${userId.substring(0, 8)}...)`)
    
    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await request.json()
      console.log('🎬 /api/generate-video: Request body parsed', {
        hasPrompt: !!requestBody.prompt,
        promptLength: requestBody.prompt?.length || 0,
        hasImageUrl: !!requestBody.image_url,
        imageUrlPreview: requestBody.image_url ? requestBody.image_url.substring(0, 100) : 'none',
        duration: requestBody.duration,
        videoModel: requestBody.videoModel,
        aspectRatio: requestBody.aspect_ratio,
      })
    } catch (parseError: any) {
      console.error('❌ Failed to parse request body:', parseError)
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: 'Request body must be valid JSON',
          parseError: parseError.message,
        },
        { status: 400 }
      )
    }

    const {
      prompt,
      duration = 4,
      resolution = '720p',
      reference_image_urls = [],
      image_url,
      aspect_ratio = '16:9',
      movement_amplitude = 'auto',
      seed,
      videoModel = 'vidu', // 'vidu' or 'kling'
      project_id,
      clip_id,
    } = requestBody

    // Step 2: Quick Storage Check (before generation to prevent wasted API calls)
    // IMPORTANT: This should be a warning only, not a hard error, so video generation still works.
    const storageReady = await quickStorageCheck(userId)
    if (!storageReady) {
      console.error('❌ Video generation API: Storage system not fully ready')
      console.warn('⚠️ Proceeding with generation. Videos may fall back to Fal.ai URLs if storage fails.')
      // Do NOT return here - let generation proceed and handle storage errors gracefully.
    } else {
      console.log('✅ Storage system ready - videos will be stored in Supabase Storage when possible')
    }

    console.log('🎬 /api/generate-video: Extracted parameters', {
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      duration,
      resolution,
      hasImageUrl: !!image_url,
      hasReferenceImages: reference_image_urls.length > 0,
      aspectRatio: aspect_ratio,
      videoModel,
    })

    if (!prompt || !prompt.trim()) {
      console.error('❌ /api/generate-video: Missing prompt')
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.FAL_KEY) {
      console.error('❌ /api/generate-video: FAL_KEY not configured')
      return NextResponse.json(
        { error: 'FAL_KEY not configured', details: 'Server configuration error - FAL_KEY environment variable is missing' },
        { status: 500 }
      )
    }
    
    console.log('✅ /api/generate-video: FAL_KEY is configured')

    // Validate image_url format if provided
    if (image_url) {
      try {
        const imageUrlObj = new URL(image_url)
        console.log('✅ /api/generate-video: Image URL is valid', {
          protocol: imageUrlObj.protocol,
          hostname: imageUrlObj.hostname,
          pathname: imageUrlObj.pathname.substring(0, 50),
        })
      } catch (e) {
        console.error('❌ /api/generate-video: Invalid image_url format', {
          image_url: image_url?.substring(0, 100),
          error: e,
        })
        return NextResponse.json(
          { error: 'Invalid image_url format. Must be a valid URL.', details: String(e) },
          { status: 400 }
        )
      }
    }

    console.log('🎬 Generating video with Fal AI:', {
      model: videoModel,
      prompt: prompt.substring(0, 50) + '...',
      duration,
      resolution,
      hasReferenceImages: reference_image_urls.length > 0,
      hasImage: !!image_url,
      imageUrl: image_url ? image_url.substring(0, 100) : 'none',
    })

    let result

    // Use Kling model if specified
    if (videoModel === 'kling') {
      console.log('Using Kling v1.6 Standard Elements model')
      
      // Validate and prepare Kling input parameters
      // Based on Fal AI Kling v1.6 Standard Elements API documentation:
      // https://fal.ai/models/fal-ai/kling-video/v1.6/standard/elements/api
      // 
      // Required parameters:
      // - prompt: string (required)
      // - input_image_urls: list<string> (required, up to 4 images)
      //
      // Optional parameters:
      // - duration: "5" | "10" (default: "5")
      // - aspect_ratio: "16:9" | "9:16" | "1:1" (default: "16:9")
      // - negative_prompt: string (default: "blur, distort, and low quality")
      const klingInput: any = {
        prompt: prompt.trim(),
      }

      // input_image_urls is REQUIRED (list<string>, up to 4 images)
      // This endpoint is specifically for multi-image-to-video generation
      // We MUST provide at least one image URL
      if (!image_url || !image_url.trim()) {
        return NextResponse.json(
          {
            error: 'Image URL required for Kling 1.6 Elements',
            details: 'Kling 1.6 Standard Elements requires at least one image URL in input_image_urls array. This endpoint generates videos from multiple input images (up to 4).',
            hint: 'Please generate or upload an image first, or provide an image URL.',
          },
          { status: 400 }
        )
      }

      // input_image_urls must be an array of strings (up to 4 images)
      klingInput.input_image_urls = [image_url.trim()]

      // Duration - Must be string enum: "5" or "10" (default: "5")
      let durationValue: number
      if (typeof duration === 'number') {
        durationValue = Math.floor(duration)
      } else if (typeof duration === 'string') {
        const numMatch = duration.match(/(\d+)/)
        durationValue = numMatch ? parseInt(numMatch[1], 10) : 5
      } else {
        durationValue = 5
      }
      
      // Clamp to valid enum values: only "5" or "10"
      if (durationValue <= 5) {
        durationValue = 5
      } else if (durationValue <= 10) {
        durationValue = 10
      } else {
        durationValue = 10 // Max is 10
      }
      
      klingInput.duration = durationValue.toString() // Must be string: "5" or "10"

      // Aspect ratio - Must be string enum: "16:9", "9:16", or "1:1" (default: "16:9")
      if (aspect_ratio && (aspect_ratio === '16:9' || aspect_ratio === '9:16' || aspect_ratio === '1:1')) {
        klingInput.aspect_ratio = aspect_ratio
      } else {
        klingInput.aspect_ratio = '16:9' // Default
      }

      // Optional: negative_prompt (default: "blur, distort, and low quality")
      // We don't send this unless explicitly provided
      
      // Note: According to the API schema, there is NO 'seed' parameter for this endpoint
      // So we remove it if we were going to send it

      console.log('🎬 Kling input parameters:', JSON.stringify(klingInput, null, 2))
      console.log('🎬 Kling input summary:', {
        hasPrompt: !!klingInput.prompt,
        promptLength: klingInput.prompt?.length,
        aspectRatio: klingInput.aspect_ratio,
        length: klingInput.length,
        hasImage: !!klingInput.image,
        hasSeed: klingInput.seed !== undefined,
      })

      try {
        // Log the exact input we're sending
        console.log('📤 Sending Kling request:', {
          endpoint: 'fal-ai/kling-video/v1.6/standard/elements',
          input: JSON.stringify(klingInput, null, 2),
          inputKeys: Object.keys(klingInput),
          inputTypes: Object.fromEntries(
            Object.entries(klingInput).map(([key, value]) => [key, typeof value])
          ),
        })

        // Try the Kling endpoint
        try {
          result = await fal.subscribe('fal-ai/kling-video/v1.6/standard/elements', {
            input: klingInput,
            logs: true,
            onQueueUpdate: (update: any) => {
              if (update.status === 'IN_PROGRESS') {
                console.log('🔄 Kling progress:', update.logs?.map((log: any) => log.message))
              } else if (update.status === 'FAILED' || update.status === 'ERROR') {
                console.error('❌ Kling queue update shows failure:', {
                  status: update.status,
                  logs: update.logs,
                  error: update.error,
                  fullUpdate: JSON.stringify(update, null, 2),
                })
              }
            },
          })
        } catch (subscribeError: any) {
          // Wrap the error to add more context
          console.error('❌ Fal AI subscribe() threw error:', subscribeError)
          console.error('❌ Subscribe error type:', typeof subscribeError)
          console.error('❌ Subscribe error keys:', Object.keys(subscribeError || {}))
          throw subscribeError
        }
        
        console.log('✅ Kling response received:', {
          hasData: !!result.data,
          keys: result.data ? Object.keys(result.data) : [],
          fullResultKeys: Object.keys(result),
          resultStructure: JSON.stringify(result, null, 2).substring(0, 500),
        })
        
        // Check if result has video in different possible structures
        if (!result.data && !(result as any).url) {
          console.warn('⚠️ Kling response structure unexpected:', {
            resultType: typeof result,
            resultKeys: Object.keys(result || {}),
            fullResult: JSON.stringify(result, null, 2).substring(0, 1000),
          })
        }
      } catch (klingError: any) {
        // Comprehensive error logging - try to get the actual validation error
        // First, log the raw error to see its structure
        console.error('❌ Kling raw error object:', klingError)
        console.error('❌ Kling error type:', typeof klingError)
        console.error('❌ Kling error keys:', Object.keys(klingError || {}))
        
        const errorDetails: any = {
          message: klingError.message,
          status: klingError.status,
          statusCode: klingError.statusCode,
          code: klingError.code,
          name: klingError.name,
          details: klingError.details,
          error: klingError.error,
          response: klingError.response,
        }
        
        // Try to get response body as text first (might be string)
        if (klingError.response) {
          try {
            // If response has a body that's already parsed
            if (klingError.response.data) {
              errorDetails.responseDataRaw = JSON.stringify(klingError.response.data, null, 2)
            }
            // If response has a body property
            if (klingError.response.body) {
              errorDetails.responseBodyRaw = typeof klingError.response.body === 'string' 
                ? klingError.response.body 
                : JSON.stringify(klingError.response.body, null, 2)
            }
          } catch (e) {
            console.error('Error parsing response body:', e)
          }
        }

        // Try to extract validation errors from Fal AI response
        if (klingError.response) {
          if (klingError.response.data) {
            errorDetails.responseData = klingError.response.data
          }
          if (klingError.response.body) {
            errorDetails.responseBody = typeof klingError.response.body === 'string'
              ? klingError.response.body
              : JSON.stringify(klingError.response.body)
          }
          if (klingError.response.status) {
            errorDetails.responseStatus = klingError.response.status
          }
          if (klingError.response.statusText) {
            errorDetails.responseStatusText = klingError.response.statusText
          }
        }
        if (klingError.body) {
          errorDetails.body = typeof klingError.body === 'string' 
            ? klingError.body 
            : JSON.stringify(klingError.body)
        }

        // Check for FalError-specific fields
        if (klingError.falError) {
          errorDetails.falError = klingError.falError
        }
        if (klingError.detail) {
          errorDetails.detail = klingError.detail
        }
        if (klingError.errors) {
          errorDetails.errors = klingError.errors
        }

        // Try to stringify the full error for debugging
        try {
          errorDetails.fullErrorString = JSON.stringify(klingError, Object.getOwnPropertyNames(klingError), 2).substring(0, 3000)
        } catch (e) {
          errorDetails.fullErrorString = 'Could not stringify error'
        }

        // Log everything for debugging
        console.error('❌ Kling error - Complete Error Details:', JSON.stringify(errorDetails, null, 2))
        console.error('❌ Kling error - Request that failed:', JSON.stringify({
          endpoint: 'fal-ai/kling-video/v1.6/standard/elements',
          input: klingInput,
        }, null, 2))

        // Extract error message with priority on validation errors
        let errorMsg = 'Kling video generation failed'
        
        // Check multiple error sources in priority order
        // 1. Check response.data.detail (most common Fal AI format)
        if (klingError.response?.data?.detail) {
          const detail = klingError.response.data.detail
          if (typeof detail === 'string') {
            errorMsg = `Kling API validation error: ${detail}`
          } else if (Array.isArray(detail)) {
            const validationErrors = detail.map((err: any) => 
              err.msg || err.message || err.loc?.join('.') || JSON.stringify(err)
            ).join(', ')
            errorMsg = `Kling API validation errors: ${validationErrors}`
          } else if (detail.msg || detail.message) {
            errorMsg = `Kling API validation error: ${detail.msg || detail.message}`
          } else {
            errorMsg = `Kling API error: ${JSON.stringify(detail).substring(0, 500)}`
          }
        }
        // 2. Check response.body (might be string or JSON)
        else if (klingError.response?.body) {
          const body = klingError.response.body
          if (typeof body === 'string') {
            try {
              const parsed = JSON.parse(body)
              if (parsed.detail || parsed.message || parsed.error) {
                errorMsg = `Kling API error: ${parsed.detail || parsed.message || parsed.error}`
              } else {
                errorMsg = `Kling API error: ${body.substring(0, 500)}`
              }
            } catch {
              errorMsg = `Kling API error: ${body.substring(0, 500)}`
            }
          } else if (body.detail || body.message) {
            errorMsg = `Kling API error: ${body.detail || body.message}`
          }
        }
        // 3. Check error.detail directly
        else if (klingError.detail) {
          errorMsg = typeof klingError.detail === 'string'
            ? `Kling API error: ${klingError.detail}`
            : `Kling API error: ${JSON.stringify(klingError.detail).substring(0, 500)}`
        }
        // 4. Check error.errors (array of validation errors)
        else if (klingError.errors && Array.isArray(klingError.errors)) {
          const errors = klingError.errors.map((err: any) => 
            err.msg || err.message || JSON.stringify(err)
          ).join(', ')
          errorMsg = `Kling API validation errors: ${errors}`
        }
        // 5. Check standard error message fields
        else if (klingError?.message) {
          errorMsg = klingError.message
        } else if (klingError?.error?.message) {
          errorMsg = klingError.error.message
        } else if (klingError?.response?.error?.message) {
          errorMsg = klingError.response.error.message
        } else if (klingError?.response?.error) {
          errorMsg = typeof klingError.response.error === 'string' 
            ? klingError.response.error 
            : JSON.stringify(klingError.response.error).substring(0, 500)
        } else if (klingError?.details) {
          errorMsg = typeof klingError.details === 'string'
            ? klingError.details
            : JSON.stringify(klingError.details).substring(0, 500)
        } else if (klingError.statusCode === 422 || klingError.status === 422) {
          errorMsg = 'Kling API validation error: Unprocessable Entity. Check server logs for detailed validation errors.'
        }

        // Add context about what was sent
        errorMsg += ` (Input: prompt="${prompt.substring(0, 50)}...", aspect_ratio="${aspect_ratio}", length="${klingInput.length}", has_image=${!!klingInput.image})`

        // Try to extract the most useful error message for the user
        // If we got a validation error, use that
        const validationMsg = errorDetails.responseDataRaw || errorDetails.responseBodyRaw || errorDetails.fullErrorString
        if (validationMsg && validationMsg.length > 0) {
          console.error('📋 Extracted validation message:', validationMsg.substring(0, 1000))
        }

        // Create a more detailed error with all available info
        const enhancedError: any = new Error(errorMsg)
        enhancedError.falAiDetails = errorDetails
        enhancedError.klingInput = klingInput
        enhancedError.originalError = klingError
        enhancedError.validationMessage = validationMsg
        
        throw enhancedError
      }
    } else {
      // Use Vidu models (default behavior)
      // Determine which Vidu model to use
      if (image_url) {
        // Image-to-Video: Start from an existing image
        console.log('🎬 /api/generate-video: Using Q2 Image-to-Video model', {
          imageUrl: image_url.substring(0, 100),
          promptLength: prompt.length,
          duration: duration.toString(),
          resolution,
        })
        
        // Vidu Q2 Image-to-Video endpoint parameters
        // Based on Fal AI docs: prompt, image_url, duration, resolution, movement_amplitude are required
        // Note: aspect_ratio is NOT supported by Q2 image-to-video (it uses the image's aspect ratio)
        const viduInput: any = {
          prompt: prompt.trim(),
          image_url: image_url.trim(),
          duration: duration.toString(),
          resolution: resolution as '720p' | '1080p',
        }
        
        // movement_amplitude: 'auto' | 'low' | 'medium' | 'high'
        // Only add if it's a valid value
        if (movement_amplitude && ['auto', 'low', 'medium', 'high'].includes(movement_amplitude)) {
          viduInput.movement_amplitude = movement_amplitude
        } else {
          viduInput.movement_amplitude = 'auto' // Default
        }
        
        // Add seed if provided (optional)
        if (seed !== undefined && seed !== null) {
          viduInput.seed = seed
        }
        
        // Note: aspect_ratio is NOT supported by Q2 image-to-video endpoint
        // The aspect ratio is determined by the input image
        
        console.log('🎬 /api/generate-video: Vidu input prepared', {
          hasPrompt: !!viduInput.prompt,
          hasImageUrl: !!viduInput.image_url,
          duration: viduInput.duration,
          resolution: viduInput.resolution,
          inputKeys: Object.keys(viduInput),
        })
        
        try {
          console.log('🎬 /api/generate-video: Calling fal.subscribe...')
          result = await fal.subscribe('fal-ai/vidu/q2-image-to-video', {
            input: viduInput,
            logs: true,
            onQueueUpdate: (update: any) => {
              if (update.status === 'IN_PROGRESS') {
                console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
              } else if (update.status === 'FAILED' || update.status === 'ERROR') {
                console.error('❌ Fal AI queue update shows failure:', update)
              }
            },
          })
          
          console.log('✅ Fal AI Q2 Image-to-Video response received:', {
            hasData: !!result.data,
            hasVideo: !!result.data?.video,
            keys: result.data ? Object.keys(result.data) : [],
            fullResultKeys: Object.keys(result),
            resultType: typeof result,
          })
          
          // Log full result structure for debugging
          if (!result.data?.video?.url) {
            console.warn('⚠️ No video URL in expected location. Full result:', JSON.stringify(result, null, 2).substring(0, 1000))
          }
        } catch (falError: any) {
          // Comprehensive error logging - capture everything
          console.error('❌ /api/generate-video: Fal AI Q2 Image-to-Video error caught')
          console.error('❌ Error type:', typeof falError)
          console.error('❌ Error constructor:', falError?.constructor?.name)
          console.error('❌ Error name:', falError?.name)
          console.error('❌ Error message:', falError?.message)
          
          const errorInfo: any = {
            message: falError.message,
            status: falError.status,
            statusCode: falError.statusCode,
            code: falError.code,
            name: falError.name,
            details: falError.details,
            error: falError.error,
            response: falError.response,
          }
          
          // Try to extract response body if available
          if (falError.response) {
            try {
              if (falError.response.data) {
                errorInfo.responseData = typeof falError.response.data === 'string' 
                  ? falError.response.data 
                  : JSON.stringify(falError.response.data, null, 2)
              }
              if (falError.response.body) {
                errorInfo.responseBody = typeof falError.response.body === 'string'
                  ? falError.response.body
                  : JSON.stringify(falError.response.body, null, 2)
              }
            } catch (e) {
              console.error('❌ Error parsing response:', e)
            }
          }
          
          // Try to stringify the entire error object
          try {
            errorInfo.fullErrorString = JSON.stringify(falError, Object.getOwnPropertyNames(falError), 2).substring(0, 3000)
          } catch (e) {
            errorInfo.fullErrorString = 'Could not stringify error'
          }
          
          console.error('❌ Fal AI Q2 Image-to-Video error - Complete Error Info:', JSON.stringify(errorInfo, null, 2))
          console.error('❌ Vidu input that failed:', JSON.stringify(viduInput, null, 2))
          
          // Try multiple strategies to extract error message
          let errorMsg: string | null = null
          
          // Strategy 1: Direct message
          if (falError?.message && typeof falError.message === 'string' && falError.message.trim()) {
            errorMsg = falError.message.trim()
          }
          
          // Strategy 2: Error object message
          if (!errorMsg && falError?.error) {
            if (typeof falError.error === 'string') {
              errorMsg = falError.error
            } else if (falError.error?.message) {
              errorMsg = falError.error.message
            } else if (falError.error?.detail) {
              errorMsg = falError.error.detail
            }
          }
          
          // Strategy 3: Response error
          if (!errorMsg && falError?.response) {
            if (falError.response?.error) {
              if (typeof falError.response.error === 'string') {
                errorMsg = falError.response.error
              } else if (falError.response.error?.message) {
                errorMsg = falError.response.error.message
              } else if (falError.response.error?.detail) {
                errorMsg = falError.response.error.detail
              }
            } else if (falError.response?.data) {
              if (typeof falError.response.data === 'string') {
                errorMsg = falError.response.data
              } else if (falError.response.data?.error) {
                errorMsg = falError.response.data.error
              } else if (falError.response.data?.message) {
                errorMsg = falError.response.data.message
              }
            }
          }
          
          // Strategy 4: Details field
          if (!errorMsg && falError?.details) {
            if (typeof falError.details === 'string') {
              errorMsg = falError.details
            } else if (typeof falError.details === 'object') {
              errorMsg = JSON.stringify(falError.details).substring(0, 500)
            }
          }
          
          // Strategy 5: Status code with generic message
          if (!errorMsg) {
            const statusInfo = falError.status || falError.statusCode
            errorMsg = statusInfo 
              ? `Fal AI API error (status: ${statusInfo})`
              : 'Fal AI image-to-video generation failed - unknown error'
          }
          
          // Add additional context
          if (image_url) {
            const urlPreview = image_url.length > 100 ? image_url.substring(0, 100) + '...' : image_url
            errorMsg += ` | Image URL: ${urlPreview}`
          }
          
          // Re-throw the error with enhanced information so it's caught by outer catch
          const enhancedError: any = new Error(errorMsg)
          enhancedError.originalError = falError
          enhancedError.errorInfo = errorInfo
          enhancedError.viduInput = viduInput
          enhancedError.status = falError?.status || falError?.statusCode || 500
          enhancedError.statusCode = falError?.statusCode || falError?.status || 500
          
          throw enhancedError
        }
      } else if (reference_image_urls.length > 0) {
        // Reference-to-Video: Use reference images for consistent characters
        console.log('Using Q1 Reference-to-Video model')
        result = await fal.subscribe('fal-ai/vidu/q1-reference-to-video', {
          input: {
            prompt: prompt,
            reference_image_urls: reference_image_urls,
            aspect_ratio: aspect_ratio,
            movement_amplitude: movement_amplitude,
            ...(seed && { seed }),
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
            }
          },
        })
      } else {
        // Text-to-Video: Pure text prompt
        console.log('Using Q2 Text-to-Video model')
        result = await fal.subscribe('fal-ai/vidu/q2-text-to-video', {
          input: {
            prompt: prompt,
            duration: duration.toString(),
            resolution: resolution as '720p' | '1080p',
            movement_amplitude: movement_amplitude,
            ...(seed && { seed }),
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
            }
          },
        })
      }
    }

    // Check multiple possible response structures from Fal AI (for both Kling and Vidu)
    const videoUrl = result?.data?.video?.url || 
                    (result as any)?.video?.url || 
                    result?.data?.url || 
                    (result as any)?.url ||
                    (result as any)?.video_url ||
                    (result?.data && typeof result.data === 'object' && (result.data as any)?.video?.url)

    if (!videoUrl) {
      const resultKeys = result ? Object.keys(result) : []
      const dataKeys = result?.data && typeof result.data === 'object' ? Object.keys(result.data) : []
      const resultPreview = result ? JSON.stringify(result, null, 2).substring(0, 1000) : 'null'
      
      console.error('❌ No video URL in Fal AI response:', {
        resultKeys,
        dataKeys,
        resultType: typeof result,
        hasResult: !!result,
        hasData: !!result?.data,
        fullResult: resultPreview,
      })
      
      throw new Error(
        `No video URL returned from Fal AI. ` +
        `Response has keys: ${resultKeys.join(', ')}. ` +
        `Data keys: ${dataKeys.join(', ')}. ` +
        `Please check server logs for full response structure.`
      )
    }

    console.log('✅ Fal AI video generated:', videoUrl)

    // Step 3: IMMEDIATE STORAGE (Industry Standard - store before returning)
    let finalVideoUrl = videoUrl
    let storageSuccess = false
    let storagePath: string | null = null
    let storageBucket: string | null = null
    let finalThumbnailUrl: string | null = null

    try {
      console.log(`📦 Storing video in Supabase Storage for user ${userId.substring(0, 8)}...`)
      
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
        videoUrl, // Fal.ai temporary URL
        userId,
        'video',
        {
          projectId: project_id,
          clipId: clip_id,
          contentType: 'video/mp4',
          accessToken,  // Pass user's access token for RLS compliance
        }
      )

      if (storageResult.success && storageResult.publicUrl) {
        finalVideoUrl = storageResult.publicUrl
        storagePath = storageResult.storagePath || null
        storageBucket = storageResult.bucket || null
        storageSuccess = true

        console.log(`✅ Video stored in Supabase Storage:`, {
          storagePath,
          bucket: storageBucket,
          publicUrl: finalVideoUrl.substring(0, 50) + '...'
        })

        // Step 4: Save metadata to database (only when storage succeeded)
        try {
          // Use authenticated client to respect RLS
          const authHeader = request.headers.get('authorization')
          const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
          const supabase = await getServerSupabaseClient(accessToken)
          
          let modelName = 'fal-ai-vidu-text-to-video'
          if (videoModel === 'kling') {
            modelName = 'fal-ai-kling-v1.6-standard-elements'
          } else if (reference_image_urls.length > 0) {
            modelName = 'fal-ai-vidu-reference-to-video'
          } else if (image_url) {
            modelName = 'fal-ai-vidu-image-to-video'
          }

          const { data: dbData, error: dbError } = await supabase
            .from('user_videos')
            .insert({
              user_id: userId,
              video_url: finalVideoUrl, // Supabase permanent URL
              storage_path: storagePath,
              storage_bucket: storageBucket,
              prompt: prompt || null,
              model: modelName,
              duration: result.data?.duration || duration || null,
              aspect_ratio: aspect_ratio || null,
              thumbnail_url: finalThumbnailUrl,
              project_id: project_id || null,
              clip_id: clip_id || null,
              metadata: {
                falRequestId: result.requestId,
                videoModel,
                resolution,
              }
            })
            .select()
            .single()

          if (dbError) {
            console.error('❌ Failed to save video metadata to database:', dbError)
            // Continue - file is stored, just metadata failed
          } else {
            console.log(`✅ Video metadata saved to database:`, { videoId: dbData?.id })
          }
        } catch (dbException: any) {
          console.error('❌ Exception saving video metadata:', dbException)
          // Continue - file is stored, just metadata failed
        }
      } else {
        console.warn('⚠️ Storage failed, using Fal.ai URL as fallback:', storageResult.error)
        // Continue with Fal.ai URL as fallback
      }
    } catch (storageException: any) {
      console.error('❌ Exception during storage:', storageException)
      // Continue with Fal.ai URL as fallback
    }

    // Ensure video metadata is saved to user_videos even if storage failed
    // This keeps the Master Bin in sync, using Fal.ai URLs as a fallback when needed.
    if (!storageSuccess) {
      try {
        console.log('📚 Saving video metadata to user_videos with Fal.ai URL fallback...')
        
        // Use authenticated client to respect RLS
        const authHeader = request.headers.get('authorization')
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
        const supabase = await getServerSupabaseClient(accessToken)
        
        let modelName = 'fal-ai-vidu-text-to-video'
        if (videoModel === 'kling') {
          modelName = 'fal-ai-kling-v1.6-standard-elements'
        } else if (reference_image_urls.length > 0) {
          modelName = 'fal-ai-vidu-reference-to-video'
        } else if (image_url) {
          modelName = 'fal-ai-vidu-image-to-video'
        }

        const { data: dbData, error: dbError } = await supabase
          .from('user_videos')
          .insert({
            user_id: userId,
            video_url: finalVideoUrl, // Fal.ai URL (temporary) or Supabase URL if storage somehow succeeded
            storage_path: storagePath, // May be null if storage failed
            storage_bucket: storageBucket, // May be null if storage failed
            prompt: prompt || null,
            model: modelName,
            duration: result.data?.duration || duration || null,
            aspect_ratio: aspect_ratio || null,
            thumbnail_url: finalThumbnailUrl,
            project_id: project_id || null,
            clip_id: clip_id || null,
            metadata: {
              falRequestId: result.requestId,
              videoModel,
              resolution,
              storageSuccess,
              storageError: storageSuccess ? null : 'Storage failed - using Fal.ai URL as fallback',
            }
          })
          .select()
          .single()

        if (dbError) {
          console.error('❌ Failed to save video metadata (fallback) to database:', dbError)
        } else {
          console.log(`✅ Video metadata saved to database (fallback):`, { videoId: dbData?.id })
        }
      } catch (fallbackDbException: any) {
        console.error('❌ Exception saving video metadata (fallback):', {
          message: fallbackDbException.message,
          stack: fallbackDbException.stack?.substring(0, 200),
        })
      }
    }

    // Determine model name for response
    let modelName = 'fal-ai-vidu-text-to-video'
    if (videoModel === 'kling') {
      modelName = 'fal-ai-kling-v1.6-standard-elements'
    } else if (reference_image_urls.length > 0) {
      modelName = 'fal-ai-vidu-reference-to-video'
    } else if (image_url) {
      modelName = 'fal-ai-vidu-image-to-video'
    }

    // Return response with Supabase URL (or Fal.ai URL as fallback)
    return NextResponse.json({
      success: true,
      videoUrl: finalVideoUrl, // Supabase URL if storage succeeded, Fal.ai URL otherwise
      storageSuccess, // Flag indicating if storage succeeded
      storagePath,
      storageBucket,
      fallbackUrl: !storageSuccess, // True if using Fal.ai URL as fallback
      model: modelName,
      requestId: result.requestId,
      duration: result.data?.duration || duration,
    })
  } catch (error: any) {
    // Log the complete error object to understand its structure
    const errorStringified = JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    console.error('❌ Fal AI Video Generation Error - Complete Error Object:', {
      message: error.message,
      stack: error.stack,
      error: error.error,
      response: error.response,
      status: error.status,
      statusCode: error.statusCode,
      code: error.code,
      name: error.name,
      details: error.details,
      fullError: errorStringified.substring(0, 2000), // First 2000 chars
    })

    // Try multiple ways to extract error information
    let errorMessage = error.message || 'Unknown error occurred'
    let errorDetails = 'No additional details available'
    
    // Try to get detailed error info
    if (error.error) {
      if (typeof error.error === 'string') {
        errorDetails = error.error
      } else if (error.error.message) {
        errorDetails = error.error.message
      } else {
        errorDetails = JSON.stringify(error.error).substring(0, 500)
      }
    } else if (error.response) {
      if (error.response.error) {
        if (typeof error.response.error === 'string') {
          errorDetails = error.response.error
        } else if (error.response.error.message) {
          errorDetails = error.response.error.message
        } else {
          errorDetails = JSON.stringify(error.response.error).substring(0, 500)
        }
      } else if (error.response.data) {
        errorDetails = JSON.stringify(error.response.data).substring(0, 500)
      }
    } else if (error.details) {
      errorDetails = typeof error.details === 'string' 
        ? error.details 
        : JSON.stringify(error.details).substring(0, 500)
    } else if (error.code) {
      errorDetails = `Error code: ${error.code}`
    }

    // If errorMessage is still generic, try to use errorDetails
    if (errorMessage === 'Unknown error occurred' && errorDetails !== 'No additional details available') {
      errorMessage = errorDetails
    }

    // Extract Fal AI specific error details if available
    const falAiErrorDetails = error.falAiDetails || error.originalError?.response?.data || error.originalError?.detail || null
    const klingInput = error.klingInput || null
    const validationMessage = error.validationMessage || null
    
    // Determine appropriate status code
    const statusCode = error.status || error.statusCode || 
      (error.name === 'ValidationError' ? 422 : 
       error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ? 503 :
       500)
    
    // Build response with all available error info
    const errorResponse: any = {
      error: 'Failed to generate video',
      details: errorMessage,
      falAiError: errorDetails,
      errorType: error.name || error.code || 'UnknownError',
      statusCode, // Always include statusCode in response
    }
    
    // Add Kling-specific details if available
    if (falAiErrorDetails) {
      errorResponse.falAiValidationError = falAiErrorDetails
    }
    if (klingInput) {
      errorResponse.klingInput = klingInput
    }
    if (validationMessage) {
      errorResponse.validationMessage = validationMessage.substring(0, 1000)
    }
    if (error.falAiDetails) {
      errorResponse.fullError = JSON.stringify(error.falAiDetails, null, 2).substring(0, 2000)
    }
    
    // Use the determined statusCode instead of hardcoded 500
    return NextResponse.json(errorResponse, { status: statusCode })
  }
}
