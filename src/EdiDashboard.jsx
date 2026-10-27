import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shell } from './chrome.jsx'
import { CreateOnboarding } from './AgentApp.jsx'
import { emptyDeveloper, loadEdiTeam, loadOnboardings, updateEdiAssignment } from './onboardingLink.js'

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending-customer', label: 'Pending customer' },
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'started', label: 'Started' },
  { value: 'test', label: 'Test' },
  { value: 'production', label: 'Production' },
]

const EDI_STAGES = [
  { value: 'started', label: 'Started' },
  { value: 'test', label: 'Test' },
  { value: 'production', label: 'Production' },
]

const DAY_MS = 24 * 60 * 60 * 1000

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

function deriveStatus(record) {
  if (record.ediStage === 'production' || record.completedAt) return 'production'
  if (record.ediStage === 'test') return 'test'
  if (record.ediStage === 'started') return 'started'
  if (record.ediOwnerId) return 'assigned'
  if (!techContactComplete(record)) return 'pending-customer'
  if (!traderIdsComplete(record)) return 'pending'
  return 'ready'
}

function isDoneStatus(status) {
  return status === 'production'
}

function recordToItem(record) {
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
    status: deriveStatus(record),
    kickoff,
    technicalContact: tech.developerName || '',
    technicalEmail: tech.email || '',
    technicalMobile: tech.tel || '',
    mobileVerified: Boolean(tech.mobileVerified),
    ownerId: record.ediOwnerId || '',
    ediStage: record.ediStage || '',
    estimatedCompletionDate: record.estimatedCompletionDate || '',
    completed: Boolean(record.completedAt) || record.ediStage === 'production',
    note: record.ediNote || '',
    readyAt: record.readyAt || null,
    assignedAt: record.assignedAt || null,
    startedAt: record.startedAt || null,
    testAt: record.testAt || null,
    productionAt: record.productionAt || null,
    completedAt: record.completedAt || record.productionAt || null,
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
  if (item.status === 'pending') missing.push('Trader ID QA/Prod missing')
  if (item.needsAt7Mapping) missing.push(item.at7CustomCount > 1 ? `Custom mapping (${item.at7CustomCount})` : 'Custom mapping')
  return missing
}

function avgDays(samples) {
  if (!samples.length) return null
  const total = samples.reduce((sum, value) => sum + value, 0)
  return total / samples.length
}

function formatAvgDays(value) {
  if (value == null) return '—'
  if (value < 1) return `${Math.round(value * 24)}h`
  return `${value.toFixed(1)}d`
}

function startOfDay(ms) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dayKey(ms) {
  const date = new Date(ms)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ageDays(fromMs, now = Date.now()) {
  if (!fromMs) return 0
  return Math.max(0, Math.floor((now - fromMs) / DAY_MS))
}

function ageBucket(days) {
  if (days <= 2) return 'fresh'
  if (days <= 7) return 'warn'
  return 'stale'
}

function buildCompletionCalendar(items, weeks = 26) {
  const today = startOfDay(Date.now())
  const counts = new Map()
  items.forEach((item) => {
    if (!item.completedAt) return
    const key = dayKey(item.completedAt)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const start = new Date(today)
  start.setDate(start.getDate() - ((weeks * 7) - 1) - start.getDay())
  const days = []
  for (let i = 0; i < weeks * 7; i += 1) {
    const ms = start.getTime() + (i * DAY_MS)
    const key = dayKey(ms)
    days.push({
      key,
      ms,
      count: counts.get(key) || 0,
      future: ms > today,
      label: new Date(ms).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    })
  }
  const weekStarts = []
  for (let i = 0; i < weeks; i += 1) weekStarts.push(days[i * 7])
  return { days, weekStarts, counts }
}

function completionLevel(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

function OnboardingTable({ rows, team, onOpen, draggable = false }) {
  return (
    <table className="edi-table">
      <colgroup>
        <col className="edi-col-customer" />
        <col className="edi-col-status" />
        <col className="edi-col-flags" />
        <col className="edi-col-action" />
      </colgroup>
      <thead>
        <tr>
          <th>Customer</th>
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
            <td><span className={`edi-pill ${item.status}`}>{statusLabel(item.status, item, team)}</span></td>
            <td>{gaps(item).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</td>
            <td><button type="button" className="secondary status-edit" onClick={() => onOpen(item.id)}>Open</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function KpiTab({ items, onOpen }) {
  const now = Date.now()
  const readyUnassigned = useMemo(
    () => items
      .filter((item) => item.status === 'ready' && !item.ownerId)
      .map((item) => ({
        ...item,
        age: ageDays(item.readyAt || item.createdAt, now),
      }))
      .sort((a, b) => b.age - a.age),
    [items, now],
  )

  const avgCreatedToReady = useMemo(() => {
    const samples = items
      .filter((item) => item.readyAt && item.createdAt)
      .map((item) => (item.readyAt - item.createdAt) / DAY_MS)
    return avgDays(samples)
  }, [items])

  const avgCreatedToComplete = useMemo(() => {
    const samples = items
      .filter((item) => item.completedAt && item.createdAt)
      .map((item) => (item.completedAt - item.createdAt) / DAY_MS)
    return avgDays(samples)
  }, [items])

  const calendar = useMemo(() => buildCompletionCalendar(items, 26), [items])
  const weekStart = startOfDay(now) - (new Date(now).getDay() * DAY_MS)
  const completedThisWeek = items.filter((item) => item.completedAt && item.completedAt >= weekStart).length
  const monthLabels = useMemo(() => {
    const labels = []
    let last = ''
    calendar.weekStarts.forEach((day, index) => {
      const label = new Date(day.ms).toLocaleDateString('en-CA', { month: 'short' })
      if (label !== last) {
        labels.push({ index, label })
        last = label
      }
    })
    return labels
  }, [calendar])

  return (
    <>
      <div className="edi-stats kpi-stats">
        <div>
          <b>{formatAvgDays(avgCreatedToReady)}</b>
          <span>Avg created → ready</span>
        </div>
        <div>
          <b>{formatAvgDays(avgCreatedToComplete)}</b>
          <span>Avg created → complete</span>
        </div>
        <div>
          <b>{readyUnassigned.length}</b>
          <span>Ready unassigned</span>
        </div>
        <div>
          <b>{completedThisWeek}</b>
          <span>Completed this week</span>
        </div>
      </div>

      <section className="card">
        <div className="dash-top">
          <div>
            <h3 className="dash-title">Completions</h3>
            <p className="intro">Last 26 weeks · darker = more completions that day</p>
          </div>
          <p className="intro">{completedThisWeek} this week</p>
        </div>
        <div className="kpi-calendar" role="img" aria-label="Completion activity calendar">
          <div className="kpi-cal-months" style={{ gridTemplateColumns: `repeat(${calendar.weekStarts.length}, 12px)` }}>
            {monthLabels.map((item) => (
              <span key={`${item.label}-${item.index}`} style={{ gridColumn: item.index + 1 }}>{item.label}</span>
            ))}
          </div>
          <div className="kpi-cal-body">
            <div className="kpi-cal-dow" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="kpi-cal-grid" style={{ gridTemplateColumns: `repeat(${calendar.weekStarts.length}, 12px)` }}>
              {calendar.days.map((day) => (
                <span
                  key={day.key}
                  className={`kpi-cal-cell level-${day.future ? 0 : completionLevel(day.count)}`}
                  title={day.future ? '' : `${day.label}: ${day.count} completed`}
                />
              ))}
            </div>
          </div>
          <div className="kpi-cal-legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`kpi-cal-cell level-${level}`} />)}
            <span>More</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="dash-title">Ready unassigned</h3>
        <p className="intro">Aging from the Ready timestamp (or created date if Ready was never stamped).</p>
        {readyUnassigned.length === 0 ? (
          <p className="intro">Nothing waiting in Ready.</p>
        ) : (
          <table className="edi-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Age</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {readyUnassigned.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
                  <td><span className={`edi-pill age-${ageBucket(item.age)}`}>{item.age}d</span></td>
                  <td><button type="button" className="secondary status-edit" onClick={() => onOpen(item.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
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
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState(null)
  const [dragOver, setDragOver] = useState('')
  const [stagePrompt, setStagePrompt] = useState(null)
  const [estimateDraft, setEstimateDraft] = useState('')
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

  const items = useMemo(() => records.map(recordToItem), [records])
  const sortBoard = (list) => [...list].sort((a, b) => {
    const aDone = isDoneStatus(a.status) ? 1 : 0
    const bDone = isDoneStatus(b.status) ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  const rows = useMemo(() => {
    const filtered = items.filter((item) => {
      const haystack = `${item.company} ${item.email}`.toLowerCase()
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
      if (status !== 'all' && item.status !== status) return false
      return true
    })
    return sortBoard(filtered)
  }, [items, query, status])
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

  const applyRecord = (saved) => {
    setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)))
  }

  const persistEdi = async (id, patch) => {
    setBusyId(id)
    setSaveError('')
    try {
      const saved = await updateEdiAssignment(id, patch)
      applyRecord(saved)
      return saved
    } catch (error) {
      setSaveError(error.message)
      throw error
    } finally {
      setBusyId('')
    }
  }

  const assign = (id, ownerId) => {
    persistEdi(id, { ediOwnerId: ownerId }).catch(() => {})
  }

  const requestStage = (item, stage) => {
    if (stage === 'started') {
      setEstimateDraft(item.estimatedCompletionDate || '')
      setStagePrompt({ id: item.id, company: item.company, stage: 'started' })
      return
    }
    persistEdi(item.id, { ediStage: stage }).catch(() => {})
  }

  const confirmStartStage = async () => {
    if (!stagePrompt) return
    const date = String(estimateDraft || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSaveError('Enter an estimated completion date')
      return
    }
    try {
      await persistEdi(stagePrompt.id, { ediStage: 'started', estimatedCompletionDate: date })
      setStagePrompt(null)
      setEstimateDraft('')
    } catch {
      // saveError already set
    }
  }

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

  const tabTitle = {
    board: 'All onboardings',
    mine: 'My assignment',
    team: 'EDI team',
    calendar: 'Kickoff calendar',
    kpi: 'KPIs',
  }[tab] || 'All onboardings'

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
            <h2 className="dash-title">{tabTitle}</h2>
          </div>
          <div className="edi-tabs" role="tablist">
            {[['board', 'Onboardings'], ['mine', 'My Assignment'], ['team', 'Team'], ['calendar', 'Kickoff'], ['kpi', 'KPIs']].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={`secondary edi-tab${tab === value ? ' active' : ''}`} onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
        </div>

        {loadError && <div className="banner err" role="alert">{loadError}</div>}
        {saveError && <div className="banner err" role="alert">{saveError}</div>}
        {loading && <p className="intro">Loading onboardings…</p>}

        {tab === 'board' && !loading && (
          <>
            <div className="edi-stats">
              <div><b>{items.filter((item) => !isDoneStatus(item.status)).length}</b><span>Active</span></div>
              <div><b>{items.filter((item) => item.status === 'started').length}</b><span>Started</span></div>
              <div><b>{items.filter((item) => item.status === 'test').length}</b><span>Test</span></div>
              <div><b>{items.filter((item) => item.status === 'production').length}</b><span>Production</span></div>
            </div>
            <section className="card">
              <div className="edi-filters">
                <label className="field">
                  <span>Search</span>
                  <input value={query} placeholder="Company or email" onChange={(event) => setQuery(event.target.value)} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
              {items.filter((item) => !item.ownerId && !isDoneStatus(item.status)).map((item) => (
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

        {tab === 'kpi' && !loading && (
          <KpiTab items={items} onOpen={setOpenId} />
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
                <p className="intro">EDI owner: {personName(team, open.ownerId) || '—'}</p>
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
            {open.estimatedCompletionDate && (
              <p className="intro">Estimated completion: {open.estimatedCompletionDate}</p>
            )}
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
                disabled={busyId === open.id}
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
              <textarea
                rows={3}
                value={open.note}
                placeholder="Only the EDI team sees this"
                disabled={busyId === open.id}
                onChange={(event) => {
                  const note = event.target.value
                  setRecords((current) => current.map((item) => (
                    item.id === open.id ? { ...item, ediNote: note } : item
                  )))
                }}
                onBlur={(event) => {
                  persistEdi(open.id, { ediNote: event.target.value }).catch(() => {})
                }}
              />
            </label>
            <div className="actions stage-actions">
              <button type="button" className="secondary" onClick={() => openRecord(open.id)}>View form</button>
              {(tab === 'mine' || open.ownerId === profile?.id) && (
                <label className="stage-dropdown">
                  <span className="visually-hidden">Update stage</span>
                  <select
                    value={open.ediStage || ''}
                    disabled={busyId === open.id}
                    onChange={(event) => {
                      const next = event.target.value
                      if (!next) return
                      requestStage(open, next)
                    }}
                  >
                    <option value="" disabled>{open.ediStage ? 'Change stage…' : 'Set stage…'}</option>
                    {EDI_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {stagePrompt && createPortal(
        <div className="edi-detail stage-prompt" role="dialog" aria-modal="true" aria-label="Estimated completion date">
          <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setStagePrompt(null)} />
          <form
            className="edi-sheet stage-prompt-sheet"
            onSubmit={(event) => {
              event.preventDefault()
              confirmStartStage()
            }}
          >
            <div className="dash-top">
              <div>
                <h2>Start {stagePrompt.company}</h2>
                <p className="intro">Enter the estimated completion date to move this onboarding to Started.</p>
              </div>
              <button type="button" className="secondary status-edit" onClick={() => setStagePrompt(null)}>Cancel</button>
            </div>
            <label className="field">
              <span>Estimated completion date</span>
              <input
                type="date"
                required
                value={estimateDraft}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setEstimateDraft(event.target.value)}
              />
            </label>
            <div className="actions">
              <button type="submit" disabled={busyId === stagePrompt.id}>
                {busyId === stagePrompt.id ? 'Saving…' : 'Start'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </Shell>
  )
}
