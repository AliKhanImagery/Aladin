import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { idea, tone, brandCues, targetRuntime, assetContext } = await request.json()

    // 1. Timing Logic: Calculate exact clip target to avoid narrative compression (6 seconds per clip avg)
    const clipTarget = Math.ceil(targetRuntime / 6);

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

    // Story Writer role - Generate story structure with High-Density Kinetic Workflow
    const storyPrompt = `You are a professional Visual Director and Story Architect implementing a High-Density Kinetic Workflow for Kling 2.5 Standard.

    NARRATIVE ANCHOR:
    The user has paid for ${targetRuntime} seconds of content. To fulfill this duration without compression, you MUST provide exactly ${clipTarget} clips in total across your scenes. Each clip represents a distinct beat of the story.

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

    Generate a story structure with scenes. Return a JSON object with this exact structure:
    {
      "story": "High-level narrative summary",
      "Subject": "Character" || "Object", 
      "scenes": [
        {
          "order": 1,
          "name": "Scene name",
          "description": "Director's Notes: Focus on the emotional shift and sensory atmosphere (smells, textures, lighting mood). Avoid generic adjectives.",
          "type": "establishing|dialogue|action|insert|montage",
          "purpose": "Narrative beat purpose",
          "duration": 10,
          "clips": [
            {
              "order": 1,
              "name": "Clip name",
              "description": "Director's Notes: Describe the sensory experience and specific emotional target of this moment. Use professional onset terminology.",
              "narrative_role": "Hook|Escalation|Peak|Resolution",
              "visual_continuity": "Kinetic Handshake: Describe how lighting, subject position, environmental elements, AND the velocity/speed/momentum of the character at the end of the previous clip carry over to ensure seamless kinetic flow. Include the character's movement velocity (e.g., 'walking at moderate pace', 'sprinting forward', 'slowly turning') so the next clip picks up the same momentum.",
              "flux_image_prompt": "Ultra-detailed visual description (150+ words) including: composition, lighting setup with specific HEX codes (e.g., key light #FFA500, fill light #87CEEB), exact character posture and weight distribution, color palette, camera specs (lens, focal length, aperture), depth of field, atmospheric details, character appearance, environmental specifics, cinematic lighting, sharp focus, natural textures. MUST lock the lighting (HEX codes) and exact posture for Clip 1 as the anchor frame.",
              "kling_motion_prompt": "Starting from the provided frame, [Subject Name] performs [Action] while the camera [Movement]. Ultra-detailed motion description (150+ words) including: Character Acting with Micro-Expressions (e.g., 'Eyes narrowing', 'Breath visible in cold air', 'Lips trembling slightly'), Physics-based Body Movement (e.g., 'Shifting weight forward', 'Arms pumping rhythmically'), camera movement type and motivation, movement speed and easing, subject actions and gestures, shot transitions, dynamic elements, temporal pacing, visual effects, professional cinematography terminology. Acting must be Motivated by the narrative_role.",
              "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
              "cameraMovement": "Static|Dolly-in|Dolly-out|Tracking|Handheld|Orbiting|Crane-up|Crane-down|Push-in|Pull-out",
              "framing": "Detailed framing description with technical specs (e.g., 'Medium close-up at 85mm, f/1.8, eye level, shallow depth of field')"
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

    HIGH-DENSITY KINETIC WORKFLOW CONSTRAINTS:

    1. NARRATIVE ROLE MAPPING:
       - Hook: First clip(s) - Use 'Cinematic wide reveal' or 'Dolly-out' camera movement
       - Escalation: Middle clip(s) - Use 'Tracking shot' or 'Handheld following' camera movement
       - Peak: Climactic clip(s) - Use 'Slow push-in (dolly) for intimacy' or 'Orbiting shot' camera movement
       - Resolution: Final clip(s) - Use appropriate camera movement that serves the story beat

    2. CAMERA MOTIVATION LOGIC:
       - Camera movement MUST only be used if it serves the story beat
       - Map camera movements to narrative_role as specified above
       - Every camera movement must have narrative justification

    3. PERFORMANCE & ACTING LOGIC:
       - kling_motion_prompt MUST specify 'Character Acting' details
       - Include 'Micro-Expression' keywords (e.g., 'Eyes narrowing', 'Breath visible in cold air', 'Lips trembling slightly')
       - Include 'Physics-based Body Movement' (e.g., 'Shifting weight forward', 'Arms pumping rhythmically')
       - Acting must be 'Motivated' by the narrative_role (e.g., if role is 'Peak', prompt for intense facial shifts)

    4. COST & TECHNICAL SPECS:
       - STRICTLY REMOVE all '4K', '8K', 'ultra-HD', and 'photorealistic' keywords from both prompts
       - Focus on 'Cinematic lighting', 'Sharp focus', and 'Natural textures' instead
       - Use quality keywords: "professional", "cinematic", "award-winning", "commercial quality"

    5. CONTINUITY HANDSHAKE:
       - visual_continuity MUST include 'Kinetic Handshake'
       - Describe the velocity/speed/momentum of the character at the end of the previous clip
       - Next clip must pick up the same momentum (e.g., if previous clip ends with 'walking briskly', next clip starts with character already in motion)

    6. FLUX IMAGE PROMPT (Anchor):
       - Must lock the lighting with specific HEX codes (e.g., key light #FFA500, fill light #87CEEB)
       - Must specify exact posture for Clip 1 as the anchor frame
       - Include all technical specs: lens, focal length, aperture, depth of field

    7. KLING MOTION PROMPT (Pivot):
       - MUST start with: 'Starting from the provided frame, [Subject Name] performs [Action] while the camera [Movement].'
       - Include Character Acting with Micro-Expressions
       - Include Physics-based Body Movement
       - Acting must be Motivated by narrative_role

    GENERAL CONSTRAINTS:
    - You MUST output exactly ${clipTarget} clips in total to fulfill the runtime.
    - Every 'description' must be written as 'Director's Notes' focusing on emotion and sensory details rather than generic adjectives.
    - Maintain all provided Asset Context and Brand Cues.
    - Make flux_image_prompt and kling_motion_prompt EXTREMELY DETAILED (150+ words each) using professional cinematography terminology.
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Story Writer specializing in visual narratives with expertise in High-Density Kinetic Workflow for Kling 2.5 Standard. You create structured, cinematic story breakdowns that optimize for kinetic continuity, camera motivation, and performance-driven acting details. Your stories integrate narrative roles (Hook, Escalation, Peak, Resolution) with camera movements and character momentum for seamless visual flow.',
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

