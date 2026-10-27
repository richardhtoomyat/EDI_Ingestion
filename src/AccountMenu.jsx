import { useEffect, useRef, useState } from 'react'

const THEME_KEY = 'edi-theme'
const TZ_KEY = 'edi-timezone'

function readTheme() {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function readTimezone() {
  return localStorage.getItem(TZ_KEY) || 'auto'
}

function applyTheme(theme) {
  const root = document.documentElement
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

function localZoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  } catch {
    return 'Local'
  }
}

function initials(profile) {
  const first = String(profile?.firstName || '').trim()
  const last = String(profile?.lastName || '').trim()
  if (first || last) return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase() || '?'
  return String(profile?.email || '?').slice(0, 1).toUpperCase()
}

function displayName(profile) {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
  return name || profile?.email || 'Account'
}

export function AccountMenu({ profile, onSignOut, onAccount }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [timezone, setTimezone] = useState(readTimezone)
  const [tzOpen, setTzOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [theme])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!wrap.current?.contains(event.target)) {
        setOpen(false)
        setTzOpen(false)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setTzOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chooseTheme = (next) => {
    setTheme(next)
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  const chooseTimezone = (next) => {
    setTimezone(next)
    localStorage.setItem(TZ_KEY, next)
    setTzOpen(false)
  }

  const zoneLabel = timezone === 'auto' ? `Auto (${localZoneLabel()})` : timezone

  return (
    <div className="account-menu" ref={wrap}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar" aria-hidden="true">{initials(profile)}</span>
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-head">
            <strong>{displayName(profile)}</strong>
            <span>{profile?.email || ''}</span>
          </div>
          <div className="account-dropdown-section">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAccount?.()
              }}
            >
              Account
            </button>
          </div>
          <div className="account-dropdown-section">
            <p className="account-section-label">Theme</p>
            {[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                className={theme === value ? 'checked' : ''}
                onClick={() => chooseTheme(value)}
              >
                <span className="account-radio" aria-hidden="true" />
                {label}
              </button>
            ))}
            <div className="account-timezone">
              <button
                type="button"
                role="menuitem"
                className="account-timezone-btn"
                aria-expanded={tzOpen}
                onClick={() => setTzOpen((current) => !current)}
              >
                <span>Timezone</span>
                <span className="account-timezone-value">{zoneLabel} ›</span>
              </button>
              {tzOpen && (
                <div className="account-timezone-menu">
                  <button type="button" onClick={() => chooseTimezone('auto')}>Auto ({localZoneLabel()})</button>
                  <button type="button" onClick={() => chooseTimezone('UTC')}>UTC</button>
                  <button type="button" onClick={() => chooseTimezone(localZoneLabel())}>{localZoneLabel()}</button>
                </div>
              )}
            </div>
          </div>
          <div className="account-dropdown-section">
            <button
              type="button"
              role="menuitem"
              className="account-signout"
              onClick={() => {
                setOpen(false)
                onSignOut?.()
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AccountPage({ profile, onSaved, onBack, onSignOut }) {
  const [firstName, setFirstName] = useState(profile?.firstName || '')
  const [lastName, setLastName] = useState(profile?.lastName || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const { updateProfile } = await import('./auth.js')
      const next = await updateProfile({
        userId: profile.id,
        firstName,
        lastName,
      })
      onSaved?.(next)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save your account.')
    } finally {
      setBusy(false)
    }
  }

  const roleLabel = profile?.role === 'sale'
    ? 'Sales'
    : profile?.role === 'coordinator'
      ? 'EDI Coordinator'
      : 'EDI'

  return (
    <main className="page login-wrap">
      <form className="card login-card account-card" onSubmit={submit} noValidate>
        <h2>Account</h2>
        <p className="intro">Update your name. Email and role stay the same.</p>
        {error && <div className="banner err" role="alert">{error}</div>}
        {saved && !error && <div className="banner ok" role="status">Account saved.</div>}
        <label className="field">
          <span>Email</span>
          <input value={profile?.email || ''} readOnly />
        </label>
        <label className="field">
          <span>Role</span>
          <input value={roleLabel} readOnly />
        </label>
        <label className="field">
          <span>First name <b className="req"> *</b></span>
          <input value={firstName} autoComplete="given-name" required onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="field">
          <span>Last name <b className="req"> *</b></span>
          <input value={lastName} autoComplete="family-name" required onChange={(event) => setLastName(event.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={onBack}>Back</button>
          <button type="button" className="secondary" disabled={busy} onClick={onSignOut}>Sign out</button>
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </main>
  )
}
