import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shell } from './chrome.jsx'
import { loadOnboardings, traderLabel, updateTraderIds } from './onboardingLink.js'

function formatSubmitted(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CoordinatorPage({ profile, onSignOut }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState('')
  const open = items.find((item) => item.id === openId)
  const [qa, setQa] = useState('')
  const [prod, setProd] = useState('')
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
  const assigned = items.filter((item) => item.traderIdQa && item.traderIdProd).length

  const refresh = async () => {
    const records = await loadOnboardings()
    setItems(records)
    setError('')
  }

  useEffect(() => {
    let cancel = false
    loadOnboardings()
      .then((records) => { if (!cancel) { setItems(records); setError('') } })
      .catch((err) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [])

  const choose = (item) => {
    setOpenId(item.id)
    setQa(item.traderIdQa || '')
    setProd(item.traderIdProd || '')
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!open) return
    setBusy(true)
    setError('')
    try {
      const saved = await updateTraderIds(open.id, { traderIdQa: qa, traderIdProd: prod })
      setItems((current) => current.map((item) => (item.id === saved.id ? saved : item)))
      setOpenId('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="EDI Coordinator" onSignOut={onSignOut}>
      <main className="page edi-page">
        {welcome && <p className="welcome-line">Welcome, {welcome}</p>}
        <div className="dash-top">
          <div>
            <h2 className="dash-title">Submitted onboardings</h2>
            <p className="intro">Assign a QA trader id and a production trader id. Sales can see these on the edit form.</p>
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => refresh().catch((err) => setError(err.message))} disabled={busy}>Refresh</button>
          </div>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        <div className="edi-stats">
          <div><b>{items.length}</b><span>Onboardings</span></div>
          <div><b>{assigned}</b><span>Both trader ids set</span></div>
          <div><b>{items.length - assigned}</b><span>Still to assign</span></div>
        </div>
        <section className="card">
          {items.length === 0 ? (
            <p className="intro">No onboardings in the database yet.</p>
          ) : (
            <table className="edi-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Technow ID</th>
                  <th>Sales agent</th>
                  <th>Created</th>
                  <th>TraderID (QA)</th>
                  <th>TraderID (Prod)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.companyName}</strong><div className="intro">{item.customerEmail}</div></td>
                    <td>{item.technowRequestId || item.id}</td>
                    <td>{item.agentName || '—'}</td>
                    <td>{formatSubmitted(item.createdAt)}</td>
                    <td>{traderLabel(item.traderIdQa)}</td>
                    <td>{traderLabel(item.traderIdProd)}</td>
                    <td><button type="button" className="secondary status-edit" onClick={() => choose(item)}>Assign</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      {open && createPortal(
        <div className="edi-detail" role="dialog" aria-modal="true" aria-label={`Assign trader ids for ${open.companyName}`}>
          <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setOpenId('')} />
          <form className="edi-sheet" onSubmit={save}>
            <div className="dash-top">
              <h2>{open.companyName}</h2>
              <button type="button" className="secondary status-edit" onClick={() => setOpenId('')}>Close</button>
            </div>
            <p className="intro">{open.customerEmail} · Technow {open.technowRequestId || open.id} · Sales agent {open.agentName || '—'} · Created {formatSubmitted(open.createdAt)}</p>
            <label className="field">
              <span>TraderID (QA)</span>
              <input value={qa} autoComplete="off" onChange={(event) => setQa(event.target.value)} />
            </label>
            <label className="field">
              <span>TraderID (Prod)</span>
              <input value={prod} autoComplete="off" onChange={(event) => setProd(event.target.value)} />
            </label>
            <div className="actions">
              <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </Shell>
  )
}
