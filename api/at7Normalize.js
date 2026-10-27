import { NORMAL_STATUSES, EXCEPTION_STATUSES } from '../src/formConfig.js'

export function statusId(status, index) {
  return `${status.code}:${index}:${status.name}`
}

function findStatus(list, id) {
  const index = list.findIndex((status, i) => statusId(status, i) === id)
  if (index < 0) return null
  return { status: list[index], index }
}

function resolveCodes(status, id, edits) {
  const edit = edits?.[id]
  return {
    at701: String(edit?.at701 ?? status.at701 ?? '').trim(),
    at702: String(edit?.at702 ?? status.at702 ?? '').trim(),
  }
}

function rowFor(groupKind, list, id, edits, source) {
  const found = findStatus(list, id)
  if (!found) return null
  const { status } = found
  const codes = resolveCodes(status, id, edits)
  const customFields = []
  if (codes.at701 !== status.at701) customFields.push('at701')
  if (codes.at702 !== status.at702) customFields.push('at702')
  return {
    source,
    group_kind: groupKind,
    status_key: id,
    status_name: status.name,
    status_code: status.code,
    default_at701: status.at701,
    default_at702: status.at702,
    at701: codes.at701,
    at702: codes.at702,
    is_custom: customFields.length > 0,
    custom_fields: customFields,
  }
}

/** Build normalized AT7 rows from a draft/prefill/submission payload. */
export function normalizeAt7(draft, source) {
  if (!draft || typeof draft !== 'object') return []
  if (!Array.isArray(draft.sets) || !draft.sets.includes('214')) return []

  const normalIds = Array.isArray(draft.normalStatuses) ? draft.normalStatuses : []
  const exceptionIds = Array.isArray(draft.exceptionStatuses) ? draft.exceptionStatuses : []
  const normalCodes = draft.normalCodes && typeof draft.normalCodes === 'object' ? draft.normalCodes : {}
  const exceptionCodes = draft.exceptionCodes && typeof draft.exceptionCodes === 'object' ? draft.exceptionCodes : {}

  return [
    ...normalIds.map((id) => rowFor('normal', NORMAL_STATUSES, id, normalCodes, source)),
    ...exceptionIds.map((id) => rowFor('exception', EXCEPTION_STATUSES, id, exceptionCodes, source)),
  ].filter(Boolean)
}

export function at7CustomCount(rows) {
  return (rows || []).filter((row) => row.is_custom).length
}
