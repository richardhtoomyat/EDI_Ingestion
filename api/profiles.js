import { readFileSync } from 'node:fs'

function localEnv(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .find((item) => item.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch {
    return ''
  }
}

async function supabase(path, { method = 'GET', body, prefer, token } = {}) {
  const url = localEnv('SUPABASE_URL')
  const key = localEnv('SUPABASE_SECRET_KEY')
  if (!url || !key) {
    const error = new Error('Supabase is not configured')
    error.status = 500
    throw error
  }
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      Prefer: prefer || 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = { message: text } }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || 'Supabase request failed')
    error.status = response.status
    error.code = payload?.code
    error.details = payload?.details
    throw error
  }
  return payload
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

async function requireRole(req, roles) {
  const token = bearerToken(req)
  if (!token) {
    const error = new Error('Sign in required')
    error.status = 401
    throw error
  }
  const url = localEnv('SUPABASE_URL')
  const key = localEnv('SUPABASE_SECRET_KEY')
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.id) {
    const error = new Error('Sign in required')
    error.status = 401
    throw error
  }
  const rows = await supabase(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=role,email,first_name,last_name`)
  const profile = rows?.[0]
  if (!profile || !roles.includes(profile.role)) {
    const error = new Error('Access required')
    error.status = 403
    throw error
  }
  return { user: payload, profile, token }
}

function toProfile(row) {
  return {
    id: row.id,
    email: row.email || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    role: row.role,
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    await requireRole(req, ['edi'])
    const role = String(req.query?.role || 'edi').trim() || 'edi'
    if (role !== 'edi') {
      return res.status(400).json({ ok: false, error: 'Only EDI profiles can be listed' })
    }

    const rows = await supabase(
      `profiles?role=eq.edi&select=id,email,first_name,last_name,role&order=first_name.asc,last_name.asc`,
    )
    return res.status(200).json({
      ok: true,
      profiles: (rows || []).map(toProfile),
    })
  } catch (error) {
    const missing = error.code === 'PGRST205' || /profiles/i.test(error.message || '')
    return res.status(missing && error.status !== 401 && error.status !== 403 ? 503 : error.status || 500).json({
      ok: false,
      error: missing && error.status !== 401 && error.status !== 403
        ? 'The profiles table does not exist yet. Run supabase/profiles.sql in the Supabase SQL editor.'
        : error.message,
    })
  }
}
