import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import Layout from './components/Layout.jsx'
import { CenterLoader } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Templates from './pages/Templates.jsx'
import Generate from './pages/Generate.jsx'
import BulkGenerate from './pages/BulkGenerate.jsx'
import Certificates from './pages/Certificates.jsx'
import Settings from './pages/Settings.jsx'
import PublicCertificate from './pages/PublicCertificate.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CenterLoader />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function Shell({ children }) {
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/view/:token" element={<PublicCertificate />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Shell>
                  <Dashboard />
                </Shell>
              </RequireAuth>
            }
          />
          <Route
            path="/templates"
            element={
              <RequireAuth>
                <Shell>
                  <Templates />
                </Shell>
              </RequireAuth>
            }
          />
          <Route
            path="/generate"
            element={
              <RequireAuth>
                <Shell>
                  <Generate />
                </Shell>
              </RequireAuth>
            }
          />
          <Route
            path="/bulk"
            element={
              <RequireAuth>
                <Shell>
                  <BulkGenerate />
                </Shell>
              </RequireAuth>
            }
          />
          <Route
            path="/certificates"
            element={
              <RequireAuth>
                <Shell>
                  <Certificates />
                </Shell>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Shell>
                  <Settings />
                </Shell>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </AuthProvider>
  )
}
