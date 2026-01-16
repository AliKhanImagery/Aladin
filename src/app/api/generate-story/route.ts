import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { idea, tone, brandCues, targetRuntime, assetContext } = await request.json()

    // 1. Timing Logic: Move from hard-coded averages to Dynamic Pacing
    // We provide targetRuntime to the LLM and let it allocate clips between 1s and 5s
    // to match the exact runtime while creating rhythmic tempo.
    
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

    // Story Writer role - Generate story structure with Aladin Pro Dynamic Pacing
    const storyPrompt = `You are a professional Visual Director and Story Architect implementing the "Aladin Pro" High-Density Kinetic Workflow.

    PRODUCTION CONTEXT:
    User's Idea: "${idea}"
    ${Array.isArray(tone) ? `Tone: ${tone.join(', ')}` : tone ? `Tone: ${tone}` : ''}
    ${Array.isArray(brandCues) ? `Brand Cues: ${brandCues.join(', ')}` : brandCues ? `Brand Cues: ${brandCues}` : ''}
    Target Runtime: ${targetRuntime} seconds
    
    ${assetContext ? `
    ASSET CONTEXT (Mandatory production anchors):
    Characters: ${assetContext.characters ? assetContext.characters.map((c: any) => `${c.name} (${c.role}): ${c.description}`).join('; ') : ''}
    Products: ${assetContext.products ? assetContext.products.map((p: any) => `${p.name}: ${p.description}`).join('; ') : ''}
    Locations: ${assetContext.locations ? assetContext.locations.map((l: any) => `${l.name}: ${l.description}`).join('; ') : ''}
    ` : ''}

    1. DYNAMIC PACING & ENGINE LOGIC:
    You must allocate clips with varied durations to create "Visual Pacing." 
    - Total duration of all clips MUST equal exactly ${targetRuntime} seconds.
    - Video Engine Selection:
        * "kling": Use for narrative, character acting, and wide establishing shots. (Duration: 3-5 seconds).
        * "ltx": Use for fast cuts, texture close-ups, rhythmic spikes, and macro details. (Duration: 1-2 seconds).
    - Rhythmic Editing: Mix long "Hero" clips with short "Texture" clips to create a professional edit feel.

    2. PRODUCTION PERSONA:
    Decide if this is a "Film" (Narrative-driven, slower pacing, character arcs) or "TVC" (Product-focused, montage-heavy, fast rhythmic cuts) based on the idea. Apply this persona to your pacing strategy.

    3. MATERIAL BIBLE (Consistency):
    If the project involves a specific object or material (e.g., a "Carpet", "Bottle", "Watch"), you must define its "Material DNA" (texture, sheen, response to light) in the first clip and strictly carry it through every subsequent clip.

    Generate a story structure. Return a JSON object with this exact structure:
    {
      "story": "High-level narrative summary",
      "production_persona": "Film|TVC",
      "subject": "Character" || "Object", 
      "scenes": [
        {
          "order": 1,
          "name": "Scene name",
          "description": "Director's Notes: Focus on the emotional shift and sensory atmosphere (smells, textures, lighting mood). Avoid generic adjectives.",
          "type": "establishing|dialogue|action|insert|montage",
          "purpose": "Narrative beat purpose",
          "clips": [
            {
              "order": 1,
              "name": "Clip name",
              "duration": 5, 
              "video_engine": "kling|ltx",
              "description": "Director's Notes: Describe the sensory experience and specific emotional target. Use professional onset terminology.",
              "narrative_role": "Hook|Escalation|Peak|Resolution",
              "visual_continuity": "Kinetic Handshake: Describe how lighting, subject position, environmental elements, AND the velocity/speed/momentum carry over. Mention specific Material DNA if object-centric.",
              "flux_image_prompt": "Ultra-detailed visual description (150+ words). INCLUDE: composition, lighting HEX codes (e.g., #FFA500), character posture, Material DNA specs, camera specs (lens, focal length), cinematic lighting, natural textures. NO forbidden keywords (4k/8k/photorealistic).",
              "kling_motion_prompt": "Ultra-detailed motion description (150+ words). INCLUDE: Character Acting with Micro-Expressions, Physics-based Body Movement, camera motivation, and temporal pacing. Acting must be Motivated by the narrative_role.",
              "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
              "cameraMovement": "Static|Dolly-in|Dolly-out|Tracking|Handheld|Orbiting|Crane-up|Crane-down|Push-in|Pull-out",
              "framing": "Detailed framing description with technical specs (e.g., 'Medium close-up at 85mm, f/1.8')"
            }
          ]
        }
      ],
      "characters": [
        {
          "name": "Character name",
          "description": "Detailed visual and behavioral profile",
          "role": "protagonist|antagonist|supporting"
        }
      ]
    }

    ALADIN PRO CONSTRAINTS:
    - CLIPS: You are not limited by number, only by the ${targetRuntime}s total runtime. Create enough clips to feel like a professional edit.
    - ENGINE: If duration is < 3s, you MUST use "ltx". If >= 3s, use "kling".
    - MATERIAL DNA: For object-centric clips, define materials with keywords like "anisotropic sheen", "micro-fiber density", "light-refractive index".
    - Forbidden: REMOVE '4K', '8K', 'ultra-HD', 'photorealistic'. Use 'commercial quality', 'cinematic lighting', 'master-grade'.
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Story Writer specializing in visual narratives with expertise in the "Aladin Pro" High-Density Kinetic Workflow. You create structured, cinematic story breakdowns that optimize for dynamic visual pacing (1s to 5s clips), engine-specific routing (Kling vs LTX), and Material DNA consistency. Your stories integrate narrative roles with rhythmic editing to create professional TVC and Film-grade visual sequences.',
        },
        {
          role: 'user',
          content: storyPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85, // Higher temperature for more creative and detailed story generation
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const storyData = JSON.parse(content)

    return NextResponse.json({ success: true, data: storyData })
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate story',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

