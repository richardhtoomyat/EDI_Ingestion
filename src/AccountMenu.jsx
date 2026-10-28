import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

const WORKPLACES = [
  { value: 'sale', label: 'Sales' },
  { value: 'edi', label: 'EDI' },
  { value: 'coordinator', label: 'Coordinator' },
]

export function isAdminProfile(profile) {
  return profile?.role === 'admin'
}

export function AccountMenu({
  profile,
  onSignOut,
  onAccount,
  onSwitchWorkplace,
  onAdministration,
  currentWorkplace,
}) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [timezone, setTimezone] = useState(readTimezone)
  const [tzOpen, setTzOpen] = useState(false)
  const [workplaceOpen, setWorkplaceOpen] = useState(false)
  const wrap = useRef(null)
  const admin = isAdminProfile(profile)

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
        setWorkplaceOpen(false)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setTzOpen(false)
        setWorkplaceOpen(false)
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
              Settings
            </button>
            {admin && (
              <>
                <div className="account-timezone">
                  <button
                    type="button"
                    role="menuitem"
                    className="account-timezone-btn"
                    aria-expanded={workplaceOpen}
                    onClick={() => {
                      setTzOpen(false)
                      setWorkplaceOpen((current) => !current)
                    }}
                  >
                    <span>Switch Workplace</span>
                    <span className="account-timezone-value">›</span>
                  </button>
                  {workplaceOpen && (
                    <div className="account-timezone-menu">
                      {WORKPLACES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={currentWorkplace === item.value ? 'checked' : ''}
                          onClick={() => {
                            setOpen(false)
                            setWorkplaceOpen(false)
                            onSwitchWorkplace?.(item.value)
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onAdministration?.()
                  }}
                >
                  Administration
                </button>
              </>
            )}
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
                onClick={() => {
                  setWorkplaceOpen(false)
                  setTzOpen((current) => !current)
                }}
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

export function AccountPage({ profile, onSaved, onBack }) {
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
      setError(err.message || 'Could not save your settings.')
    } finally {
      setBusy(false)
    }
  }

  const roleLabel = profile?.role === 'sale'
    ? 'Sales'
    : profile?.role === 'coordinator'
      ? 'EDI Coordinator'
      : profile?.role === 'admin'
        ? 'Admin'
        : 'EDI'

  return (
    <main className="settings-page">
      <aside className="settings-nav">
        <div className="settings-identity">
          <span className="settings-avatar" aria-hidden="true">{initials(profile)}</span>
          <div>
            <strong>{displayName(profile)}</strong>
            <span>{profile?.email || ''}</span>
            <small>{roleLabel}</small>
          </div>
        </div>
        <nav aria-label="Settings">
          <button type="button" className="settings-tab active" aria-current="page">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path fill="currentColor" d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6.2c0-2.2 2.2-3.7 5-3.7s5 1.5 5 3.7V15H3v-.8Z" />
            </svg>
            Account
          </button>
        </nav>
      </aside>
      <form className="settings-panel" onSubmit={submit} noValidate>
        <h2>Account</h2>
        {error && <div className="banner err" role="alert">{error}</div>}
        {saved && !error && <div className="banner ok" role="status">Settings saved.</div>}
        <label className="field">
          <span>First name</span>
          <input value={firstName} autoComplete="given-name" required onChange={(event) => setFirstName(event.target.value)} />
          <small>Shown when teammates see your name.</small>
        </label>
        <label className="field">
          <span>Last name</span>
          <input value={lastName} autoComplete="family-name" required onChange={(event) => setLastName(event.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={profile?.email || ''} readOnly />
          <small>Used to sign in. This cannot be changed here.</small>
        </label>
        <label className="field">
          <span>Role</span>
          <input value={roleLabel} readOnly />
          <small>Assigned for this workspace.</small>
        </label>
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={onBack}>Back</button>
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </main>
  )
}

const INVITE_ROLES = [
  { value: 'sale', label: 'Sales' },
  { value: 'edi', label: 'EDI' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'admin', label: 'Admin' },
]

const DEFAULT_INVITE_MESSAGE = 'I would like to invite you to the Day & Ross EDI workspace. Please use the link in this email to set up your account and join.'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function InviteUserModal({ onClose, onInvited }) {
  const [emails, setEmails] = useState([])
  const [draft, setDraft] = useState('')
  const [role, setRole] = useState('sale')
  const [message, setMessage] = useState(DEFAULT_INVITE_MESSAGE)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const addEmails = (raw) => {
    const parts = String(raw || '').split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)
    if (!parts.length) return
    const invalid = parts.find((item) => !isValidEmail(item))
    if (invalid) {
      setError(`Invalid email: ${invalid}`)
      return
    }
    setError('')
    setEmails((current) => [...new Set([...current, ...parts])])
    setDraft('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (draft.trim()) addEmails(draft)
    const nextEmails = draft.trim()
      ? [...new Set([...emails, ...String(draft).split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)])]
      : emails
    if (!nextEmails.length) {
      setError('Add at least one email address')
      return
    }
    if (nextEmails.some((item) => !isValidEmail(item))) {
      setError('One or more email addresses are invalid')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { inviteUsers } = await import('./onboardingLink.js')
      const result = await inviteUsers({ emails: nextEmails, role, message })
      onInvited?.(result)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Could not send invitations')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="edi-detail invite-modal" role="dialog" aria-modal="true" aria-label="Invite to Workspace">
      <button type="button" className="edi-scrim" aria-label="Close" onClick={onClose} />
      <form className="edi-sheet invite-sheet" onSubmit={submit}>
        <div className="dash-top">
          <h2>Invite to Workspace</h2>
          <button type="button" className="secondary status-edit" onClick={onClose}>Close</button>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        <div className="invite-grid">
          <div className="invite-fields">
            <label className="field">
              <span>E-Mail Addresses <b className="req"> *</b></span>
              <div className="email-chips">
                {emails.map((email) => (
                  <span key={email} className="email-chip">
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => setEmails((current) => current.filter((item) => item !== email))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={draft}
                  placeholder={emails.length ? 'Add another email' : 'name@dayross.com'}
                  autoComplete="off"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                      event.preventDefault()
                      addEmails(draft)
                    }
                    if (event.key === 'Backspace' && !draft && emails.length) {
                      setEmails((current) => current.slice(0, -1))
                    }
                  }}
                  onBlur={() => { if (draft.trim()) addEmails(draft) }}
                />
              </div>
            </label>
            <label className="field">
              <span>Set Role <b className="req"> *</b></span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {INVITE_ROLES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Message</span>
              <textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
              <span className="intro">A header and the invite link are added automatically.</span>
            </label>
          </div>
          <aside className="invite-help">
            <h3>How to Invite?</h3>
            <p className="intro">Provide the email addresses of the users you want in this workspace. Press Enter after each address.</p>
            <p className="intro">They receive an email from the app to finish account setup (name and password), then can sign in with the role you selected.</p>
          </aside>
        </div>
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy}>{busy ? 'Inviting…' : 'Invite'}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function roleLabel(role) {
  if (role === 'sale') return 'Sales'
  if (role === 'coordinator') return 'Coordinator'
  if (role === 'admin') return 'Admin'
  if (role === 'edi') return 'EDI'
  return role || '—'
}

function memberName(person) {
  const name = [person.firstName, person.lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ')
  return name || '—'
}

function formatJoined(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AdministrationPage({ onBack }) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [members, setMembers] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const refreshMembers = () => {
    setLoading(true)
    return import('./onboardingLink.js')
      .then(({ loadOrganization }) => loadOrganization())
      .then((profiles) => {
        setMembers(profiles)
        setLoadError('')
      })
      .catch((error) => {
        setLoadError(error.message || 'Could not load organization')
        setMembers([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refreshMembers()
  }, [])

  const filtered = members.filter((person) => {
    if (roleFilter !== 'all' && person.role !== roleFilter) return false
    const haystack = `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    return true
  })

  const counts = {
    all: members.length,
    sale: members.filter((item) => item.role === 'sale').length,
    edi: members.filter((item) => item.role === 'edi').length,
    coordinator: members.filter((item) => item.role === 'coordinator').length,
    admin: members.filter((item) => item.role === 'admin').length,
  }

  return (
    <main className="page edi-page">
      <div className="dash-top">
        <div>
          <h2 className="dash-title">Administration</h2>
          <p className="intro">Manage workspace access for Sales, EDI, Coordinator, and Admin users.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Back</button>
          <button type="button" className="secondary" disabled={loading} onClick={() => refreshMembers()}>Refresh</button>
          <button type="button" onClick={() => { setNotice(''); setInviteOpen(true) }}>Invite user</button>
        </div>
      </div>
      {notice && <div className="banner ok" role="status">{notice}</div>}
      {loadError && <div className="banner err" role="alert">{loadError}</div>}

      <div className="edi-stats">
        <div><b>{counts.all}</b><span>Everyone</span></div>
        <div><b>{counts.sale}</b><span>Sales</span></div>
        <div><b>{counts.edi}</b><span>EDI</span></div>
        <div><b>{counts.admin + counts.coordinator}</b><span>Admin / Coordinator</span></div>
      </div>

      <section className="card">
        <div className="dash-top">
          <div>
            <h3 className="dash-title">Organization</h3>
            <p className="intro">Everyone with an account in this workspace.</p>
          </div>
        </div>
        <div className="edi-filters admin-org-filters">
          <label className="field">
            <span>Search</span>
            <input value={query} placeholder="Name or email" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              {INVITE_ROLES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="intro">Loading organization…</p>
        ) : filtered.length === 0 ? (
          <p className="intro">No people match these filters.</p>
        ) : (
          <table className="edi-table admin-org-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.id}>
                  <td><strong>{memberName(person)}</strong></td>
                  <td>{person.email || '—'}</td>
                  <td><span className={`edi-pill role-${person.role}`}>{roleLabel(person.role)}</span></td>
                  <td>{formatJoined(person.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onInvited={(result) => {
            setNotice(result.message || 'Invitations sent.')
            refreshMembers()
          }}
        />
      )}
    </main>
  )
}
