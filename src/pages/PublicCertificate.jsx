import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import { CenterLoader } from '../components/ui.jsx'
import { getPublicCertificate } from '../lib/data.js'
import {
  resolveDesign,
  resolveOrganization,
  resolveSignature,
  certFileName,
  formatDate,
  initials
} from '../lib/certUtils.js'
import { exportPDF, exportPNG, exportJPEG } from '../lib/export.js'
import { IconCertificate, IconDownload, IconCheck } from '../components/icons.jsx'

export default function PublicCertificate() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [cert, setCert] = useState(null)
  const [exporting, setExporting] = useState('')
  const exportRef = useRef(null)

  useEffect(() => {
    let active = true
    setStatus('loading')
    setCert(null)
    getPublicCertificate(token)
      .then((found) => {
        if (!active) return
        setCert(found)
        setStatus(found ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!active) return
        setStatus('missing')
      })
    return () => {
      active = false
    }
  }, [token])

  const design = cert ? resolveDesign(cert, [], null) : null
  const organization = cert ? resolveOrganization(cert, null) : null
  const companyName = organization?.name || ''
  const companyMark = initials(companyName) || 'C'
  const companyHref = organization?.website || undefined

  const doExport = async (type) => {
    if (!cert || !exportRef.current) return
    setExporting(type)
    try {
      const file = certFileName(cert)
      if (type === 'pdf') await exportPDF(exportRef.current, file)
      else if (type === 'png') await exportPNG(exportRef.current, file)
      else await exportJPEG(exportRef.current, file)
    } catch {
      /* export failures are non-fatal for the viewer */
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="verify-wrap">
      <header className="verify-bar">
        <a
          className="brand"
          href={companyHref || undefined}
          target={companyHref ? '_blank' : undefined}
          rel={companyHref ? 'noreferrer' : undefined}
          style={{ textDecoration: 'none', cursor: companyHref ? 'pointer' : 'default' }}
        >
          {organization?.logo ? (
            <img className="brand-mark brand-mark-logo" src={organization.logo} alt="" />
          ) : (
            <div className="brand-mark">{companyMark}</div>
          )}
          <div className="brand-text">
            <b style={{ color: 'var(--brand)' }}>{companyName || 'Certificate Verification'}</b>
            <span>Certificate Verification</span>
          </div>
        </a>
        {cert && (
          <div className="verify-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => doExport('png')}
              disabled={!!exporting}
            >
              {exporting === 'png' ? '…' : 'PNG'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => doExport('jpg')}
              disabled={!!exporting}
            >
              {exporting === 'jpg' ? '…' : 'JPEG'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => doExport('pdf')}
              disabled={!!exporting}
            >
              <IconDownload width={16} height={16} />
              {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
        )}
      </header>

      <main className="verify-main">
        {status === 'loading' && <CenterLoader label="Verifying certificate…" />}

        {status === 'missing' && (
          <div className="card card-pad verify-empty">
            <IconCertificate width={44} height={44} />
            <h2>Certificate not found</h2>
            <p className="muted">
              This link is invalid, or the certificate has been removed. Please check the link and
              try again.
            </p>
            <Link className="btn btn-primary" to="/">
              Go to Certify Studio
            </Link>
          </div>
        )}

        {status === 'ready' && cert && (
          <>
            <div className="verify-status">
              <span className="verify-tick">
                <IconCheck width={16} height={16} />
              </span>
              <div>
                <b>Certificate verified</b>
                <div className="small muted">
                  Issued to {cert.recipientName} · {cert.courseTitle}
                </div>
              </div>
            </div>

            <div className="verify-frame">
              <CertificatePreview>
                <Certificate
                  certificate={cert}
                  design={design}
                  organization={organization}
                  signature={resolveSignature(cert, null)}
                />
              </CertificatePreview>
            </div>

            <div className="card verify-meta">
              <div className="verify-meta-item">
                <span className="k">Recipient</span>
                <span className="v">{cert.recipientName}</span>
              </div>
              <div className="verify-meta-item">
                <span className="k">Program</span>
                <span className="v">{cert.courseTitle}</span>
              </div>
              <div className="verify-meta-item">
                <span className="k">Date of issue</span>
                <span className="v">{formatDate(cert.issueDate)}</span>
              </div>
              <div className="verify-meta-item">
                <span className="k">Certificate ID</span>
                <span className="v">{cert.certificateId}</span>
              </div>
            </div>

            <p className="verify-credit">
              Developed By{' '}
              <a
                href="https://irfathchowdhuryjoy.web.app/"
                target="_blank"
                rel="noreferrer"
              >
                Md. Irfath Chowdhury
              </a>
            </p>
          </>
        )}
      </main>

      {/* Off-screen full-size surface used for high-resolution export */}
      {cert && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}
        >
          <Certificate
            ref={exportRef}
            certificate={cert}
            design={design}
            organization={organization}
            signature={resolveSignature(cert, null)}
          />
        </div>
      )}
    </div>
  )
}
