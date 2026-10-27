import logo from './assets/logo.png'

export const EDI_EMAIL = 'edirequest@dayandrossinc.ca'

export function SiteHeader({ title = 'EDI Customer Onboarding' }) {
  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <img className="logo" src={logo} alt="Day & Ross" />
        <span className="site-title">{title}</span>
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

export function Shell({ title, children }) {
  return (<><SiteHeader title={title} />{children}<SiteFooter /></>)
}

export const Chevron = () => <span className="chev" aria-hidden="true">›</span>
