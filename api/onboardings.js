import { readFileSync } from 'node:fs'
import { DEMO_ONBOARDINGS } from '../src/demoOnboardings.js'

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

async function requireSaleUser(req) {
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
  const rows = await supabase(`profiles?id=eq.${encodeURIComponent(payload.id)}&select=role,email`)
  const profile = rows?.[0]
  if (!profile || profile.role !== 'sale') {
    const error = new Error('Sales access required')
    error.status = 403
    throw error
  }
  return { user: payload, profile, token }
}

function toRecord(row) {
  return {
    id: row.id,
    token: row.token,
    createdAt: new Date(row.created_at).getTime(),
    companyName: row.company_name,
    customerEmail: row.customer_email,
    draft: row.prefill,
  }
}

async function ensureDemos() {
  const existing = await supabase('onboardings?select=token')
  const tokens = new Set((existing || []).map((row) => row.token))
  for (const demo of DEMO_ONBOARDINGS) {
    if (tokens.has(demo.id)) continue
    await supabase('onboardings', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        token: demo.id,
        company_name: demo.companyName,
        customer_email: demo.customerEmail,
        prefill: demo.draft,
        created_at: new Date(demo.createdAt).toISOString(),
      },
    })
  }
}

export default async function handler(req, res) {
  try {
    const token = req.query?.token
    if (req.method === 'GET' && token) {
      const rows = await supabase(`onboardings?token=eq.${encodeURIComponent(token)}&select=*`)
      if (!rows?.length) return res.status(404).json({ ok: false, error: 'This link is not valid' })
      return res.status(200).json({ ok: true, record: toRecord(rows[0]), submission: rows[0].submission })
    }
    if (req.method === 'PATCH' && token) {
      await supabase(`onboardings?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { submission: req.body?.submission || null },
      })
      return res.status(200).json({ ok: true })
    }
    await requireSaleUser(req)
    if (req.method === 'GET') {
      await ensureDemos()
      const rows = await supabase('onboardings?select=*&order=created_at.desc')
      return res.status(200).json({ ok: true, records: (rows || []).map(toRecord) })
    }
    if (req.method === 'POST') {
      const draft = req.body?.draft
      if (!draft?.mainAccount?.companyName || !draft?.customerEmail) {
        return res.status(400).json({ ok: false, error: 'Company name and customer email are required' })
      }
      const rows = await supabase('onboardings', {
        method: 'POST',
        body: {
          company_name: draft.mainAccount.companyName.trim(),
          customer_email: draft.customerEmail.trim(),
          prefill: draft,
        },
      })
      return res.status(201).json({ ok: true, record: toRecord(rows[0]) })
    }
    if (req.method === 'PATCH') {
      const { id, draft } = req.body || {}
      if (!id || !draft) return res.status(400).json({ ok: false, error: 'Missing onboarding' })
      const rows = await supabase(`onboardings?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: {
          company_name: draft.mainAccount.companyName.trim(),
          customer_email: draft.customerEmail.trim(),
          prefill: draft,
        },
      })
      return res.status(200).json({ ok: true, record: toRecord(rows[0]) })
    }
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (error) {
    const missing = error.code === 'PGRST205' || /onboardings|profiles/.test(error.message || '')
    return res.status(missing && error.status !== 401 && error.status !== 403 ? 503 : error.status || 500).json({
      ok: false,
      error: missing && error.status !== 401 && error.status !== 403
        ? 'A required table does not exist yet. Run the SQL from the Supabase SQL editor.'
        : error.message,
    })
  }
}
