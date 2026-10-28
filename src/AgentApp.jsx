import { useEffect, useState } from 'react'
import { DEVELOPER_FIELDS, NORMAL_STATUSES, EXCEPTION_STATUSES, SERVICES, SFTP_FIELDS, TRANSACTION_SETS } from './formConfig.js'
import { Shell, Chevron, EDI_EMAIL } from './chrome.jsx'
import {
  emptyAuthorization, emptyCustomerDetails, emptyDeveloper, emptyDraft, loadOnboardings, padAs400, saveOnboarding, traderLabel, updateOnboarding,
} from './onboardingLink.js'
import AddressField from './AddressField.jsx'
import RegionField from './RegionField.jsx'
import PhoneField from './PhoneField.jsx'
import HostingRequest from './HostingRequest.jsx'
import As2CertificateField from './As2CertificateField.jsx'
import StatusPage, { statusCodeText } from './StatusPage.jsx'
import { formatPostal, normalizeRegion, regionsForCountry } from './addressPlaces.js'

const wants214 = (draft) => Array.isArray(draft?.sets) && draft.sets.includes('214')
const toggleList = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

function TextField({ label, value, onChange, type = 'text', required, readOnly }) {
  return (
    <label className={`field${readOnly ? ' locked' : ''}`}>
      <span>{label}{required && <b className="req"> *</b>}</span>
      <input
        type={type}
        value={value}
        autoComplete="off"
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
      />
    </label>
  )
}

function agentSignerName(profile) {
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
}

function agentAuthLocks(profile) {
  return {
    name: agentSignerName(profile),
    company: 'Day & Ross',
    date: new Date().toISOString().slice(0, 10),
  }
}

function CopyFormIdButton({ id }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const value = String(id || '')
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const input = document.createElement('input')
      input.value = value
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return <button type="button" className="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy form ID'}</button>
}

function Dashboard({
  profile, records, error, onCreate, onView, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
}) {
  const [query, setQuery] = useState('')
  const firstName = profile?.firstName || ''
  const needle = query.trim().toLowerCase()
  const filtered = !needle
    ? records
    : records.filter((record) => {
      const haystack = [
        record.id,
        record.companyName,
        record.customerEmail,
        record.technowRequestId,
      ].map((value) => String(value || '').toLowerCase()).join(' ')
      return haystack.includes(needle)
    })

  return (
    <Shell
      title="EDI Sales Agent"
      subtitle={firstName ? `Welcome, ${firstName}` : ''}
      profile={profile}
      onSignOut={onSignOut}
      onAccount={onAccount}
      onSwitchWorkplace={onSwitchWorkplace}
      onAdministration={onAdministration}
      currentWorkplace={currentWorkplace}
    >
      <main className="page edi-page">
        <div className="dash-top">
          <h2 className="dash-title">Onboardings</h2>
          <div className="actions">
            <button type="button" onClick={onCreate}>New onboarding <Chevron /></button>
          </div>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        <label className="field dash-search">
          <span>Search by form ID</span>
          <input
            value={query}
            placeholder="Paste UUID or search company / email"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        {records.length === 0 ? (
          <section className="card"><p className="intro">No onboardings yet. Create one to get started.</p></section>
        ) : filtered.length === 0 ? (
          <section className="card"><p className="intro">No onboardings match that form ID.</p></section>
        ) : (
          <div className="onboard-list">
            {filtered.map((record) => (
              <section key={record.id} className="card onboard-item">
                <div>
                  <strong>{record.companyName}</strong>
                  <div className="intro">{record.customerEmail}</div>
                  <div className="intro">{new Date(record.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div className="intro form-id">{record.id}</div>
                </div>
                <div className="row-actions">
                  <CopyFormIdButton id={record.id} />
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

function salesShellProps(account, title = 'EDI Sales Agent') {
  const firstName = account?.profile?.firstName || ''
  return {
    title,
    subtitle: firstName ? `Welcome, ${firstName}` : '',
    profile: account?.profile,
    onSignOut: account?.onSignOut,
    onAccount: account?.onAccount,
    onSwitchWorkplace: account?.onSwitchWorkplace,
    onAdministration: account?.onAdministration,
    currentWorkplace: account?.currentWorkplace,
  }
}

export function CreateOnboarding({
  profile, record, onCancel, onCreated, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
}) {
  const account = { profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace }
  const [draft, setDraft] = useState(() => {
    const base = record ? structuredClone(record.draft) : emptyDraft()
    return {
      ...base,
      authorization: {
        ...emptyAuthorization(),
        ...(base.authorization || {}),
        ...agentAuthLocks(profile),
      },
    }
  })
  const [error, setError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [page, setPage] = useState('form')
  const [busy, setBusy] = useState(false)
  const [savedRecord, setSavedRecord] = useState(null)

  useEffect(() => {
    const locks = agentAuthLocks(profile)
    setDraft((current) => ({
      ...current,
      authorization: {
        ...emptyAuthorization(),
        ...(current.authorization || {}),
        ...locks,
      },
    }))
  }, [profile?.firstName, profile?.lastName])

  const buildPayload = () => {
    const email = draft.customerEmail.trim()
    const technowRequestId = String(draft.technowRequestId || '').trim()
    const company = draft.customerDetails?.companyName?.trim() || email
    const with214 = wants214(draft)
    return {
      ...draft,
      customerEmail: email,
      technowRequestId,
      traderIdQa: record?.traderIdQa || draft.traderIdQa || '',
      traderIdProd: record?.traderIdProd || draft.traderIdProd || '',
      normalStatuses: with214 ? (draft.normalStatuses || []) : [],
      normalCodes: with214 ? (draft.normalCodes || {}) : {},
      normalOpen: with214 ? (draft.normalOpen || []) : [],
      exceptionStatuses: with214 ? (draft.exceptionStatuses || []) : [],
      exceptionCodes: with214 ? (draft.exceptionCodes || {}) : {},
      exceptionOpen: with214 ? (draft.exceptionOpen || []) : [],
      authorization: {
        ...emptyAuthorization(),
        ...(draft.authorization || {}),
        ...agentAuthLocks(profile),
      },
      mainAccount: {
        ...draft.mainAccount,
        companyName: company,
        address: draft.customerDetails?.address || draft.mainAccount?.address || '',
        city: draft.customerDetails?.city || draft.mainAccount?.city || '',
        region: draft.customerDetails?.region || draft.mainAccount?.region || '',
        postal: draft.customerDetails?.postal || draft.mainAccount?.postal || '',
        contactName: draft.customerDetails?.businessContactName || draft.mainAccount?.contactName || '',
        tel: draft.customerDetails?.businessContactPhone || draft.mainAccount?.tel || '',
        email: draft.customerDetails?.businessContactEmail || draft.mainAccount?.email || email,
      },
    }
  }

  const saveDraft = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = record ? await updateOnboarding(record.id, buildPayload()) : await saveOnboarding(buildPayload())
      setSavedRecord(saved)
      onCreated?.(saved)
      setPage('created')
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err.message)
      setPage('review')
    } finally {
      setBusy(false)
    }
  }

  const goToReview = () => {
    const email = draft.customerEmail.trim()
    const technowRequestId = String(draft.technowRequestId || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid customer email.')
      return false
    }
    if (!technowRequestId) {
      setError('Enter the Technow Request ID.')
      return false
    }
    if (draft.type !== 'New' && draft.type !== 'Revised') {
      setError('Select a type.')
      return false
    }
    if (!Array.isArray(draft.services) || draft.services.length === 0) {
      setError('Select at least one service.')
      return false
    }
    setError('')
    return true
  }

  const submit = (event) => {
    event.preventDefault()
    if (!goToReview()) return
    if (wants214(draft)) {
      setStatusError('')
      setPage('statuses')
      window.scrollTo(0, 0)
      return
    }
    setPage('review')
    window.scrollTo(0, 0)
  }

  if (page === 'statuses') {
    return (
      <StatusPage
        title="EDI Sales Agent"
        {...account}
        normal={draft.normalStatuses || []}
        exception={draft.exceptionStatuses || []}
        normalCodes={draft.normalCodes || {}}
        normalOpen={draft.normalOpen || []}
        exceptionCodes={draft.exceptionCodes || {}}
        exceptionOpen={draft.exceptionOpen || []}
        error={statusError || error}
        continueLabel="Review"
        onToggle={(group, id) => {
          setStatusError('')
          setDraft((current) => ({ ...current, [group]: toggleList(current[group] || [], id) }))
        }}
        onCustomize={(group, id, status) => {
          const openKey = group === 'normalStatuses' ? 'normalOpen' : 'exceptionOpen'
          const codeKey = group === 'normalStatuses' ? 'normalCodes' : 'exceptionCodes'
          setDraft((current) => ({
            ...current,
            [openKey]: (current[openKey] || []).includes(id) ? current[openKey] : [...(current[openKey] || []), id],
            [codeKey]: current[codeKey]?.[id]
              ? current[codeKey]
              : { ...(current[codeKey] || {}), [id]: { at701: status.at701, at702: status.at702 } },
          }))
        }}
        onSave={(group, id, status) => {
          const openKey = group === 'normalStatuses' ? 'normalOpen' : 'exceptionOpen'
          const codeKey = group === 'normalStatuses' ? 'normalCodes' : 'exceptionCodes'
          setDraft((current) => {
            const existing = current[codeKey]?.[id] || {}
            return {
              ...current,
              [openKey]: (current[openKey] || []).filter((item) => item !== id),
              [codeKey]: {
                ...(current[codeKey] || {}),
                [id]: {
                  at701: String(existing.at701 || '').trim() || status.at701,
                  at702: String(existing.at702 || '').trim() || status.at702,
                },
              },
            }
          })
        }}
        onCode={(group, id, field, value) => {
          const codeKey = group === 'normalStatuses' ? 'normalCodes' : 'exceptionCodes'
          setDraft((current) => ({
            ...current,
            [codeKey]: {
              ...(current[codeKey] || {}),
              [id]: { ...(current[codeKey]?.[id] || {}), [field]: value },
            },
          }))
        }}
        onBack={() => {
          setStatusError('')
          setPage('form')
          window.scrollTo(0, 0)
        }}
        onContinue={() => {
          if ((draft.normalStatuses || []).length + (draft.exceptionStatuses || []).length === 0) {
            setStatusError('Select at least one status')
            return
          }
          setPage('review')
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  if (page === 'review') {
    return (
      <AgentReview
        {...account}
        draft={buildPayload()}
        error={error}
        busy={busy}
        isEdit={Boolean(record)}
        onBack={() => {
          setError('')
          setPage(wants214(draft) ? 'statuses' : 'form')
          window.scrollTo(0, 0)
        }}
        onCreate={saveDraft}
      />
    )
  }

  if (page === 'created' && savedRecord) {
    return (
      <Created
        {...account}
        record={savedRecord}
        draft={buildPayload()}
        onDone={onCancel}
      />
    )
  }

  return (
    <Shell {...salesShellProps(account)}>
      <main className="page edi-page">
        <form onSubmit={submit} noValidate>
          <section className="card">
            <h2>{record ? 'Edit onboarding' : 'New customer onboarding'}</h2>
            <p className="intro">Fill in what you already know. The customer completes any remaining fields and kickoff weeks.</p>
            {error && <div className="banner err" role="alert">{error}</div>}
            <div className="cols">
              <TextField label="Customer email" type="email" required value={draft.customerEmail} onChange={(customerEmail) => setDraft((current) => ({ ...current, customerEmail }))} />
              <TextField
                label="Technow Request ID"
                required
                value={draft.technowRequestId || ''}
                onChange={(technowRequestId) => setDraft((current) => ({ ...current, technowRequestId }))}
              />
            </div>
            {record && (
              <div className="cols">
                <TextField
                  label="Trader ID (QA)"
                  value={traderLabel(record.traderIdQa || draft.traderIdQa)}
                  readOnly
                />
                <TextField
                  label="Trader ID (Prod)"
                  value={traderLabel(record.traderIdProd || draft.traderIdProd)}
                  readOnly
                />
              </div>
            )}
            <div className="cols type-service">
              <fieldset className="type-field">
                <legend>Type <b className="req">*</b></legend>
                {['New', 'Revised'].map((type) => (
                  <label key={type} className="inline">
                    <input type="radio" name="agent-type" checked={draft.type === type} onChange={() => setDraft((current) => ({ ...current, type }))} /> {type}
                  </label>
                ))}
              </fieldset>
              <fieldset className="service-field">
                <legend>Service <b className="req">*</b></legend>
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
            <h2>Customer details</h2>
            {(() => {
              const details = { ...emptyCustomerDetails(), ...(draft.customerDetails || {}) }
              const country = details.addressCountry || 'ca'
              const regionOptions = regionsForCountry(country)
              const setDetail = (name, value) => setDraft((current) => ({
                ...current,
                customerDetails: { ...emptyCustomerDetails(), ...(current.customerDetails || {}), [name]: value },
              }))
              const setAs400 = (name, value) => setDetail(name, padAs400(value))
              const applyPlace = (place) => setDraft((current) => {
                const currentDetails = { ...emptyCustomerDetails(), ...(current.customerDetails || {}) }
                const nextCountry = place.country || currentDetails.addressCountry || 'ca'
                const nextRegion = place.region !== undefined
                  ? normalizeRegion(place.region, nextCountry)
                  : normalizeRegion(currentDetails.region, nextCountry)
                return {
                  ...current,
                  customerDetails: {
                    ...currentDetails,
                    ...(place.country ? { addressCountry: place.country } : {}),
                    ...(place.address !== undefined ? { address: place.address } : {}),
                    ...(place.city !== undefined ? { city: place.city } : {}),
                    region: nextRegion,
                    ...(place.postal !== undefined ? { postal: formatPostal(place.postal) } : {}),
                  },
                }
              })
              return (
                <>
                  <div className="cols">
                    <TextField label="AS400 Account Number" value={details.as400AccountNumber} onChange={(value) => setAs400('as400AccountNumber', value)} />
                    <TextField label="AS400 Account Number (Test)" value={details.as400AccountNumberTest} onChange={(value) => setAs400('as400AccountNumberTest', value)} />
                  </div>
                  <div className="cols">
                    <TextField label="Truckmate ID" value={details.truckmateId} onChange={(value) => setDetail('truckmateId', value)} />
                    <TextField label="Truckmate ID (QA)" value={details.truckmateIdQa} onChange={(value) => setDetail('truckmateIdQa', value)} />
                  </div>
                  <div className="cols">
                    <TextField label="Oracle ID" value={details.oracleId} onChange={(value) => setDetail('oracleId', value)} />
                    <TextField label="Oracle ID (QA)" value={details.oracleIdQa} onChange={(value) => setDetail('oracleIdQa', value)} />
                  </div>
                  <div className="cols sub">
                    <TextField label="Company Name" value={details.companyName} onChange={(value) => setDetail('companyName', value)} />
                    <AddressField
                      label="Address"
                      value={details.address}
                      country={country}
                      onChange={(value) => setDetail('address', value)}
                      onPlace={applyPlace}
                    />
                    <TextField label="City" value={details.city} onChange={(value) => setDetail('city', value)} />
                    <RegionField
                      label="Prov/State"
                      value={normalizeRegion(details.region, country)}
                      options={regionOptions}
                      placeholder={country === 'us' ? 'Select state…' : 'Select province…'}
                      onChange={(value) => setDetail('region', value)}
                    />
                    <TextField label="Postal/Zip" value={details.postal} onChange={(value) => setDetail('postal', formatPostal(value))} />
                    <TextField label="Business Contact Name" value={details.businessContactName} onChange={(value) => setDetail('businessContactName', value)} />
                    <TextField label="Business Contact Phone" type="tel" value={details.businessContactPhone} onChange={(value) => setDetail('businessContactPhone', value)} />
                    <TextField label="Business Contact Email" type="email" value={details.businessContactEmail} onChange={(value) => setDetail('businessContactEmail', value)} />
                  </div>
                  {(() => {
                    const tech = { ...emptyDeveloper(), ...(draft.developer || {}) }
                    const setTech = (name, value) => setDraft((current) => ({
                      ...current,
                      developer: { ...emptyDeveloper(), ...(current.developer || {}), [name]: value },
                    }))
                    return (
                      <div className="cols sub">
                        <h3 className="span-all">Technical Contact</h3>
                        <TextField label="Name" value={tech.developerName} onChange={(value) => setTech('developerName', value)} />
                        <TextField label="Email" type="email" value={tech.email} onChange={(value) => setTech('email', value)} />
                        <PhoneField
                          id="tech-mobile"
                          label="Contact - Mobile"
                          value={tech.tel}
                          onChange={(value) => setTech('tel', value)}
                          verify
                        />
                        <PhoneField
                          id="tech-other"
                          label="Contact - Other"
                          value={tech.otherTel}
                          onChange={(value) => setTech('otherTel', value)}
                        />
                      </div>
                    )
                  })()}
                </>
              )
            })()}
          </section>
          <section className="card">
            <h2>Transaction Sets <small>ANSI X12, Version 4010 (check the appropriate boxes)</small></h2>
            <div>
              {TRANSACTION_SETS.map((item) => (
                <label key={item.code} className="inline block">
                  <input
                    type="checkbox"
                    checked={(draft.sets || []).includes(item.code)}
                    onChange={() => setDraft((current) => {
                      const sets = current.sets || []
                      const turningOn = !sets.includes(item.code)
                      let next = turningOn ? [...sets, item.code] : sets.filter((code) => code !== item.code)
                      if (turningOn && (item.code === '204' || item.code === '211')) {
                        const other = item.code === '204' ? '211' : '204'
                        next = next.filter((code) => code !== other)
                      }
                      if (!turningOn && item.code === '214') {
                        return {
                          ...current,
                          sets: next,
                          normalStatuses: [],
                          normalCodes: {},
                          normalOpen: [],
                          exceptionStatuses: [],
                          exceptionCodes: {},
                          exceptionOpen: [],
                        }
                      }
                      return { ...current, sets: next }
                    })}
                  />
                  <span><b>{item.code}</b> {item.name}</span>
                </label>
              ))}
            </div>
          </section>
          {draft.type !== 'Revised' && (
            <section className="card">
              <h2>EDI Communication</h2>
              <fieldset>
                <legend>Hosting</legend>
                {[
                  { value: 'dayross', label: 'Day & Ross' },
                  { value: 'customer', label: 'Customer' },
                ].map((option) => (
                  <label key={option.value} className="inline">
                    <input
                      type="radio"
                      name="hosting"
                      checked={draft.hosting === option.value}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        hosting: option.value,
                        as2: false,
                        sftp: false,
                        as2Certificate: null,
                      }))}
                    /> {option.label}
                  </label>
                ))}
              </fieldset>
              {draft.hosting === 'dayross' && <HostingRequest key="dayross-request" />}
              {draft.hosting === 'customer' && (
                <>
                  <fieldset className="sub">
                    <legend>Method</legend>
                    <label className="inline">
                      <input
                        type="radio"
                        name="customer-method"
                        checked={Boolean(draft.as2)}
                        onChange={() => setDraft((current) => ({ ...current, as2: true, sftp: false }))}
                      /> AS2
                    </label>
                    <label className="inline">
                      <input
                        type="radio"
                        name="customer-method"
                        checked={Boolean(draft.sftp)}
                        onChange={() => setDraft((current) => ({
                          ...current,
                          as2: false,
                          sftp: true,
                          as2Certificate: null,
                        }))}
                      /> SFTP
                    </label>
                  </fieldset>
                  {draft.as2 && (
                    <div className="cols sub">
                      <As2CertificateField
                        value={draft.as2Certificate}
                        onChange={(as2Certificate) => setDraft((current) => ({ ...current, as2Certificate }))}
                      />
                    </div>
                  )}
                  {draft.sftp && (
                    <div className="cols sub">
                      {SFTP_FIELDS.map((field) => (
                        <TextField
                          key={field.name}
                          label={field.label}
                          type={field.type || 'text'}
                          value={draft.sftpDetails?.[field.name] || ''}
                          onChange={(value) => setDraft((current) => ({
                            ...current,
                            sftpDetails: { ...(current.sftpDetails || {}), [field.name]: value },
                          }))}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          <section className="card">
            <h2>Authorization</h2>
            {(() => {
              const auth = { ...emptyAuthorization(), ...(draft.authorization || {}) }
              const setAuth = (name, value) => setDraft((current) => ({
                ...current,
                authorization: { ...emptyAuthorization(), ...(current.authorization || {}), [name]: value },
              }))
              return (
                <>
                  <div className="cols">
                    <TextField label="Name of person completing this form" value={auth.name} readOnly />
                    <TextField label="Title" value={auth.title} onChange={(value) => setAuth('title', value)} />
                    <TextField label="Company" value={auth.company} readOnly />
                    <label className="field locked">
                      <span>Date</span>
                      <input type="date" value={auth.date} readOnly />
                    </label>
                  </div>
                  <fieldset>
                    <legend>Do you give authorization for your payment house to be set up on API/EDI and any other services Day &amp; Ross offers to get backup documents?</legend>
                    {['YES', 'NO'].map((value) => (
                      <label key={value} className="inline">
                        <input
                          type="radio"
                          name="agent-phauth"
                          checked={auth.paymentHouseAuth === value}
                          onChange={() => setAuth('paymentHouseAuth', value)}
                        /> {value}
                      </label>
                    ))}
                  </fieldset>
                  <label className="field">
                    <span>Comments</span>
                    <textarea rows={3} value={auth.comments} onChange={(event) => setAuth('comments', event.target.value)} />
                  </label>
                </>
              )
            })()}
          </section>
          <div className="actions">
            <button type="button" className="secondary" onClick={onCancel}>Back</button>
            <button type="submit" disabled={busy}>
              {wants214(draft) ? 'Next' : 'Review'} <Chevron />
            </button>
          </div>
        </form>
      </main>
    </Shell>
  )
}

function ReviewSummary({ draft }) {
  const details = { ...emptyCustomerDetails(), ...(draft.customerDetails || {}) }
  const tech = { ...emptyDeveloper(), ...(draft.developer || {}) }
  const auth = { ...emptyAuthorization(), ...(draft.authorization || {}) }
  const sets = (draft.sets || []).join(', ') || '—'
  const services = (draft.services || [])
    .map((value) => SERVICES.find((item) => item.value === value)?.label || value)
    .join('; ') || '—'
  const row = (label, value) => <tr key={label}><th>{label}</th><td>{value || '—'}</td></tr>

  return (
    <>
      <section className="card"><h2>Request</h2><table><tbody>
        {row('Customer email', draft.customerEmail)}
        {row('Technow Request ID', draft.technowRequestId)}
        {row('Type', draft.type)}
        {row('Service', services)}
      </tbody></table></section>
      <section className="card"><h2>Customer details</h2><table><tbody>
        {row('Company Name', details.companyName)}
        {row('Address', details.address)}
        {row('City', details.city)}
        {row('Prov/State', details.region)}
        {row('Postal/Zip', details.postal)}
        {row('Business Contact Name', details.businessContactName)}
        {row('Business Contact Phone', details.businessContactPhone)}
        {row('Business Contact Email', details.businessContactEmail)}
        {row('AS400 Account Number', details.as400AccountNumber)}
        {row('Truckmate ID', details.truckmateId)}
        {row('Oracle ID', details.oracleId)}
      </tbody></table></section>
      <section className="card"><h2>Technical Contact</h2><table><tbody>
        {DEVELOPER_FIELDS.filter((field) => field.name !== 'title').map((field) => row(field.label, tech[field.name]))}
      </tbody></table></section>
      <section className="card"><h2>Transaction Sets</h2><table><tbody>
        {row('Transaction sets', sets)}
        {wants214(draft) && (draft.normalStatuses || []).length
          ? row('214 normal statuses', statusCodeText(draft.normalStatuses, NORMAL_STATUSES, draft.normalCodes))
          : null}
        {wants214(draft) && (draft.exceptionStatuses || []).length
          ? row('214 exception statuses', statusCodeText(draft.exceptionStatuses, EXCEPTION_STATUSES, draft.exceptionCodes))
          : null}
      </tbody></table></section>
      {draft.type !== 'Revised' && (
        <section className="card"><h2>EDI Communication</h2><table><tbody>
          {row('Hosting', draft.hosting === 'dayross' ? 'Day & Ross' : draft.hosting === 'customer' ? 'Customer' : '—')}
          {draft.hosting === 'customer' && row('Method', [draft.as2 && 'AS2', draft.sftp && 'SFTP'].filter(Boolean).join(', ') || '—')}
          {draft.hosting === 'customer' && draft.as2 && row('AS2 certificate', draft.as2Certificate?.name || '—')}
          {draft.hosting === 'customer' && draft.sftp && SFTP_FIELDS.map((field) => (
            row(field.label, field.name === 'password' ? '••••••••' : draft.sftpDetails?.[field.name])
          ))}
        </tbody></table></section>
      )}
      <section className="card"><h2>Authorization</h2><table><tbody>
        {row('Completed by', auth.name)}
        {row('Title', auth.title)}
        {row('Company', auth.company)}
        {row('Payment house authorized for API/EDI & other services', auth.paymentHouseAuth)}
        {row('Comments', auth.comments)}
        {row('Date', auth.date)}
      </tbody></table></section>
    </>
  )
}

function AgentReview({
  profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
  draft, error, busy, isEdit, onBack, onCreate,
}) {
  return (
    <Shell {...salesShellProps({
      profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
    })}>
      <main className="page edi-page">
        <div className="banner ok no-print">Review the onboarding details, then create it.</div>
        {error && <div className="banner err" role="alert">{error}</div>}
        <ReviewSummary draft={draft} />
        <div className="actions no-print">
          <button type="button" className="secondary" onClick={onBack} disabled={busy}>Back</button>
          <button type="button" onClick={onCreate} disabled={busy}>
            {busy ? 'Saving…' : (isEdit ? 'Save' : 'Create')} <Chevron />
          </button>
        </div>
      </main>
    </Shell>
  )
}

function lastModifiedLabel(record) {
  const name = String(record?.lastModifiedByName || '').trim()
  const team = String(record?.lastModifiedByTeam || '').trim()
  if (!name && !team) return ''
  if (name && team) return `${name} (${team})`
  return name || team
}

function Created({
  profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
  record, draft, onDone,
}) {
  const company = draft?.mainAccount?.companyName || record.companyName || 'Customer'
  const sets = (draft?.sets || []).join(', ') || '—'
  const modifiedBy = lastModifiedLabel(record)
  const mailBody = [
    `EDI Sales Onboarding (${draft?.type || 'New'})`,
    `Form ID: ${record.id}`,
    `Technow Request ID: ${draft?.technowRequestId || '—'}`,
    `Customer: ${company}`,
    `Customer email: ${record.customerEmail}`,
    `Services: ${(draft?.services || []).map((value) => SERVICES.find((item) => item.value === value)?.label || value).join('; ') || '—'}`,
    `Transaction sets: ${sets}`,
    wants214(draft) && (draft.normalStatuses || []).length
      ? `214 normal statuses: ${statusCodeText(draft.normalStatuses, NORMAL_STATUSES, draft.normalCodes).replaceAll('\n', ', ')}`
      : '',
    wants214(draft) && (draft.exceptionStatuses || []).length
      ? `214 exception statuses: ${statusCodeText(draft.exceptionStatuses, EXCEPTION_STATUSES, draft.exceptionCodes).replaceAll('\n', ', ')}`
      : '',
    `Completed by: ${draft?.authorization?.name || '—'}`,
    modifiedBy ? `Last modified by: ${modifiedBy}` : '',
  ].filter(Boolean).join('\n')

  return (
    <Shell {...salesShellProps({
      profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
    })}>
      <main className="page edi-page">
        <div className="banner ok no-print">Created</div>
        <section className="card no-print">
          <h2>Created</h2>
          <p className="intro">Form ID: {record.id}</p>
          {modifiedBy && <p className="intro">Last modified by: {modifiedBy}</p>}
          <CopyFormIdButton id={record.id} />
        </section>
        <div className="print-only">
          <ReviewSummary draft={draft} />
        </div>
        <div className="actions no-print">
          <button type="button" onClick={() => window.print()}>Save as PDF <Chevron /></button>
          <a
            className="btn"
            href={`mailto:${EDI_EMAIL}?subject=${encodeURIComponent(`EDI Onboarding – ${company}`)}&body=${encodeURIComponent(mailBody)}`}
          >
            Email <Chevron />
          </a>
          <button type="button" className="secondary" onClick={onDone}>Go back to dashboard <Chevron /></button>
        </div>
      </main>
    </Shell>
  )
}

export function InvalidLink() {
  return (
    <Shell>
      <main className="page edi-page">
        <section className="card">
          <h2>This link is not valid</h2>
          <p className="intro">Ask your Day & Ross sales agent for a new onboarding link.</p>
        </section>
      </main>
    </Shell>
  )
}

export function SalesFormPreview() {
  return (
    <CreateOnboarding
      profile={{ firstName: 'Alex', lastName: 'Sales' }}
      record={null}
      onCancel={() => {}}
      onCreated={() => {}}
    />
  )
}

export default function AgentApp({
  profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
}) {
  const [view, setView] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [loadError, setLoadError] = useState('')
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
        profile={profile}
        record={view === 'edit' ? editing : null}
        onCancel={() => { setEditing(null); setView('dashboard') }}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onSwitchWorkplace={onSwitchWorkplace}
        onAdministration={onAdministration}
        currentWorkplace={currentWorkplace}
        onCreated={(saved) => {
          setRecords((current) => view === 'edit'
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...current.filter((item) => item.id !== saved.id)])
        }}
      />
    )
  }
  return (
    <Dashboard
      profile={profile}
      records={records}
      error={loadError}
      onCreate={() => { setEditing(null); setView('create') }}
      onView={(record) => { setEditing(record); setView('edit') }}
      onSignOut={onSignOut}
      onAccount={onAccount}
      onSwitchWorkplace={onSwitchWorkplace}
      onAdministration={onAdministration}
      currentWorkplace={currentWorkplace}
    />
  )
}
