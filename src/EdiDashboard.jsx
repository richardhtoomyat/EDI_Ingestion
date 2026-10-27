import { useEffect, useMemo, useState } from 'react'
import { Shell } from './chrome.jsx'
import { loadOnboardings } from './onboardingLink.js'

const TEAM = [
  { id: 'priya', firstName: 'Priya', lastName: 'Shah', email: 'priya.shah@dayross.com' },
  { id: 'owen', firstName: 'Owen', lastName: 'Blake', email: 'owen.blake@dayross.com' },
  { id: 'lena', firstName: 'Lena', lastName: 'Cho', email: 'lena.cho@dayross.com' },
]

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'link-sent', label: 'Link sent' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'ready', label: 'Ready for setup' },
  { value: 'returned', label: 'Returned to sales' },
]

function statusLabel(value) {
  return STATUSES.find((status) => status.value === value)?.label || value
}

function personName(team, id) {
  const person = team.find((item) => item.id === id)
  return person ? `${person.firstName} ${person.lastName}` : ''
}

function formatCreated(value) {
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function recordToItem(record, overlays = {}) {
  const overlay = overlays[record.id] || {}
  const draft = record.draft || {}
  const kickoff = Array.isArray(draft.kickoffWeeks) ? draft.kickoffWeeks : []
  const technicalContact = draft.developer?.name || ''
  const mobileVerified = Boolean(draft.developer?.mobileVerified)
  return {
    id: record.id,
    company: record.companyName || '—',
    email: record.customerEmail || '',
    agent: record.agentName || '—',
    created: formatCreated(record.createdAt),
    status: overlay.status || (record.submitted ? 'submitted' : 'link-sent'),
    kickoff,
    technicalContact,
    mobileVerified,
    ownerId: overlay.ownerId || '',
    note: overlay.note || '',
    needsAt7Mapping: Boolean(record.needsAt7Mapping),
    at7CustomCount: record.at7CustomCount || 0,
    codes: (record.at7Codes || []).map((code) => ({
      name: code.name,
      at701: code.at701,
      at702: code.at702,
      custom: code.custom || [],
      isCustom: Boolean(code.isCustom),
    })),
  }
}

function gaps(item) {
  const missing = []
  if (item.needsAt7Mapping) missing.push(`Custom AT7 mapping${item.at7CustomCount ? ` (${item.at7CustomCount})` : ''}`)
  if (!item.kickoff.length) missing.push('No kickoff weeks')
  if (!item.technicalContact) missing.push('No EDI technical contact')
  if (!item.mobileVerified) missing.push('Mobile not verified')
  return missing
}

export default function EdiDashboard({ profile, onSignOut }) {
  const [tab, setTab] = useState('board')
  const [records, setRecords] = useState([])
  const [overlays, setOverlays] = useState({})
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [agent, setAgent] = useState('all')
  const [mappingOnly, setMappingOnly] = useState(false)
  const [openId, setOpenId] = useState('')
  const [dragOver, setDragOver] = useState('')
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  useEffect(() => {
    let cancel = false
    setLoading(true)
    loadOnboardings()
      .then((next) => {
        if (cancel) return
        setRecords(next)
        setLoadError('')
      })
      .catch((error) => {
        if (cancel) return
        setLoadError(error.message)
        setRecords([])
      })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [])

  const items = useMemo(
    () => records.map((record) => recordToItem(record, overlays)),
    [records, overlays],
  )
  const agents = [...new Set(items.map((item) => item.agent).filter(Boolean))].sort()
  const rows = useMemo(() => items.filter((item) => {
    const haystack = `${item.company} ${item.email} ${item.agent}`.toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    if (status !== 'all' && item.status !== status) return false
    if (agent !== 'all' && item.agent !== agent) return false
    if (mappingOnly && !item.needsAt7Mapping) return false
    return true
  }), [items, query, status, agent, mappingOnly])
  const open = items.find((item) => item.id === openId)
  const weeks = useMemo(() => {
    const map = new Map()
    items.forEach((item) => item.kickoff.forEach((week) => {
      map.set(week, [...(map.get(week) || []), item])
    }))
    return [...map.entries()]
  }, [items])

  const assign = (id, ownerId) => setOverlays((current) => ({ ...current, [id]: { ...current[id], ownerId } }))
  const patch = (id, next) => setOverlays((current) => ({ ...current, [id]: { ...current[id], ...next } }))
  const onDropOwner = (ownerId) => (event) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    if (id) assign(id, ownerId)
    setDragOver('')
  }

  return (
    <Shell title="EDI Portal">
      <main className="page edi-page">
        {welcome && <p className="welcome-line">Welcome, {welcome}</p>}
        <div className="dash-top">
          <div>
            <h2 className="dash-title">{tab === 'team' ? 'EDI team' : tab === 'calendar' ? 'Kickoff calendar' : 'All onboardings'}</h2>
            <p className="intro">Onboardings from the database. Custom AT7-01/AT7-02 values are flagged for EDI mapping.</p>
          </div>
          <div className="actions">
            {onSignOut && <button type="button" className="secondary" onClick={onSignOut}>Sign out</button>}
            <div className="edi-tabs" role="tablist">
              {[['board', 'Onboardings'], ['team', 'Team'], ['calendar', 'Kickoff']].map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className={`secondary edi-tab${tab === value ? ' active' : ''}`} onClick={() => setTab(value)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {loadError && <div className="banner err" role="alert">{loadError}</div>}
        {loading && <p className="intro">Loading onboardings…</p>}

        {tab === 'board' && !loading && (
          <>
            <div className="edi-stats">
              <div><b>{items.length}</b><span>Onboardings</span></div>
              <div><b>{items.filter((item) => item.needsAt7Mapping).length}</b><span>Need AT7 mapping</span></div>
              <div><b>{items.filter((item) => gaps(item).length).length}</b><span>Need attention</span></div>
              <div><b>{items.filter((item) => item.ownerId).length}</b><span>In a workbucket</span></div>
            </div>
            <section className="card">
              <div className="edi-filters">
                <label className="field">
                  <span>Search</span>
                  <input value={query} placeholder="Company, email, or sales agent" onChange={(event) => setQuery(event.target.value)} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Sales agent</span>
                  <select value={agent} onChange={(event) => setAgent(event.target.value)}>
                    <option value="all">All agents</option>
                    {agents.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label className="field checkbox">
                  <span>AT7 mapping only</span>
                  <input type="checkbox" checked={mappingOnly} onChange={(event) => setMappingOnly(event.target.checked)} />
                </label>
              </div>
              {rows.length === 0 ? (
                <p className="intro">No onboardings match these filters.</p>
              ) : (
                <table className="edi-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Sales agent</th>
                      <th>Working</th>
                      <th>Status</th>
                      <th>Flags</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}>
                        <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
                        <td>{item.agent}</td>
                        <td>{personName(TEAM, item.ownerId) || '—'}</td>
                        <td><span className={`edi-pill ${item.status}`}>{statusLabel(item.status)}</span></td>
                        <td>{gaps(item).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</td>
                        <td><button type="button" className="secondary status-edit" onClick={() => setOpenId(item.id)}>Open</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}

        {tab === 'team' && !loading && (
          <div className="workbuckets">
            {TEAM.map((person) => {
              const bucket = items.filter((item) => item.ownerId === person.id)
              return (
                <section
                  key={person.id}
                  className={`card workbucket${dragOver === person.id ? ' over' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(person.id) }}
                  onDragLeave={() => setDragOver('')}
                  onDrop={onDropOwner(person.id)}
                >
                  <h3>{person.firstName} {person.lastName}</h3>
                  <p className="intro">{person.email}</p>
                  <p className="bucket-label">Workbucket</p>
                  {bucket.length === 0 && <p className="intro">Drag an onboarding here.</p>}
                  {bucket.map((item) => (
                    <button key={item.id} type="button" className="bucket-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)} onClick={() => setOpenId(item.id)}>
                      <strong>{item.company}</strong>
                      <span>{item.agent}</span>
                      {item.needsAt7Mapping && <span className="edi-flag">Custom AT7</span>}
                    </button>
                  ))}
                </section>
              )
            })}
            <section
              className={`card workbucket${dragOver === 'none' ? ' over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragOver('none') }}
              onDragLeave={() => setDragOver('')}
              onDrop={onDropOwner('')}
            >
              <h3>Unassigned</h3>
              <p className="intro">Not in anyone's workbucket yet.</p>
              {items.filter((item) => !item.ownerId).map((item) => (
                <button key={item.id} type="button" className="bucket-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)} onClick={() => setOpenId(item.id)}>
                  <strong>{item.company}</strong>
                  <span>{item.agent}</span>
                  {item.needsAt7Mapping && <span className="edi-flag">Custom AT7</span>}
                </button>
              ))}
            </section>
          </div>
        )}

        {tab === 'calendar' && !loading && (
          <section className="card">
            <h3>Shared kickoff weeks</h3>
            {weeks.length === 0 ? (
              <p className="intro">No kickoff weeks selected yet.</p>
            ) : (
              <div className="kickoff-board">
                {weeks.map(([week, customers]) => (
                  <article key={week} className={customers.length > 1 ? 'clash' : ''}>
                    <strong>{week}</strong>
                    {customers.length > 1 && <span className="edi-flag">Two customers this week</span>}
                    {customers.map((item) => <p key={item.id}>{item.company}<span>{personName(TEAM, item.ownerId) || item.agent}</span></p>)}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {open && (
          <div className="edi-detail" role="dialog" aria-label={`${open.company} onboarding`}>
            <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setOpenId('')} />
            <div className="edi-sheet">
              <div className="dash-top">
                <h2>{open.company}</h2>
                <button type="button" className="secondary status-edit" onClick={() => setOpenId('')}>Close</button>
              </div>
              <p className="intro">{open.email} · Sales agent {open.agent} · Created {open.created}</p>
              <p>{personName(TEAM, open.ownerId) ? `${personName(TEAM, open.ownerId)} is working on this.` : 'Nobody on the EDI team has this yet.'}</p>
              {gaps(open).length > 0 && <div className="flag-row">{gaps(open).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</div>}
              <h3>214 codes</h3>
              {open.codes.length === 0 && <p className="intro">No 214 statuses selected yet.</p>}
              {open.needsAt7Mapping && (
                <p className="intro">Custom AT7 values need EDI mapping before go-live.</p>
              )}
              <ul className="code-review">
                {open.codes.map((code) => (
                  <li key={`${code.name}-${code.at701}-${code.at702}`}>
                    <span>{code.name}{code.isCustom ? ' (custom)' : ''}</span>
                    <b className={code.custom.includes('at701') ? 'custom-code' : ''}>{code.at701}</b>
                    <b className={code.custom.includes('at702') ? 'custom-code' : ''}>{code.at702}</b>
                  </li>
                ))}
              </ul>
              <label className="field">
                <span>EDI owner</span>
                <select value={open.ownerId} onChange={(event) => assign(open.id, event.target.value)}>
                  <option value="">Unassigned</option>
                  {TEAM.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Internal note</span>
                <textarea rows={3} value={open.note} placeholder="Only the EDI team sees this" onChange={(event) => patch(open.id, { note: event.target.value })} />
              </label>
              <div className="actions">
                <button type="button" onClick={() => patch(open.id, { status: 'ready' })}>Ready for setup</button>
                <button type="button" className="secondary" onClick={() => patch(open.id, { status: 'returned' })}>Return to sales</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Shell>
  )
}
