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

async function supabase(path, { method = 'GET', body, prefer } = {}) {
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
      Authorization: `Bearer ${key}`,
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

async function requireEdi(req) {
  const token = bearerToken(req)
  if (!token) {
    const error = new Error('Sign in required')
    error.status = 401
    throw error
  }
  const url = localEnv('SUPABASE_URL')
  const key = localEnv('SUPABASE_SECRET_KEY')
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.id) {
    const error = new Error('Sign in required')
    error.status = 401
    throw error
  }
  const rows = await supabase(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=id,role,email,first_name,last_name`)
  const profile = rows?.[0]
  if (!profile || (profile.role !== 'admin' && profile.role !== 'edi')) {
    const error = new Error('EDI access required')
    error.status = 403
    throw error
  }
  return { user: payload, profile }
}

function personLabel(row) {
  return [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() || row?.email || 'Someone'
}

function toNotification(row) {
  const kind = ['mention', 'assigned', 'unassigned'].includes(row.kind) ? row.kind : 'mention'
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    actorName: personLabel(row.actor),
    onboardingId: row.onboarding_id,
    companyName: row.onboarding?.company_name || '—',
    kind,
    noteExcerpt: row.note_excerpt || '',
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  }
}

export default async function handler(req, res) {
  try {
    const { user } = await requireEdi(req)

    if (req.method === 'GET') {
      const rows = await supabase(
        `edi_notification?recipient_id=eq.${encodeURIComponent(user.id)}`
          + '&select=id,recipient_id,actor_id,onboarding_id,kind,note_excerpt,read_at,created_at'
          + '&order=created_at.desc'
          + '&limit=100',
      )
      const actorIds = [...new Set((rows || []).map((row) => row.actor_id).filter(Boolean))]
      const onboardingIds = [...new Set((rows || []).map((row) => row.onboarding_id).filter(Boolean))]
      const actors = actorIds.length
        ? await supabase(`profiles?id=in.(${actorIds.map(encodeURIComponent).join(',')})&select=id,first_name,last_name,email`)
        : []
      const onboardings = onboardingIds.length
        ? await supabase(`onboarding?id=in.(${onboardingIds.map(encodeURIComponent).join(',')})&select=id,company_name`)
        : []
      const actorMap = new Map((actors || []).map((row) => [row.id, row]))
      const onboardingMap = new Map((onboardings || []).map((row) => [row.id, row]))
      const notifications = (rows || []).map((row) => toNotification({
        ...row,
        actor: actorMap.get(row.actor_id),
        onboarding: onboardingMap.get(row.onboarding_id),
      }))
      return res.status(200).json({
        ok: true,
        notifications,
        unreadCount: notifications.filter((item) => !item.readAt).length,
      })
    }

    if (req.method === 'PATCH') {
      const now = new Date().toISOString()
      if (req.body?.all === true) {
        await supabase(
          `edi_notification?recipient_id=eq.${encodeURIComponent(user.id)}&read_at=is.null`,
          { method: 'PATCH', body: { read_at: now }, prefer: 'return=minimal' },
        )
        return res.status(200).json({ ok: true })
      }
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id) => String(id || '').trim()).filter(Boolean)
        : (req.body?.id ? [String(req.body.id).trim()] : [])
      if (!ids.length) {
        return res.status(400).json({ ok: false, error: 'id, ids, or all is required' })
      }
      const updated = []
      for (const id of ids) {
        const rows = await supabase(
          `edi_notification?id=eq.${encodeURIComponent(id)}&recipient_id=eq.${encodeURIComponent(user.id)}`
            + '&select=id,recipient_id,actor_id,onboarding_id,kind,note_excerpt,read_at,created_at',
          { method: 'PATCH', body: { read_at: now } },
        )
        if (rows?.[0]) updated.push(toNotification(rows[0]))
      }
      return res.status(200).json({ ok: true, notifications: updated })
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (error) {
    const missing = error.code === 'PGRST205' || /edi_notification/i.test(error.message || '')
    return res.status(missing && error.status !== 401 && error.status !== 403 ? 503 : error.status || 500).json({
      ok: false,
      error: missing && error.status !== 401 && error.status !== 403
        ? 'The notifications table does not exist yet. Run supabase/edi_notifications.sql in the Supabase SQL editor.'
        : error.message,
    })
  }
}
