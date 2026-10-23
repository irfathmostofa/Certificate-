import { supabase, isSupabaseConfigured, SIGNATURE_BUCKET } from './supabase.js'
import { local, uid } from './storage.js'
import { TEMPLATE_PRESETS, blankDesign, resolveCopy } from './templates.js'
import { DEFAULT_INTEGRATION } from './tutorLms.js'
import { DEFAULT_EMAILJS } from './emailjs.js'

const SETTINGS_KEY = 'settings'
const TEMPLATES_KEY = 'templates'
const CERTS_KEY = 'certificates'
const SEED_KEY = 'seeded'

export const DEFAULT_CERTIFICATE_PREFIX = 'CERT'

export const DEFAULT_SETTINGS = {
  organization: {
    name: 'Certify Academy',
    tagline: 'Excellence in Learning',
    website: 'https://example.com',
    logo: ''
  },
  signature: {
    name: 'Dr. Jane Sterling',
    title: 'Program Director',
    image: ''
  },
  certificatePrefix: DEFAULT_CERTIFICATE_PREFIX,
  defaultDesign: blankDesign(),
  integration: { ...DEFAULT_INTEGRATION },
  emailjs: { ...DEFAULT_EMAILJS }
}

export function sanitizeCertificatePrefix(value) {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
  return cleaned || DEFAULT_CERTIFICATE_PREFIX
}

export const mode = isSupabaseConfigured ? 'supabase' : 'demo'

/* Public verification tokens look like PREFIX-XXXX-XXXXXXXX and are the key
   used by the shareable public view link. They are long enough to be
   unguessable while remaining readable. */
export function makePublicToken(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = (n) =>
    Array.from(
      { length: n },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join('')
  return `${sanitizeCertificatePrefix(prefix)}-${block(4)}-${block(8)}`
}

/* ------------------------------------------------------------------ */
/* Demo-mode seeding                                                   */
/* ------------------------------------------------------------------ */

function seedDemo() {
  if (local.get(SEED_KEY)) return
  const samples = [
    {
      recipientName: 'Amelia Richardson',
      recipientEmail: 'amelia@example.com',
      courseTitle: 'Advanced Data Analytics',
      description: 'Awarded in recognition of the successful completion of all program requirements.',
      templateId: 'royal-gold'
    },
    {
      recipientName: 'Marcus Chen',
      recipientEmail: 'marcus@example.com',
      courseTitle: 'Full-Stack Web Development',
      description: 'Completed 120 hours of intensive training with distinction.',
      templateId: 'modern-graphite'
    },
    {
      recipientName: 'Sofia Alvarez',
      recipientEmail: 'sofia@example.com',
      courseTitle: 'Project Management Professional',
      description: 'Demonstrated mastery of agile delivery and stakeholder management.',
      templateId: 'emerald-classic'
    }
  ].map((s) => ({
    id: uid(),
    certificateId: makeCertificateId(DEFAULT_SETTINGS.certificatePrefix),
    publicToken: makePublicToken(DEFAULT_SETTINGS.certificatePrefix),
    issueDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    status: 'issued',
    design: TEMPLATE_PRESETS.find((t) => t.id === s.templateId)?.design || null,
    organization: DEFAULT_SETTINGS.organization,
    signature: DEFAULT_SETTINGS.signature,
    createdAt: new Date().toISOString(),
    ...s
  }))
  local.set(CERTS_KEY, samples)
  local.set(SEED_KEY, true)
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function getSettings() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return normalizeSettings(data?.data)
  }
  return normalizeSettings(local.get(SETTINGS_KEY))
}

/* Merge persisted settings over the defaults, keeping nested objects
   (organization, signature, integration) intact when new keys are added. */
function normalizeSettings(stored) {
  const saved = stored || {}
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    organization: { ...DEFAULT_SETTINGS.organization, ...(saved.organization || {}) },
    signature: { ...DEFAULT_SETTINGS.signature, ...(saved.signature || {}) },
    integration: { ...DEFAULT_INTEGRATION, ...(saved.integration || {}) },
    emailjs: { ...DEFAULT_EMAILJS, ...(saved.emailjs || {}) },
    certificatePrefix: sanitizeCertificatePrefix(
      saved.certificatePrefix ?? DEFAULT_SETTINGS.certificatePrefix
    )
  }
}

export async function saveSettings(settings) {
  const next = {
    ...settings,
    certificatePrefix: sanitizeCertificatePrefix(settings?.certificatePrefix)
  }
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 1, data: next }, { onConflict: 'id' })
    if (error) throw error
    return next
  }
  local.set(SETTINGS_KEY, next)
  return next
}

/* ------------------------------------------------------------------ */
/* Templates (custom, stored on top of built-in presets)               */
/* ------------------------------------------------------------------ */

export async function listCustomTemplates() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(rowToTemplate)
  }
  return local.get(TEMPLATES_KEY, [])
}

export async function saveCustomTemplate(template) {
  const record = {
    id: template.id || uid(),
    name: template.name,
    category: template.category || 'Custom',
    description: template.description || '',
    design: template.design,
    custom: true,
    created_at: new Date().toISOString()
  }
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('templates')
      .upsert(
        {
          id: record.id,
          name: record.name,
          category: record.category,
          description: record.description,
          design: record.design
        },
        { onConflict: 'id' }
      )
      .select()
      .single()
    if (error) throw error
    return rowToTemplate(data)
  }
  const all = local.get(TEMPLATES_KEY, [])
  const idx = all.findIndex((t) => t.id === record.id)
  if (idx >= 0) all[idx] = record
  else all.unshift(record)
  local.set(TEMPLATES_KEY, all)
  return record
}

export async function deleteCustomTemplate(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) throw error
    return
  }
  local.set(
    TEMPLATES_KEY,
    local.get(TEMPLATES_KEY, []).filter((t) => t.id !== id)
  )
}

function rowToTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    design: row.design,
    custom: true,
    createdAt: row.created_at
  }
}

export function allTemplates(customTemplates) {
  return [...TEMPLATE_PRESETS.map((t) => ({ ...t, custom: false })), ...customTemplates]
}

/* ------------------------------------------------------------------ */
/* Certificates                                                        */
/* ------------------------------------------------------------------ */

export async function listCertificates() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(rowToCert)
  }
  seedDemo()
  return local.get(CERTS_KEY, [])
}

export async function createCertificates(items) {
  const rows = items.map((it) => {
    const baseCopy = resolveCopy(it.design)
    const copy = {
      ...baseCopy,
      eyebrow: it.eyebrow || baseCopy.eyebrow,
      description: it.description || baseCopy.description
    }
    const design = it.design ? { ...it.design, copy } : { copy }
    return {
      id: uid(),
      certificate_id: it.certificateId,
      public_token: it.publicToken || makePublicToken(it.certificatePrefix),
      recipient_name: it.recipientName,
      recipient_email: it.recipientEmail || it.email || '',
      course_title: it.courseTitle,
      description: it.description || copy.description || '',
      template_id: it.templateId,
      design,
      organization: it.organization || null,
      signature: it.signature || null,
      issue_date: it.issueDate,
      status: 'issued',
      created_at: new Date().toISOString()
    }
  })

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('certificates').insert(rows).select()
    if (error) throw error
    return data.map(rowToCert)
  }
  const all = local.get(CERTS_KEY, [])
  const created = rows.map((r) => rowToCert(r))
  local.set(CERTS_KEY, [...created, ...all])
  return created
}

/* Fetch a single certificate for the public share page. Supabase uses a
   SECURITY DEFINER RPC so anonymous visitors can read exactly one record
   without exposing the table. */
export async function getPublicCertificate(token) {
  if (!token) return null
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('get_public_certificate', { p_token: token })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return row ? rowToCert(row) : null
  }
  seedDemo()
  const all = local.get(CERTS_KEY, [])
  const match = all.find((c) => c.publicToken === token || c.certificateId === token)
  return match || null
}

export async function deleteCertificate(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('certificates').delete().eq('id', id)
    if (error) throw error
    return
  }
  local.set(
    CERTS_KEY,
    local.get(CERTS_KEY, []).filter((c) => c.id !== id)
  )
}

function rowToCert(row) {
  return {
    id: row.id,
    certificateId: row.certificate_id,
    publicToken: row.public_token,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email || row.recipientEmail || '',
    courseTitle: row.course_title,
    description: row.description,
    templateId: row.template_id,
    design: row.design,
    organization: row.organization || null,
    signature: row.signature || null,
    issueDate: row.issue_date,
    status: row.status,
    createdAt: row.created_at
  }
}

/* ------------------------------------------------------------------ */
/* Asset upload (logo / signature)                                     */
/* ------------------------------------------------------------------ */

export async function uploadAsset(file, kind = 'assets') {
  if (isSupabaseConfigured) {
    const path = `${kind}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    if (error) throw error
    const { data } = supabase.storage.from(SIGNATURE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }
  return fileToDataURL(file)
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function makeCertificateId(prefix) {
  const y = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${sanitizeCertificatePrefix(prefix)}-${y}-${rand}`
}

export function previewCertificateId(prefix) {
  return `${sanitizeCertificatePrefix(prefix)}-PREVIEW`
}

export function todayLong() {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
