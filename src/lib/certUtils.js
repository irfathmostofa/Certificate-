import { blankDesign, TEMPLATE_PRESETS } from './templates.js'

export const SAMPLE_CERT = {
  recipientName: 'Amelia Richardson',
  courseTitle: 'Advanced Data Analytics',
  description:
    'Awarded in recognition of the successful completion of all program requirements and assessments.',
  issueDate: new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }),
  certificateId: 'CERT-2026-0A1B2C',
  eyebrow: 'Certificate of Achievement'
}

export function resolveDesign(cert, templates, settings) {
  if (cert?.design) return cert.design
  const list = templates?.length ? templates : TEMPLATE_PRESETS
  const tpl = list.find((t) => t.id === cert?.templateId)
  if (tpl?.design) return tpl.design
  return settings?.defaultDesign || blankDesign()
}

/* Certificates store a snapshot of the organization and signature at the
   time they were issued, so public viewers (who cannot read settings) still
   see the correct branding. Fall back to live settings when no snapshot. */
export function resolveOrganization(cert, settings) {
  return cert?.organization || settings?.organization || null
}

export function resolveSignature(cert, settings) {
  return cert?.signature || settings?.signature || null
}

/* The token that identifies a certificate on its public page. Newer records
   carry a dedicated publicToken; older ones fall back to the certificate id. */
export function publicTokenFor(cert) {
  return cert?.publicToken || cert?.certificateId || ''
}

export function buildPublicUrl(cert) {
  const token = publicTokenFor(cert)
  if (!token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/view/${encodeURIComponent(token)}`
}

export function certFileName(cert) {
  const recipient = cert?.recipientName || 'recipient'
  const course = cert?.courseTitle || 'course'
  return `${recipient} - ${course}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
