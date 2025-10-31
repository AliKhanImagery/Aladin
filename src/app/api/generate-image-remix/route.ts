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
      // Text-to-image mode requires only prompt
      if (!sanitizedPrompt) {
        return NextResponse.json(
          { error: 'Prompt is required for Text-to-Image mode', details: 'Please provide a text prompt' },
          { status: 400 }
        )
      }
      // Note: Reve Remix might not support pure text-to-image, might need reference_image_urls
      // We'll try without it first
    }

    // Build Fal AI input object - DO NOT send 'mode' parameter to Fal AI
    // Fal AI Reve Remix API infers behavior from provided parameters
    const falInput: Record<string, any> = {
      aspect_ratio: aspectRatioFormatted,
      num_images: numImagesToUse,
    }

    // Add prompt if provided (required for remix and text-to-image modes)
    if (sanitizedPrompt) {
      falInput.prompt = sanitizedPrompt
    }

    // Add reference images if provided (required for edit and remix modes)
    if (sanitizedReferenceUrls.length > 0) {
      falInput.reference_image_urls = sanitizedReferenceUrls
    }

    // Add seed if valid
    if (seedValid && seed !== undefined) {
      falInput.seed = Math.floor(seed)
    }

    // Log validation results
    console.log('🎨 Generating image with Fal AI Reve Remix:', {
      mode,
      hasPrompt: !!sanitizedPrompt,
      promptPreview: sanitizedPrompt ? sanitizedPrompt.substring(0, 50) + '...' : '(no prompt)',
      referenceImagesCount: sanitizedReferenceUrls.length,
      aspectRatio: aspectRatioFormatted,
      numImages: numImagesToUse,
      hasSeed: seedValid && seed !== undefined,
      validatedInput: Object.keys(falInput).join(', '),
    })

    // Validate that we have at least one required parameter
    if (!falInput.prompt && !falInput.reference_image_urls) {
      return NextResponse.json(
        { error: 'Invalid request: Must provide either prompt or reference images', details: 'At least one input is required' },
        { status: 400 }
      )
    }

    // Final validation: Ensure Fal AI input structure is valid
    if (falInput.reference_image_urls && falInput.reference_image_urls.length === 0) {
      // Remove empty array - might cause validation error
      delete falInput.reference_image_urls
    }

    // Call Fal AI Reve Remix
    console.log('📤 Sending request to Fal AI Reve Remix with input:', JSON.stringify(falInput, null, 2))
    
    const result = await fal.subscribe('fal-ai/reve/remix', {
      input: falInput,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('🔄 Fal AI Reve Remix progress:', update.logs?.map((log: any) => log.message))
        }
      },
    })

    console.log('📥 Fal AI Reve Remix response:', JSON.stringify(result, null, 2))

    // Remix returns images array
    const imageUrl = result.data?.images?.[0]?.url || result.data?.image?.url

    if (!imageUrl) {
      console.error('❌ No image URL in response. Full result:', result)
      throw new Error('No image URL returned from Fal AI Reve Remix. Response: ' + JSON.stringify(result.data))
    }

    console.log('✅ Fal AI Reve Remix image generated:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      model: 'fal-ai-reve-remix',
      requestId: result.requestId,
      allImages: result.data?.images || [],
    })
  } catch (error: any) {
    console.error('❌ Fal AI Reve Remix Error:', error)
    
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
          model: 'fal-ai-reve-remix',
          hint: 'Check that all required parameters are provided in the correct format. For Reve Remix: prompt and reference_image_urls are typically required for remix mode.',
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
        model: 'fal-ai-reve-remix',
        hint: 'Check console logs for more details. Common issues: invalid API key, missing required parameters, or unsupported parameter combination.',
        statusCode,
      },
      { status: statusCode }
    )
  }
}

