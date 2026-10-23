export const DEFAULT_EMAILJS = {
  enabled: false,
  publicKey: '',
  privateKey: '',
  serviceId: '',
  templateId: ''
}

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'

export function isEmailjsConfigured(config) {
  return Boolean(
    config?.enabled &&
      String(config.publicKey || '').trim() &&
      String(config.serviceId || '').trim() &&
      String(config.templateId || '').trim()
  )
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function buildCertificateEmailParams({ certificate, organization, publicUrl }) {
  const recipientName = certificate?.recipientName || ''
  const orgName = organization?.name || ''
  return {
    to_email: String(certificate?.recipientEmail || '').trim(),
    to_name: recipientName,
    recipient_name: recipientName,
    course_title: certificate?.courseTitle || '',
    certificate_id: certificate?.certificateId || '',
    issue_date: certificate?.issueDate || '',
    organization_name: orgName,
    organization_tagline: organization?.tagline || '',
    certificate_url: publicUrl || '',
    from_name: orgName
  }
}

export async function sendCertificateEmail({ config, certificate, organization, publicUrl }) {
  if (!isEmailjsConfigured(config)) {
    throw new Error('EmailJS is not configured. Add your keys in Organization settings.')
  }
  const params = buildCertificateEmailParams({ certificate, organization, publicUrl })
  if (!isValidEmail(params.to_email)) {
    throw new Error('A valid student email is required.')
  }

  const payload = {
    service_id: String(config.serviceId).trim(),
    template_id: String(config.templateId).trim(),
    user_id: String(config.publicKey).trim(),
    template_params: params
  }
  const privateKey = String(config.privateKey || '').trim()
  if (privateKey) payload.accessToken = privateKey

  const res = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const text = (await res.text()).trim()
  if (!res.ok) {
    throw new Error(text || `EmailJS request failed (${res.status}).`)
  }
  return params
}
