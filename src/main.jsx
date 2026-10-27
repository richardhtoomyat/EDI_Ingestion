import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './AuthGate.jsx'
import EdiDashboard from './EdiDashboard.jsx'
import { InvalidLink } from './AgentApp.jsx'
import { customerRoute, readCustomerDraft } from './onboardingLink.js'
import './styles.css'

function Root() {
  const route = customerRoute()
  const [screen, setScreen] = useState(route.kind === 'agent' || route.kind === 'edi' ? route.kind : 'loading')
  const [draft, setDraft] = useState(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (route.kind === 'agent' || route.kind === 'edi') return
    if (route.kind === 'invalid') {
      setScreen('invalid')
      return
    }
    if (route.kind === 'hash') {
      const hashed = readCustomerDraft()
      setDraft(hashed)
      setScreen(hashed ? 'form' : 'invalid')
      return
    }
    let cancel = false
    fetch(`/api/onboardings?token=${encodeURIComponent(route.token)}`)
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (cancel) return
        if (!ok || !payload.record?.draft) {
          setScreen('invalid')
          return
        }
        setDraft(payload.record.draft)
        setToken(route.token)
        setScreen('form')
      })
      .catch(() => { if (!cancel) setScreen('invalid') })
    return () => { cancel = true }
  }, [route.kind, route.token])

  if (screen === 'edi') return <EdiDashboard />
  if (screen === 'agent') return <AuthGate />
  if (screen === 'invalid') return <InvalidLink />
  if (screen === 'loading') return <p className="page intro">Loading your onboarding…</p>
  return <App prefill={draft} token={token} />
}

createRoot(document.getElementById('root')).render(<Root />)
