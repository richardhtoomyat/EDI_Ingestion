import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './AuthGate.jsx'
import { InvalidLink, SalesFormPreview } from './AgentApp.jsx'
import { EdiDashboardPreview } from './EdiDashboard.jsx'
import { customerRoute, readCustomerDraft } from './onboardingLink.js'
import './styles.css'

;(() => {
  const stored = localStorage.getItem('edi-theme')
  const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
})()

function Root() {
  const route = customerRoute()
  const [screen, setScreen] = useState(
    route.kind === 'agent' || route.kind === 'salePreview' || route.kind === 'ediPreview' ? route.kind : 'loading',
  )
  const [draft, setDraft] = useState(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (route.kind === 'agent' || route.kind === 'salePreview' || route.kind === 'ediPreview') return
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

  if (screen === 'salePreview') return <SalesFormPreview />
  if (screen === 'ediPreview') return <EdiDashboardPreview />
  if (screen === 'agent') return <AuthGate />
  if (screen === 'invalid') return <InvalidLink />
  if (screen === 'loading') return <p className="page intro">Loading your onboarding…</p>
  return <App prefill={draft} token={token} />
}

createRoot(document.getElementById('root')).render(<Root />)
