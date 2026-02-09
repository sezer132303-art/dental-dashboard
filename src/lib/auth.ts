import { supabase, createServerSupabaseClient } from './supabase'
import { User } from '@/types'
import bcrypt from 'bcryptjs'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://mwqopo2p.rpcld.net/webhook'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Login with phone and password
export async function loginWithPassword(phone: string, password: string): Promise<{ user: User | null; sessionToken: string | null; error?: string }> {
  try {
    const serverSupabase = createServerSupabaseClient()

    // Find user by phone
    const { data: user, error: userError } = await serverSupabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (userError || !user) {
      return { user: null, sessionToken: null, error: 'Невалиден телефон или парола' }
    }

    // Check if user has password set
    if (!user.password_hash) {
      return { user: null, sessionToken: null, error: 'Моля, задайте парола първо' }
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return { user: null, sessionToken: null, error: 'Невалиден телефон или парола' }
    }

    // Update last login
    await serverSupabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Generate session token
    const sessionToken = crypto.randomUUID()

    return { user: user as User, sessionToken }
  } catch (error) {
    console.error('Login error:', error)
    return { user: null, sessionToken: null, error: 'Неочаквана грешка' }
  }
}

// Set password for user
export async function setPassword(phone: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const serverSupabase = createServerSupabaseClient()

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update user
    const { error } = await serverSupabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('phone', phone)

    if (error) {
      return { success: false, error: 'Грешка при запазване на паролата' }
    }

    return { success: true }
  } catch (error) {
    console.error('Set password error:', error)
    return { success: false, error: 'Неочаквана грешка' }
  }
}

export async function sendMagicLink(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate unique token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (userError || !user) {
      return { success: false, error: 'Телефонният номер не е регистриран' }
    }

    // Store token in database
    const { error: tokenError } = await supabase
      .from('auth_tokens')
      .insert({
        phone,
        token,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Token insert error:', tokenError)
      return { success: false, error: 'Грешка при създаване на токен' }
    }

    // Send WhatsApp message via n8n webhook
    const magicLink = `${APP_URL}/auth/verify?token=${token}`

    const response = await fetch(`${N8N_WEBHOOK_URL}/send-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        token,
        magicLink,
        userName: user.name || 'Потребител'
      })
    })

    if (!response.ok) {
      return { success: false, error: 'Грешка при изпращане на съобщението' }
    }

    return { success: true }
  } catch (error) {
    console.error('Magic link error:', error)
    return { success: false, error: 'Неочаквана грешка' }
  }
}

export async function verifyMagicLink(token: string): Promise<{ user: User | null; sessionToken: string | null; error?: string }> {
  try {
    const serverSupabase = createServerSupabaseClient()

    // Find and validate token
    const { data: authToken, error: tokenError } = await serverSupabase
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !authToken) {
      return { user: null, sessionToken: null, error: 'Невалиден или изтекъл линк' }
    }

    // Check if expired
    if (new Date(authToken.expires_at) < new Date()) {
      return { user: null, sessionToken: null, error: 'Линкът е изтекъл' }
    }

    // Mark token as used
    await serverSupabase
      .from('auth_tokens')
      .update({ used: true })
      .eq('id', authToken.id)

    // Get user
    const { data: user, error: userError } = await serverSupabase
      .from('users')
      .select('*')
      .eq('phone', authToken.phone)
      .single()

    if (userError || !user) {
      return { user: null, sessionToken: null, error: 'Потребителят не е намерен' }
    }

    // Update last login
    await serverSupabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Generate session token
    const sessionToken = crypto.randomUUID()

    return { user: user as User, sessionToken }
  } catch (error) {
    console.error('Verify magic link error:', error)
    return { user: null, sessionToken: null, error: 'Неочаквана грешка' }
  }
}

export async function getCurrentUser(sessionToken: string): Promise<User | null> {
  // In production, you'd verify the session token against a sessions table
  // For now, this is a placeholder
  return null
}
