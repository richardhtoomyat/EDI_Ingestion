import logo from './assets/logo.png'
import { AccountMenu } from './AccountMenu.jsx'

export const EDI_EMAIL = 'edirequest@dayandrossinc.ca'

export function SiteHeader({
  title = 'EDI Customer Onboarding',
  subtitle,
  onSignOut,
  profile,
  onAccount,
  onSwitchWorkplace,
  onAdministration,
  currentWorkplace,
  nav,
}) {
  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <img className="logo" src={logo} alt="Day & Ross" />
        <div className="site-title-block">
          <span className="site-title">{title}</span>
          {subtitle && <span className="site-subtitle">{subtitle}</span>}
        </div>
        {nav && <div className="site-header-nav">{nav}</div>}
        {profile && onSignOut ? (
          <AccountMenu
            profile={profile}
            onSignOut={onSignOut}
            onAccount={onAccount}
            onSwitchWorkplace={onSwitchWorkplace}
            onAdministration={onAdministration}
            currentWorkplace={currentWorkplace}
          />
        ) : onSignOut ? (
          <button type="button" className="secondary header-signout" onClick={onSignOut}>
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  )
}

export function Shell({
  title,
  subtitle,
  onSignOut,
  profile,
  onAccount,
  onSwitchWorkplace,
  onAdministration,
  currentWorkplace,
  nav,
  children,
}) {
  return (
    <div className="app-shell">
      <SiteHeader
        title={title}
        subtitle={subtitle}
        onSignOut={onSignOut}
        profile={profile}
        onAccount={onAccount}
        onSwitchWorkplace={onSwitchWorkplace}
        onAdministration={onAdministration}
        currentWorkplace={currentWorkplace}
        nav={nav}
      />
      <div className="app-shell-body">{children}</div>
    </div>
  )
}

export const Chevron = () => <span className="chev" aria-hidden="true">›</span>
