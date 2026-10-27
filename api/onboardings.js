import { readFileSync } from 'node:fs'
import { at7CustomCount, normalizeAt7 } from './at7Normalize.js'

const TABLE = 'onboarding'
const AT7_TABLE = 'onboarding_at7_code'
const ONBOARDING_SELECT = '*,onboarding_at7_code(*)'

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
  return {
    user: payload,
    profile: {
      role: profile.role,
      email: profile.email,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
    },
    token,
  }
}

function pickTrader(source = {}) {
  return {
    traderIdQa: String(source.traderIdQa || source.trader_id_qa || '').trim(),
    traderIdProd: String(source.traderIdProd || source.trader_id_prod || '').trim(),
  }
}

function withTrader(draft = {}, trader = {}) {
  return {
    ...draft,
    traderIdQa: trader.traderIdQa || '',
    traderIdProd: trader.traderIdProd || '',
  }
}

function agentName(draft = {}, profile) {
  const fromAuth = [draft.authorization?.name].filter(Boolean)[0]
  if (fromAuth) return fromAuth
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || '—'
}

function technowId(value) {
  return String(value || '').trim()
}

function mapAt7Code(row) {
  return {
    id: row.id,
    source: row.source,
    groupKind: row.group_kind,
    statusKey: row.status_key,
    name: row.status_name,
    code: row.status_code,
    defaultAt701: row.default_at701,
    defaultAt702: row.default_at702,
    at701: row.at701,
    at702: row.at702,
    isCustom: Boolean(row.is_custom),
    custom: Array.isArray(row.custom_fields) ? row.custom_fields : [],
  }
}

function authoritativeSource(row) {
  return row.submission ? 'submission' : 'prefill'
}

function toRecord(row) {
  const draft = row.prefill && typeof row.prefill === 'object' ? { ...row.prefill } : {}
  const technowRequestId = technowId(row.technow_request_id || draft.technowRequestId)
  draft.technowRequestId = technowRequestId
  const trader = pickTrader({ ...draft, trader_id_qa: row.trader_id_qa, trader_id_prod: row.trader_id_prod })
  const source = authoritativeSource(row)
  const at7Codes = (row.onboarding_at7_code || [])
    .filter((item) => item.source === source)
    .map(mapAt7Code)
  return {
    id: row.id,
    technowRequestId,
    token: row.token,
    createdAt: new Date(row.created_at).getTime(),
    companyName: row.company_name,
    customerEmail: row.customer_email,
    draft: withTrader(draft, trader),
    traderIdQa: trader.traderIdQa,
    traderIdProd: trader.traderIdProd,
    agentName: agentName(draft),
    submitted: Boolean(row.submission),
    needsAt7Mapping: Boolean(row.needs_at7_mapping),
    at7CustomCount: Number(row.at7_custom_count) || 0,
    at7Codes,
  }
}

async function loadOnboarding(id) {
  const rows = await supabase(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=${ONBOARDING_SELECT}`)
  if (!rows?.length) {
    const error = new Error('Onboarding not found')
    error.status = 404
    throw error
  }
  return rows[0]
}

async function replaceAt7Codes(onboardingId, source, draft) {
  const rows = normalizeAt7(draft, source).map((row) => ({
    ...row,
    onboarding_id: onboardingId,
  }))
  await supabase(
    `${AT7_TABLE}?onboarding_id=eq.${encodeURIComponent(onboardingId)}&source=eq.${encodeURIComponent(source)}`,
    { method: 'DELETE', prefer: 'return=minimal' },
  )
  if (rows.length) {
    await supabase(AT7_TABLE, { method: 'POST', body: rows, prefer: 'return=minimal' })
  }
  return rows
}

async function refreshAt7Flags(onboardingId) {
  const row = await loadOnboarding(onboardingId)
  const source = authoritativeSource(row)
  const codes = (row.onboarding_at7_code || []).filter((item) => item.source === source)
  const customCount = at7CustomCount(codes)
  const updated = await supabase(`${TABLE}?id=eq.${encodeURIComponent(onboardingId)}`, {
    method: 'PATCH',
    body: {
      needs_at7_mapping: customCount > 0,
      at7_custom_count: customCount,
      updated_at: new Date().toISOString(),
    },
  })
  return updated?.[0] ? { ...updated[0], onboarding_at7_code: row.onboarding_at7_code } : row
}

async function syncAt7(onboardingId, source, draft) {
  await replaceAt7Codes(onboardingId, source, draft)
  return refreshAt7Flags(onboardingId)
}

function companyFromDraft(draft, email) {
  return String(
    draft?.mainAccount?.companyName
    || draft?.customerDetails?.companyName
    || draft?.paymentHouse?.companyName
    || email,
  ).trim()
}

export default async function handler(req, res) {
  try {
    const token = req.query?.token
    if (req.method === 'GET' && token) {
      const rows = await supabase(`${TABLE}?token=eq.${encodeURIComponent(token)}&select=${ONBOARDING_SELECT}`)
      if (!rows?.length) return res.status(404).json({ ok: false, error: 'This link is not valid' })
      return res.status(200).json({ ok: true, record: toRecord(rows[0]), submission: rows[0].submission })
    }
    if (req.method === 'PATCH' && token) {
      const rows = await supabase(`${TABLE}?token=eq.${encodeURIComponent(token)}&select=${ONBOARDING_SELECT}`)
      if (!rows?.length) return res.status(404).json({ ok: false, error: 'This link is not valid' })
      const existing = rows[0]
      const submission = req.body?.submission || null
      await supabase(`${TABLE}?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: {
          submission,
          updated_at: new Date().toISOString(),
        },
      })
      if (submission) await syncAt7(existing.id, 'submission', submission)
      else await refreshAt7Flags(existing.id)
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'GET') {
      await requireRole(req, ['sale', 'coordinator', 'edi'])
      const rows = await supabase(`${TABLE}?select=${ONBOARDING_SELECT}&order=created_at.desc`)
      return res.status(200).json({ ok: true, records: (rows || []).map(toRecord) })
    }

    if (req.method === 'POST') {
      const { profile } = await requireRole(req, ['sale'])
      const draft = req.body?.draft
      const email = String(draft?.customerEmail || '').trim()
      const technowRequestId = technowId(draft?.technowRequestId)
      if (!email) {
        return res.status(400).json({ ok: false, error: 'Customer email is required' })
      }
      if (!technowRequestId) {
        return res.status(400).json({ ok: false, error: 'Technow Request ID is required' })
      }
      const prefill = withTrader({ ...draft, technowRequestId }, { traderIdQa: '', traderIdProd: '' })
      if (!prefill.authorization?.name) {
        prefill.authorization = {
          ...(prefill.authorization || {}),
          name: agentName(prefill, profile),
          company: prefill.authorization?.company || 'Day & Ross',
        }
      }
      const body = {
        technow_request_id: technowRequestId,
        company_name: companyFromDraft(draft, email),
        customer_email: email,
        prefill,
        trader_id_qa: '',
        trader_id_prod: '',
      }
      try {
        const rows = await supabase(TABLE, { method: 'POST', body })
        const synced = await syncAt7(rows[0].id, 'prefill', prefill)
        return res.status(201).json({ ok: true, record: toRecord(synced) })
      } catch (error) {
        if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
          return res.status(409).json({ ok: false, error: `An onboarding with Technow Request ID "${technowRequestId}" already exists` })
        }
        throw error
      }
    }

    if (req.method === 'PATCH') {
      const { id, draft, traderIdQa, traderIdProd } = req.body || {}
      if (!id) return res.status(400).json({ ok: false, error: 'Missing onboarding id' })

      if (traderIdQa !== undefined || traderIdProd !== undefined) {
        await requireRole(req, ['coordinator'])
        const existing = await loadOnboarding(id)
        const current = pickTrader({ ...(existing.prefill || {}), trader_id_qa: existing.trader_id_qa, trader_id_prod: existing.trader_id_prod })
        const nextTrader = {
          traderIdQa: traderIdQa !== undefined ? String(traderIdQa || '').trim() : current.traderIdQa,
          traderIdProd: traderIdProd !== undefined ? String(traderIdProd || '').trim() : current.traderIdProd,
        }
        const prefill = withTrader(existing.prefill || {}, nextTrader)
        const rows = await supabase(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: {
            prefill,
            trader_id_qa: nextTrader.traderIdQa,
            trader_id_prod: nextTrader.traderIdProd,
            updated_at: new Date().toISOString(),
          },
        })
        return res.status(200).json({ ok: true, record: toRecord({ ...rows[0], onboarding_at7_code: existing.onboarding_at7_code }) })
      }

      await requireRole(req, ['sale'])
      if (!draft) return res.status(400).json({ ok: false, error: 'Missing onboarding' })
      const email = String(draft.customerEmail || '').trim()
      const technowRequestId = technowId(draft.technowRequestId)
      if (!email) return res.status(400).json({ ok: false, error: 'Customer email is required' })
      if (!technowRequestId) return res.status(400).json({ ok: false, error: 'Technow Request ID is required' })
      const existing = await loadOnboarding(id)
      const trader = pickTrader({ ...(existing.prefill || {}), trader_id_qa: existing.trader_id_qa, trader_id_prod: existing.trader_id_prod })
      const prefill = withTrader({ ...draft, technowRequestId }, trader)
      try {
        await supabase(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: {
            technow_request_id: technowRequestId,
            company_name: companyFromDraft(draft, email),
            customer_email: email,
            prefill,
            trader_id_qa: trader.traderIdQa,
            trader_id_prod: trader.traderIdProd,
            updated_at: new Date().toISOString(),
          },
        })
        const synced = await syncAt7(id, 'prefill', prefill)
        return res.status(200).json({ ok: true, record: toRecord(synced) })
      } catch (error) {
        if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
          return res.status(409).json({ ok: false, error: `An onboarding with Technow Request ID "${technowRequestId}" already exists` })
        }
        throw error
      }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (error) {
    const missing = error.code === 'PGRST205' || /onboarding|profiles|needs_at7|at7_/i.test(error.message || '')
    return res.status(missing && error.status !== 401 && error.status !== 403 && error.status !== 404 ? 503 : error.status || 500).json({
      ok: false,
      error: missing && error.status !== 401 && error.status !== 403 && error.status !== 404
        ? 'Onboarding / AT7 tables are missing. Run supabase/onboarding.sql (or supabase/onboarding_at7.sql on an existing DB) in the Supabase SQL editor.'
        : error.message,
    })
  }
}
