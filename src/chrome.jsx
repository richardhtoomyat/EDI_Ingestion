import logo from './assets/logo.png'

export const EDI_EMAIL = 'edirequest@dayandrossinc.ca'

export function SiteHeader({ title = 'EDI Customer Onboarding', onSignOut }) {
  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <img className="logo" src={logo} alt="Day & Ross" />
        <span className="site-title">{title}</span>
        {onSignOut && (
          <button type="button" className="secondary header-signout" onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <p>Questions? Contact <a href={`mailto:${EDI_EMAIL}`}>{EDI_EMAIL}</a></p>
      <p>© Day & Ross. All rights reserved.</p>
    </footer>
  )
}

export function Shell({ title, onSignOut, children }) {
  return (
    <div className="app-shell">
      <SiteHeader title={title} onSignOut={onSignOut} />
      <div className="app-shell-body">{children}</div>
      <SiteFooter />
    </div>
  )
}

export const Chevron = () => <span className="chev" aria-hidden="true">›</span>
