import { useState } from 'react'
import { Shell } from './chrome.jsx'

const DUMMY = [
  { id: 'amazon', company: 'Amazon', email: 'edi@amazon.com', agent: 'Maya Chen', submitted: 'Oct 26, 2026', qa: '', prod: '' },
  { id: 'canadiantire', company: 'Canadian Tire', email: 'edi@canadiantire.ca', agent: 'Maya Chen', submitted: 'Oct 25, 2026', qa: 'CT-QA-1044', prod: '' },
  { id: 'costco', company: 'Costco', email: 'edi@costco.ca', agent: 'Chris Patel', submitted: 'Oct 27, 2026', qa: '', prod: '' },
]

export default function CoordinatorPage({ profile, onSignOut }) {
  const [items, setItems] = useState(DUMMY)
  const [openId, setOpenId] = useState('')
  const open = items.find((item) => item.id === openId)
  const [qa, setQa] = useState('')
  const [prod, setProd] = useState('')
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  const choose = (item) => {
    setOpenId(item.id)
    setQa(item.qa)
    setProd(item.prod)
  }
  const save = (event) => {
    event.preventDefault()
    setItems((current) => current.map((item) => (item.id === openId ? { ...item, qa: qa.trim(), prod: prod.trim() } : item)))
    setOpenId('')
  }
  const assigned = items.filter((item) => item.qa && item.prod).length

  return (
    <Shell title="EDI Coordinator">
      <main className="page edi-page">
        {welcome && <p className="welcome-line">Welcome, {welcome}</p>}
        <div className="dash-top">
          <div>
            <h2 className="dash-title">Submitted onboardings</h2>
            <p className="intro">Dummy data. Assign a QA trader id and a production trader id. This page is not connected to the database yet.</p>
          </div>
          {onSignOut && (
            <div className="actions">
              <button type="button" className="secondary" onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
        <div className="edi-stats">
          <div><b>{items.length}</b><span>Submitted</span></div>
          <div><b>{assigned}</b><span>Both trader ids set</span></div>
          <div><b>{items.length - assigned}</b><span>Still to assign</span></div>
        </div>
        <section className="card">
          <table className="edi-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Sales agent</th>
                <th>Submitted</th>
                <th>TraderID (QA)</th>
                <th>TraderID (Prod)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
                  <td>{item.agent}</td>
                  <td>{item.submitted}</td>
                  <td>{item.qa || '—'}</td>
                  <td>{item.prod || '—'}</td>
                  <td><button type="button" className="secondary status-edit" onClick={() => choose(item)}>Assign</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {open && (
          <div className="edi-detail" role="dialog" aria-label={`Assign trader ids for ${open.company}`}>
            <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setOpenId('')} />
            <form className="edi-sheet" onSubmit={save}>
              <div className="dash-top">
                <h2>{open.company}</h2>
                <button type="button" className="secondary status-edit" onClick={() => setOpenId('')}>Close</button>
              </div>
              <p className="intro">{open.email} · Sales agent {open.agent} · Submitted {open.submitted}</p>
              <label className="field">
                <span>TraderID (QA)</span>
                <input value={qa} autoComplete="off" onChange={(event) => setQa(event.target.value)} />
              </label>
              <label className="field">
                <span>TraderID (Prod)</span>
                <input value={prod} autoComplete="off" onChange={(event) => setProd(event.target.value)} />
              </label>
              <div className="actions">
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </Shell>
  )
}
