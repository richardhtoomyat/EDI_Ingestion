import { useEffect, useState } from 'react'
import { PARTY_FIELDS, SERVICES } from './formConfig.js'
import { Shell, Chevron } from './chrome.jsx'
import {
  emptyDraft, loadOnboardings, onboardingUrl, saveOnboarding, updateOnboarding,
} from './onboardingLink.js'

const ACCOUNT_SYSTEMS = ['TruckMate', 'AS400']

function padAs400(value) {
  const core = String(value).replace(/^0+/, '').slice(0, 7)
  return core ? core.padStart(7, '0') : ''
}

function TextField({ label, value, onChange, type = 'text', required }) {
  return (
    <label className="field">
      <span>{label}{required && <b className="req"> *</b>}</span>
      <input type={type} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function PartyFields({ title, prefix, values, onChange }) {
  const set = (name, value) => onChange({ ...values, [name]: value })
  const chooseSystem = (system) => {
    const accountNumber = system === 'AS400' ? padAs400(values.accountNumber) : values.accountNumber.replace(/^0+/, '')
    onChange({ ...values, accountSystem: system, accountNumber })
  }
  return (
    <div>
      <h3>{title}</h3>
      <TextField
        label="Account #"
        value={values.accountNumber}
        onChange={(value) => set('accountNumber', values.accountSystem === 'AS400' ? padAs400(value) : value)}
      />
      <fieldset>
        <legend>Is this account # TruckMate or AS400?</legend>
        {ACCOUNT_SYSTEMS.map((system) => (
          <label key={system} className="inline">
            <input type="radio" name={`${prefix}-accountSystem`} checked={values.accountSystem === system} onChange={() => chooseSystem(system)} /> {system}
          </label>
        ))}
      </fieldset>
      {PARTY_FIELDS.filter((field) => field.name !== 'accountNumber').map((field) => (
        <TextField key={field.name} label={field.label} type={field.type === 'email' ? 'email' : 'text'} required={prefix === 'agent-main' && field.name === 'companyName'} value={values[field.name]} onChange={(value) => set(field.name, value)} />
      ))}
    </div>
  )
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="link-row">
      <input readOnly value={url} aria-label="Customer link" onFocus={(e) => e.target.select()} />
      <button type="button" className="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return <button type="button" className="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
}

function Dashboard({ profile, records, error, onCreate, onView, onSignOut }) {
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
  return (
    <Shell title="EDI Sales Agent">
      <main className="page">
        {welcome && <p className="welcome-line">Welcome, {welcome}</p>}
        <div className="dash-top">
          <h2 className="dash-title">Onboardings</h2>
          <div className="actions">
            <button type="button" className="secondary" onClick={onSignOut}>Sign out</button>
            <button type="button" onClick={onCreate}>New onboarding <Chevron /></button>
          </div>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        {records.length === 0 ? (
          <section className="card"><p className="intro">No onboardings yet. Create one to get a link for the customer.</p></section>
        ) : (
          <div className="onboard-list">
            {records.map((record) => (
              <section key={record.id} className="card onboard-item">
                <div>
                  <strong>{record.companyName}</strong>
                  <div className="intro">{record.customerEmail}</div>
                  <div className="intro">{new Date(record.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div className="row-actions">
                  <CopyLinkButton url={onboardingUrl(record)} />
                  <button type="button" className="secondary" onClick={() => onView(record)}>View form</button>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </Shell>
  )
}

function CreateOnboarding({ record, onCancel, onCreated }) {
  const [draft, setDraft] = useState(() => (record ? structuredClone(record.draft) : emptyDraft()))
  const [error, setError] = useState('')
  const setParty = (key) => (next) => setDraft((current) => ({ ...current, [key]: next }))
  const submit = async (event) => {
    event.preventDefault()
    const email = draft.customerEmail.trim()
    const company = draft.mainAccount.companyName.trim()
    if (!company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter the main account company name and a valid customer email.')
      return
    }
    const next = { ...draft, customerEmail: email, mainAccount: { ...draft.mainAccount, companyName: company } }
    try {
      const saved = record ? await updateOnboarding(record.id, next) : await saveOnboarding(next)
      onCreated(saved)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Shell title="EDI Sales Agent">
      <main className="page">
        <form onSubmit={submit} noValidate>
          <section className="card">
            <h2>{record ? 'Edit onboarding' : 'New customer onboarding'}</h2>
            <p className="intro">Fill in what you already know. The customer completes the EDI technical contact, transaction sets, communication, kickoff weeks, and the authorization.</p>
            {error && <div className="banner err" role="alert">{error}</div>}
            <TextField label="Customer email" type="email" required value={draft.customerEmail} onChange={(customerEmail) => setDraft((current) => ({ ...current, customerEmail }))} />
            <div className="row">
              <fieldset>
                <legend>Type</legend>
                {['New', 'Revised'].map((type) => (
                  <label key={type} className="inline">
                    <input type="radio" name="agent-type" checked={draft.type === type} onChange={() => setDraft((current) => ({ ...current, type }))} /> {type}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Service</legend>
                {SERVICES.map((service) => (
                  <label key={service.value} className="inline">
                    <input
                      type="checkbox"
                      checked={draft.services.includes(service.value)}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        services: current.services.includes(service.value)
                          ? current.services.filter((value) => value !== service.value)
                          : [...current.services, service.value],
                      }))}
                    /> {service.label}
                  </label>
                ))}
              </fieldset>
            </div>
          </section>
          <section className="card">
            <h2>Accounts and contacts</h2>
            <div className="cols">
              <PartyFields title="Main Account" prefix="agent-main" values={draft.mainAccount} onChange={setParty('mainAccount')} />
              <PartyFields title="Logistics Provider" prefix="agent-lp" values={draft.logisticsProvider} onChange={setParty('logisticsProvider')} />
            </div>
            <div className="cols sub">
              <div>
                <h3>Additional locations</h3>
                <label className="field">
                  <span>Indicate Account # or Name & Address</span>
                  <textarea rows={4} value={draft.additionalLocations} onChange={(e) => setDraft((current) => ({ ...current, additionalLocations: e.target.value }))} />
                </label>
              </div>
              <div>
                <h3>Payment house</h3>
                <TextField label="Company Name" value={draft.paymentHouse.companyName} onChange={(companyName) => setDraft((current) => ({ ...current, paymentHouse: { ...current.paymentHouse, companyName } }))} />
                <TextField label="Contact Name" value={draft.paymentHouse.contactName} onChange={(contactName) => setDraft((current) => ({ ...current, paymentHouse: { ...current.paymentHouse, contactName } }))} />
              </div>
            </div>
          </section>
          <div className="actions">
            <button type="button" className="secondary" onClick={onCancel}>Back</button>
            <button type="submit">{record ? 'Save' : 'Create'} <Chevron /></button>
          </div>
        </form>
      </main>
    </Shell>
  )
}

function Created({ record, onDone }) {
  return (
    <Shell title="EDI Sales Agent">
      <main className="page">
        <section className="card">
          <h2>Onboarding created</h2>
          <p className="intro">Send this link to {record.customerEmail}. It opens their form with the details you entered.</p>
          <CopyLink url={onboardingUrl(record)} />
        </section>
        <div className="actions"><button type="button" onClick={onDone}>Back to onboardings <Chevron /></button></div>
      </main>
    </Shell>
  )
}

export function InvalidLink() {
  return (
    <Shell>
      <main className="page">
        <section className="card">
          <h2>This link is not valid</h2>
          <p className="intro">Ask your Day & Ross sales agent for a new onboarding link.</p>
        </section>
      </main>
    </Shell>
  )
}

export default function AgentApp({ profile, onSignOut }) {
  const [view, setView] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [created, setCreated] = useState(null)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (view === 'create' || view === 'edit') return
    let cancel = false
    loadOnboardings()
      .then((next) => { if (!cancel) { setRecords(next); setLoadError('') } })
      .catch((error) => { if (!cancel) setLoadError(error.message) })
    return () => { cancel = true }
  }, [view])

  if (view === 'create' || view === 'edit') {
    return (
      <CreateOnboarding
        record={view === 'edit' ? editing : null}
        onCancel={() => setView('dashboard')}
        onCreated={(saved) => {
          setRecords((current) => view === 'edit'
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...current.filter((item) => item.id !== saved.id)])
          if (view === 'edit') {
            setEditing(null)
            setView('dashboard')
            return
          }
          setCreated(saved)
          setView('created')
        }}
      />
    )
  }
  if (view === 'created' && created) return <Created record={created} onDone={() => setView('dashboard')} />
  return (
    <Dashboard
      profile={profile}
      records={records}
      error={loadError}
      onCreate={() => { setEditing(null); setView('create') }}
      onView={(record) => { setEditing(record); setView('edit') }}
      onSignOut={onSignOut}
    />
  )
}
