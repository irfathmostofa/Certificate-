import { forwardRef } from 'react'
import { BorderLayer, WatermarkLayer, Strip } from './decorations.jsx'
import BadgeSeal from './BadgeSeal.jsx'
import { FONTS, resolveSizes } from '../../lib/templates.js'
import { initials } from '../../lib/certUtils.js'
import './certificate.css'

const Certificate = forwardRef(function Certificate(
  { certificate, organization = {}, signature = {}, design },
  ref
) {
  const c = certificate || {}
  const d = design
  const colors = d.colors
  const layout = d.layout || 'center'
  const sizes = resolveSizes(d)

  const name = c.recipientName || 'Recipient Name'
  const nameSize =
    name.length > 34
      ? Math.round(sizes.name * 0.6)
      : name.length > 24
        ? Math.round(sizes.name * 0.76)
        : sizes.name

  const vars = {
    '--bg': colors.background,
    '--text': colors.text,
    '--primary': colors.primary,
    '--secondary': colors.secondary,
    '--accent': colors.accent,
    '--accent-solid': colors.accent,
    '--font-heading': FONTS[d.fonts.heading] || FONTS.cinzel,
    '--font-name': FONTS[d.fonts.name] || FONTS.greatvibes,
    '--font-body': FONTS[d.fonts.body] || FONTS.cormorant,
    '--size-org': `${sizes.org}px`,
    '--size-eyebrow': `${sizes.eyebrow}px`,
    '--size-name': `${nameSize}px`,
    '--size-lead': `${sizes.lead}px`,
    '--size-course': `${sizes.course}px`,
    '--size-desc': `${sizes.desc}px`,
    '--size-signature': `${sizes.signature}px`,
    '--size-signer-name': `${sizes.signerName}px`,
    '--size-signer-title': `${sizes.signerTitle}px`,
    '--size-meta': `${sizes.meta}px`
  }

  const orgName = organization.name || 'Certify Academy'
  const orgTagline = organization.tagline || 'Excellence in Learning'

  const Header = ({ light = false }) => (
    <div className="cert-header">
      <div className="cert-org-row">
        {organization.logo ? (
          <img className="cert-logo" src={organization.logo} alt="logo" crossOrigin="anonymous" />
        ) : (
          <div className="cert-logo-mark" style={light ? { color: colors.primary } : undefined}>
            {initials(orgName)}
          </div>
        )}
        <div style={{ textAlign: light ? 'left' : 'center' }}>
          <div className="cert-org-name">{orgName}</div>
          <div className="cert-org-tagline">{orgTagline}</div>
        </div>
      </div>
      {!light && <div className="cert-rule" />}
    </div>
  )

  const Footer = () => (
    <div className="cert-footer">
      <div className="cert-sig">
        {signature.image ? (
          <img className="cert-sig-img" src={signature.image} alt="signature" crossOrigin="anonymous" />
        ) : (
          <div className="cert-typed-sig">{signature.name || orgName}</div>
        )}
        <div className="cert-line" />
        <div className="cert-sig-name">{signature.name || 'Authorized Signatory'}</div>
        <div className="cert-sig-title">{signature.title || 'Director'}</div>
      </div>

      {d.showSeal !== false && (
        <div className="cert-badge">
          <BadgeSeal primary={colors.primary} accent={colors.accent} text="SEAL" size={sizes.seal} />
        </div>
      )}

      <div className="cert-meta">
        <div className="cert-meta-item">{c.issueDate || '—'}</div>
        <div className="cert-meta-label">Date of Issue</div>
        <div className="cert-meta-item" style={{ marginTop: 6 }}>
          {c.certificateId || '—'}
        </div>
        <div className="cert-meta-label">Certificate ID</div>
      </div>
    </div>
  )

  const Body = () => (
    <div className="cert-body">
      <p className="cert-eyebrow">{c.eyebrow || 'Certificate of Achievement'}</p>
      <h1 className="cert-recipient">{name}</h1>
      <p className="cert-lead">has successfully completed the program</p>
      <h2 className="cert-course">{c.courseTitle || 'Course Title'}</h2>
      {c.description && <p className="cert-desc">{c.description}</p>}
    </div>
  )

  const rootClass =
    'cert' +
    (layout === 'band' ? ' cert-band-layout' : '') +
    (layout === 'split' ? ' cert-split-layout' : '')

  return (
    <div ref={ref} className={rootClass} style={{ ...vars, background: colors.background }}>
      <BorderLayer design={d} />
      <WatermarkLayer design={d} organization={organization} />
      <Strip design={d} />

      {layout === 'band' && (
        <div className="cert-band">
          <Header light />
          <div className="cert-band-badge">Official Certificate</div>
        </div>
      )}

      {layout === 'split' && (
        <div className="cert-split">
          <Header light />
          <div className="cert-split-mark">
            {orgName}
            <br />
            EST. {new Date().getFullYear()}
          </div>
        </div>
      )}

      <div className="cert-content">
        {layout === 'center' && <Header />}
        <Body />
        <Footer />
      </div>
    </div>
  )
})

export default Certificate
