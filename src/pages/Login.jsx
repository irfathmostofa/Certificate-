import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(isSupabaseConfigured ? '' : DEMO_CREDENTIALS.email)
  const [password, setPassword] = useState(isSupabaseConfigured ? '' : DEMO_CREDENTIALS.password)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">C</div>
            <div className="brand-text">
              <b style={{ color: '#fff' }}>Certify Studio</b>
              <span style={{ color: '#8ea0c9' }}>Certificate System</span>
            </div>
          </div>
          <h1>Design and issue beautiful certificates in minutes.</h1>
          <p>
            Choose from professional templates, add your logo and signature, then generate single
            or bulk certificates for entire cohorts.
          </p>
          <div style={{ marginTop: 26 }}>
            {[
              'Ornate borders, watermarks and wax-style seals',
              'Single & bulk generation from CSV or Tutor LMS',
              'Custom signature image and organization branding',
              'Export to high-resolution PDF, PNG or JPEG'
            ].map((t) => (
              <div className="auth-feature" key={t}>
                <span className="tick">✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <h2 style={{ fontSize: 24, margin: '0 0 4px' }}>Admin sign in</h2>
          <p className="muted small" style={{ marginTop: 0, marginBottom: 22 }}>
            {isSupabaseConfigured
              ? 'Sign in with your Supabase account.'
              : 'Demo mode is active. Use the pre-filled credentials to explore.'}
          </p>

          {error && <div className="alert error">{error}</div>}
          {!isSupabaseConfigured && (
            <div className="alert info">
              Demo credentials: <b>{DEMO_CREDENTIALS.email}</b> / <b>{DEMO_CREDENTIALS.password}</b>
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {!isSupabaseConfigured && (
            <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
              Connect Supabase by adding keys to <code>.env</code> to enable real authentication and
              storage.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
