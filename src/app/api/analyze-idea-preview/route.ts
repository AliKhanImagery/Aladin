import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * PROTOTYPE ANALYSIS METHOD
 * 
 * QA Team: Modify the analysis criteria below to add/remove analysis points
 * Junior PMs: Each analysis point is clearly marked with comments
 * 
 * This endpoint performs a quick analysis of the user's idea before full story generation.
 * It extracts: Type, SubjectType, Characters, Products, Locations, Tone, BrandCues
 */
export async function POST(request: NextRequest) {
  try {
    const { idea, tone, brandCues } = await request.json()

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: 'Idea is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // PROTOTYPE: Analysis prompt - Easy to modify for QA/PMs
    const analysisPrompt = `You are an expert Content Analyst. Analyze this idea quickly and extract key information.

User's Idea: "${idea}"
${tone ? `Suggested Tone: ${tone}` : ''}
${brandCues ? `Suggested Brand Cues: ${brandCues}` : ''}

ANALYSIS REQUIREMENTS (QA Team: Modify these criteria as needed):

1. TYPE: Determine the content type
   - Options: "Film/Video", "Content/UGC", "DVC", "TVC", "Animated/3D/ComputerGenerated"
   - DVC = Digital Video Content (short-form, social media)
   - TVC = Television Commercial
   - Film/Video = Traditional film or video production
   - Content/UGC = User-generated content style
   - Animated/3D/ComputerGenerated = Animated or CGI content

2. SUBJECT TYPE: Determine if the main subject is a product or living being
   - Options: "Product" or "Livingbeing"
   - Product = Physical objects, items, food, products
   - Livingbeing = People, animals, characters

3. CHARACTERS: Extract all characters mentioned
   - If names are provided, use them
   - If no names, generate appropriate names based on context
   - Determine role: "protagonist", "antagonist", or "supporting"
   - Extract detailed appearance description
   - Note if character is explicitly mentioned in the idea

4. PRODUCTS: Extract all products/objects that need exact recreation
   - Products that must match a specific brand/item
   - Food items that need exact visual match
   - Objects that are central to the story
   - Note if product needs exact match (needsExactMatch: true)

5. LOCATIONS: Extract specific locations mentioned
   - Named places, specific settings
   - Locations that need reference images
   - Note if location is explicitly mentioned

6. RECOMMENDED TONE & MOOD: Suggest 3-5 keywords
   - Based on the idea's emotional tone
   - Examples: "Energetic", "Dramatic", "Comedic", "Mysterious", "Adventurous"

7. RECOMMENDED BRAND CUES: Suggest 3-5 keywords
   - Based on the idea's style and aesthetic
   - Examples: "Modern", "Vintage", "Corporate", "Youthful", "Luxury"

Return a JSON object with this exact format:
{
  "preview": "Quick 1-2 sentence story preview based on the idea",
  "analysis": {
    "type": "DVC" | "TVC" | "Film" | "Content/UGC" | "Animated/3D/ComputerGenerated",
    "subjectType": "Product" | "Livingbeing",
    "recommendedTone": ["keyword1", "keyword2", "keyword3"],
    "recommendedBrandCues": ["keyword1", "keyword2", "keyword3"],
    "detectedItems": [
      {
        "id": "char_1",
        "type": "character",
        "name": "Character name",
        "role": "protagonist" | "antagonist" | "supporting",
        "mentionedInIdea": true,
        "description": "Detailed character description and appearance",
        "suggestedPrompt": "Detailed prompt for generating/remixing this character's image"
      },
      {
        "id": "product_1",
        "type": "product",
        "name": "Product name",
        "mentionedInIdea": true,
        "needsExactMatch": true,
        "description": "Product description",
        "suggestedPrompt": "Detailed prompt for generating/remixing this product's image"
      },
      {
        "id": "location_1",
        "type": "location",
        "name": "Location name",
        "mentionedInIdea": true,
        "description": "Location description",
        "suggestedPrompt": "Detailed prompt for generating/remixing this location's image"
      }
    ]
  }
}

IMPORTANT:
- Generate unique IDs for each detected item (char_1, char_2, product_1, etc.)
- Only include items that are clearly mentioned or implied in the idea
- For characters without names, generate contextually appropriate names
- Make suggested prompts detailed and production-ready (50-100 words)
- Be specific about appearance, style, and visual details in prompts`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Content Analyst specializing in video and film production. You quickly analyze ideas and extract key information for production planning.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Lower temperature for more consistent analysis
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const analysisData = JSON.parse(content)

    return NextResponse.json({ success: true, data: analysisData })
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze idea',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
