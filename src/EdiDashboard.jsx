import { useMemo, useState } from 'react'
import { Shell } from './chrome.jsx'

const TEAM = [
  { id: 'priya', firstName: 'Priya', lastName: 'Shah', email: 'priya.shah@dayross.com' },
  { id: 'owen', firstName: 'Owen', lastName: 'Blake', email: 'owen.blake@dayross.com' },
  { id: 'lena', firstName: 'Lena', lastName: 'Cho', email: 'lena.cho@dayross.com' },
]

const DUMMY = [
  {
    id: 'amazon',
    company: 'Amazon',
    email: 'edi@amazon.com',
    agent: 'Maya Chen',
    created: 'Oct 20, 2026',
    status: 'submitted',
    kickoff: ['Nov 9 – 15', 'Nov 16 – 22'],
    technicalContact: 'Ada Lovelace',
    mobileVerified: true,
    ownerId: 'priya',
    note: '',
    codes: [
      { name: 'Depart Shipper', at701: 'ZZ', at702: 'NS', custom: ['at701'] },
      { name: 'Out for Delivery', at701: 'X6', at702: 'NS', custom: [] },
      { name: 'Refused', at701: 'A7', at702: 'BS', custom: [] },
    ],
  },
  {
    id: 'walmart',
    company: 'Walmart',
    email: 'edi@walmart.com',
    agent: 'Chris Patel',
    created: 'Oct 21, 2026',
    status: 'in-progress',
    kickoff: ['Nov 9 – 15'],
    technicalContact: '',
    mobileVerified: false,
    ownerId: '',
    note: '',
    codes: [
      { name: 'Arrive Consignee', at701: 'X1', at702: 'NS', custom: [] },
    ],
  },
  {
    id: 'canadiantire',
    company: 'Canadian Tire',
    email: 'edi@canadiantire.ca',
    agent: 'Maya Chen',
    created: 'Oct 22, 2026',
    status: 'submitted',
    kickoff: [],
    technicalContact: 'Sam Roy',
    mobileVerified: true,
    ownerId: '',
    note: '',
    codes: [
      { name: 'Picked up', at701: 'CP', at702: 'NS', custom: [] },
      { name: 'Weather Delay', at701: 'SD', at702: 'WX', custom: ['at702'] },
    ],
  },
  {
    id: 'loblaw',
    company: 'Loblaw',
    email: 'edi@loblaw.ca',
    agent: 'Chris Patel',
    created: 'Oct 24, 2026',
    status: 'link-sent',
    kickoff: [],
    technicalContact: '',
    mobileVerified: false,
    ownerId: 'owen',
    note: '',
    codes: [],
  },
  {
    id: 'costco',
    company: 'Costco',
    email: 'edi@costco.ca',
    agent: 'Maya Chen',
    created: 'Oct 25, 2026',
    status: 'submitted',
    kickoff: ['Nov 23 – 29'],
    technicalContact: 'Jordan Lee',
    mobileVerified: false,
    ownerId: '',
    note: '',
    codes: [
      { name: 'Complete Delivery', at701: 'D1', at702: 'OK', custom: ['at702'] },
    ],
  },
]

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'link-sent', label: 'Link sent' },
  { value: 'in-progress', label: 'In progress' },
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

function gaps(item) {
  const missing = []
  if (!item.kickoff.length) missing.push('No kickoff weeks')
  if (!item.technicalContact) missing.push('No EDI technical contact')
  if (!item.mobileVerified) missing.push('Mobile not verified')
  return missing
}

export default function EdiDashboard() {
  const [tab, setTab] = useState('board')
  const [items, setItems] = useState(DUMMY)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [agent, setAgent] = useState('all')
  const [openId, setOpenId] = useState('')
  const [dragOver, setDragOver] = useState('')
  const agents = [...new Set(items.map((item) => item.agent))].sort()
  const rows = useMemo(() => items.filter((item) => {
    const haystack = `${item.company} ${item.email} ${item.agent}`.toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    if (status !== 'all' && item.status !== status) return false
    if (agent !== 'all' && item.agent !== agent) return false
    return true
  }), [items, query, status, agent])
  const open = items.find((item) => item.id === openId)
  const weeks = useMemo(() => {
    const map = new Map()
    items.forEach((item) => item.kickoff.forEach((week) => {
      map.set(week, [...(map.get(week) || []), item])
    }))
    return [...map.entries()]
  }, [items])

  const assign = (id, ownerId) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ownerId } : item)))
  const patch = (id, next) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)))
  const onDropOwner = (ownerId) => (event) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    if (id) assign(id, ownerId)
    setDragOver('')
  }

  return (
    <Shell title="EDI Portal">
      <main className="page edi-page">
        <div className="dash-top">
          <div>
            <h2 className="dash-title">{tab === 'team' ? 'EDI team' : tab === 'calendar' ? 'Kickoff calendar' : 'All onboardings'}</h2>
            <p className="intro">Dummy data for the EDI portal. It will be cleared when this connects to the database.</p>
          </div>
          <div className="edi-tabs" role="tablist">
            {[['board', 'Onboardings'], ['team', 'Team'], ['calendar', 'Kickoff']].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={`secondary edi-tab${tab === value ? ' active' : ''}`} onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
        </div>

        {tab === 'board' && (
          <>
            <div className="edi-stats">
              <div><b>{items.length}</b><span>Onboardings</span></div>
              <div><b>{items.filter((item) => gaps(item).length).length}</b><span>Need attention</span></div>
              <div><b>{items.filter((item) => item.status === 'ready').length}</b><span>Ready for setup</span></div>
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
              </div>
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
            </section>
          </>
        )}

        {tab === 'team' && (
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
                </button>
              ))}
            </section>
          </div>
        )}

        {tab === 'calendar' && (
          <section className="card">
            <h3>Shared kickoff weeks</h3>
            <div className="kickoff-board">
              {weeks.map(([week, customers]) => (
                <article key={week} className={customers.length > 1 ? 'clash' : ''}>
                  <strong>{week}</strong>
                  {customers.length > 1 && <span className="edi-flag">Two customers this week</span>}
                  {customers.map((item) => <p key={item.id}>{item.company}<span>{personName(TEAM, item.ownerId) || item.agent}</span></p>)}
                </article>
              ))}
            </div>
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
              <p className="intro">{open.email} · Sales agent {open.agent}</p>
              <p>{personName(TEAM, open.ownerId) ? `${personName(TEAM, open.ownerId)} is working on this.` : 'Nobody on the EDI team has this yet.'}</p>
              {gaps(open).length > 0 && <div className="flag-row">{gaps(open).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</div>}
              <h3>214 codes</h3>
              {open.codes.length === 0 && <p className="intro">The customer has not selected statuses yet.</p>}
              <ul className="code-review">
                {open.codes.map((code) => (
                  <li key={code.name}>
                    <span>{code.name}</span>
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
