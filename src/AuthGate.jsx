import { useEffect, useState } from 'react'
import { Shell, Chevron } from './chrome.jsx'
import { AccountPage, AdministrationPage, isAdminProfile } from './AccountMenu.jsx'
import AgentApp from './AgentApp.jsx'
import CoordinatorPage from './CoordinatorPage.jsx'
import EdiDashboard from './EdiDashboard.jsx'

const WORKPLACE_KEY = 'edi-workplace'
const WORKPLACES = ['sale', 'edi', 'coordinator']
import {
  authConfigured,
  createAccount,
  getProfile,
  isDayrossEmail,
  namesFromUser,
  saveProfile,
  sessionEmail,
  signInWithMicrosoft,
  signInWithPassword,
  signOut,
  supabase,
  updateProfile,
} from './auth.js'

function readWorkplace() {
  const value = localStorage.getItem(WORKPLACE_KEY)
  return WORKPLACES.includes(value) ? value : ''
}

function screenForRole(role) {
  if (role === 'admin') return readWorkplace() || 'edi'
  if (role === 'sale') return 'sale'
  if (role === 'coordinator') return 'coordinator'
  return 'edi'
}

function TextField({ label, value, onChange, type = 'text', required, autoComplete }) {
  return (
    <label className="field">
      <span>{label}{required && <b className="req"> *</b>}</span>
      <input type={type} value={value} autoComplete={autoComplete || 'off'} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function SignInCard({ error, busy, onMicrosoft, onSignIn, onCreate }) {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (mode === 'create') {
      onCreate({ email, password, firstName, lastName })
      return
    }
    onSignIn({ email, password })
  }

  return (
    <Shell title="Sign in">
      <main className="page login-wrap">
        <div className="card login-card auth-card">
          <h2>Sign in</h2>
          <p className="intro">Use your Day & Ross Microsoft account, or create an account on this page.</p>
          {error && <div className="banner err" role="alert">{error}</div>}
          <button type="button" className="ms-btn" disabled={busy} onClick={onMicrosoft}>
            Sign in with Microsoft
          </button>
          <div className="auth-divider"><span>or</span></div>
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'signIn'} className={mode === 'signIn' ? 'active' : ''} onClick={() => setMode('signIn')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create account</button>
          </div>
          <form onSubmit={submit} noValidate>
            {mode === 'create' && (
              <>
                <TextField label="First name" value={firstName} onChange={setFirstName} required autoComplete="given-name" />
                <TextField label="Last name" value={lastName} onChange={setLastName} required autoComplete="family-name" />
              </>
            )}
            <TextField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
            <TextField label="Password" type="password" value={password} onChange={setPassword} required autoComplete={mode === 'create' ? 'new-password' : 'current-password'} />
            <div className="actions">
              <button type="submit" disabled={busy}>{mode === 'create' ? 'Create account' : 'Sign in'} <Chevron /></button>
            </div>
          </form>
        </div>
      </main>
    </Shell>
  )
}

function NameCard({ error, busy, firstName, lastName, onChange, onSubmit, onSignOut }) {
  return (
    <Shell title="Your name">
      <main className="page login-wrap">
        <form className="card login-card" onSubmit={onSubmit} noValidate>
          <h2>Confirm your name</h2>
          <p className="intro">We use this to greet you in the Sales or EDI portal.</p>
          {error && <div className="banner err" role="alert">{error}</div>}
          <TextField label="First name" value={firstName} onChange={(value) => onChange({ firstName: value })} required autoComplete="given-name" />
          <TextField label="Last name" value={lastName} onChange={(value) => onChange({ lastName: value })} required autoComplete="family-name" />
          <div className="actions">
            <button type="button" className="secondary" disabled={busy} onClick={onSignOut}>Sign out</button>
            <button type="submit" disabled={busy}>Continue <Chevron /></button>
          </div>
        </form>
      </main>
    </Shell>
  )
}

function RoleCard({ error, busy, firstName, onChoose, onSignOut }) {
  return (
    <Shell title="Choose portal">
      <main className="page login-wrap">
        <section className="card login-card">
          <h2>Welcome{firstName ? `, ${firstName}` : ''}</h2>
          <p className="intro">Choose which portal you use. This is saved for next time.</p>
          {error && <div className="banner err" role="alert">{error}</div>}
          <div className="role-actions">
            <button type="button" disabled={busy} onClick={() => onChoose('sale')}>Sales</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => onChoose('edi')}>EDI</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => onChoose('coordinator')}>EDI Coordinator</button>
          </div>
          <div className="actions">
            <button type="button" className="secondary" disabled={busy} onClick={onSignOut}>Sign out</button>
          </div>
        </section>
      </main>
    </Shell>
  )
}

export default function AuthGate() {
  const [screen, setScreen] = useState('loading')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [accountReturn, setAccountReturn] = useState(null)

  const rejectSession = async (message) => {
    await signOut().catch(() => {})
    setSession(null)
    setProfile(null)
    setError(message)
    setScreen('signedOut')
  }

  const resolveUser = async (nextSession) => {
    if (!nextSession?.user) {
      setSession(null)
      setProfile(null)
      setScreen('signedOut')
      return
    }

    const user = nextSession.user
    const email = sessionEmail(user)
    const provider = user.app_metadata?.provider || user.identities?.[0]?.provider
    if (provider === 'azure' && !isDayrossEmail(email)) {
      await rejectSession('Only @dayross.com Microsoft accounts can sign in here.')
      return
    }

    setSession(nextSession)
    try {
      const existing = await getProfile(user.id)
      if (existing) {
        setProfile(existing)
        setFirstName(existing.firstName)
        setLastName(existing.lastName)
        setError('')
        if (!existing.firstName.trim() || !existing.lastName.trim()) {
          setScreen('needName')
        } else {
          setScreen(screenForRole(existing.role))
        }
        return
      }
      const names = namesFromUser(user)
      const invitedRole = String(user.user_metadata?.role || '').trim()
      setFirstName((current) => current.trim() || names.firstName)
      setLastName((current) => current.trim() || names.lastName)
      setError('')
      if (['sale', 'edi', 'coordinator', 'admin'].includes(invitedRole)) {
        try {
          const first = names.firstName.trim()
          const last = names.lastName.trim()
          const saved = await saveProfile({
            userId: user.id,
            email,
            firstName: first || ' ',
            lastName: last || ' ',
            role: invitedRole,
          })
          const cleaned = {
            ...saved,
            firstName: first,
            lastName: last,
          }
          setProfile(cleaned)
          setFirstName(first)
          setLastName(last)
          setScreen(first && last ? screenForRole(invitedRole) : 'needName')
          return
        } catch {
          // Fall through to normal onboarding if profile create fails.
        }
      }
      setScreen((current) => {
        if (current === 'needName' || current === 'needRole') return current
        if (!names.firstName.trim() || !names.lastName.trim()) return 'needName'
        return 'needRole'
      })
    } catch (err) {
      setError(err.message || 'Could not load your profile.')
      setScreen((current) => (current === 'needName' || current === 'needRole' ? current : 'needRole'))
    }
  }

  useEffect(() => {
    if (!authConfigured()) {
      setError('Sign-in is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
      setScreen('signedOut')
      return undefined
    }
    let cancel = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancel) return
      resolveUser(data.session)
    }).catch((err) => {
      if (cancel) return
      setError(err.message || 'Could not restore the session.')
      setScreen('signedOut')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancel) return
      if (!nextSession) {
        setSession(null)
        setProfile(null)
        setScreen('signedOut')
        return
      }
      resolveUser(nextSession)
    })
    return () => {
      cancel = true
      subscription.unsubscribe()
    }
  }, [])

  const handleMicrosoft = async () => {
    setBusy(true)
    setError('')
    try {
      await signInWithMicrosoft()
    } catch (err) {
      setError(err.message || 'Microsoft sign-in failed.')
      setBusy(false)
    }
  }

  const handleSignIn = async ({ email, password }) => {
    setBusy(true)
    setError('')
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      setError(err.message || 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async ({ email, password, firstName: first, lastName: last }) => {
    if (!first.trim() || !last.trim()) {
      setError('Enter your first and last name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await createAccount({ email, password, firstName: first, lastName: last })
      setFirstName(first.trim())
      setLastName(last.trim())
      if (!data.session) {
        setError('Account created. Confirm email is still required in Supabase Auth, so turn that off for this prototype, then sign in.')
      }
    } catch (err) {
      setError(err.message || 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveRole = async (role) => {
    if (!session?.user) return
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.')
      setScreen('needName')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await saveProfile({
        userId: session.user.id,
        email: sessionEmail(session.user),
        firstName,
        lastName,
        role,
      })
      setProfile(saved)
      setScreen(screenForRole(role))
    } catch (err) {
      setError(err.message || 'Could not save your choice.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    setError('')
    try {
      await signOut()
      setSession(null)
      setProfile(null)
      setAccountReturn(null)
      setScreen('signedOut')
    } catch (err) {
      setError(err.message || 'Could not sign out.')
    } finally {
      setBusy(false)
    }
  }

  const openAccount = () => {
    setAccountReturn(screen)
    setScreen('account')
  }

  const openAdministration = () => {
    setAccountReturn(screen)
    setScreen('admin')
  }

  const switchWorkplace = (workplace) => {
    if (!WORKPLACES.includes(workplace)) return
    localStorage.setItem(WORKPLACE_KEY, workplace)
    setAccountReturn(null)
    setScreen(workplace)
  }

  const portalAccountProps = profile ? {
    profile,
    onSignOut: handleSignOut,
    onAccount: openAccount,
    onSwitchWorkplace: isAdminProfile(profile) ? switchWorkplace : undefined,
    onAdministration: isAdminProfile(profile) ? openAdministration : undefined,
    currentWorkplace: WORKPLACES.includes(screen) ? screen : readWorkplace(),
  } : {}

  if (screen === 'loading') {
    return <p className="page intro">Loading…</p>
  }

  if (screen === 'account' && profile) {
    return (
      <Shell
        title="Account"
        subtitle={profile.firstName ? `Welcome, ${profile.firstName}` : ''}
        {...portalAccountProps}
      >
        <AccountPage
          profile={profile}
          onSaved={(next) => {
            setProfile(next)
            setFirstName(next.firstName)
            setLastName(next.lastName)
          }}
          onBack={() => setScreen(accountReturn || screenForRole(profile.role))}
          onSignOut={handleSignOut}
        />
      </Shell>
    )
  }

  if (screen === 'admin' && profile && isAdminProfile(profile)) {
    return (
      <Shell
        title="Administration"
        subtitle={profile.firstName ? `Welcome, ${profile.firstName}` : ''}
        {...portalAccountProps}
      >
        <AdministrationPage onBack={() => setScreen(accountReturn || screenForRole(profile.role))} />
      </Shell>
    )
  }

  if (screen === 'sale' && profile) {
    return <AgentApp {...portalAccountProps} />
  }

  if (screen === 'coordinator' && profile) {
    return <CoordinatorPage {...portalAccountProps} />
  }

  if (screen === 'edi' && profile) {
    return <EdiDashboard {...portalAccountProps} />
  }

  if (screen === 'needName') {
    return (
      <NameCard
        error={error}
        busy={busy}
        firstName={firstName}
        lastName={lastName}
        onChange={({ firstName: first, lastName: last }) => {
          if (first !== undefined) setFirstName(first)
          if (last !== undefined) setLastName(last)
        }}
        onSubmit={async (event) => {
          event.preventDefault()
          if (!firstName.trim() || !lastName.trim()) {
            setError('Enter your first and last name.')
            return
          }
          setError('')
          if (profile?.id) {
            setBusy(true)
            try {
              const saved = await updateProfile({
                userId: profile.id,
                firstName,
                lastName,
              })
              setProfile(saved)
              setScreen(screenForRole(saved.role))
            } catch (err) {
              setError(err.message || 'Could not save your name.')
            } finally {
              setBusy(false)
            }
            return
          }
          setScreen('needRole')
        }}
        onSignOut={handleSignOut}
      />
    )
  }

  if (screen === 'needRole') {
    return (
      <RoleCard
        error={error}
        busy={busy}
        firstName={firstName}
        onChoose={handleSaveRole}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <SignInCard
      error={error}
      busy={busy}
      onMicrosoft={handleMicrosoft}
      onSignIn={handleSignIn}
      onCreate={handleCreate}
    />
  )
}
