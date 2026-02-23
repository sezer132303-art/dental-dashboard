import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from './supabase'
import crypto from 'crypto'

export interface ApiKeyValidation {
  isValid: boolean
  keyId?: string
  clinicId?: string
  permissions?: string[]
  error?: string
}

/**
 * Hash API key using SHA-256 for secure comparison
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
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

  // Check against environment variable (primary method)
  const envApiKey = process.env.N8N_API_KEY
  if (envApiKey && apiKey === envApiKey) {
    return {
      isValid: true,
      clinicId: getDefaultClinicId(),
      permissions: ['read', 'write']
    }
  }

  // Fallback: check against hashed keys in database
  try {
    const supabase = createServerSupabaseClient()
    const keyHash = hashApiKey(apiKey)

    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .select('id, clinic_id, permissions')
      .eq('is_active', true)
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('API key lookup error:', error)
      return { isValid: false, error: 'Validation error' }
    }

    if (!keyRecord) {
      return { isValid: false, error: 'Invalid API key' }
    }

    return {
      isValid: true,
      keyId: keyRecord.id,
      clinicId: keyRecord.clinic_id,
      permissions: keyRecord.permissions || ['read', 'write']
    }

  } catch (error) {
    console.error('API key validation error:', error)
    return { isValid: false, error: 'Validation error' }
  }
}

/**
 * Get default clinic ID from environment
 * Throws error if not configured - prevents silent failures
 */
export function getDefaultClinicId(): string {
  const clinicId = process.env.DEFAULT_CLINIC_ID

  if (!clinicId) {
    console.error('DEFAULT_CLINIC_ID environment variable is not set')
    throw new Error('DEFAULT_CLINIC_ID is required but not configured')
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(clinicId)) {
    console.error('DEFAULT_CLINIC_ID is not a valid UUID:', clinicId)
    throw new Error('DEFAULT_CLINIC_ID must be a valid UUID')
  }

  return clinicId
}

/**
 * Safely get default clinic ID, returns null if not configured
 */
export function getDefaultClinicIdOrNull(): string | null {
  try {
    return getDefaultClinicId()
  } catch {
    return null
  }
}
