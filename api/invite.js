import { readFileSync } from 'node:fs'

const TABLE = 'profiles'
const ROLES = ['sale', 'edi', 'coordinator', 'admin']

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
    throw error
  }
  return payload
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

async function requireAdmin(req) {
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
  if (!profile || profile.role !== 'admin') {
    const error = new Error('Admin access required')
    error.status = 403
    throw error
  }
  return {
    user: payload,
    profile: {
      role: profile.role,
      email: profile.email,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
    },
  }
}

function normalizeEmails(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/)
  return [...new Set(list.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function inviteOne(email, role, message, invitedBy, redirectTo) {
  const url = localEnv('SUPABASE_URL')
  const key = localEnv('SUPABASE_SECRET_KEY')
  const response = await fetch(`${url}/auth/v1/invite`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      data: {
        role,
        invite_message: message,
        invited_by: invitedBy,
      },
      redirect_to: redirectTo,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.msg || payload?.message || `Could not invite ${email}`)
    error.status = response.status
    throw error
  }
  const userId = payload?.id
  if (userId) {
    try {
      await supabase(`${TABLE}?on_conflict=id`, {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          id: userId,
          email,
          first_name: '',
          last_name: '',
          role,
        },
      })
    } catch (error) {
      if (error.code !== '23505' && !/duplicate|unique/i.test(error.message || '')) throw error
      await supabase(`${TABLE}?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { role, email },
      })
    }
  }
  return { email, id: userId || null }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }
    const { profile } = await requireAdmin(req)
    const emails = normalizeEmails(req.body?.emails)
    const role = String(req.body?.role || '').trim()
    const message = String(req.body?.message || '').trim()
    const redirectTo = String(req.body?.redirectTo || '').trim() || undefined

    if (!emails.length) {
      return res.status(400).json({ ok: false, error: 'Add at least one email address' })
    }
    const invalid = emails.filter((email) => !isEmail(email))
    if (invalid.length) {
      return res.status(400).json({ ok: false, error: `Invalid email: ${invalid[0]}` })
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ ok: false, error: 'Choose a valid role' })
    }

    const invited = []
    const failed = []
    for (const email of emails) {
      try {
        invited.push(await inviteOne(email, role, message, profile.email, redirectTo))
      } catch (error) {
        failed.push({ email, error: error.message })
      }
    }

    if (!invited.length) {
      return res.status(400).json({
        ok: false,
        error: failed[0]?.error || 'Could not send invitations',
        failed,
      })
    }

    return res.status(200).json({
      ok: true,
      invited,
      failed,
      message: failed.length
        ? `Invited ${invited.length}; ${failed.length} failed`
        : `Invited ${invited.length} user${invited.length === 1 ? '' : 's'}`,
    })
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Invite failed',
    })
  }
}
