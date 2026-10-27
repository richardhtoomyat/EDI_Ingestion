import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shell } from './chrome.jsx'
import { CreateOnboarding } from './AgentApp.jsx'
import { emptyDeveloper } from './onboardingLink.js'
import { loadEdiTeam, loadOnboardings } from './onboardingLink.js'

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending-customer', label: 'Pending customer' },
  { value: 'pending-coordinator', label: 'Pending coordinator' },
  { value: 'ready', label: 'Ready' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'completed', label: 'Completed' },
]

function personName(team, id) {
  const person = team.find((item) => item.id === id)
  return person ? `${person.firstName} ${person.lastName}` : ''
}

function personFirstName(team, id) {
  const person = team.find((item) => item.id === id)
  return person?.firstName || person?.email || ''
}

function statusLabel(value, item, team = []) {
  if (value === 'assigned') {
    const first = personFirstName(team, item?.ownerId)
    return first ? `Assigned (${first})` : 'Assigned'
  }
  return STATUSES.find((status) => status.value === value)?.label || value
}

function formatCreated(value) {
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function techContact(record) {
  const draft = record.draft || {}
  const submission = record.submission || {}
  return {
    ...emptyDeveloper(),
    ...(draft.developer || {}),
    ...(submission.developer || {}),
  }
}

function techContactComplete(record) {
  const tech = techContact(record)
  return Boolean(
    String(tech.developerName || '').trim()
    && String(tech.email || '').trim()
    && String(tech.tel || '').trim(),
  )
}

function traderIdsComplete(record) {
  return Boolean(String(record.traderIdQa || '').trim() && String(record.traderIdProd || '').trim())
}

function deriveStatus(record, overlay = {}) {
  if (overlay.completed) return 'completed'
  if (overlay.ownerId) return 'assigned'
  if (!techContactComplete(record)) return 'pending-customer'
  if (!traderIdsComplete(record)) return 'pending-coordinator'
  return 'ready'
}

function recordToItem(record, overlays = {}) {
  const overlay = overlays[record.id] || {}
  const draft = record.draft || {}
  const submission = record.submission || {}
  const kickoff = Array.isArray(submission.kickoffWeeks)
    ? submission.kickoffWeeks
    : (Array.isArray(draft.kickoffWeeks) ? draft.kickoffWeeks : [])
  const tech = techContact(record)
  return {
    id: record.id,
    company: record.companyName || '—',
    email: record.customerEmail || '',
    agent: record.agentName || '—',
    created: formatCreated(record.createdAt),
    createdAt: record.createdAt || 0,
    status: deriveStatus(record, overlay),
    kickoff,
    technicalContact: tech.developerName || '',
    technicalEmail: tech.email || '',
    technicalMobile: tech.tel || '',
    mobileVerified: Boolean(tech.mobileVerified),
    ownerId: overlay.ownerId || '',
    completed: Boolean(overlay.completed),
    note: overlay.note || '',
    traderIdQa: record.traderIdQa || '',
    traderIdProd: record.traderIdProd || '',
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
  if (item.status === 'pending-customer') missing.push('Technical contact incomplete')
  if (item.status === 'pending-coordinator') missing.push('Trader ID QA/Prod missing')
  if (item.needsAt7Mapping) missing.push(item.at7CustomCount > 1 ? `Custom mapping (${item.at7CustomCount})` : 'Custom mapping')
  return missing
}

function OnboardingTable({ rows, team, onOpen, draggable = false }) {
  return (
    <table className="edi-table">
      <colgroup>
        <col className="edi-col-customer" />
        <col className="edi-col-agent" />
        <col className="edi-col-status" />
        <col className="edi-col-flags" />
        <col className="edi-col-action" />
      </colgroup>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Sales agent</th>
          <th>Status</th>
          <th>Flags</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr
            key={item.id}
            draggable={draggable}
            onDragStart={draggable ? (event) => event.dataTransfer.setData('text/plain', item.id) : undefined}
          >
            <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
            <td>{item.agent}</td>
            <td><span className={`edi-pill ${item.status}`}>{statusLabel(item.status, item, team)}</span></td>
            <td>{gaps(item).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</td>
            <td><button type="button" className="secondary status-edit" onClick={() => onOpen(item.id)}>Open</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EdiDashboardPreview() {
  return (
    <EdiDashboard
      profile={{ firstName: 'Alex', lastName: 'EDI', role: 'edi' }}
      onSignOut={() => {}}
    />
  )
}

export default function EdiDashboard({ profile, onSignOut }) {
  const [tab, setTab] = useState('board')
  const [records, setRecords] = useState([])
  const [team, setTeam] = useState([])
  const [overlays, setOverlays] = useState({})
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [agent, setAgent] = useState('all')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState(null)
  const [dragOver, setDragOver] = useState('')
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  useEffect(() => {
    let cancel = false
    setLoading(true)
    Promise.all([loadOnboardings(), loadEdiTeam()])
      .then(([nextRecords, nextTeam]) => {
        if (cancel) return
        setRecords(nextRecords)
        setTeam(nextTeam)
        setLoadError('')
      })
      .catch((error) => {
        if (cancel) return
        setLoadError(error.message)
        setRecords([])
        setTeam([])
      })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [])

  const items = useMemo(
    () => records.map((record) => recordToItem(record, overlays)),
    [records, overlays],
  )
  const agents = [...new Set(items.map((item) => item.agent).filter(Boolean))].sort()
  const sortBoard = (list) => [...list].sort((a, b) => {
    const aDone = a.status === 'completed' ? 1 : 0
    const bDone = b.status === 'completed' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  const rows = useMemo(() => {
    const filtered = items.filter((item) => {
      const haystack = `${item.company} ${item.email} ${item.agent}`.toLowerCase()
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
      if (status !== 'all' && item.status !== status) return false
      if (agent !== 'all' && item.agent !== agent) return false
      return true
    })
    return sortBoard(filtered)
  }, [items, query, status, agent])
  const myRows = useMemo(() => {
    if (!profile?.id) return []
    return sortBoard(items.filter((item) => item.ownerId === profile.id))
  }, [items, profile?.id])
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

  const openRecord = (id) => {
    const record = records.find((item) => item.id === id)
    if (record) {
      setOpenId('')
      setEditing(record)
    }
  }

  if (editing) {
    return (
      <CreateOnboarding
        profile={profile}
        record={editing}
        onCancel={() => setEditing(null)}
        onCreated={(saved) => {
          setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)))
          setEditing(saved)
        }}
      />
    )
  }

  return (
    <Shell title="EDI Portal" onSignOut={onSignOut}>
      <main className="page edi-page">
        {welcome && <p className="welcome-line">Welcome, {welcome}</p>}
        <div className="dash-top">
          <div>
            <h2 className="dash-title">
              {tab === 'mine' ? 'My assignment'
                : tab === 'team' ? 'EDI team'
                  : tab === 'calendar' ? 'Kickoff calendar'
                    : 'All onboardings'}
            </h2>
          </div>
          <div className="edi-tabs" role="tablist">
            {[['board', 'Onboardings'], ['mine', 'My Assignment'], ['team', 'Team'], ['calendar', 'Kickoff']].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={`secondary edi-tab${tab === value ? ' active' : ''}`} onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
        </div>

        {loadError && <div className="banner err" role="alert">{loadError}</div>}
        {loading && <p className="intro">Loading onboardings…</p>}

        {tab === 'board' && !loading && (
          <>
            <div className="edi-stats">
              <div><b>{items.filter((item) => item.status !== 'completed').length}</b><span>Active</span></div>
              <div><b>{items.filter((item) => item.status === 'assigned').length}</b><span>Assigned</span></div>
              <div><b>{items.filter((item) => item.status === 'ready').length}</b><span>Ready</span></div>
              <div><b>{items.filter((item) => item.status === 'completed').length}</b><span>Completed</span></div>
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
              </div>
              {rows.length === 0 ? (
                <p className="intro">No onboardings match these filters.</p>
              ) : (
                <OnboardingTable rows={rows} team={team} onOpen={setOpenId} draggable />
              )}
            </section>
          </>
        )}

        {tab === 'mine' && !loading && (
          <section className="card">
            {myRows.length === 0 ? (
              <p className="intro">No customers are assigned to you yet. Assign one from Team or Open → EDI owner.</p>
            ) : (
              <OnboardingTable rows={myRows} team={team} onOpen={setOpenId} />
            )}
          </section>
        )}

        {tab === 'team' && !loading && (
          <div className="workbuckets">
            {team.length === 0 && (
              <section className="card">
                <p className="intro">No EDI accounts yet. Team members appear here after they create an account with the EDI role.</p>
              </section>
            )}
            {team.map((person) => {
              const bucket = items.filter((item) => item.ownerId === person.id)
              return (
                <section
                  key={person.id}
                  className={`card workbucket${dragOver === person.id ? ' over' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(person.id) }}
                  onDragLeave={() => setDragOver('')}
                  onDrop={onDropOwner(person.id)}
                >
                  <h3>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.email}</h3>
                  <p className="intro">{person.email}</p>
                  <p className="bucket-label">Workbucket</p>
                  {bucket.length === 0 && <p className="intro">Drag an onboarding here.</p>}
                  {bucket.map((item) => (
                    <button key={item.id} type="button" className="bucket-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)} onClick={() => setOpenId(item.id)}>
                      <strong>{item.company}</strong>
                      <span>{statusLabel(item.status, item, team)}</span>
                      {item.needsAt7Mapping && <span className="edi-flag">Custom mapping</span>}
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
              {items.filter((item) => !item.ownerId && item.status !== 'completed').map((item) => (
                <button key={item.id} type="button" className="bucket-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)} onClick={() => setOpenId(item.id)}>
                  <strong>{item.company}</strong>
                  <span>{statusLabel(item.status, item, team)}</span>
                  {item.needsAt7Mapping && <span className="edi-flag">Custom mapping</span>}
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
                    {customers.map((item) => <p key={item.id}>{item.company}<span>{personName(team, item.ownerId) || item.agent}</span></p>)}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

      </main>
      {open && createPortal(
        <div className="edi-detail" role="dialog" aria-modal="true" aria-label={`${open.company} onboarding`}>
          <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setOpenId('')} />
          <div className="edi-sheet">
            <div className="dash-top">
              <div>
                <h2>{open.company}</h2>
                <p className="edi-created">Created on {open.created}</p>
                <p className="intro">Sales Agent: {open.agent || '—'}</p>
                <p className="intro">Coordinator: {personName(team, open.ownerId) || '—'}</p>
              </div>
              <button type="button" className="secondary status-edit" onClick={() => setOpenId('')}>Close</button>
            </div>
            <section className="edi-tech">
              <h3>Technical contact</h3>
              <p className="intro"><span>Name:</span> {open.technicalContact}</p>
              <p className="intro"><span>Email:</span> {open.technicalEmail}</p>
              <p className="intro"><span>Mobile:</span> {open.technicalMobile}</p>
            </section>
            <p><span className={`edi-pill ${open.status}`}>{statusLabel(open.status, open, team)}</span></p>
            {gaps(open).length > 0 && <div className="flag-row">{gaps(open).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</div>}
            <p className="intro">Trader ID QA: {open.traderIdQa || '—'} · Trader ID Prod: {open.traderIdProd || '—'}</p>
            <h3>214 codes</h3>
            {open.codes.length === 0 && <p className="intro">No 214 statuses selected yet.</p>}
            {open.needsAt7Mapping && (
              <p className="intro">Custom mapping values need EDI work before go-live.</p>
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
              <select
                value={open.ownerId}
                onChange={(event) => assign(open.id, event.target.value)}
              >
                <option value="">Unassigned</option>
                {team.map((person) => (
                  <option key={person.id} value={person.id}>
                    {[person.firstName, person.lastName].filter(Boolean).join(' ') || person.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Internal note</span>
              <textarea rows={3} value={open.note} placeholder="Only the EDI team sees this" onChange={(event) => patch(open.id, { note: event.target.value })} />
            </label>
            <div className="actions">
              <button type="button" onClick={() => openRecord(open.id)}>View form</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Shell>
  )
}
