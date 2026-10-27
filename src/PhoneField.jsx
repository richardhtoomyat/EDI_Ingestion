import { useEffect, useRef, useState } from 'react'

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

export function formatPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d ? `(${d}` : ''
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export function splitPhone(value) {
  const match = String(value || '').match(/^(\+\d+)\s*(.*)$/)
  const dial = COUNTRY_CODES.some((country) => country.dial === match?.[1]) ? match[1] : '+1'
  const rest = match ? match[2] : value
  return { dial, digits: String(rest || '').replace(/\D/g, '').slice(0, 10) }
}

export default function PhoneField({ id, label, required, value, onChange, error, verify }) {
  const { dial, digits } = splitPhone(value)
  const [iso, setIso] = useState(() => (dial === '+1' ? 'ca' : COUNTRY_CODES.find((country) => country.dial === dial)?.iso || 'ca'))
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [stage, setStage] = useState('idle') // idle | checking | success
  const [prompt, setPrompt] = useState(false)
  const picker = useRef(null)
  const inputId = id || `phone-${label || 'field'}`.toLowerCase().replace(/\W+/g, '-')
  const country = COUNTRY_CODES.find((item) => item.iso === iso) || COUNTRY_CODES[0]
  const complete = digits.length === 10
  const reset = () => {
    setVerified(false)
    setCode('')
    setStage('idle')
  }
  const write = (nextDial, nextDigits) => {
    const formatted = formatPhone(nextDigits)
    onChange?.(formatted ? `${nextDial} ${formatted}` : '')
  }

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!picker.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (!verify || !complete || verified) {
      setPrompt(false)
      return undefined
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
    return undefined
  }, [stage])

  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={inputId}>{label}{required && <b className="req"> *</b>}</label>
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
          id={inputId}
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
              <label htmlFor={`${inputId}-code`}>Enter the 4-digit code sent to this number</label>
              <div className="sms-row">
                <input
                  id={`${inputId}-code`}
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
