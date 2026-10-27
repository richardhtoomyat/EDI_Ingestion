import { PARTY_FIELDS, initialState } from './formConfig.js'
import { accessToken } from './auth.js'

const party = () => ({ ...Object.fromEntries(PARTY_FIELDS.map((field) => [field.name, ''])), accountSystem: '' })

export function emptyDraft() {
  return {
    customerEmail: '',
    type: 'New',
    services: [],
    mainAccount: party(),
    logisticsProvider: party(),
    additionalLocations: '',
    paymentHouse: { companyName: '', contactName: '' },
  }
}

export function mergePrefill(draft) {
  const base = initialState()
  if (!draft) return base
  const mainAccount = { ...base.mainAccount, ...(draft.mainAccount || {}) }
  if (!mainAccount.email && draft.customerEmail) mainAccount.email = draft.customerEmail
  return {
    ...base,
    type: draft.type === 'Revised' ? 'Revised' : 'New',
    services: Array.isArray(draft.services) ? draft.services.filter((value) => value === 'ltl-tl' || value === 'commerce') : [],
    mainAccount,
    logisticsProvider: { ...base.logisticsProvider, ...(draft.logisticsProvider || {}) },
    additionalLocations: draft.additionalLocations || '',
    paymentHouse: { ...base.paymentHouse, ...(draft.paymentHouse || {}) },
  }
}

function encode(draft) {
  const bytes = new TextEncoder().encode(JSON.stringify(draft))
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function decode(token) {
  const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4))
  const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/') + pad)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function onboardingUrl(record) {
  if (record?.token) return `${window.location.origin}/c/${record.token}`
  const draft = record?.draft || record
  return `${window.location.origin}/c#${encode(draft)}`
}

export function customerRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/edi' || path === '/coordinator') return { kind: 'agent' }
  if (path.startsWith('/c/')) {
    const token = decodeURIComponent(path.slice(3))
    return token ? { kind: 'token', token } : { kind: 'invalid' }
  }
  if (path !== '/c') return { kind: 'agent' }
  return { kind: 'hash' }
}

export function readCustomerDraft() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path !== '/c') return undefined
  const token = window.location.hash.replace(/^#/, '')
  if (!token) return null
  try {
    const draft = decode(token)
    if (!draft || typeof draft !== 'object' || !draft.mainAccount) return null
    return draft
  } catch {
    return null
  }
}

async function authHeaders() {
  const token = await accessToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function loadOnboardings() {
  const response = await fetch('/api/onboardings', { headers: await authHeaders() })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Could not load onboardings')
    error.missingTable = response.status === 503
    throw error
  }
  return payload.records || []
}

async function sendOnboarding(path, method, body) {
  const response = await fetch(path, {
    method,
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save the onboarding')
  return payload.record
}

export function saveOnboarding(draft) {
  return sendOnboarding('/api/onboardings', 'POST', { draft })
}

export function updateOnboarding(id, draft) {
  return sendOnboarding('/api/onboardings', 'PATCH', { id, draft })
}

export function saveSubmission(token, submission) {
  return fetch(`/api/onboardings?token=${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission }),
  })
}
