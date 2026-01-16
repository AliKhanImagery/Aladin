import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * AI-Powered Character Matching
 * 
 * Intelligently determines which characters should appear in each clip
 * based on story context, not just simple string matching.
 * 
 * Handles:
 * - Pronouns (he, she, they, the protagonist, etc.)
 * - Story flow and narrative context
 * - Character roles and relationships
 * - Scene context and clip positioning
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      storyContext, 
      sceneDescription, 
      clipDescription, 
      clipOrder,
      sceneOrder,
      allClipsInScene,
      assetContext 
    } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Build character reference list
    const characterList = assetContext?.characters?.map((char: any) => ({
      id: char.id,
      name: char.name,
      role: char.role,
      description: char.description,
      appearanceDetails: char.appearanceDetails || char.description,
      assetUrl: char.assetUrl
    })) || []

    if (characterList.length === 0) {
      return NextResponse.json({ 
        success: true, 
        matchedCharacters: [],
        matchedProducts: [],
        matchedLocations: []
      })
    }

    // Get context of other clips in the scene for better understanding
    const otherClipsContext = allClipsInScene?.map((clip: any, idx: number) => 
      `Clip ${idx + 1}: ${clip.description || clip.name}`
    ).join('\n') || ''

    const matchingPrompt = `You are an expert Story Analyst. Analyze the story context and determine which characters, products, and locations MUST appear in this specific clip.

STORY CONTEXT:
${storyContext}

SCENE DESCRIPTION:
${sceneDescription}

CURRENT CLIP (Clip ${clipOrder} in Scene ${sceneOrder}):
${clipDescription}

OTHER CLIPS IN THIS SCENE:
${otherClipsContext || 'None'}

AVAILABLE ASSETS:
CHARACTERS:
${characterList.map((char: any) => 
  `- ID: ${char.id} | NAME: ${char.name} | ROLE: ${char.role} | DESCRIPTION: ${char.description} | APPEARANCE: ${char.appearanceDetails || 'N/A'}`
).join('\n')}

PRODUCTS/OBJECTS:
${assetContext?.products?.map((p: any) => `- ID: ${p.id} | NAME: ${p.name} | DESCRIPTION: ${p.description}`).join('\n') || 'None'}

LOCATIONS:
${assetContext?.locations?.map((l: any) => `- ID: ${l.id} | NAME: ${l.name} | DESCRIPTION: ${l.description}`).join('\n') || 'None'}

ANALYSIS TASK:
Determine which assets should appear in this clip. Be VERY inclusive.
1. DIRECT MATCHES: If the name is mentioned.
2. PRONOUN MATCHES: If "he", "she", "they", "him", "her" is used, match to the character it refers to in context.
3. ROLE MATCHES: If "the protagonist", "the hero", "the main character", "the narrator" is used, match to the character with that role.
4. NARRATIVE INFERENCE: If the scene is about a character, and the clip describes an action ("Walking down the street"), assume that character is the subject even if not named in the clip.
5. CONTINUITY: If a character was in the previous clip of this scene and the action continues, they are likely still present.
6. PRODUCT FOCUS: For matched products, determine if the product is the PRIMARY VISUAL SUBJECT (e.g. close-up, hero shot, being held/used prominently) or just INCIDENTAL/BACKGROUND.

Return a JSON object with this format:
{
  "matchedCharacters": [
    {
      "characterId": "ID_HERE",
      "reason": "Detailed explanation of why this character is matched (e.g., 'Referred to as \"he\" in this clip, which logically refers to [Name]')",
      "confidence": "high" | "medium" | "low",
      "roleInClip": "primary subject" | "background" | "supporting"
    }
  ],
  "matchedProducts": [
    {
      "productId": "ID_HERE",
      "reason": "Why this product is relevant",
      "confidence": "high",
      "visualFocus": "primary" | "background"
    }
  ],
  "matchedLocations": [
    {
      "locationId": "ID_HERE",
      "reason": "Why this location is relevant",
      "confidence": "high"
    }
  ]
}

IMPORTANT:
- WE NEED HIGH RECALL. It is better to include a character that might be there than to miss them.
- If only one character is the 'protagonist' in the story, they should be matched to almost any clip that describes a primary action unless another character is explicitly named.
- Use the character's NAME as a trigger for consistency in the prompts later.
- Ensure the ID matches exactly from the AVAILABLE ASSETS list.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Story Analyst specializing in narrative flow and character placement. You analyze story context to determine which characters, products, and locations should appear in specific clips based on narrative logic, not just keyword matching.',
        },
        {
          role: 'user',
          content: matchingPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent matching
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Safely parse and validate JSON response
    let matchingResult: any
    try {
      matchingResult = JSON.parse(content)
    } catch (parseError: any) {
      console.error('JSON parse error in character matching:', {
        error: parseError.message,
        contentPreview: content.substring(0, 200),
        contentLength: content.length
      })
      throw new Error(`Invalid JSON response from OpenAI: ${parseError.message}. Content preview: ${content.substring(0, 100)}...`)
    }

    // Validate response structure
    if (!matchingResult || typeof matchingResult !== 'object') {
      throw new Error('Invalid response format: expected object but got ' + typeof matchingResult)
    }

    // Validate expected array properties exist (even if empty)
    if (!Array.isArray(matchingResult.matchedCharacters)) {
      console.warn('matchedCharacters is not an array, defaulting to empty array')
      matchingResult.matchedCharacters = []
    }
    if (!Array.isArray(matchingResult.matchedProducts)) {
      console.warn('matchedProducts is not an array, defaulting to empty array')
      matchingResult.matchedProducts = []
    }
    if (!Array.isArray(matchingResult.matchedLocations)) {
      console.warn('matchedLocations is not an array, defaulting to empty array')
      matchingResult.matchedLocations = []
    }

    // Map IDs back to full character/product/location objects
    const matchedCharacters = (matchingResult.matchedCharacters || [])
      .map((match: any) => {
        const character = characterList.find((c: any) => c.id === match.characterId)
        if (!character) return null
        return {
          ...character,
          matchReason: match.reason,
          confidence: match.confidence,
          roleInClip: match.roleInClip || 'primary subject'
        }
      })
      .filter((c: any) => c !== null)

    const matchedProducts = (matchingResult.matchedProducts || [])
      .map((match: any) => {
        const product = assetContext?.products?.find((p: any) => p.id === match.productId)
        if (!product) return null
        return {
          ...product,
          matchReason: match.reason,
          confidence: match.confidence,
          visualFocus: match.visualFocus || 'background'
        }
      })
      .filter((p: any) => p !== null)

    const matchedLocations = (matchingResult.matchedLocations || [])
      .map((match: any) => {
        const location = assetContext?.locations?.find((l: any) => l.id === match.locationId)
        if (!location) return null
        return {
          ...location,
          matchReason: match.reason,
          confidence: match.confidence
        }
      })
      .filter((l: any) => l !== null)

    return NextResponse.json({
      success: true,
      matchedCharacters,
      matchedProducts,
      matchedLocations
    })
  } catch (error: any) {
    console.error('Character Matching API Error:', error)
    
    // Provide specific error information
    let errorMessage = 'Failed to match characters'
    let errorDetails = error.message || 'Unknown error'
    let statusCode = 500

    // Distinguish between different error types
    if (error.message?.includes('Invalid JSON')) {
      errorMessage = 'Invalid JSON response from AI'
      errorDetails = error.message
      statusCode = 502 // Bad Gateway - upstream service returned invalid data
    } else if (error.message?.includes('Invalid response')) {
      errorMessage = 'Invalid response structure from AI'
      errorDetails = error.message
      statusCode = 502
    } else if (error.message?.includes('OpenAI API key')) {
      errorMessage = 'Configuration error'
      errorDetails = 'OpenAI API key not configured'
      statusCode = 500
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        type: error.message?.includes('JSON') ? 'parse_error' : 
              error.message?.includes('structure') ? 'validation_error' : 
              'unknown_error'
      },
      { status: statusCode }
    )
  }
}

