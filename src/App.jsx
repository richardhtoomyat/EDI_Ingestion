import { useEffect, useRef, useState } from 'react'
import {
  SERVICES, PARTY_FIELDS, DEVELOPER_FIELDS, TRANSACTION_SETS, SFTP_FIELDS, NORMAL_STATUSES, EXCEPTION_STATUSES,
} from './formConfig.js'
import { Chevron, EDI_EMAIL, Shell } from './chrome.jsx'
import { mergePrefill, saveSubmission } from './onboardingLink.js'
import PhoneField from './PhoneField.jsx'
import HostingRequest from './HostingRequest.jsx'
import As2CertificateField from './As2CertificateField.jsx'
import StatusPage, { statusCodeText } from './StatusPage.jsx'

const ACCOUNT_SYSTEMS = ['TruckMate', 'AS400']

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

function partyHasValues(values = {}) {
  return Boolean(
    String(values.accountNumber || '').trim()
    || String(values.accountSystem || '').trim()
    || PARTY_FIELDS.some((field) => String(values[field.name] || '').trim())
  )
}

function PartyColumn({ title, prefix, values, onChange, errors, locked = false }) {
  const rest = PARTY_FIELDS.filter((f) => f.name !== 'accountNumber' && (!locked || String(values[f.name] || '').trim()))
  const chooseSystem = (system) => {
    onChange('accountSystem', system)
    onChange('accountNumber', system === 'AS400' ? padAs400(values.accountNumber) : values.accountNumber.replace(/^0+/, ''))
  }
  return (
    <div>
      <h3>{title}</h3>
      <fieldset disabled={locked} className={locked ? 'locked-fields' : undefined}>
      {(!locked || values.accountNumber) && <AccountNumberField id={`${prefix}-accountNumber`} value={values.accountNumber} system={values.accountSystem} onValue={(v) => onChange('accountNumber', v)} error={errors.accountNumber} />}
      {(!locked || values.accountSystem) && (
      <fieldset className={errors.accountSystem ? 'group-error' : ''}>
        <legend>Is this account # TruckMate or AS400?{!locked && <> <b className="req">*</b></>}</legend>
        {ACCOUNT_SYSTEMS.filter((system) => !locked || values.accountSystem === system).map((system) => (
          <label key={system} className="inline">
            <input type="radio" name={`${prefix}-accountSystem`} checked={values.accountSystem === system} onChange={() => chooseSystem(system)} /> {system}
          </label>
        ))}
        {errors.accountSystem && <em role="alert">{errors.accountSystem}</em>}
      </fieldset>
      )}
      <Fields prefix={prefix} fields={rest} values={values} onChange={onChange} errors={errors} />
      </fieldset>
    </div>
  )
}

function validate(s, visible = { main: true, logistics: true, request: true }) {
  const e = { mainAccount: {}, logisticsProvider: {}, developer: {}, authorization: {}, x12: {}, other: {} }
  const need = (group, key, v) => { if (!String(v).trim()) e[group][key] = 'Required' }
  const groups = [visible.main && 'mainAccount', visible.logistics && 'logisticsProvider'].filter(Boolean)
  for (const f of PARTY_FIELDS.filter((f) => f.required)) {
    for (const group of groups) need(group, f.name, s[group][f.name])
  }
  if (visible.main) need('mainAccount', 'accountSystem', s.mainAccount.accountSystem)
  if (visible.logistics) need('logisticsProvider', 'accountSystem', s.logisticsProvider.accountSystem)
  for (const group of groups) {
    if (s[group].accountSystem === 'AS400' && s[group].accountNumber && s[group].accountNumber.length !== 7) {
      e[group].accountNumber = 'AS400 account # must be 7 characters'
    }
  }
  need('developer', 'developerName', s.developer.developerName)
  need('authorization', 'name', s.authorization.name)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const [g, vals] of [[visible.main && 'mainAccount', s.mainAccount], [visible.logistics && 'logisticsProvider', s.logisticsProvider], ['developer', s.developer]]) {
    if (!g) continue
    if (vals.email && !emailRe.test(vals.email) && vals.email.toUpperCase() !== 'N/A') e[g].email = 'Enter a valid email'
  }
  if (visible.request && s.services.length === 0) e.other.services = 'Select at least one service'
  if (!/^[A-Z]{2,4}$/.test(s.x12.scac)) e.x12.scac = 'Use 2 to 4 letters'
  if (!/^[A-Z0-9]{1,15}$/.test(s.x12.isa)) e.x12.isa = 'Use 1 to 15 letters or digits'
  if (!/^[A-Z0-9]{2,15}$/.test(s.x12.gs)) e.x12.gs = 'Use 2 to 15 letters or digits'
  if (s.type !== 'Revised') {
    if (s.hosting !== 'dayross' && s.hosting !== 'customer') {
      e.other.comm = 'Select Day & Ross or Customer hosting'
    } else if ((s.hosting === 'customer' || s.hosting === 'dayross') && !s.as2 && !s.sftp) {
      e.other.comm = 'Select AS2 or SFTP'
    }
  }
  return e
}

const hasErrors = (e) => Object.values(e).some((g) => Object.keys(g).length)
const wants214 = (s) => s.sets.includes('214')

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
}

function mondayOf(date) {
  const day = date.getDay()
  return addDays(date, day === 0 ? -6 : 1 - day)
}

function firstSelectableMonday(today) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const earliest = addDays(day, 14)
  const monday = mondayOf(earliest)
  return monday < earliest ? addDays(monday, 7) : monday
}

function monthCells(year, month) {
  const last = new Date(year, month + 1, 0)
  const start = mondayOf(new Date(year, month, 1))
  const end = addDays(mondayOf(last), 6)
  const cells = []
  for (let date = start; date <= end; date = addDays(date, 1)) cells.push(date)
  return cells
}

function formatWeek(mondayIso) {
  const start = mondayOf(new Date(`${mondayIso}T00:00:00`))
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const left = `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`
  const right = sameMonth ? String(end.getDate()) : `${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`
  return `${left} – ${right}, ${end.getFullYear()}`
}

function WeekPicker({ selected, onToggle }) {
  const today = new Date()
  const todayIso = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const earliestMonday = isoDate(firstSelectableMonday(today))
  const opening = firstSelectableMonday(today)
  const [cursor, setCursor] = useState(() => new Date(opening.getFullYear(), opening.getMonth(), 1))
  const [hover, setHover] = useState(null)
  const firstMonth = new Date(opening.getFullYear(), opening.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + 8, 1)
  const right = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  const canPrev = cursor > firstMonth
  const canNext = right < lastMonth
  const sorted = [...selected].sort()
  const preview = hover && !selected.includes(hover) && selected.length < 3 ? hover : null
  const slots = preview ? [...sorted, preview] : sorted

  const paint = (date) => {
    const monday = isoDate(mondayOf(date))
    const past = monday < earliestMonday
    const picked = selected.includes(monday)
    const showing = picked || hover === monday
    const day = date.getDay()
    return {
      monday,
      past,
      className: [
        'cal-cell',
        past ? 'past' : '',
        picked ? 'picked' : '',
        !picked && hover === monday && !past && selected.length < 3 ? 'preview' : '',
        showing && !past && (picked || selected.length < 3) ? (day === 1 ? 'start edge' : day === 0 ? 'end edge' : 'mid') : '',
        isoDate(date) === todayIso ? 'today' : '',
      ].filter(Boolean).join(' '),
    }
  }

  const month = (date, side) => {
    const cells = monthCells(date.getFullYear(), date.getMonth())
    return (
      <div className="month">
        <div className="month-title">
          {side === 'left' ? (
            <button type="button" className="cal-nav" aria-label="Previous month" disabled={!canPrev} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
          ) : <span />}
          <div className="month-name">{MONTHS[date.getMonth()]} {date.getFullYear()}</div>
          {side === 'right' ? (
            <button type="button" className="cal-nav" aria-label="Next month" disabled={!canNext} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
          ) : <span />}
        </div>
        <div className="cal-grid" onMouseLeave={() => setHover(null)}>
          {WEEKDAYS.map((name) => <div key={name} className="cal-dow">{name.slice(0, 2)}</div>)}
          {cells.map((day) => {
            const cell = paint(day)
            const outside = day.getMonth() !== date.getMonth()
            return (
              <button
                key={isoDate(day)}
                type="button"
                className={`${cell.className}${outside ? ' out' : ''}`}
                disabled={cell.past}
                aria-pressed={selected.includes(cell.monday)}
                aria-label={`Week of ${formatWeek(cell.monday)}`}
                onMouseEnter={() => { if (!cell.past) setHover(cell.monday) }}
                onClick={() => onToggle(cell.monday)}
              >
                <span className="num">{day.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flights">
      <div className="week-slots">
        {[0, 1, 2].map((index) => {
          const value = slots[index]
          const isPreview = value && value === preview
          return (
            <button
              key={index}
              type="button"
              className={`week-slot${value && !isPreview ? ' filled' : ''}${isPreview ? ' preview' : ''}`}
              disabled={!value || isPreview}
              onClick={() => onToggle(value)}
            >
              <span className="slot-k">Week {index + 1}</span>
              <span className="slot-v">{value ? formatWeek(value) : 'Select a week'}</span>
            </button>
          )
        })}
      </div>
      <div className="flights-board">
        {month(cursor, 'left')}
        {month(right, 'right')}
      </div>
    </div>
  )
}

function KickoffPage({ weeks, onToggle, onBack, onContinue, error }) {
  return (
    <Shell>
      <main className="page">
        <section className="card">
          <h2>Developer Kickoff Call <small>Pick 3 weeks you are available</small></h2>
          <p className="intro">Each choice is one full week, Monday through Sunday. The first week you can choose starts two weeks from today. Click any day to select that week, and click it again to remove it.</p>
          {error && <div className="banner err" role="alert">{error}</div>}
          <WeekPicker selected={weeks} onToggle={onToggle} />
          <p className="week-count">{weeks.length} of 3 weeks selected</p>
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
  const sets = TRANSACTION_SETS.filter((t) => state.sets.includes(t.code)).map((t) => `${t.code} ${t.name}`).join(', ') || '—'
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
    `Transaction sets: ${sets}`,
    `SCAC: ${state.x12.scac}`,
    `ISA: ${state.x12.isa}`,
    `GS: ${state.x12.gs}`,
    state.normalStatuses.length ? `214 normal statuses: ${statusCodeText(state.normalStatuses, NORMAL_STATUSES, state.normalCodes).replaceAll('\n', ', ')}` : '',
    state.exceptionStatuses.length ? `214 exception statuses: ${statusCodeText(state.exceptionStatuses, EXCEPTION_STATUSES, state.exceptionCodes).replaceAll('\n', ', ')}` : '',
    `Developer Kickoff Call: ${[...state.kickoffWeeks].sort().map(formatWeek).join('; ')}`,
    `Hosting: ${state.hosting === 'dayross' ? 'Day & Ross (Preferred)' : state.hosting === 'customer' ? 'Customer' : '—'}`,
    (state.hosting === 'customer' || state.hosting === 'dayross') ? `Method: ${[state.sftp && 'SFTP (Preferred)', state.as2 && 'AS2'].filter(Boolean).join(', ') || '—'}` : '',
    (state.hosting === 'customer' || state.hosting === 'dayross') && state.as2 ? `AS2 certificate: ${state.as2Certificate?.name || '—'}` : '',
    state.hosting === 'customer' && state.sftp ? `SFTP: ${sftpSafe.server} port ${sftpSafe.port}, user ${sftpSafe.username}, qualifier ${sftpSafe.qualifier}, dirs ${sftpSafe.directories}` : '',
    `Completed by: ${state.authorization.name} on ${state.authorization.date}`,
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
        {row('Transaction sets', sets)}
        {row('SCAC', state.x12.scac)}
        {row('ISA', state.x12.isa)}
        {row('GS', state.x12.gs)}
        {state.normalStatuses.length ? row('214 normal statuses', statusCodeText(state.normalStatuses, NORMAL_STATUSES, state.normalCodes)) : null}
        {state.exceptionStatuses.length ? row('214 exception statuses', statusCodeText(state.exceptionStatuses, EXCEPTION_STATUSES, state.exceptionCodes)) : null}
        {row('Developer Kickoff Call', [...state.kickoffWeeks].sort().map(formatWeek).join('\n'))}
      </tbody></table></section>
      {state.type !== 'Revised' && (
        <section className="card"><h2>EDI Communication</h2><table><tbody>
          {row('Hosting', state.hosting === 'dayross' ? 'Day & Ross (Preferred)' : state.hosting === 'customer' ? 'Customer' : '—')}
          {(state.hosting === 'customer' || state.hosting === 'dayross') && row('Method', [state.sftp && 'SFTP (Preferred)', state.as2 && 'AS2'].filter(Boolean).join(', ') || '—')}
          {(state.hosting === 'customer' || state.hosting === 'dayross') && state.as2 && row('AS2 certificate', state.as2Certificate?.name || '—')}
          {state.hosting === 'customer' && state.sftp && SFTP_FIELDS.map((f) => row(f.label, f.name === 'password' ? '••••••••' : state.sftpDetails[f.name]))}
        </tbody></table></section>
      )}
      <section className="card"><h2>Authorization</h2><table><tbody>
        {row('Completed by', state.authorization.name)}
        {row('Passed probationary period against tariff contract', state.authorization.paymentHouseAuth)}
        {row('Comments', state.authorization.comments)}
        {row('Date', state.authorization.date)}
      </tbody></table></section>
    </main>
    </Shell>
  )
}

export default function App({ prefill, token }) {
  const [state, setState] = useState(() => mergePrefill(prefill))
  const [errors, setErrors] = useState(null)
  const [page, setPage] = useState('form')
  const [statusError, setStatusError] = useState('')
  const [kickoffError, setKickoffError] = useState('')
  const [editingAgent, setEditingAgent] = useState(false)
  useEffect(() => {
    if (page !== 'review' || !token) return
    saveSubmission(token, state)
  }, [page])
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
  useEffect(() => { if ((state.hosting !== 'customer' && state.hosting !== 'dayross') || !state.sftp) stopOutboundWatch() }, [state.hosting, state.sftp])

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

  const fromAgent = Boolean(prefill)
  const agentLocked = fromAgent && !editingAgent
  const showRequest = !fromAgent || prefill.services?.length > 0 || prefill.type === 'Revised'
  const showMain = !fromAgent || partyHasValues(prefill.mainAccount) || Boolean(String(prefill.customerEmail || '').trim())
  const showLogistics = !fromAgent || partyHasValues(prefill.logisticsProvider)
  const showLocations = !fromAgent || Boolean(String(prefill.additionalLocations || '').trim())
  const showPayment = !fromAgent || Boolean(String(prefill.paymentHouse?.companyName || '').trim() || String(prefill.paymentHouse?.contactName || '').trim())

  const saveAgent = () => {
    const e = validate(state, { main: showMain, logistics: showLogistics, request: showRequest })
    const agentErrors = {
      mainAccount: showMain ? e.mainAccount : {},
      logisticsProvider: showLogistics ? e.logisticsProvider : {},
      developer: {},
      authorization: {},
      x12: {},
      other: showRequest && e.other.services ? { services: e.other.services } : {},
    }
    if (hasErrors(agentErrors)) {
      setErrors(agentErrors)
      setTimeout(() => document.querySelector('.has-error, .group-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    setErrors(null)
    setEditingAgent(false)
  }

  const submit = (ev) => {
    ev.preventDefault()
    const e = validate(state, { main: showMain, logistics: showLogistics, request: showRequest })
    setErrors(e)
    if (hasErrors(e)) {
      if (fromAgent) setEditingAgent(true)
      setTimeout(() => document.querySelector('.has-error, .group-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    setPage(wants214(state) ? 'statuses' : 'kickoff')
    window.scrollTo(0, 0)
  }

  const toggleKickoff = (monday) => {
    setKickoffError('')
    setState((current) => {
      if (current.kickoffWeeks.includes(monday)) {
        return { ...current, kickoffWeeks: current.kickoffWeeks.filter((week) => week !== monday) }
      }
      if (current.kickoffWeeks.length >= 3) return current
      return { ...current, kickoffWeeks: [...current.kickoffWeeks, monday] }
    })
  }

  if (page === 'review') return <Summary state={state} onEdit={() => setPage('form')} />
  if (page === 'statuses') {
    return (
      <StatusPage
        normal={state.normalStatuses}
        exception={state.exceptionStatuses}
        normalCodes={state.normalCodes}
        normalOpen={state.normalOpen}
        exceptionCodes={state.exceptionCodes}
        exceptionOpen={state.exceptionOpen}
        error={statusError}
        onToggle={(group, id) => {
          setStatusError('')
          setState((s) => ({ ...s, [group]: toggle(s[group], id) }))
        }}
        onCustomize={(group, id, status) => {
          const openKey = group === 'normalStatuses' ? 'normalOpen' : 'exceptionOpen'
          const codeKey = group === 'normalStatuses' ? 'normalCodes' : 'exceptionCodes'
          setState((s) => ({
            ...s,
            [openKey]: s[openKey].includes(id) ? s[openKey] : [...s[openKey], id],
            [codeKey]: s[codeKey][id] ? s[codeKey] : { ...s[codeKey], [id]: { at701: status.at701, at702: status.at702 } },
          }))
        }}
        onSave={(group, id, status) => {
          const openKey = group === 'normalStatuses' ? 'normalOpen' : 'exceptionOpen'
          const codeKey = group === 'normalStatuses' ? 'normalCodes' : 'exceptionCodes'
          setState((s) => {
            const existing = s[codeKey][id] || {}
            return {
              ...s,
              [openKey]: s[openKey].filter((item) => item !== id),
              [codeKey]: {
                ...s[codeKey],
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
          setState((s) => ({
            ...s,
            [codeKey]: { ...s[codeKey], [id]: { ...s[codeKey][id], [field]: value } },
          }))
        }}
        onBack={() => { setPage('form'); window.scrollTo(0, 0) }}
        onContinue={() => {
          if (state.normalStatuses.length + state.exceptionStatuses.length === 0) {
            setStatusError('Select at least one status')
            return
          }
          setPage('kickoff')
          window.scrollTo(0, 0)
        }}
      />
    )
  }
  if (page === 'kickoff') {
    return (
      <KickoffPage
        weeks={state.kickoffWeeks}
        error={kickoffError}
        onToggle={(monday) => {
          if (!state.kickoffWeeks.includes(monday) && state.kickoffWeeks.length >= 3) {
            setKickoffError('Remove a week before choosing a different one')
            return
          }
          toggleKickoff(monday)
        }}
        onBack={() => { setPage(wants214(state) ? 'statuses' : 'form'); window.scrollTo(0, 0) }}
        onContinue={() => {
          if (state.kickoffWeeks.length !== 3) {
            setKickoffError('Pick 3 weeks for the Developer Kickoff Call')
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
      {prefill && <div className="banner ok">Your Day &amp; Ross sales agent started this form. Review the details and complete the rest.</div>}

      <form onSubmit={submit} noValidate>
        {errors && hasErrors(errors) && <div className="banner err" role="alert">Please fix the highlighted fields below.</div>}

        {(showRequest || showMain || showLogistics || showLocations || showPayment) && (
        <section className="card">
          <div className="dash-top">
            <h2>{fromAgent ? 'Provided by your sales agent' : 'Account information'}</h2>
            {fromAgent && <button type="button" className="secondary" onClick={() => (editingAgent ? saveAgent() : setEditingAgent(true))}>{editingAgent ? 'Save' : 'Edit'}</button>}
          </div>
          {showRequest && (
          <div className="row">
            <fieldset disabled={agentLocked} className={agentLocked ? 'locked-fields' : undefined}><legend>Type</legend>
              {(agentLocked ? [state.type] : ['New', 'Revised']).map((t) => (
                <label key={t} className="inline"><input type="radio" name="type" checked={state.type === t} onChange={() => setState((s) => ({ ...s, type: t }))} /> {t}</label>
              ))}
            </fieldset>
            <fieldset disabled={agentLocked} className={`${agentLocked ? 'locked-fields' : ''}${err('other').services ? ' group-error' : ''}`}><legend>Service</legend>
              {SERVICES.filter((sv) => !agentLocked || state.services.includes(sv.value)).map((sv) => (
                <label key={sv.value} className="inline"><input type="checkbox" checked={state.services.includes(sv.value)} onChange={() => setState((s) => ({ ...s, services: toggle(s.services, sv.value) }))} /> {sv.label}</label>
              ))}
              {err('other').services && <em role="alert">{err('other').services}</em>}
            </fieldset>
          </div>
          )}
          {(showMain || showLogistics) && (
          <div className="cols">
            {showMain && <PartyColumn title="Main Account" prefix="main" values={state.mainAccount} onChange={setGroup('mainAccount')} errors={err('mainAccount')} locked={agentLocked} />}
            {showLogistics && <PartyColumn title="Logistics Provider" prefix="lp" values={state.logisticsProvider} onChange={setGroup('logisticsProvider')} errors={err('logisticsProvider')} locked={agentLocked} />}
          </div>
          )}
          {(showLocations || showPayment) && (
          <div className="cols">
            {showLocations && (
            <div>
              <h3>Additional Locations</h3>
              <fieldset disabled={agentLocked} className={agentLocked ? 'locked-fields' : undefined}>
              <label className="field"><span>Indicate Account # or Name &amp; Address</span>
                <textarea rows={4} value={state.additionalLocations} onChange={(e) => setState((s) => ({ ...s, additionalLocations: e.target.value }))} />
              </label>
              </fieldset>
            </div>
            )}
            {showPayment && (
            <div>
              <h3>Payment House</h3>
              <fieldset disabled={agentLocked} className={agentLocked ? 'locked-fields' : undefined}>
              <Fields prefix="ph" fields={[{ name: 'companyName', label: 'Company Name' }, { name: 'contactName', label: 'Contact Name' }].filter((field) => !agentLocked || String(state.paymentHouse[field.name] || '').trim())} values={state.paymentHouse} onChange={setGroup('paymentHouse')} />
              </fieldset>
            </div>
            )}
          </div>
          )}
        </section>
        )}

        <section className="card">
          <h2>EDI Technical Contact</h2>
          <Fields prefix="dev" fields={DEVELOPER_FIELDS} values={state.developer} onChange={setGroup('developer')} errors={err('developer')} />
        </section>

        <section className="card">
          <h2>Transaction Sets <small>ANSI X12, Version 4010 (check the appropriate boxes)</small></h2>
          <fieldset disabled={fromAgent && prefill?.sets?.length > 0 && agentLocked} className={fromAgent && prefill?.sets?.length > 0 && agentLocked ? 'locked-fields' : undefined}>
            <div>
              {TRANSACTION_SETS.filter((t) => !(fromAgent && prefill?.sets?.length > 0 && agentLocked) || state.sets.includes(t.code)).map((t) => (
                <label key={t.code} className="inline block">
                  <input type="checkbox" checked={state.sets.includes(t.code)} onChange={() => setState((s) => {
                    const next = toggle(s.sets, t.code)
                    const turningOn = !s.sets.includes(t.code)
                    if (turningOn && (t.code === '204' || t.code === '211')) {
                      const other = t.code === '204' ? '211' : '204'
                      return { ...s, sets: next.filter((code) => code !== other) }
                    }
                    return { ...s, sets: next }
                  })} />
                  <span><b>{t.code}</b> {t.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
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

        {state.type !== 'Revised' && (
        <section className={`card${err('other').comm ? ' group-error' : ''}`}>
          <h2>EDI Communication</h2>
          <fieldset disabled={fromAgent && Boolean(prefill?.hosting) && agentLocked} className={fromAgent && Boolean(prefill?.hosting) && agentLocked ? 'locked-fields' : undefined}>
            <legend>Hosting</legend>
            {[
              { value: 'dayross', label: 'Day & Ross (Preferred)' },
              { value: 'customer', label: 'Customer' },
            ].map((option) => (
              <label key={option.value} className="inline">
                <input
                  type="radio"
                  name="hosting"
                  checked={state.hosting === option.value}
                  onChange={() => setState((current) => ({
                    ...current,
                    hosting: option.value,
                    as2: false,
                    sftp: false,
                    as2Certificate: null,
                  }))}
                /> {option.label}
              </label>
            ))}
            {err('other').comm && <em role="alert">{err('other').comm}</em>}
            {(state.hosting === 'dayross' || state.hosting === 'customer') && (
              <>
                <fieldset className="sub">
                  <legend>Method</legend>
                  <label className="inline">
                    <input
                      type="radio"
                      name="edi-method"
                      checked={Boolean(state.sftp)}
                      onChange={() => setState((current) => ({
                        ...current,
                        as2: false,
                        sftp: true,
                        as2Certificate: null,
                      }))}
                    /> SFTP (Preferred)
                  </label>
                  <label className="inline">
                    <input
                      type="radio"
                      name="edi-method"
                      checked={Boolean(state.as2)}
                      onChange={() => setState((current) => ({ ...current, as2: true, sftp: false }))}
                    /> AS2
                  </label>
                </fieldset>
                {state.as2 && (
                  <div className="cols sub">
                    <As2CertificateField
                      value={state.as2Certificate}
                      onChange={(as2Certificate) => setState((current) => ({ ...current, as2Certificate }))}
                    />
                  </div>
                )}
                {state.hosting === 'dayross' && state.sftp && <HostingRequest key="dayross-sftp-request" />}
                {state.hosting === 'customer' && state.sftp && (
                  <>
                    <div className="cols sub">
                      <Fields prefix="sftp" fields={SFTP_FIELDS} values={state.sftpDetails} onChange={setGroup('sftpDetails')} />
                    </div>
                    {!(fromAgent && Boolean(prefill?.hosting) && agentLocked) && (
                      <>
                        <div className="actions">
                          <button type="button" onClick={onSftpButton} disabled={!sftpReady || sftpBusy}>
                            {sftpLabel} {!sftpBusy && <Chevron />}
                          </button>
                        </div>
                        {sftpTest.message && <div className={`banner ${sftpTest.ok ? 'ok' : 'err'}`} role="status">{sftpTest.message}</div>}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </fieldset>
        </section>
        )}

        <section className="card">
          <h2>Authorization</h2>
          <fieldset disabled={fromAgent && Boolean(prefill?.authorization?.name) && agentLocked} className={fromAgent && Boolean(prefill?.authorization?.name) && agentLocked ? 'locked-fields' : undefined}>
            <div className="cols">
              <Fields prefix="auth" fields={[
                { name: 'name', label: 'Name of person completing this form', required: true },
              ]} values={state.authorization} onChange={setGroup('authorization')} errors={err('authorization')} />
              <label className="field"><span>Date</span>
                <input type="date" value={state.authorization.date} onChange={(e) => setGroup('authorization')('date', e.target.value)} />
              </label>
            </div>
            <fieldset><legend>Has this customer already passed the probationary period against their tariff contract?</legend>
              {['YES', 'NO'].map((v) => (
                <label key={v} className="inline"><input type="radio" name="phauth" checked={state.authorization.paymentHouseAuth === v} onChange={() => setGroup('authorization')('paymentHouseAuth', v)} /> {v}</label>
              ))}
            </fieldset>
            <label className="field"><span>Comments</span>
              <textarea rows={3} value={state.authorization.comments} onChange={(e) => setGroup('authorization')('comments', e.target.value)} />
            </label>
          </fieldset>
        </section>

        <div className="actions"><button type="submit">Next <Chevron /></button></div>
      </form>
    </main>
    </Shell>
  )
}
