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
  IconLogout
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
  '/bulk': ['Bulk Generation', 'Create certificates for many recipients at once'],
  '/certificates': ['Certificates', 'Search, preview and export issued certificates'],
  '/settings': ['Organization & Signature', 'Set your brand, logo and authorized signature']
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [title, subtitle] = TITLES[location.pathname] || ['Certify Studio', '']

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const name = user?.name || user?.email?.split('@')[0] || 'Admin'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <b>Certify Studio</b>
            <span>Certificate System</span>
          </div>
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
          <div>
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
