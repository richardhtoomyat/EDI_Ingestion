import { DEVELOPER_FIELDS, PARTY_FIELDS, SERVICES, TRANSACTION_SETS, initialState } from './formConfig.js'

function emptySftpDetails() {
  return { ...initialState().sftpDetails }
}

export function emptyAuthorization() {
  return { ...initialState().authorization }
}
import { accessToken } from './auth.js'

const SERVICE_VALUES = new Set(SERVICES.map((service) => service.value))
const SET_CODES = new Set(TRANSACTION_SETS.map((item) => item.code))

const party = () => ({ ...Object.fromEntries(PARTY_FIELDS.map((field) => [field.name, ''])), accountSystem: '' })
const developer = () => Object.fromEntries(DEVELOPER_FIELDS.map((field) => [field.name, '']))

export function emptyCustomerDetails() {
  return {
    as400AccountNumber: '',
    as400AccountNumberTest: '',
    truckmateId: '',
    truckmateIdQa: '',
    oracleId: '',
    oracleIdQa: '',
    companyName: '',
    addressCountry: 'ca',
    address: '',
    city: '',
    region: '',
    postal: '',
    businessContactName: '',
    businessContactPhone: '',
    businessContactEmail: '',
  }
}

export function emptyDeveloper() {
  return developer()
}

export function padAs400(value) {
  const core = String(value || '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 7)
  return core ? core.padStart(7, '0') : ''
}

export function emptyDraft() {
  return {
    customerEmail: '',
    technowRequestId: '',
    type: 'New',
    services: [],
    mainAccount: party(),
    logisticsProvider: party(),
    customerDetails: emptyCustomerDetails(),
    developer: emptyDeveloper(),
    sets: [],
    hosting: '',
    as2: false,
    as2Certificate: null,
    sftp: false,
    sftpDetails: emptySftpDetails(),
    authorization: emptyAuthorization(),
    normalStatuses: [],
    normalCodes: {},
    normalOpen: [],
    exceptionStatuses: [],
    exceptionCodes: {},
    exceptionOpen: [],
    additionalLocations: '',
    paymentHouse: { companyName: '', contactName: '' },
  }
}

function normalizeHosting(draft) {
  if (draft?.hosting === 'dayross' || draft?.hosting === 'customer') return draft.hosting
  if (draft?.sftp || draft?.as2) return 'customer'
  return ''
}

export function mergePrefill(draft) {
  const base = initialState()
  if (!draft) return base
  const mainAccount = { ...base.mainAccount, ...(draft.mainAccount || {}) }
  if (!mainAccount.email && draft.customerEmail) mainAccount.email = draft.customerEmail
  return {
    ...base,
    type: draft.type === 'Revised' ? 'Revised' : 'New',
    services: Array.isArray(draft.services) ? draft.services.filter((value) => SERVICE_VALUES.has(value)) : [],
    technowRequestId: draft.technowRequestId || '',
    mainAccount,
    logisticsProvider: { ...base.logisticsProvider, ...(draft.logisticsProvider || {}) },
    customerDetails: { ...emptyCustomerDetails(), ...(draft.customerDetails || {}) },
    developer: { ...base.developer, ...(draft.developer || {}) },
    sets: Array.isArray(draft.sets) ? draft.sets.filter((code) => SET_CODES.has(code)) : [],
    hosting: normalizeHosting(draft),
    as2: Boolean(draft.as2) && normalizeHosting(draft) === 'customer',
    as2Certificate: draft.as2Certificate && typeof draft.as2Certificate === 'object'
      ? draft.as2Certificate
      : null,
    sftp: Boolean(draft.sftp) && normalizeHosting(draft) === 'customer',
    sftpDetails: { ...base.sftpDetails, ...(draft.sftpDetails || {}) },
    authorization: { ...base.authorization, ...(draft.authorization || {}) },
    normalStatuses: Array.isArray(draft.normalStatuses) ? draft.normalStatuses : [],
    normalCodes: draft.normalCodes && typeof draft.normalCodes === 'object' ? draft.normalCodes : {},
    normalOpen: Array.isArray(draft.normalOpen) ? draft.normalOpen : [],
    exceptionStatuses: Array.isArray(draft.exceptionStatuses) ? draft.exceptionStatuses : [],
    exceptionCodes: draft.exceptionCodes && typeof draft.exceptionCodes === 'object' ? draft.exceptionCodes : {},
    exceptionOpen: Array.isArray(draft.exceptionOpen) ? draft.exceptionOpen : [],
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
  // Local-only previews — never available on Vercel production builds
  if (import.meta.env.DEV && path === '/dev/sale') return { kind: 'salePreview' }
  if (import.meta.env.DEV && path === '/dev/edi') return { kind: 'ediPreview' }
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

export async function loadEdiTeam() {
  const response = await fetch('/api/profiles?role=edi', { headers: await authHeaders() })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load EDI team')
  return {
    profiles: payload.profiles || [],
    teamHidden: Array.isArray(payload.teamHidden) ? payload.teamHidden : [],
  }
}

export async function updateEdiTeamView({ teamViewOrder, teamHidden } = {}) {
  const body = {}
  if (Array.isArray(teamViewOrder)) body.teamViewOrder = teamViewOrder
  if (Array.isArray(teamHidden)) body.teamHidden = teamHidden
  const response = await fetch('/api/profiles', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save team view')
  return {
    teamViewOrder: Array.isArray(payload.teamViewOrder) ? payload.teamViewOrder : [],
    teamHidden: Array.isArray(payload.teamHidden) ? payload.teamHidden : [],
  }
}

export async function loadOrganization() {
  const response = await fetch('/api/profiles?role=all', { headers: await authHeaders() })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not load organization')
  return payload.profiles || []
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

export function updateTraderIds(id, { traderIdQa, traderIdProd }) {
  return sendOnboarding('/api/onboardings', 'PATCH', { id, traderIdQa, traderIdProd })
}

export async function inviteUsers({ emails, role, message }) {
  const response = await fetch('/api/invite', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      emails,
      role,
      message,
      redirectTo: window.location.origin,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Could not send invitations')
    error.failed = payload.failed
    throw error
  }
  return payload
}

export function updateEdiAssignment(id, { ediOwnerId, ediNote, completed, ediStage, estimatedCompletionDate, ediBucketOrder }) {
  const body = { id }
  if (ediOwnerId !== undefined) body.ediOwnerId = ediOwnerId
  if (ediNote !== undefined) body.ediNote = ediNote
  if (completed !== undefined) body.completed = completed
  if (ediStage !== undefined) body.ediStage = ediStage
  if (estimatedCompletionDate !== undefined) body.estimatedCompletionDate = estimatedCompletionDate
  if (ediBucketOrder !== undefined) body.ediBucketOrder = ediBucketOrder
  return sendOnboarding('/api/onboardings', 'PATCH', body)
}

export async function reorderEdiBucket(bucketOrders) {
  const response = await fetch('/api/onboardings', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ bucketOrders }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save workbucket order')
  return payload.records || []
}

export function traderLabel(value) {
  const text = String(value || '').trim()
  return text || 'Not available'
}

export function saveSubmission(token, submission) {
  return fetch(`/api/onboardings?token=${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission }),
  })
}
