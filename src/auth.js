import { createClient } from '@supabase/supabase-js'

const ALLOWED_DOMAIN = 'dayross.com'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = createClient(url, key)

export function authConfigured() {
  return Boolean(url && key)
}

export function sessionEmail(user) {
  if (!user) return ''
  const candidates = [
    user.email,
    user.user_metadata?.email,
    user.user_metadata?.preferred_username,
    user.identities?.find((item) => item.identity_data?.email)?.identity_data?.email,
    user.identities?.find((item) => item.identity_data?.preferred_username)?.identity_data?.preferred_username,
  ]
  return String(candidates.find(Boolean) || '').trim()
}

export function isDayrossEmail(email) {
  return String(email || '').toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
}

export function namesFromUser(user) {
  const meta = user?.user_metadata || {}
  const first = String(meta.first_name || meta.given_name || '').trim()
  const last = String(meta.last_name || meta.family_name || '').trim()
  if (first || last) return { firstName: first, lastName: last }
  const full = String(meta.name || meta.full_name || '').trim()
  if (!full) return { firstName: '', lastName: '' }
  const parts = full.split(/\s+/)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

export async function signInWithMicrosoft() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid email profile',
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  return data
}

export async function createAccount({ email, password, firstName, lastName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    role: data.role,
  }
}

export async function saveProfile({ userId, email, firstName, lastName, role }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
    })
    .select('id, email, first_name, last_name, role')
    .single()
  if (error) throw error
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    role: data.role,
  }
}

export async function accessToken() {
  const session = await getSession()
  return session?.access_token || ''
}
