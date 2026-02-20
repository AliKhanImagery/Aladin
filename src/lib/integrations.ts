import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Get all ElevenLabs integrations for a user (server-side only).
 */
export async function getElevenLabsIntegrations(userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id, name, api_key, created_at')
    .eq('user_id', userId)
    .eq('provider', 'elevenlabs')
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

/**
 * Get a specific integration key by ID (server-side only).
 * Optionally verifies ownership if userId is provided.
 */
export async function getIntegrationKeyById(integrationId: string, userId?: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let query = supabase
    .from('user_integrations')
    .select('api_key')
    .eq('id', integrationId)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query.single()

  if (error || !data?.api_key) return null
  return data.api_key
}

/**
 * Get the user's ElevenLabs API key from user_integrations (server-side only).
 * Returns the most recently added key if multiple exist.
 */
export async function getElevenLabsKeyForUser(userId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data, error } = await supabase
    .from('user_integrations')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'elevenlabs')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.api_key) return null
  return data.api_key
}
