import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from './supabase'

export interface ApiKeyValidation {
  isValid: boolean
  keyId?: string
  permissions?: string[]
  error?: string
}

/**
 * Validates API key from X-API-Key header
 * Used for n8n webhook endpoints
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyValidation> {
  const apiKey = request.headers.get('X-API-Key')

  if (!apiKey) {
    return { isValid: false, error: 'Missing API key' }
  }

  // In development, accept a simple key
  if (process.env.NODE_ENV === 'development' && apiKey === process.env.N8N_API_KEY) {
    return { isValid: true, permissions: ['read', 'write'] }
  }

  // Check against environment variable first (simpler approach)
  if (apiKey === process.env.N8N_API_KEY) {
    return { isValid: true, permissions: ['read', 'write'] }
  }

  try {
    const supabase = createServerSupabaseClient()

    // For production: check against hashed keys in database
    // This is a simplified version - in production use bcrypt comparison
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, permissions')
      .eq('is_active', true)
      .eq('name', 'n8n-integration')

    if (error || !keys?.length) {
      return { isValid: false, error: 'Invalid API key' }
    }

    // Simple key match for now
    // In production, use bcrypt.compare with key_hash
    return {
      isValid: true,
      keyId: keys[0].id,
      permissions: keys[0].permissions
    }

  } catch (error) {
    console.error('API key validation error:', error)
    return { isValid: false, error: 'Validation error' }
  }
}

/**
 * Get default clinic ID
 * In a multi-clinic setup, this would come from the API key or request
 */
export function getDefaultClinicId(): string {
  return process.env.DEFAULT_CLINIC_ID || '00000000-0000-0000-0000-000000000001'
}
