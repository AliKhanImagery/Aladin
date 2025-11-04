import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Configure Fal AI client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
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
      mode = 'remix', // 'edit', 'remix', or 'text-to-image' - used for UI logic only
      prompt,
      reference_image_urls = [],
      aspect_ratio = '16:9',
      num_images = 1,
      seed,
    } = requestBody

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured', details: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate mode value
    const validModes = ['edit', 'remix', 'text-to-image']
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate and sanitize inputs based on mode
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

    // Validate num_images
    const numImagesValid = typeof num_images === 'number' && num_images >= 1 && num_images <= 4
    const numImagesToUse = numImagesValid ? Math.floor(num_images) : 1

    // Validate seed if provided
    const seedValid = seed === undefined || (typeof seed === 'number' && seed >= 0)

    // Mode-specific validation
    if (mode === 'remix') {
      // Remix mode requires both prompt and reference images
      if (!sanitizedPrompt) {
        return NextResponse.json(
          { error: 'Prompt is required for Remix mode', details: 'Please provide a text prompt' },
          { status: 400 }
        )
      }
      if (sanitizedReferenceUrls.length === 0) {
        return NextResponse.json(
          { error: 'At least one reference image URL is required for Remix mode', details: 'Please provide reference images' },
          { status: 400 }
        )
      }
    } else if (mode === 'edit') {
      // Edit mode requires reference images, prompt is optional
      if (sanitizedReferenceUrls.length === 0) {
        return NextResponse.json(
          { error: 'At least one reference image URL is required for Edit mode', details: 'Please provide reference images' },
          { status: 400 }
        )
      }
    } else if (mode === 'text-to-image') {
      // Text-to-image mode: Uses fal-ai/reve/text-to-image endpoint
      // This endpoint only requires a prompt (no reference images needed)
      if (!sanitizedPrompt) {
        return NextResponse.json(
          { error: 'Prompt is required for Text-to-Image mode', details: 'Please provide a text prompt' },
          { status: 400 }
        )
      }
      // Note: text-to-image endpoint doesn't require reference images
    }

    // Build Fal AI input object based on mode
    // Different endpoints have different requirements
    let falInput: Record<string, any> = {
      aspect_ratio: aspectRatioFormatted,
    }

    if (mode === 'text-to-image') {
      // Text-to-image endpoint: only needs prompt and aspect_ratio
      // Uses fal-ai/reve/text-to-image endpoint
      falInput.prompt = sanitizedPrompt
      falInput.num_images = numImagesToUse
      if (seedValid && seed !== undefined) {
        falInput.seed = Math.floor(seed)
      }
    } else {
      // Remix and Edit modes: use fal-ai/reve/remix endpoint
      // Requires image_urls (and optionally prompt for remix)
      falInput.num_images = numImagesToUse
      
      // Add prompt if provided (required for remix, optional for edit)
      if (sanitizedPrompt) {
        falInput.prompt = sanitizedPrompt
      }

      // Add reference images - REQUIRED for remix and edit modes
      // Fal AI Reve Remix API requires 'image_urls' parameter
      if (sanitizedReferenceUrls.length > 0) {
        falInput.image_urls = sanitizedReferenceUrls
      }

      // Add seed if valid
      if (seedValid && seed !== undefined) {
        falInput.seed = Math.floor(seed)
      }
    }

    // Log validation results
    console.log('🎨 Generating image with Fal AI Reve Remix:', {
      mode,
      hasPrompt: !!sanitizedPrompt,
      promptPreview: sanitizedPrompt ? sanitizedPrompt.substring(0, 50) + '...' : '(no prompt)',
      imageUrlsCount: sanitizedReferenceUrls.length,
      aspectRatio: aspectRatioFormatted,
      numImages: numImagesToUse,
      hasSeed: seedValid && seed !== undefined,
      validatedInput: Object.keys(falInput).join(', '),
    })

    // Validate that we have all required parameters based on mode
    if (mode === 'text-to-image') {
      // Text-to-image endpoint only needs prompt
      if (!falInput.prompt) {
        return NextResponse.json(
          { error: 'Invalid request: Prompt is required for text-to-image mode', details: 'Please provide a text prompt' },
          { status: 400 }
        )
      }
    } else {
      // Remix and Edit modes require image_urls
      if (!falInput.image_urls || falInput.image_urls.length === 0) {
        return NextResponse.json(
          { error: 'Invalid request: Reference images are required', details: 'Fal AI Reve Remix requires at least one reference image URL (image_urls parameter) for remix and edit modes' },
          { status: 400 }
        )
      }
      
      // Prompt is required for remix mode, optional for edit
      if (mode === 'remix' && !falInput.prompt) {
        return NextResponse.json(
          { error: 'Invalid request: Prompt is required for remix mode', details: 'Please provide a text prompt' },
          { status: 400 }
        )
      }
    }

    // Determine which endpoint to use
    const endpoint = mode === 'text-to-image' 
      ? 'fal-ai/reve/text-to-image'
      : 'fal-ai/reve/remix'

    // Call Fal AI Reve endpoint
    console.log(`📤 Sending request to Fal AI Reve (${endpoint}) with input:`, JSON.stringify(falInput, null, 2))
    
    const result = await fal.subscribe(endpoint, {
      input: falInput,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`🔄 Fal AI Reve (${endpoint}) progress:`, update.logs?.map((log: any) => log.message))
        }
      },
    })

    console.log(`📥 Fal AI Reve (${endpoint}) response:`, JSON.stringify(result, null, 2))

    // Remix returns images array
    const imageUrl = result.data?.images?.[0]?.url || result.data?.image?.url

    if (!imageUrl) {
      console.error('❌ No image URL in response. Full result:', result)
      throw new Error(`No image URL returned from Fal AI Reve (${endpoint}). Response: ` + JSON.stringify(result.data))
    }

    console.log(`✅ Fal AI Reve (${endpoint}) image generated:`, imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      model: mode === 'text-to-image' ? 'fal-ai-reve-text-to-image' : 'fal-ai-reve-remix',
      endpoint,
      requestId: result.requestId,
      allImages: result.data?.images || [],
    })
  } catch (error: any) {
    const endpoint = mode === 'text-to-image' ? 'fal-ai/reve/text-to-image' : 'fal-ai/reve/remix'
    console.error(`❌ Fal AI Reve (${endpoint}) Error:`, error)
    
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
          model: mode === 'text-to-image' ? 'fal-ai-reve-text-to-image' : 'fal-ai-reve-remix',
          endpoint,
          hint: mode === 'text-to-image' 
            ? 'Check that prompt is provided. Text-to-image endpoint only requires prompt and aspect_ratio.'
            : 'Check that all required parameters are provided in the correct format. For Reve Remix: prompt and image_urls are required for remix mode, image_urls are required for edit mode.',
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
        model: mode === 'text-to-image' ? 'fal-ai-reve-text-to-image' : 'fal-ai-reve-remix',
        endpoint,
        hint: 'Check console logs for more details. Common issues: invalid API key, missing required parameters, or unsupported parameter combination.',
        statusCode,
      },
      { status: statusCode }
    )
  }
}

