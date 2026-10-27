import { NORMAL_STATUSES, EXCEPTION_STATUSES } from './formConfig.js'
import { Chevron, Shell } from './chrome.jsx'

export function statusId(status, index) {
  return `${status.code}:${index}:${status.name}`
}

export function codesFor(status, index, edits) {
  const id = statusId(status, index)
  return edits?.[id] || { at701: status.at701, at702: status.at702 }
}

export function statusCodeText(ids, list, edits) {
  return ids.map((id) => {
    const found = list.find((status, index) => statusId(status, index) === id)
    if (!found) return null
    const index = list.indexOf(found)
    const codes = codesFor(found, index, edits)
    const custom = codes.at701 !== found.at701 || codes.at702 !== found.at702
    return `${found.name} (${codes.at701}/${codes.at702}${custom ? ', custom' : ''})`
  }).filter(Boolean).join('\n')
}

function StatusCodeList({ title, list, selected, codeEdits, openIds, group, onToggle, onCustomize, onSave, onCode }) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="status-code-head" aria-hidden="true">
        <span>Description</span>
        <span>AT7-01</span>
        <span>AT7-02</span>
        <span />
      </div>
      <ul className="status-codes">
        {list.map((status, index) => {
          const id = statusId(status, index)
          const codes = codesFor(status, index, codeEdits)
          const open = openIds.includes(id)
          return (
            <li key={id}>
              <label>
                <input type="checkbox" checked={selected.includes(id)} onChange={() => onToggle(group, id)} />
                <span>{status.name}</span>
              </label>
              {['at701', 'at702'].map((field) => (
                <input
                  key={field}
                  className={`code-box${codes[field] !== status[field] ? ' edited' : ''}`}
                  aria-label={`${status.name} ${field === 'at701' ? 'AT7-01' : 'AT7-02'}`}
                  value={codes[field]}
                  disabled={!open}
                  maxLength={4}
                  onChange={(event) => onCode(group, id, field, event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                />
              ))}
              <button type="button" className="secondary status-edit" onClick={() => (open ? onSave(group, id, status) : onCustomize(group, id, status))}>{open ? 'Save' : 'Customize'}</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function StatusPage({
  title,
  normal,
  exception,
  normalCodes = {},
  normalOpen = [],
  exceptionCodes = {},
  exceptionOpen = [],
  onToggle,
  onCustomize,
  onSave,
  onCode,
  onBack,
  onContinue,
  continueLabel = 'Next',
  error,
}) {
  return (
    <Shell title={title}>
      <main className="page">
        <section className="card">
          <h2>214 Status <small>Select the statuses Day &amp; Ross should send</small></h2>
          {error && <div className="banner err" role="alert">{error}</div>}
          <div className="status-stack">
            <StatusCodeList title="Normal Status" list={NORMAL_STATUSES} selected={normal} codeEdits={normalCodes} openIds={normalOpen} group="normalStatuses" onToggle={onToggle} onCustomize={onCustomize} onSave={onSave} onCode={onCode} />
            <StatusCodeList title="Exception Status" list={EXCEPTION_STATUSES} selected={exception} codeEdits={exceptionCodes} openIds={exceptionOpen} group="exceptionStatuses" onToggle={onToggle} onCustomize={onCustomize} onSave={onSave} onCode={onCode} />
          </div>
        </section>
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Back</button>
          <button type="button" onClick={onContinue}>{continueLabel} <Chevron /></button>
        </div>
      </main>
    </Shell>
  )
}

export { NORMAL_STATUSES, EXCEPTION_STATUSES }
