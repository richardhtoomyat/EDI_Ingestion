import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shell } from './chrome.jsx'

const STORAGE_KEY = 'edi-iam-directory-v6'
const DORMANT_DAYS = 90
const ACTOR = 'Jordan IAM'
const SUPER_ADMIN_GROUP = 'EDI-SuperAdmins'

const GROUPS = [
  { value: 'EDI-Sales', role: 'sale', label: 'Sales' },
  { value: 'EDI-Analysts', role: 'edi', label: 'EDI' },
  { value: 'EDI-Coordinators', role: 'coordinator', label: 'Coordinator' },
  { value: 'EDI-Admins', role: 'admin', label: 'Admin' },
  { value: SUPER_ADMIN_GROUP, role: 'super-admin', label: 'Super Admin' },
]

const OFFBOARD_REASONS = [
  'Left the company',
  'Role no longer needed',
  'Duplicate account',
]

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isoDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function todayInputValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function roleForGroup(group) {
  return GROUPS.find((item) => item.value === group)?.role || ''
}

function roleLabel(role) {
  return GROUPS.find((item) => item.role === role)?.label || role || '—'
}

function groupLabel(group) {
  return GROUPS.find((item) => item.value === group)?.value || group || '—'
}

function isSuperAdmin(person) {
  return person?.ldapGroup === SUPER_ADMIN_GROUP || person?.role === 'super-admin'
}

function grantableGroups(actorIsSuperAdmin) {
  return GROUPS.filter((item) => item.value !== SUPER_ADMIN_GROUP || actorIsSuperAdmin)
}

function personName(person) {
  return [person?.firstName, person?.lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ') || '—'
}

function formatWhen(value) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatStamp(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function daysSince(value) {
  if (!value) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000))
}

function personFlags(person) {
  if (person.appStatus !== 'active') return []
  const flags = []
  if (person.directoryStatus === 'disabled') flags.push('directory-disabled')
  if (daysSince(person.lastSsoSignIn) >= DORMANT_DAYS) flags.push('dormant')
  if (person.ldapGroup && roleForGroup(person.ldapGroup) && person.role !== roleForGroup(person.ldapGroup)) {
    flags.push('exception')
  }
  return flags
}

function flagLabel(flag) {
  if (flag === 'dormant') return 'Dormant'
  if (flag === 'directory-disabled') return 'Directory disabled'
  if (flag === 'exception') return 'Group exception'
  return flag
}

function makePerson({
  firstName, lastName, email, networkId, upn, directoryStatus = 'enabled',
  lastSsoSignIn, ldapGroup = '', role = '', appStatus = 'none', note = '',
  grantedAt = '', offboardedAt = '', offboardReason = '', offboardNote = '', lastDay = '',
  sessionRevoked = false, leaverIncomplete = false,
}) {
  const derivedNetworkId = networkId
    || `${String(firstName || '').slice(0, 1)}${String(lastName || '')}`.toLowerCase().replace(/[^a-z0-9]/g, '')
  return {
    id: uid(),
    firstName,
    lastName,
    email,
    networkId: derivedNetworkId,
    upn: upn || email,
    directoryStatus,
    lastSsoSignIn: lastSsoSignIn || '',
    ldapGroup,
    role: role || (ldapGroup ? roleForGroup(ldapGroup) : ''),
    appStatus,
    note,
    grantedAt,
    offboardedAt,
    offboardReason,
    offboardNote,
    lastDay,
    sessionRevoked,
    leaverIncomplete,
  }
}

function createSeed() {
  const people = [
    makePerson({
      firstName: 'Avery', lastName: 'Chen', email: 'avery.chen@dayross.com', networkId: 'achen',
      ldapGroup: 'EDI-Sales', appStatus: 'active', grantedAt: isoDaysAgo(86),
      lastSsoSignIn: isoDaysAgo(4),
    }),
    makePerson({
      firstName: 'Jordan', lastName: 'Hale', email: 'jordan.hale@dayross.com', networkId: 'jhale',
      ldapGroup: 'EDI-Analysts', appStatus: 'active', note: 'Primary EDI analyst',
      grantedAt: isoDaysAgo(54), lastSsoSignIn: isoDaysAgo(1),
    }),
    makePerson({
      firstName: 'Morgan', lastName: 'Patel', email: 'morgan.patel@dayross.com', networkId: 'mpatel',
      ldapGroup: 'EDI-Coordinators', appStatus: 'active', grantedAt: isoDaysAgo(31),
      lastSsoSignIn: isoDaysAgo(9),
    }),
    makePerson({
      firstName: 'Riley', lastName: 'Santos', email: 'riley.santos@dayross.com', networkId: 'rsantos',
      ldapGroup: 'EDI-Admins', appStatus: 'active', grantedAt: isoDaysAgo(140),
      lastSsoSignIn: isoDaysAgo(2),
    }),
    // IAM Super Admin (operator for this mock)
    makePerson({
      firstName: 'Jordan', lastName: 'IAM', email: 'jordan.iam@dayross.com', networkId: 'jiam',
      ldapGroup: SUPER_ADMIN_GROUP, appStatus: 'active', grantedAt: isoDaysAgo(300),
      lastSsoSignIn: isoDaysAgo(0),
      note: 'IAM team · Super Admin',
    }),
    // Dormant: has access, no SSO in 90+ days
    makePerson({
      firstName: 'Taylor', lastName: 'Brooks', email: 'taylor.brooks@dayross.com', networkId: 'tbrooks',
      ldapGroup: 'EDI-Sales', appStatus: 'active', grantedAt: isoDaysAgo(210),
      lastSsoSignIn: isoDaysAgo(118),
      note: 'No recent SSO sign-in',
    }),
    // Directory disabled but still has app access
    makePerson({
      firstName: 'Quinn', lastName: 'Adler', email: 'quinn.adler@dayross.com', networkId: 'qadler',
      ldapGroup: 'EDI-Analysts', appStatus: 'active', directoryStatus: 'disabled',
      grantedAt: isoDaysAgo(95), lastSsoSignIn: isoDaysAgo(40),
      note: 'Directory account disabled; app access still present',
    }),
    // Group exception: LDAP group vs app role mismatch
    makePerson({
      firstName: 'Harper', lastName: 'Diaz', email: 'harper.diaz@dayross.com', networkId: 'hdiaz',
      ldapGroup: 'EDI-Sales', role: 'edi', appStatus: 'active',
      grantedAt: isoDaysAgo(60), lastSsoSignIn: isoDaysAgo(3),
      note: 'App role does not match LDAP group',
    }),
    makePerson({
      firstName: 'Cameron', lastName: 'Singh', email: 'cameron.singh@dayross.com', networkId: 'csingh',
      ldapGroup: 'EDI-Coordinators', appStatus: 'active', grantedAt: isoDaysAgo(160),
      lastSsoSignIn: isoDaysAgo(8),
    }),
    // Offboarded leaver
    makePerson({
      firstName: 'Casey', lastName: 'Nguyen', email: 'casey.nguyen@dayross.com', networkId: 'cnguyen',
      ldapGroup: '', role: 'edi', appStatus: 'offboarded', directoryStatus: 'disabled',
      grantedAt: isoDaysAgo(200), offboardedAt: isoDaysAgo(12),
      offboardReason: 'Left the company',
      offboardNote: 'Last day confirmed with their manager.',
      lastDay: isoDaysAgo(12).slice(0, 10),
      lastSsoSignIn: isoDaysAgo(14), sessionRevoked: true, leaverIncomplete: false,
    }),
    // Directory people without app access yet (joiners)
    makePerson({
      firstName: 'Samira', lastName: 'Quinn', email: 'samira.quinn@dayross.com', networkId: 'squinn',
      lastSsoSignIn: isoDaysAgo(2), appStatus: 'none',
    }),
    makePerson({
      firstName: 'Noah', lastName: 'Kim', email: 'noah.kim@dayross.com', networkId: 'nkim',
      lastSsoSignIn: isoDaysAgo(6), appStatus: 'none',
    }),
    makePerson({
      firstName: 'Elena', lastName: 'Vargas', email: 'elena.vargas@dayross.com', networkId: 'evargas',
      lastSsoSignIn: isoDaysAgo(11), appStatus: 'none',
    }),
  ]

  const activity = [
    ...people.filter((person) => person.appStatus === 'active' || person.appStatus === 'offboarded').map((person) => ({
      id: uid(),
      at: person.grantedAt,
      kind: 'grant',
      actor: ACTOR,
      detail: `${personName(person)} granted ${groupLabel(person.ldapGroup || roleLabel(person.role))}`,
      before: '',
      after: person.ldapGroup || '',
    })),
    ...people.filter((person) => person.appStatus === 'offboarded').map((person) => ({
      id: uid(),
      at: person.offboardedAt,
      kind: 'leaver',
      actor: ACTOR,
      detail: `${personName(person)} · ${person.offboardReason}`,
      before: 'EDI-Analysts',
      after: '',
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  return { people, activity }
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data?.people) || !Array.isArray(data?.activity)) return null
    return data
  } catch {
    return null
  }
}

function persist(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Directory still works for this browser session.
  }
}

function logEntry({ kind, detail, before = '', after = '', actor = ACTOR }) {
  return {
    id: uid(),
    at: new Date().toISOString(),
    kind,
    actor,
    detail,
    before,
    after,
  }
}

export function IamDashboardPreview() {
  return (
    <IamDashboard
      profile={{ firstName: 'Jordan', lastName: 'IAM', email: 'jordan.iam@dayross.com', role: 'super-admin' }}
      onSignOut={() => {}}
    />
  )
}

export default function IamDashboard({ profile, onSignOut }) {
  const [store, setStore] = useState(() => readStore() || createSeed())
  const [tab, setTab] = useState('access')
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [grantOpen, setGrantOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState(null)
  const [offboardTarget, setOffboardTarget] = useState(null)
  const [detailId, setDetailId] = useState('')
  const [resetAsk, setResetAsk] = useState(false)
  const firstName = profile?.firstName || ''
  const actorEmail = String(profile?.email || '').toLowerCase()

  useEffect(() => {
    persist(store)
  }, [store])

  const updateStore = (recipe) => {
    setStore((current) => recipe(current))
  }

  const people = store.people
  const active = people.filter((person) => person.appStatus === 'active')
  const offboarded = people.filter((person) => person.appStatus === 'offboarded')
  const eligible = people.filter((person) => (
    person.appStatus === 'none'
    && person.directoryStatus === 'enabled'
  ))
  const actor = people.find((person) => String(person.email || '').toLowerCase() === actorEmail)
    || (profile?.role === 'super-admin' || profile?.role === 'iam'
      ? { ldapGroup: SUPER_ADMIN_GROUP, role: 'super-admin', email: actorEmail }
      : null)
  const actorIsSuperAdmin = isSuperAdmin(actor)
  const availableGroups = grantableGroups(actorIsSuperAdmin)

  const flagCounts = useMemo(() => {
    const counts = { dormant: 0, 'directory-disabled': 0, exception: 0 }
    active.forEach((person) => {
      personFlags(person).forEach((flag) => { counts[flag] += 1 })
    })
    return counts
  }, [active])

  const pool = tab === 'offboarded' ? offboarded : active
  const filtered = pool.filter((person) => {
    if (groupFilter !== 'all' && person.ldapGroup !== groupFilter) return false
    if (flagFilter !== 'all' && !personFlags(person).includes(flagFilter)) return false
    const haystack = `${person.firstName} ${person.lastName} ${person.email} ${person.networkId} ${person.ldapGroup}`.toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    return true
  })

  const detail = people.find((person) => person.id === detailId) || null

  const grantAccess = ({ personId, ldapGroup, note }) => {
    const person = people.find((item) => item.id === personId)
    if (!person) return 'Pick someone from the LDAP directory.'
    if (person.directoryStatus !== 'enabled') return 'Directory account is disabled. Enable them in LDAP first.'
    if (person.appStatus === 'active') return 'That person already has app access.'
    if (person.appStatus === 'offboarded') return 'Restore them from Offboarded before granting again.'
    if (ldapGroup === SUPER_ADMIN_GROUP && !actorIsSuperAdmin) {
      return 'Only a Super Admin can grant Super Admin.'
    }
    const role = roleForGroup(ldapGroup)
    if (!role) return 'Choose an LDAP group.'

    updateStore((current) => ({
      people: current.people.map((item) => (
        item.id === personId
          ? {
            ...item,
            ldapGroup,
            role,
            appStatus: 'active',
            note: note.trim() || (ldapGroup === SUPER_ADMIN_GROUP ? 'IAM team · Super Admin' : ''),
            grantedAt: new Date().toISOString(),
            offboardedAt: '',
            offboardReason: '',
            offboardNote: '',
            lastDay: '',
            sessionRevoked: false,
            leaverIncomplete: false,
          }
          : item
      )),
      activity: [
        logEntry({
          kind: 'grant',
          detail: `${personName(person)} granted ${ldapGroup}${ldapGroup === SUPER_ADMIN_GROUP ? ' (Super Admin)' : ''}`,
          before: '',
          after: ldapGroup,
        }),
        ...current.activity,
      ],
    }))
    setNotice(
      ldapGroup === SUPER_ADMIN_GROUP
        ? `Granted Super Admin to ${personName(person)}. They can manage IAM access, including granting Super Admin to others.`
        : `Granted ${ldapGroup} to ${personName(person)}. SSO sign-in is unchanged; group membership is local only.`,
    )
    setGrantOpen(false)
    setTab('access')
    return ''
  }

  const moveGroup = (person, nextGroup) => {
    const previous = person.ldapGroup
    if (nextGroup === SUPER_ADMIN_GROUP && !actorIsSuperAdmin) {
      setNotice('Only a Super Admin can grant Super Admin.')
      return
    }
    if (previous === SUPER_ADMIN_GROUP && !actorIsSuperAdmin) {
      setNotice('Only a Super Admin can change another Super Admin’s group.')
      return
    }
    const role = roleForGroup(nextGroup)
    if (!role) return
    updateStore((current) => ({
      people: current.people.map((item) => (
        item.id === person.id
          ? {
            ...item,
            ldapGroup: nextGroup,
            role,
            note: nextGroup === SUPER_ADMIN_GROUP
              ? (item.note || 'IAM team · Super Admin')
              : item.note,
          }
          : item
      )),
      activity: [
        logEntry({
          kind: 'move',
          detail: `${personName(person)} moved ${previous || '—'} → ${nextGroup}${nextGroup === SUPER_ADMIN_GROUP ? ' (Super Admin)' : ''}`,
          before: previous,
          after: nextGroup,
        }),
        ...current.activity,
      ],
    }))
    setNotice(
      nextGroup === SUPER_ADMIN_GROUP
        ? `Moved ${personName(person)} to Super Admin.`
        : `Moved ${personName(person)} to ${nextGroup}.`,
    )
    setMoveTarget(null)
  }

  const offboardUser = (person, form) => {
    if (isSuperAdmin(person) && !actorIsSuperAdmin) {
      setNotice('Only a Super Admin can offboard another Super Admin.')
      setOffboardTarget(null)
      return
    }
    const lastDay = form.lastDay || todayInputValue()
    const directoryStillEnabled = person.directoryStatus === 'enabled'
    updateStore((current) => ({
      people: current.people.map((item) => (
        item.id === person.id
          ? {
            ...item,
            appStatus: 'offboarded',
            ldapGroup: '',
            offboardedAt: new Date().toISOString(),
            offboardReason: form.reason,
            offboardNote: form.note.trim(),
            lastDay,
            sessionRevoked: true,
            leaverIncomplete: directoryStillEnabled,
          }
          : item
      )),
      activity: [
        logEntry({
          kind: 'leaver',
          detail: `${personName(person)} · ${form.reason}${directoryStillEnabled ? ' · directory still enabled' : ''}`,
          before: person.ldapGroup,
          after: '',
        }),
        ...current.activity,
      ],
    }))
    setNotice(
      directoryStillEnabled
        ? `Removed app access for ${personName(person)}. Leaver is incomplete until the directory account is disabled in LDAP.`
        : `Completed leaver for ${personName(person)}. App role removed and SSO session marked revoked (local mock).`,
    )
    setOffboardTarget(null)
    setTab('offboarded')
  }

  const restoreUser = (person) => {
    if (person.directoryStatus !== 'enabled') {
      setNotice(`Cannot restore ${personName(person)}. Enable the directory account in LDAP first.`)
      return
    }
    const group = GROUPS.find((item) => item.role === person.role)?.value || 'EDI-Sales'
    updateStore((current) => ({
      people: current.people.map((item) => (
        item.id === person.id
          ? {
            ...item,
            appStatus: 'active',
            ldapGroup: group,
            role: roleForGroup(group),
            grantedAt: new Date().toISOString(),
            offboardedAt: '',
            offboardReason: '',
            offboardNote: '',
            lastDay: '',
            sessionRevoked: false,
            leaverIncomplete: false,
          }
          : item
      )),
      activity: [
        logEntry({
          kind: 'restore',
          detail: `${personName(person)} restored to ${group}`,
          before: '',
          after: group,
        }),
        ...current.activity,
      ],
    }))
    setNotice(`Restored ${personName(person)} with ${group}.`)
    setTab('access')
  }

  const resetDirectory = () => {
    setStore(createSeed())
    setQuery('')
    setGroupFilter('all')
    setFlagFilter('all')
    setResetAsk(false)
    setDetailId('')
    setNotice('Local LDAP/SSO sample reset.')
    setTab('access')
  }

  const tabTitle = {
    access: 'App access',
    offboarded: 'Offboarded',
    activity: 'Activity',
    mapping: 'Group mapping',
  }[tab] || 'App access'

  const headerNav = (
    <div className="edi-tabs header-tabs" role="tablist">
      {[
        ['access', 'Access'],
        ['offboarded', offboarded.length ? `Offboarded (${offboarded.length})` : 'Offboarded'],
        ['mapping', 'Groups'],
        ['activity', 'Activity'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          className={`secondary edi-tab${tab === value ? ' active' : ''}`}
          onClick={() => setTab(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <Shell
      brand
      subtitle={firstName
        ? `${actorIsSuperAdmin ? 'Super Admin' : 'IAM'} · ${firstName}`
        : (actorIsSuperAdmin ? 'Super Admin' : 'IAM')}
      profile={profile}
      onSignOut={onSignOut}
      nav={headerNav}
    >
      <main className="page edi-page">
        <div className="dash-top">
          <div>
            <h2 className="dash-title">{tabTitle}</h2>
            <p className="intro">
              Grant and remove this app’s LDAP groups. People must already exist in the directory. SSO proves who they are.
              {actorIsSuperAdmin ? ' You are Super Admin and can grant Super Admin to other IAM members.' : ''}
            </p>
          </div>
          <div className="actions iam-actions">
            {resetAsk ? (
              <>
                <button type="button" className="secondary" onClick={() => setResetAsk(false)}>Cancel reset</button>
                <button type="button" className="iam-danger" onClick={resetDirectory}>Reset sample data</button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => { setNotice(''); setResetAsk(true) }}>Reset sample data</button>
            )}
            {tab === 'access' && (
              <button type="button" onClick={() => { setNotice(''); setGrantOpen(true) }}>Grant access</button>
            )}
          </div>
        </div>

        <div className="banner local" role="status">
          Local LDAP and SSO mock for the IAM team. Super Admin is the IAM role. Only Super Admins can grant Super Admin to someone else. Changes here do not affect live directory or Microsoft sign-in.
        </div>
        {notice && <div className="banner ok" role="status">{notice}</div>}

        {(tab === 'access' || tab === 'offboarded') && (
          <>
            <div className="edi-stats">
              <div><b>{active.length}</b><span>With access</span></div>
              <div><b>{flagCounts.dormant + flagCounts['directory-disabled'] + flagCounts.exception}</b><span>Open flags</span></div>
              <div><b>{active.filter(isSuperAdmin).length}</b><span>Super Admin</span></div>
              <div><b>{eligible.length}</b><span>In LDAP, no app</span></div>
            </div>
            <section className="card">
              <div className="edi-filters iam-filters">
                <label className="field">
                  <span>Search</span>
                  <input value={query} placeholder="Name, email, network ID, or group" onChange={(event) => setQuery(event.target.value)} />
                </label>
                <label className="field">
                  <span>LDAP group</span>
                  <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                    <option value="all">All groups</option>
                    {GROUPS.map((item) => (
                      <option key={item.value} value={item.value}>{item.value}</option>
                    ))}
                  </select>
                </label>
                {tab === 'access' && (
                  <label className="field">
                    <span>Flag</span>
                    <select value={flagFilter} onChange={(event) => setFlagFilter(event.target.value)}>
                      <option value="all">All flags</option>
                      <option value="dormant">Dormant</option>
                      <option value="directory-disabled">Directory disabled</option>
                      <option value="exception">Group exception</option>
                    </select>
                  </label>
                )}
              </div>
              {filtered.length === 0 ? (
                <p className="intro">{pool.length === 0 ? 'No people in this list yet.' : 'No people match these filters.'}</p>
              ) : (
                <div className="iam-table-wrap">
                  <table className="edi-table iam-table">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>LDAP group</th>
                        <th>Role</th>
                        <th>Directory</th>
                        <th>Last SSO</th>
                        <th>{tab === 'offboarded' ? 'Offboarded' : 'Flags'}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((person) => {
                        const flags = personFlags(person)
                        const role = person.role || roleForGroup(person.ldapGroup)
                        return (
                          <tr key={person.id}>
                            <td>
                              <strong>{personName(person)}</strong>
                              <div className="intro">{person.email}</div>
                              <div className="intro">Network ID {person.networkId}</div>
                            </td>
                            <td>
                              {person.ldapGroup
                                ? <span className="edi-pill iam-group">{person.ldapGroup}</span>
                                : <span className="intro">—</span>}
                            </td>
                            <td>
                              {role
                                ? <span className={`edi-pill role-${role}`}>{roleLabel(role)}</span>
                                : <span className="intro">—</span>}
                            </td>
                            <td>
                              <span className={`edi-pill ${person.directoryStatus === 'enabled' ? 'status-active' : 'iam-flag-directory-disabled'}`}>
                                {person.directoryStatus === 'enabled' ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                            <td>{formatWhen(person.lastSsoSignIn)}</td>
                            <td>
                              {tab === 'offboarded' ? (
                                <>
                                  <div>{person.offboardReason || '—'}</div>
                                  {person.lastDay && <div className="intro">Last day {formatWhen(person.lastDay)}</div>}
                                  {person.leaverIncomplete && <span className="edi-pill iam-flag-exception">Leaver incomplete</span>}
                                  {person.sessionRevoked && <div className="intro">SSO session revoked</div>}
                                </>
                              ) : flags.length ? (
                                <div className="iam-flag-list">
                                  {flags.map((flag) => (
                                    <span key={flag} className={`edi-pill iam-flag-${flag}`}>{flagLabel(flag)}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="edi-pill status-active">Clear</span>
                              )}
                            </td>
                            <td>
                              <div className="iam-row-actions">
                                <button type="button" className="secondary status-edit" onClick={() => setDetailId(person.id)}>View</button>
                                {tab === 'offboarded' ? (
                                  <button
                                    type="button"
                                    className="secondary status-edit"
                                    disabled={person.directoryStatus !== 'enabled'}
                                    title={person.directoryStatus !== 'enabled' ? 'Enable directory account first' : undefined}
                                    onClick={() => restoreUser(person)}
                                  >
                                    Restore
                                  </button>
                                ) : (
                                  <>
                                    <button type="button" className="secondary status-edit" onClick={() => { setNotice(''); setMoveTarget(person) }}>Move</button>
                                    <button type="button" className="secondary status-edit" onClick={() => { setNotice(''); setOffboardTarget(person) }}>Offboard</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'mapping' && (
          <section className="card">
            <h2 className="dash-title">LDAP groups</h2>
            <p className="intro">App access is granted by LDAP group. Super Admin is the IAM team role and can only be granted by another Super Admin.</p>
            <div className="iam-table-wrap">
              <table className="edi-table iam-table">
                <thead>
                  <tr>
                    <th>LDAP group</th>
                    <th>Role</th>
                    <th>People with access</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((group) => (
                    <tr key={group.value}>
                      <td><span className="edi-pill iam-group">{group.value}</span></td>
                      <td><span className={`edi-pill role-${group.role}`}>{group.label}</span></td>
                      <td>{active.filter((person) => person.ldapGroup === group.value).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'activity' && (
          <section className="card">
            <h2 className="dash-title">Local activity</h2>
            <p className="intro">Grant, move, leaver, and restore actions in this browser.</p>
            {store.activity.length === 0 ? (
              <p className="intro">No activity yet.</p>
            ) : (
              <ol className="iam-log">
                {store.activity.map((entry) => (
                  <li key={entry.id}>
                    <span className={`edi-pill iam-kind iam-kind-${entry.kind}`}>{kindLabel(entry.kind)}</span>
                    <div>
                      <strong>{entry.detail}</strong>
                      <span className="intro">by {entry.actor || ACTOR}</span>
                      {(entry.before || entry.after) && (
                        <span className="intro">{entry.before || '—'} → {entry.after || '—'}</span>
                      )}
                      <time dateTime={entry.at}>{formatStamp(entry.at)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </main>

      {grantOpen && (
        <GrantSheet
          eligible={eligible}
          groups={availableGroups}
          actorIsSuperAdmin={actorIsSuperAdmin}
          onClose={() => setGrantOpen(false)}
          onSubmit={grantAccess}
        />
      )}
      {moveTarget && (
        <MoveSheet
          person={moveTarget}
          groups={availableGroups}
          actorIsSuperAdmin={actorIsSuperAdmin}
          onClose={() => setMoveTarget(null)}
          onSubmit={(group) => moveGroup(moveTarget, group)}
        />
      )}
      {offboardTarget && (
        <OffboardSheet
          person={offboardTarget}
          onClose={() => setOffboardTarget(null)}
          onSubmit={(form) => offboardUser(offboardTarget, form)}
        />
      )}
      {detail && (
        <DetailSheet person={detail} onClose={() => setDetailId('')} />
      )}
    </Shell>
  )
}

function kindLabel(kind) {
  if (kind === 'grant' || kind === 'onboard') return 'Granted'
  if (kind === 'move') return 'Moved'
  if (kind === 'leaver' || kind === 'offboard') return 'Leaver'
  if (kind === 'restore') return 'Restored'
  return kind || 'Updated'
}

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

function GrantSheet({ eligible, groups, actorIsSuperAdmin, onClose, onSubmit }) {
  const [personId, setPersonId] = useState(eligible[0]?.id || '')
  const [ldapGroup, setLdapGroup] = useState(groups[0]?.value || 'EDI-Sales')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEscape(onClose)

  const matches = eligible.filter((person) => {
    const haystack = `${person.firstName} ${person.lastName} ${person.email} ${person.networkId}`.toLowerCase()
    return !search.trim() || haystack.includes(search.trim().toLowerCase())
  })

  const selected = eligible.find((person) => person.id === personId) || matches[0] || null

  useEffect(() => {
    if (selected && selected.id !== personId) setPersonId(selected.id)
  }, [selected, personId])

  const submit = (event) => {
    event.preventDefault()
    if (!selected) {
      setError('No eligible directory people match this search.')
      return
    }
    const message = onSubmit({ personId: selected.id, ldapGroup, note })
    if (message) setError(message)
  }

  return createPortal(
    <div className="edi-detail invite-modal" role="dialog" aria-modal="true" aria-label="Grant access">
      <button type="button" className="edi-scrim" aria-label="Close" onClick={onClose} />
      <form className="edi-sheet invite-sheet" onSubmit={submit} noValidate>
        <div className="dash-top">
          <h2>Grant access</h2>
          <button type="button" className="secondary status-edit" onClick={onClose}>Close</button>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        <div className="invite-grid">
          <div className="invite-fields">
            <label className="field">
              <span>Search LDAP directory <b className="req">*</b></span>
              <input
                value={search}
                autoFocus
                placeholder="Name, email, or network ID"
                autoComplete="off"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Person <b className="req">*</b></span>
              {matches.length === 0 ? (
                <p className="intro">No enabled directory accounts without app access match that search. Someone must exist in LDAP first.</p>
              ) : (
                <select value={selected?.id || ''} onChange={(event) => setPersonId(event.target.value)}>
                  {matches.map((person) => (
                    <option key={person.id} value={person.id}>
                      {personName(person)} · {person.email} · {person.networkId}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {selected && (
              <p className="iam-offboard-who">
                <span className={`edi-pill ${selected.directoryStatus === 'enabled' ? 'status-active' : 'iam-flag-directory-disabled'}`}>
                  Directory {selected.directoryStatus}
                </span>
                <span className="intro">{selected.email}</span>
                <span className="intro">Network ID {selected.networkId}</span>
                <span className="intro">Last SSO {formatWhen(selected.lastSsoSignIn)}</span>
              </p>
            )}
            <label className="field">
              <span>LDAP group <b className="req">*</b></span>
              <select value={ldapGroup} onChange={(event) => setLdapGroup(event.target.value)}>
                {groups.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.label})
                  </option>
                ))}
              </select>
              {ldapGroup === SUPER_ADMIN_GROUP && (
                <span className="intro">Super Admin can manage IAM and grant Super Admin to others.</span>
              )}
              {!actorIsSuperAdmin && (
                <span className="intro">Super Admin is hidden here because only Super Admins can grant it.</span>
              )}
            </label>
            <label className="field">
              <span>Note</span>
              <textarea rows={3} value={note} placeholder="Optional IAM note" onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
          <aside className="invite-help">
            <h3>Joiner</h3>
            <p className="intro">IAM does not create directory accounts or passwords. Pick someone already in LDAP, then grant an app group.</p>
            <p className="intro">They sign in with SSO. Role follows the LDAP group. Super Admin is for IAM team members.</p>
          </aside>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!selected}>Grant access</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function MoveSheet({ person, groups: options, actorIsSuperAdmin, onClose, onSubmit }) {
  const initial = options.some((item) => item.value === person.ldapGroup)
    ? person.ldapGroup
    : (options[0]?.value || 'EDI-Sales')
  const [ldapGroup, setLdapGroup] = useState(initial)
  useEscape(onClose)

  const submit = (event) => {
    event.preventDefault()
    onSubmit(ldapGroup)
  }

  return createPortal(
    <div className="edi-detail invite-modal" role="dialog" aria-modal="true" aria-label="Move group">
      <button type="button" className="edi-scrim" aria-label="Close" onClick={onClose} />
      <form className="edi-sheet invite-sheet" onSubmit={submit} noValidate>
        <div className="dash-top">
          <h2>Move group</h2>
          <button type="button" className="secondary status-edit" onClick={onClose}>Close</button>
        </div>
        <div className="invite-grid">
          <div className="invite-fields">
            <p className="iam-offboard-who">
              <strong>{personName(person)}</strong>
              <span>{person.email}</span>
              <span>Network ID {person.networkId}</span>
              <span className="edi-pill iam-group">{person.ldapGroup || '—'}</span>
              <span className={`edi-pill role-${person.role || roleForGroup(person.ldapGroup)}`}>
                {roleLabel(person.role || roleForGroup(person.ldapGroup))}
              </span>
            </p>
            <label className="field">
              <span>New LDAP group <b className="req">*</b></span>
              <select value={ldapGroup} onChange={(event) => setLdapGroup(event.target.value)}>
                {options.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.label})
                  </option>
                ))}
              </select>
              {ldapGroup === SUPER_ADMIN_GROUP && (
                <span className="intro">This grants the Super Admin role for the IAM team.</span>
              )}
              {!actorIsSuperAdmin && (
                <span className="intro">Super Admin is hidden here because only Super Admins can grant it.</span>
              )}
            </label>
          </div>
          <aside className="invite-help">
            <h3>Mover</h3>
            <p className="intro">Change the LDAP group for someone who already has this app. Role follows the group.</p>
          </aside>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={ldapGroup === person.ldapGroup}>Save move</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function OffboardSheet({ person, onClose, onSubmit }) {
  const [reason, setReason] = useState(OFFBOARD_REASONS[0])
  const [lastDay, setLastDay] = useState(todayInputValue)
  const [note, setNote] = useState('')
  useEscape(onClose)

  const submit = (event) => {
    event.preventDefault()
    onSubmit({ reason, lastDay, note })
  }

  return createPortal(
    <div className="edi-detail invite-modal" role="dialog" aria-modal="true" aria-label="Offboard user">
      <button type="button" className="edi-scrim" aria-label="Close" onClick={onClose} />
      <form className="edi-sheet invite-sheet" onSubmit={submit} noValidate>
        <div className="dash-top">
          <h2>Leaver</h2>
          <button type="button" className="secondary status-edit" onClick={onClose}>Close</button>
        </div>
        <div className="invite-grid">
          <div className="invite-fields">
            <p className="iam-offboard-who">
              <strong>{personName(person)}</strong>
              <span>{person.email}</span>
              <span>Network ID {person.networkId}</span>
              <span className="edi-pill iam-group">{person.ldapGroup || '—'}</span>
            </p>
            <div className="iam-checklist">
              <div>
                <span>Directory account</span>
                <strong>{person.directoryStatus === 'enabled' ? 'Still enabled' : 'Disabled'}</strong>
              </div>
              <div>
                <span>App group</span>
                <strong>Will be removed</strong>
              </div>
              <div>
                <span>SSO session</span>
                <strong>Will be marked revoked</strong>
              </div>
            </div>
            {person.directoryStatus === 'enabled' && (
              <div className="banner err" role="status">
                Directory account is still enabled. Removing app access leaves the leaver incomplete until LDAP is disabled.
              </div>
            )}
            <label className="field">
              <span>Reason <b className="req">*</b></span>
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                {OFFBOARD_REASONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Last day</span>
              <input type="date" value={lastDay} onChange={(event) => setLastDay(event.target.value)} />
            </label>
            <label className="field">
              <span>Note</span>
              <textarea rows={3} value={note} placeholder="Optional handoff note" onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
          <aside className="invite-help">
            <h3>Leaver</h3>
            <p className="intro">Removes this app’s LDAP group and marks the SSO session revoked in the local mock.</p>
            <p className="intro">Restore is only allowed when the directory account is enabled again.</p>
          </aside>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="iam-danger">Remove access</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function DetailSheet({ person, onClose }) {
  useEscape(onClose)
  const flags = personFlags(person)

  return createPortal(
    <div className="edi-detail invite-modal" role="dialog" aria-modal="true" aria-label="Person detail">
      <button type="button" className="edi-scrim" aria-label="Close" onClick={onClose} />
      <div className="edi-sheet invite-sheet">
        <div className="dash-top">
          <h2>{personName(person)}</h2>
          <button type="button" className="secondary status-edit" onClick={onClose}>Close</button>
        </div>
        <dl className="iam-detail">
          <div><dt>Email</dt><dd>{person.email}</dd></div>
          <div><dt>Network ID</dt><dd>{person.networkId}</dd></div>
          <div><dt>Directory</dt><dd>{person.directoryStatus}</dd></div>
          <div><dt>Last SSO</dt><dd>{formatStamp(person.lastSsoSignIn)}</dd></div>
          <div><dt>LDAP group</dt><dd>{person.ldapGroup || '—'}</dd></div>
          <div><dt>Role</dt><dd>{roleLabel(person.role || roleForGroup(person.ldapGroup))}</dd></div>
          <div><dt>App status</dt><dd>{person.appStatus}</dd></div>
          <div><dt>Granted</dt><dd>{formatWhen(person.grantedAt)}</dd></div>
          {person.note && <div><dt>Note</dt><dd>{person.note}</dd></div>}
          {flags.length > 0 && (
            <div>
              <dt>Flags</dt>
              <dd className="iam-flag-list">
                {flags.map((flag) => (
                  <span key={flag} className={`edi-pill iam-flag-${flag}`}>{flagLabel(flag)}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>,
    document.body,
  )
}
