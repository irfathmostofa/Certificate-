import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { mode } from '../lib/data.js'
import {
  IconDashboard,
  IconTemplate,
  IconSparkles,
  IconUpload,
  IconCertificate,
  IconSettings,
  IconLogout,
  IconDots,
  IconClose
} from './icons.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/templates', label: 'Templates', icon: IconTemplate },
  { to: '/generate', label: 'Generate', icon: IconSparkles },
  { to: '/bulk', label: 'Bulk Generate', icon: IconUpload },
  { to: '/certificates', label: 'Certificates', icon: IconCertificate },
  { to: '/settings', label: 'Organization', icon: IconSettings }
]

const TITLES = {
  '/': ['Dashboard', 'Overview of your certificate activity'],
  '/templates': ['Design Templates', 'Choose and customize professional certificate designs'],
  '/generate': ['Generate Certificate', 'Create a single certificate for one recipient'],
  '/bulk': ['Bulk Generation', 'Add recipients from manual entry, CSV, or Tutor LMS'],
  '/certificates': ['Certificates', 'Search, preview and export issued certificates'],
  '/settings': ['Organization', 'Brand, signature, student API and EmailJS']
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [title, subtitle] = TITLES[location.pathname] || ['Certify Studio', '']
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const name = user?.name || user?.email?.split('@')[0] || 'Admin'

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className="sidebar" id="app-sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <b>Certify Studio</b>
            <span>Certificate System</span>
          </div>
          <button
            className="icon-btn sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <IconClose />
          </button>
        </div>

        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="mode-pill" title={mode === 'supabase' ? 'Connected to Supabase' : 'Local demo mode'}>
            <span className={`dot ${mode === 'supabase' ? 'live' : ''}`} />
            {mode === 'supabase' ? 'Supabase connected' : 'Demo mode (local)'}
          </div>
          <button className="nav-item signout-btn" onClick={handleLogout}>
            <IconLogout />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
          >
            <IconDots />
          </button>
          <div className="topbar-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-user">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, textTransform: 'capitalize' }}>{name}</div>
              <div className="muted small">{user?.email || 'Administrator'}</div>
            </div>
            <div className="avatar">{name[0]?.toUpperCase()}</div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  )
}
