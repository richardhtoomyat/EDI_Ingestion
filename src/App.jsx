import { useEffect, useRef, useState } from 'react'
import {
  SERVICES, PARTY_FIELDS, DEVELOPER_FIELDS, TRANSACTION_SETS, SFTP_FIELDS, NORMAL_STATUSES, EXCEPTION_STATUSES, initialState,
} from './formConfig.js'
import logo from './assets/logo.png'

const ACCOUNT_SYSTEMS = ['TruckMate', 'AS400']

const EDI_EMAIL = 'edirequest@dayandrossinc.ca'

function SiteHeader() {
  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <img className="logo" src={logo} alt="Day &amp; Ross" />
        <span className="site-title">EDI Customer Onboarding</span>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <p>Questions? Contact <a href={`mailto:${EDI_EMAIL}`}>{EDI_EMAIL}</a></p>
      <p>© Day &amp; Ross. All rights reserved.</p>
    </footer>
  )
}

function Shell({ children }) {
  return (<><SiteHeader />{children}<SiteFooter /></>)
}

const Chevron = () => <span className="chev" aria-hidden="true">›</span>

const COUNTRY_CODES = [
  { iso: 'ca', dial: '+1', name: 'Canada' },
  { iso: 'us', dial: '+1', name: 'United States' },
  { iso: 'mx', dial: '+52', name: 'Mexico' },
  { iso: 'gb', dial: '+44', name: 'United Kingdom' },
  { iso: 'fr', dial: '+33', name: 'France' },
  { iso: 'de', dial: '+49', name: 'Germany' },
  { iso: 'au', dial: '+61', name: 'Australia' },
  { iso: 'in', dial: '+91', name: 'India' },
  { iso: 'cn', dial: '+86', name: 'China' },
  { iso: 'jp', dial: '+81', name: 'Japan' },
  { iso: 'br', dial: '+55', name: 'Brazil' },
]

function Flag({ iso }) {
  return <img className="flag" src={`https://flagcdn.com/w80/${iso}.png`} alt="" width="22" height="22" />
}

function formatPhone(digits) {
  const d = digits.slice(0, 10)
  if (d.length < 4) return d ? `(${d}` : ''
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function splitPhone(value) {
  const match = String(value || '').match(/^(\+\d+)\s*(.*)$/)
  const dial = COUNTRY_CODES.some((country) => country.dial === match?.[1]) ? match[1] : '+1'
  const rest = match ? match[2] : value
  return { dial, digits: String(rest || '').replace(/\D/g, '').slice(0, 10) }
}

function PhoneField({ id, label, required, value, onChange, error, verify }) {
  const { dial, digits } = splitPhone(value)
  const [iso, setIso] = useState(() => (dial === '+1' ? 'ca' : COUNTRY_CODES.find((country) => country.dial === dial)?.iso || 'ca'))
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [stage, setStage] = useState('idle') // idle | checking | success
  const [prompt, setPrompt] = useState(false)
  const picker = useRef(null)
  const country = COUNTRY_CODES.find((item) => item.iso === iso) || COUNTRY_CODES[0]
  const complete = digits.length === 10
  const reset = () => {
    setVerified(false)
    setCode('')
    setStage('idle')
  }
  const write = (nextDial, nextDigits) => {
    const formatted = formatPhone(nextDigits)
    onChange(formatted ? `${nextDial} ${formatted}` : '')
  }

  useEffect(() => {
    if (!open) return
    const close = (event) => {
      if (!picker.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (!verify || !complete || verified) {
      setPrompt(false)
      return
    }
    const timer = setTimeout(() => setPrompt(true), 1000)
    return () => clearTimeout(timer)
  }, [verify, complete, verified, digits])

  useEffect(() => {
    if (verify && code.length === 4 && !verified && stage === 'idle') setStage('checking')
  }, [code, verify, verified, stage])

  useEffect(() => {
    if (stage === 'checking') {
      const timer = setTimeout(() => setStage('success'), 1000)
      return () => clearTimeout(timer)
    }
    if (stage === 'success') {
      const done = setTimeout(() => {
        setVerified(true)
        setCode('')
      }, 900)
      const idle = setTimeout(() => setStage('idle'), 1600)
      return () => {
        clearTimeout(done)
        clearTimeout(idle)
      }
    }
  }, [stage])

  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <b className="req"> *</b>}</label>
      <div className="phone-row">
        <div className="country-picker" ref={picker}>
          <button type="button" className="country-btn" aria-label={`${label} country code`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <Flag iso={country.iso} />
            <span>{country.dial}</span>
          </button>
          {open && (
            <ul className="country-menu" role="listbox">
              {COUNTRY_CODES.map((item) => (
                <li key={item.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.iso === country.iso}
                    onClick={() => {
                      setIso(item.iso)
                      setOpen(false)
                      reset()
                      write(item.dial, digits)
                    }}
                  >
                    <Flag iso={item.iso} />
                    <span>{item.name}</span>
                    <b>{item.dial}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="(555) 555-5555"
          value={formatPhone(digits)}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, 10)
            if (next !== digits) reset()
            write(country.dial, next)
          }}
        />
        <span className={`verify-slot${verify && verified ? ' show' : ''}`} aria-hidden={!(verify && verified)}>
          {verify && verified && (
            <span className="verify-tick" aria-label="Verified">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="12" fill="#0095F6" />
                <path d="M6.8 12.4l3.2 3.2 7.2-7.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
              </svg>
            </span>
          )}
        </span>
      </div>
      {verify && (
        <div className={`sms-box${prompt && !verified ? ' open' : ''}`}>
          <div className="sms-box-inner">
            <div className={`sms-panel stage-${stage}`}>
              <label htmlFor={`${id}-code`}>Enter the 4-digit code sent to this number</label>
              <div className="sms-row">
                <input
                  id={`${id}-code`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="••••"
                  value={code}
                  disabled={stage !== 'idle'}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <span className="sms-status" aria-live="polite">
                  {stage === 'checking' && (<><span className="spinner" /> Checking…</>)}
                  {stage === 'success' && (
                    <>
                      <svg className="sms-ok" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="12" fill="#0095F6" />
                        <path d="M6.8 12.4l3.2 3.2 7.2-7.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
                      </svg>
                      Verified
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <em role="alert">{error}</em>}
    </div>
  )
}

function Field({ field, value, onChange, error, id, prefix }) {
  if (field.type === 'tel') {
    return (
      <PhoneField
        id={id}
        label={field.label}
        required={field.required}
        value={value}
        onChange={(next) => onChange(field.name, next)}
        error={error}
        verify={prefix === 'dev' && field.name === 'tel'}
      />
    )
  }
  return (
    <label className={`field${error ? ' has-error' : ''}`} htmlFor={id}>
      <span>{field.label}{field.required && <b className="req"> *</b>}</span>
      <input
        id={id}
        type={field.type || 'text'}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(field.name, e.target.value)}
      />
      {error && <em role="alert">{error}</em>}
    </label>
  )
}

function Fields({ fields, values, onChange, errors = {}, prefix }) {
  return fields.map((f) => (
    <Field key={f.name} id={`${prefix}-${f.name}`} prefix={prefix} field={f} value={values[f.name]} onChange={onChange} error={errors[f.name]} />
  ))
}

function padAs400(value) {
  const core = String(value).replace(/^0+/, '').slice(0, 7)
  return core ? core.padStart(7, '0') : ''
}

function AccountNumberField({ id, value, system, onValue, error }) {
  const ref = useRef(null)
  const placeCaret = () => {
    const el = ref.current
    if (!el || system !== 'AS400') return
    requestAnimationFrame(() => {
      const pos = el.value.length
      el.setSelectionRange(pos, pos)
    })
  }
  return (
    <label className={`field${error ? ' has-error' : ''}`} htmlFor={id}>
      <span>Account # <b className="req"> *</b></span>
      <input
        ref={ref}
        id={id}
        value={value}
        autoComplete="off"
        placeholder={system === 'AS400' ? '0000000' : undefined}
        onFocus={placeCaret}
        onKeyDown={(e) => {
          if (system !== 'AS400' || e.metaKey || e.ctrlKey || e.altKey) return
          if (e.key === 'Backspace') {
            e.preventDefault()
            const core = value.replace(/^0+/, '').slice(0, -1)
            onValue(core ? core.padStart(7, '0') : '')
            placeCaret()
          } else if (e.key === 'Delete') {
            e.preventDefault()
            onValue('')
          } else if (e.key.length === 1) {
            e.preventDefault()
            onValue(padAs400(value.replace(/^0+/, '') + e.key))
            placeCaret()
          }
        }}
        onPaste={(e) => {
          if (system !== 'AS400') return
          e.preventDefault()
          const text = e.clipboardData.getData('text')
          const el = e.currentTarget
          const replaceAll = el.selectionStart === 0 && el.selectionEnd === el.value.length
          const base = replaceAll ? '' : value.replace(/^0+/, '')
          const core = (base + text).replace(/^0+/, '').slice(0, 7)
          onValue(core ? core.padStart(7, '0') : '')
          placeCaret()
        }}
        onChange={(e) => onValue(system === 'AS400' ? padAs400(e.target.value) : e.target.value)}
      />
      {error && <em role="alert">{error}</em>}
    </label>
  )
}

function PartyColumn({ title, prefix, values, onChange, errors }) {
  const rest = PARTY_FIELDS.filter((f) => f.name !== 'accountNumber')
  const chooseSystem = (system) => {
    onChange('accountSystem', system)
    onChange('accountNumber', system === 'AS400' ? padAs400(values.accountNumber) : values.accountNumber.replace(/^0+/, ''))
  }
  return (
    <div>
      <h3>{title}</h3>
      <AccountNumberField id={`${prefix}-accountNumber`} value={values.accountNumber} system={values.accountSystem} onValue={(v) => onChange('accountNumber', v)} error={errors.accountNumber} />
      <fieldset className={errors.accountSystem ? 'group-error' : ''}>
        <legend>Is this account # TruckMate or AS400? <b className="req">*</b></legend>
        {ACCOUNT_SYSTEMS.map((system) => (
          <label key={system} className="inline">
            <input type="radio" name={`${prefix}-accountSystem`} checked={values.accountSystem === system} onChange={() => chooseSystem(system)} /> {system}
          </label>
        ))}
        {errors.accountSystem && <em role="alert">{errors.accountSystem}</em>}
      </fieldset>
      <Fields prefix={prefix} fields={rest} values={values} onChange={onChange} errors={errors} />
    </div>
  )
}

function validate(s) {
  const e = { mainAccount: {}, logisticsProvider: {}, developer: {}, authorization: {}, x12: {}, other: {} }
  const need = (group, key, v) => { if (!String(v).trim()) e[group][key] = 'Required' }
  for (const f of PARTY_FIELDS.filter((f) => f.required)) {
    need('mainAccount', f.name, s.mainAccount[f.name])
    need('logisticsProvider', f.name, s.logisticsProvider[f.name])
  }
  need('mainAccount', 'accountSystem', s.mainAccount.accountSystem)
  need('logisticsProvider', 'accountSystem', s.logisticsProvider.accountSystem)
  for (const group of ['mainAccount', 'logisticsProvider']) {
    if (s[group].accountSystem === 'AS400' && s[group].accountNumber && s[group].accountNumber.length !== 7) {
      e[group].accountNumber = 'AS400 account # must be 7 characters'
    }
  }
  need('developer', 'developerName', s.developer.developerName)
  need('authorization', 'name', s.authorization.name)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const [g, vals] of [['mainAccount', s.mainAccount], ['logisticsProvider', s.logisticsProvider], ['developer', s.developer]]) {
    if (vals.email && !emailRe.test(vals.email) && vals.email.toUpperCase() !== 'N/A') e[g].email = 'Enter a valid email'
  }
  if (s.services.length === 0) e.other.services = 'Select at least one service'
  if (!/^[A-Z]{2,4}$/.test(s.x12.scac)) e.x12.scac = 'Use 2 to 4 letters'
  if (!/^[A-Z0-9]{1,15}$/.test(s.x12.isa)) e.x12.isa = 'Use 1 to 15 letters or digits'
  if (!/^[A-Z0-9]{2,15}$/.test(s.x12.gs)) e.x12.gs = 'Use 2 to 15 letters or digits'
  if (!s.as2 && !s.sftp) e.other.comm = 'Select a communication method'
  return e
}

const hasErrors = (e) => Object.values(e).some((g) => Object.keys(g).length)
const wants214 = (s) => s.sets.dayRoss.includes('214') || s.sets.customer.includes('214')

function statusId(status, index) {
  return `${status.code}:${index}:${status.name}`
}

function statusNames(ids, list) {
  return ids.map((id) => list.find((status, index) => statusId(status, index) === id)?.name).filter(Boolean).join('\n')
}

function StatusPage({ normal, exception, onToggle, onBack, onContinue, error }) {
  const column = (title, list, selected, group) => (
    <div>
      <h3>{title}</h3>
      <ul className="status-list">
        {list.map((status, index) => {
          const id = statusId(status, index)
          return (
            <li key={id}>
              <label>
                <input type="checkbox" checked={selected.includes(id)} onChange={() => onToggle(group, id)} />
                <span>{status.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
  return (
    <Shell>
      <main className="page">
        <section className="card">
          <h2>214 Status <small>Select the statuses Day &amp; Ross should send</small></h2>
          {error && <div className="banner err" role="alert">{error}</div>}
          <div className="cols">
            {column('Normal Status', NORMAL_STATUSES, normal, 'normalStatuses')}
            {column('Exception Status', EXCEPTION_STATUSES, exception, 'exceptionStatuses')}
          </div>
        </section>
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Back</button>
          <button type="button" onClick={onContinue}>Review &amp; Submit <Chevron /></button>
        </div>
      </main>
    </Shell>
  )
}

function Summary({ state, onEdit }) {
  const sets = (key) => TRANSACTION_SETS.filter((t) => state.sets[key].includes(t.code)).map((t) => t.code).join(', ') || '—'
  const row = (k, v) => <tr key={k}><th>{k}</th><td>{v || '—'}</td></tr>
  const party = (p) => PARTY_FIELDS.flatMap((f) => (
    f.name === 'accountNumber'
      ? [row(f.label, p[f.name]), row('Account system', p.accountSystem)]
      : [row(f.label, p[f.name])]
  ))
  const { password, ...sftpSafe } = state.sftpDetails
  const mailBody = [
    `EDI Setup Request (${state.type})`,
    `Services: ${state.services.map((v) => SERVICES.find((x) => x.value === v).label).join('; ')}`,
    `Main account: ${state.mainAccount.companyName} (#${state.mainAccount.accountNumber}, ${state.mainAccount.accountSystem})`,
    `Logistics provider: ${state.logisticsProvider.companyName} (#${state.logisticsProvider.accountNumber}, ${state.logisticsProvider.accountSystem})`,
    `D&R provides specs: ${sets('dayRoss')}`,
    `Customer provides specs: ${sets('customer')}`,
    `SCAC: ${state.x12.scac}`,
    `ISA: ${state.x12.isa}`,
    `GS: ${state.x12.gs}`,
    state.normalStatuses.length ? `214 normal statuses: ${statusNames(state.normalStatuses, NORMAL_STATUSES).replaceAll('\n', ', ')}` : '',
    state.exceptionStatuses.length ? `214 exception statuses: ${statusNames(state.exceptionStatuses, EXCEPTION_STATUSES).replaceAll('\n', ', ')}` : '',
    `Communication: ${[state.as2 && 'AS2', state.sftp && 'SFTP'].filter(Boolean).join(', ')}`,
    state.sftp ? `SFTP: ${sftpSafe.server} port ${sftpSafe.port}, user ${sftpSafe.username}, qualifier ${sftpSafe.qualifier}, dirs ${sftpSafe.directories}` : '',
    `Completed by: ${state.authorization.name}, ${state.authorization.title}, ${state.authorization.company} on ${state.authorization.date}`,
    '(SFTP password intentionally omitted - share it securely.)',
  ].filter(Boolean).join('\n')

  return (
    <Shell>
    <main className="page">
      <div className="banner ok">Form complete. Review, then print/save as PDF or email it to Day &amp; Ross.</div>
      <div className="actions no-print">
        <button onClick={() => window.print()}>Print / Save as PDF <Chevron /></button>
        <a className="btn" href={`mailto:${EDI_EMAIL}?subject=${encodeURIComponent(`EDI Setup – ${state.mainAccount.companyName}`)}&body=${encodeURIComponent(mailBody)}`}>Email to {EDI_EMAIL} <Chevron /></a>
        <button className="secondary" onClick={onEdit}>Edit form</button>
      </div>
      <section className="card"><h2>Request</h2><table><tbody>
        {row('Type', state.type)}
        {row('Service', state.services.map((v) => SERVICES.find((x) => x.value === v).label).join('; '))}
      </tbody></table></section>
      <section className="card"><h2>Main Account</h2><table><tbody>{party(state.mainAccount)}</tbody></table></section>
      <section className="card"><h2>Logistics Provider</h2><table><tbody>{party(state.logisticsProvider)}</tbody></table></section>
      <section className="card"><h2>Additional Locations / Payment House</h2><table><tbody>
        {row('Additional locations', state.additionalLocations)}
        {row('Payment house company', state.paymentHouse.companyName)}
        {row('Payment house contact', state.paymentHouse.contactName)}
      </tbody></table></section>
      <section className="card"><h2>EDI Technical Contact</h2><table><tbody>{DEVELOPER_FIELDS.map((f) => row(f.label, state.developer[f.name]))}</tbody></table></section>
      <section className="card"><h2>Transaction Sets (ANSI X12, 4010)</h2><table><tbody>
        {row('Day & Ross provides specs', sets('dayRoss'))}
        {row('Customer provides specs', sets('customer'))}
        {row('SCAC', state.x12.scac)}
        {row('ISA', state.x12.isa)}
        {row('GS', state.x12.gs)}
        {state.normalStatuses.length ? row('214 normal statuses', statusNames(state.normalStatuses, NORMAL_STATUSES)) : null}
        {state.exceptionStatuses.length ? row('214 exception statuses', statusNames(state.exceptionStatuses, EXCEPTION_STATUSES)) : null}
      </tbody></table></section>
      <section className="card"><h2>Communication</h2><table><tbody>
        {row('AS2', state.as2 ? 'Yes (billable setup charge applies)' : 'No')}
        {row('SFTP', state.sftp ? 'Yes' : 'No')}
        {state.sftp && SFTP_FIELDS.map((f) => row(f.label, f.name === 'password' ? '••••••••' : state.sftpDetails[f.name]))}
      </tbody></table></section>
      <section className="card"><h2>Authorization</h2><table><tbody>
        {row('Completed by', state.authorization.name)}
        {row('Title', state.authorization.title)}
        {row('Company', state.authorization.company)}
        {row('Payment house authorized for API/EDI & other services', state.authorization.paymentHouseAuth)}
        {row('Comments', state.authorization.comments)}
        {row('Date', state.authorization.date)}
      </tbody></table></section>
    </main>
    </Shell>
  )
}

export default function App() {
  const [state, setState] = useState(initialState)
  const [errors, setErrors] = useState(null)
  const [page, setPage] = useState('form')
  const [statusError, setStatusError] = useState('')
  const [sftpTest, setSftpTest] = useState({ phase: 'idle', ok: false, message: '' })
  const sftpTarget = useRef({ server: '', port: '' })
  const pollRef = useRef(null)

  const setGroup = (group) => (name, value) => setState((s) => ({ ...s, [group]: { ...s[group], [name]: value } }))
  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const err = (g) => (errors && errors[g]) || {}

  sftpTarget.current = {
    server: state.sftpDetails.server.trim(),
    port: state.sftpDetails.port.trim(),
  }
  const sftpReady = ['server', 'port', 'username', 'password', 'directories'].every((name) => String(state.sftpDetails[name] || '').trim())
  const stopOutboundWatch = () => {
    clearInterval(pollRef.current)
    pollRef.current = null
  }
  useEffect(() => () => stopOutboundWatch(), [])
  useEffect(() => { if (!state.sftp) stopOutboundWatch() }, [state.sftp])

  const postSftp = async (action) => {
    const res = await fetch('/api/test-sftp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sftpTarget.current, action }),
    })
    return res.json()
  }
  const watchOutbound = () => {
    stopOutboundWatch()
    pollRef.current = setInterval(async () => {
      try {
        const data = await postSftp('check-outbound')
        if (!data.ok) {
          stopOutboundWatch()
          setSftpTest({ phase: 'connected', ok: false, message: data.error || 'Lost the SFTP connection.' })
          return
        }
        if (data.found) {
          stopOutboundWatch()
          setSftpTest({
            phase: 'done',
            ok: true,
            message: `Outbound connection complete. Read ${data.file}: ${data.text || '(empty file)'}`,
          })
        }
      } catch {
        stopOutboundWatch()
        setSftpTest({ phase: 'connected', ok: false, message: 'Could not reach the test service.' })
      }
    }, 2000)
  }
  const onSftpButton = async () => {
    if (sftpTest.phase === 'connected') {
      setSftpTest({ phase: 'sending', ok: true, message: 'Sending inbound.txt…' })
      try {
        const data = await postSftp('send-inbound')
        if (!data.ok) {
          setSftpTest({ phase: 'connected', ok: false, message: data.error || 'Could not send inbound.txt.' })
          return
        }
        setSftpTest({
          phase: 'waiting',
          ok: true,
          message: `Sent inbound.txt to ${data.folder}. Drop outbound.txt into that folder.`,
        })
        watchOutbound()
      } catch {
        setSftpTest({ phase: 'connected', ok: false, message: 'Could not reach the test service.' })
      }
      return
    }
    setSftpTest({ phase: 'connecting', ok: false, message: '' })
    try {
      const data = await postSftp('connect')
      if (data.ok) {
        setSftpTest({
          phase: 'connected',
          ok: true,
          message: `Connection established. The folder on this machine is ${data.folder}.`,
        })
      } else {
        setSftpTest({ phase: 'idle', ok: false, message: data.error || 'Connection failed' })
      }
    } catch {
      setSftpTest({ phase: 'idle', ok: false, message: 'Could not reach the test service.' })
    }
  }
  const sftpBusy = ['connecting', 'sending', 'waiting', 'done'].includes(sftpTest.phase)
  const sftpLabel = {
    idle: 'Establish connection',
    connecting: 'Establishing…',
    connected: 'Test connection',
    sending: 'Sending inbound.txt…',
    waiting: 'Waiting for outbound.txt…',
    done: 'Done',
  }[sftpTest.phase]

  const submit = (ev) => {
    ev.preventDefault()
    const e = validate(state)
    setErrors(e)
    if (hasErrors(e)) {
      setTimeout(() => document.querySelector('.has-error, .group-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    if (wants214(state)) setPage('statuses')
    else setPage('review')
    window.scrollTo(0, 0)
  }

  if (page === 'review') return <Summary state={state} onEdit={() => setPage('form')} />
  if (page === 'statuses') {
    return (
      <StatusPage
        normal={state.normalStatuses}
        exception={state.exceptionStatuses}
        error={statusError}
        onToggle={(group, id) => {
          setStatusError('')
          setState((s) => ({ ...s, [group]: toggle(s[group], id) }))
        }}
        onBack={() => { setPage('form'); window.scrollTo(0, 0) }}
        onContinue={() => {
          if (state.normalStatuses.length + state.exceptionStatuses.length === 0) {
            setStatusError('Select at least one status')
            return
          }
          setPage('review')
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  return (
    <Shell>
    <section className="hero">
      <div className="hero-inner">
        <h1>Delivering what drives you.</h1>
        <p className="hero-sub">Electronic Data Interchange (EDI) Form</p>
      </div>
    </section>
    <main className="page">
      <p className="intro">Please complete all required fields marked with an asterisk (<b className="req">*</b>) before you submit the form. Thank you.</p>

      <form onSubmit={submit} noValidate>
        {errors && hasErrors(errors) && <div className="banner err" role="alert">Please fix the highlighted fields below.</div>}

        <section className="card">
          <h2>Request</h2>
          <div className="row">
            <fieldset><legend>Type</legend>
              {['New', 'Revised'].map((t) => (
                <label key={t} className="inline"><input type="radio" name="type" checked={state.type === t} onChange={() => setState((s) => ({ ...s, type: t }))} /> {t}</label>
              ))}
            </fieldset>
            <fieldset className={err('other').services ? 'group-error' : ''}><legend>Service</legend>
              {SERVICES.map((sv) => (
                <label key={sv.value} className="inline"><input type="checkbox" checked={state.services.includes(sv.value)} onChange={() => setState((s) => ({ ...s, services: toggle(s.services, sv.value) }))} /> {sv.label}</label>
              ))}
              {err('other').services && <em role="alert">{err('other').services}</em>}
            </fieldset>
          </div>
        </section>

        <section className="card">
          <h2>Main Account, Locations, Logistics &amp; Contact Information</h2>
          <div className="cols">
            <PartyColumn title="Main Account" prefix="main" values={state.mainAccount} onChange={setGroup('mainAccount')} errors={err('mainAccount')} />
            <PartyColumn title="Logistics Provider" prefix="lp" values={state.logisticsProvider} onChange={setGroup('logisticsProvider')} errors={err('logisticsProvider')} />
          </div>
          <div className="cols">
            <div>
              <h3>Additional Locations</h3>
              <label className="field"><span>Indicate Account # or Name &amp; Address</span>
                <textarea rows={4} value={state.additionalLocations} onChange={(e) => setState((s) => ({ ...s, additionalLocations: e.target.value }))} />
              </label>
              <h3>Payment House</h3>
              <Fields prefix="ph" fields={[{ name: 'companyName', label: 'Company Name' }, { name: 'contactName', label: 'Contact Name' }]} values={state.paymentHouse} onChange={setGroup('paymentHouse')} />
            </div>
            <div><h3>EDI Technical Contact</h3><Fields prefix="dev" fields={DEVELOPER_FIELDS} values={state.developer} onChange={setGroup('developer')} errors={err('developer')} /></div>
          </div>
        </section>

        <section className="card">
          <h2>Transaction Sets <small>ANSI X12, Version 4010 (check the appropriate boxes)</small></h2>
          <div className="cols">
            {[['dayRoss', 'Day & Ross to provide specs'], ['customer', 'Customer to provide specs']].map(([key, title]) => (
              <div key={key}>
                <h3>{title}</h3>
                {TRANSACTION_SETS.filter((t) => t[key]).map((t) => (
                  <label key={t.code} className="inline block">
                    <input type="checkbox" checked={state.sets[key].includes(t.code)} onChange={() => setState((s) => ({ ...s, sets: { ...s.sets, [key]: toggle(s.sets[key], t.code) } }))} />
                    <span><b>{t.code}</b> {t.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Trading partner identifiers <small>ANSI X12</small></h2>
          <div className="cols">
            {[
              ['scac', 'SCAC', 4, '2 to 4 letters'],
              ['isa', 'ISA', 15, '1 to 15 letters or digits. Padded to 15 in ISA06/ISA08.'],
              ['gs', 'GS', 15, '2 to 15 letters or digits (GS02/GS03).'],
            ].map(([name, label, max, hint]) => (
              <label key={name} className={`field${err('x12')[name] ? ' has-error' : ''}`} htmlFor={`x12-${name}`}>
                <span>{label} <b className="req">*</b></span>
                <input
                  id={`x12-${name}`}
                  value={state.x12[name]}
                  maxLength={max}
                  autoComplete="off"
                  onChange={(ev) => {
                    const value = ev.target.value.toUpperCase().replace(name === 'scac' ? /[^A-Z]/g : /[^A-Z0-9]/g, '').slice(0, max)
                    setState((s) => ({ ...s, x12: { ...s.x12, [name]: value } }))
                  }}
                />
                <span className="hint">{hint}</span>
                {err('x12')[name] && <em role="alert">{err('x12')[name]}</em>}
              </label>
            ))}
          </div>
        </section>

        <section className={`card${err('other').comm ? ' group-error' : ''}`}>
          <h2>Communication Methods <small>(check the appropriate boxes)</small></h2>
          <label className="inline block"><input type="checkbox" checked={state.as2} onChange={(e) => setState((s) => ({ ...s, as2: e.target.checked }))} /> <span><b>AS2</b> <i>* There is a billable charge for setting up AS2</i></span></label>
          <label className="inline block"><input type="checkbox" checked={state.sftp} onChange={(e) => setState((s) => ({ ...s, sftp: e.target.checked }))} /> <b>SFTP</b></label>
          {err('other').comm && <em role="alert">{err('other').comm}</em>}
          {state.sftp && (
            <>
              <div className="cols sub">
                <Fields prefix="sftp" fields={SFTP_FIELDS} values={state.sftpDetails} onChange={setGroup('sftpDetails')} />
              </div>
              <div className="actions">
                <button type="button" onClick={onSftpButton} disabled={!sftpReady || sftpBusy}>
                  {sftpLabel} {!sftpBusy && <Chevron />}
                </button>
              </div>
              {sftpTest.message && <div className={`banner ${sftpTest.ok ? 'ok' : 'err'}`} role="status">{sftpTest.message}</div>}
            </>
          )}
        </section>

        <section className="card">
          <h2>Authorization</h2>
          <div className="cols">
            <Fields prefix="auth" fields={[
              { name: 'name', label: 'Name of person completing this form', required: true },
              { name: 'title', label: 'Title' },
              { name: 'company', label: 'Company' },
            ]} values={state.authorization} onChange={setGroup('authorization')} errors={err('authorization')} />
            <label className="field"><span>Date</span>
              <input type="date" value={state.authorization.date} onChange={(e) => setGroup('authorization')('date', e.target.value)} />
            </label>
          </div>
          <fieldset><legend>Do you give authorization for your payment house to be set up on API/EDI and any other services Day &amp; Ross offers to get backup documents?</legend>
            {['YES', 'NO'].map((v) => (
              <label key={v} className="inline"><input type="radio" name="phauth" checked={state.authorization.paymentHouseAuth === v} onChange={() => setGroup('authorization')('paymentHouseAuth', v)} /> {v}</label>
            ))}
          </fieldset>
          <label className="field"><span>Comments</span>
            <textarea rows={3} value={state.authorization.comments} onChange={(e) => setGroup('authorization')('comments', e.target.value)} />
          </label>
        </section>

        <div className="actions"><button type="submit">{wants214(state) ? 'Next' : 'Review & Submit'} <Chevron /></button></div>
      </form>
    </main>
    </Shell>
  )
}
