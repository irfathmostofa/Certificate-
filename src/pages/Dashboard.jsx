import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import { CenterLoader, EmptyState } from '../components/ui.jsx'
import {
  resolveDesign,
  resolveOrganization,
  resolveSignature,
  formatDate
} from '../lib/certUtils.js'
import {
  IconCertificate,
  IconTemplate,
  IconSparkles,
  IconCheck,
  IconUpload
} from '../components/icons.jsx'

function Stat({ icon, label, value, tone = '' }) {
  return (
    <div className="card card-pad dash-stat">
      <div className="ico stat" style={{ background: tone }}>
        {icon}
      </div>
      <div className="stat">
        <span className="k">{label}</span>
        <span className="v">{value}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { certificates, templates, settings, loading } = useData()
  const { user } = useAuth()

  if (loading) return <CenterLoader label="Loading dashboard…" />

  const now = new Date()
  const thisMonth = certificates.filter((c) => {
    const d = new Date(c.createdAt || c.issueDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const recipients = new Set(certificates.map((c) => c.recipientName)).size

  const stats = [
    { icon: <IconCertificate />, label: 'Certificates issued', value: certificates.length, tone: '#eef2ff' },
    { icon: <IconCheck />, label: 'Issued this month', value: thisMonth, tone: '#dcfce7' },
    { icon: <IconTemplate />, label: 'Design templates', value: templates.length, tone: '#fdf5dd' },
    { icon: <IconSparkles />, label: 'Unique recipients', value: recipients, tone: '#e0f2fe' }
  ]

  return (
    <div className="dash">
      <div className="dash-stats">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div className="dash-body">
        <div className="card dash-recent">
          <div className="card-pad row-between dash-recent-head">
            <div>
              <h3 style={{ margin: 0 }}>Recent certificates</h3>
              <p className="muted small" style={{ margin: '3px 0 0' }}>
                Latest issued certificates
              </p>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/certificates">
              View all
            </Link>
          </div>

          {certificates.length === 0 ? (
            <EmptyState icon={<IconCertificate width={40} height={40} />} title="No certificates yet">
              Generate your first certificate to see it here.
            </EmptyState>
          ) : (
            <div className="dash-recent-list">
              {certificates.slice(0, 4).map((cert) => {
                const design = resolveDesign(cert, templates, settings)
                return (
                  <div key={cert.id} className="recent-item">
                    <div className="recent-thumb">
                      <CertificatePreview maxWidth={190}>
                        <Certificate
                          certificate={cert}
                          design={design}
                          organization={resolveOrganization(cert, settings)}
                          signature={resolveSignature(cert, settings)}
                        />
                      </CertificatePreview>
                    </div>
                    <div className="recent-info">
                      <div className="recent-name">{cert.recipientName}</div>
                      <div className="muted small">{cert.courseTitle}</div>
                      <div className="row small" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <span className="badge gold">
                          {templates.find((x) => x.id === cert.templateId)?.name || cert.templateId}
                        </span>
                        <span className="muted">{formatDate(cert.issueDate)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="dash-side">
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>Quick actions</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Welcome back, {user?.name || 'Admin'}.
            </p>
            <div className="grid" style={{ gap: 10, marginTop: 6 }}>
              <Link className="btn btn-primary btn-block" to="/generate">
                <IconSparkles /> Generate a certificate
              </Link>
              <Link className="btn btn-ghost btn-block" to="/bulk">
                <IconUpload /> Bulk generate
              </Link>
              <Link className="btn btn-ghost btn-block" to="/templates">
                <IconTemplate /> Browse templates
              </Link>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>How it works</h3>
            <ol className="muted small dash-steps">
              <li>Set your organization & signature in Organization.</li>
              <li>Pick a design template or customize your own.</li>
              <li>Fill recipient details and generate.</li>
              <li>Export to PDF, PNG or JPEG in high resolution.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
