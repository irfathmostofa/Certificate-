import { forwardRef } from 'react'
import { BorderLayer, WatermarkLayer, Strip } from './decorations.jsx'
import BadgeSeal from './BadgeSeal.jsx'
import VerifyQr from './VerifyQr.jsx'
import { FONTS, resolveSizes, resolveCopy } from '../../lib/templates.js'
import { initials, verifyUrlFor } from '../../lib/certUtils.js'
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
  const copy = resolveCopy(d)

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
    '--size-logo': `${sizes.logo}px`,
    '--logo-gap': `${sizes.logoGap}px`,
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
  const showLogo = d.showLogo !== false
  const logoPosition = d.logoPosition === 'top' ? 'top' : 'left'

  const Header = ({ light = false }) => {
    const align = d.headerAlign || (light || layout !== 'center' ? 'left' : 'center')
    return (
      <div className={`cert-header cert-header-${align}`}>
        <div className={`cert-org-row cert-org-${logoPosition} cert-org-align-${align}`}>
          {showLogo &&
            (organization.logo ? (
              <img className="cert-logo" src={organization.logo} alt="logo" crossOrigin="anonymous" />
            ) : (
              <div className="cert-logo-mark" style={light ? { color: colors.primary } : undefined}>
                {initials(orgName)}
              </div>
            ))}
          <div className="cert-org-copy">
            <div className="cert-org-name">{orgName}</div>
            {orgTagline ? <div className="cert-org-tagline">{orgTagline}</div> : null}
          </div>
        </div>
        {!light && <div className="cert-rule" />}
      </div>
    )
  }

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
          {d.badgeStyle === 'qr' ? (
            <VerifyQr
              value={verifyUrlFor(c)}
              size={sizes.seal}
              primary={colors.primary}
              accent={colors.accent}
              label={copy.qrLabel}
            />
          ) : (
            <BadgeSeal
              primary={colors.primary}
              accent={colors.accent}
              top={copy.sealTop}
              text={copy.sealBottom}
              size={sizes.seal}
            />
          )}
        </div>
      )}

      <div className="cert-meta">
        <div className="cert-meta-item">{c.issueDate || '—'}</div>
        <div className="cert-meta-label">{copy.dateLabel}</div>
        <div className="cert-meta-item" style={{ marginTop: 6 }}>
          {c.certificateId || '—'}
        </div>
        <div className="cert-meta-label">{copy.idLabel}</div>
      </div>
    </div>
  )

  const Body = () => (
    <div className="cert-body">
      <p className="cert-eyebrow">{c.eyebrow || copy.eyebrow}</p>
      <h1 className="cert-recipient">{name}</h1>
      {copy.lead ? <p className="cert-lead">{copy.lead}</p> : null}
      <h2 className="cert-course">{c.courseTitle || 'Course Title'}</h2>
      {(c.description || copy.description) ? (
        <p className="cert-desc">{c.description || copy.description}</p>
      ) : null}
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
          {copy.bandBadge ? <div className="cert-band-badge">{copy.bandBadge}</div> : null}
        </div>
      )}

      {layout === 'split' && (
        <div className="cert-split">
          <Header light />
          <div className="cert-split-mark">
            {orgName}
            {copy.splitMark ? (
              <>
                <br />
                {copy.splitMark.replace('{year}', String(new Date().getFullYear()))}
              </>
            ) : null}
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
