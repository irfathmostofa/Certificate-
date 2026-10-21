import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import DesignEditor from '../components/DesignEditor.jsx'
import SaveTemplateButton from '../components/SaveTemplateButton.jsx'
import { uploadAsset, sanitizeCertificatePrefix } from '../lib/data.js'
import { SAMPLE_CERT } from '../lib/certUtils.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { fetchTutorStudents, DEFAULT_ENDPOINT_PATH } from '../lib/tutorLms.js'
import { IconUpload, IconCheck, IconTrash, IconPlug, IconRefresh } from '../components/icons.jsx'

export default function Settings() {
  const { settings, persistSettings, loading } = useData()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [uploading, setUploading] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const value = draft || settings

  if (loading || !value) {
    return <div className="center-box"><div className="spinner" /></div>
  }

  const patchOrg = (k, v) => setDraft({ ...value, organization: { ...value.organization, [k]: v } })
  const patchSig = (k, v) => setDraft({ ...value, signature: { ...value.signature, [k]: v } })
  const patchDesign = (design) => setDraft({ ...value, defaultDesign: design })
  const patchField = (k, v) => setDraft({ ...value, [k]: v })
  const patchIntegration = (k, v) => {
    setTestResult(null)
    setDraft({ ...value, integration: { ...value.integration, [k]: v } })
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { students, total } = await fetchTutorStudents(value.integration)
      setTestResult({
        type: 'success',
        text: `Connected. Found ${students.length} student${students.length === 1 ? '' : 's'}${
          total !== students.length ? ` (of ${total} records)` : ''
        }.`
      })
    } catch (e) {
      setTestResult({ type: 'error', text: e.message || 'Connection failed.' })
    } finally {
      setTesting(false)
    }
  }

  const upload = async (file, kind, target) => {
    if (!file) return
    setUploading(kind)
    setMsg(null)
    try {
      const url = await uploadAsset(file, kind)
      if (target === 'logo') patchOrg('logo', url)
      else patchSig('image', url)
      setMsg({ type: 'success', text: `${kind} uploaded.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Upload failed.' })
    } finally {
      setUploading('')
    }
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await persistSettings({
        ...value,
        certificatePrefix: sanitizeCertificatePrefix(value.certificatePrefix)
      })
      setMsg({ type: 'success', text: 'Settings saved.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not save settings.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="editor-layout">
      <div className="grid" style={{ gap: 20 }}>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        {!isSupabaseConfigured && (
          <div className="alert info">
            Demo mode: data is stored in your browser. To use Supabase, copy{' '}
            <code>.env.example</code> to <code>.env</code>, add your project URL and anon key, then
            run the SQL in <code>supabase/schema.sql</code>.
          </div>
        )}

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Organization</h3>
          <div className="field">
            <label>Organization name</label>
            <input
              className="input"
              value={value.organization.name}
              onChange={(e) => patchOrg('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Tagline</label>
            <input
              className="input"
              value={value.organization.tagline}
              onChange={(e) => patchOrg('tagline', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Website</label>
            <input
              className="input"
              value={value.organization.website}
              onChange={(e) => patchOrg('website', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Logo</label>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                <IconUpload width={16} height={16} />
                {uploading === 'logo' ? 'Uploading…' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => upload(e.target.files?.[0], 'logo', 'logo')}
                />
              </label>
              {value.organization.logo && (
                <>
                  <img
                    src={value.organization.logo}
                    alt="logo"
                    style={{ height: 46, borderRadius: 8, background: '#f1f5f9', padding: 4 }}
                  />
                  <button className="icon-btn" title="Remove" onClick={() => patchOrg('logo', '')}>
                    <IconTrash />
                  </button>
                </>
              )}
              <span className="hint">PNG or SVG with transparent background works best.</span>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Certificate ID</h3>
          <div className="field">
            <label>ID prefix</label>
            <input
              className="input"
              value={value.certificatePrefix || ''}
              onChange={(e) => patchField('certificatePrefix', e.target.value)}
              placeholder="CERT"
              spellCheck={false}
              maxLength={12}
              style={{ textTransform: 'uppercase', maxWidth: 220 }}
            />
            <span className="hint">
              Used for new certificate IDs and public share tokens, e.g.{' '}
              <code>{sanitizeCertificatePrefix(value.certificatePrefix)}-{new Date().getFullYear()}-A1B2C3</code>.
              Letters and numbers only.
            </span>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Authorized signature</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Signatory name</label>
              <input
                className="input"
                value={value.signature.name}
                onChange={(e) => patchSig('name', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Signatory title</label>
              <input
                className="input"
                value={value.signature.title}
                onChange={(e) => patchSig('title', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Signature image</label>
            <div className="signature-preview">
              {value.signature.image ? (
                <img src={value.signature.image} alt="signature" />
              ) : (
                <span className="hint">
                  No image — a typed script signature of the name will be used.
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 12, marginTop: 10 }}>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                <IconUpload width={16} height={16} />
                {uploading === 'signature' ? 'Uploading…' : 'Upload signature'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => upload(e.target.files?.[0], 'signature', 'signature')}
                />
              </label>
              {value.signature.image && (
                <button className="btn btn-danger btn-sm" onClick={() => patchSig('image', '')}>
                  <IconTrash /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Student API (WordPress · Tutor LMS)</h3>
            <span className={`badge ${value.integration.enabled ? 'green' : 'gray'}`}>
              {value.integration.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Enter your WordPress domain and administrator credentials. Students are read from{' '}
            <code>/wp-json/{value.integration.studentsPath || DEFAULT_ENDPOINT_PATH}</code>.
          </p>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={value.integration.enabled}
              onChange={(e) => patchIntegration('enabled', e.target.checked)}
            />
            <span>
              <b>Enable student import</b>
              <span className="hint">Show the Students page and allow pulling from the API.</span>
            </span>
          </label>

          <div className="field" style={{ marginTop: 4 }}>
            <label>WordPress domain</label>
            <input
              className="input"
              value={value.integration.baseUrl}
              onChange={(e) => patchIntegration('baseUrl', e.target.value)}
              placeholder="https://teklabd.com"
              spellCheck={false}
            />
            <span className="hint">
              Just the site address — the endpoint path is added automatically.
            </span>
          </div>

          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>WordPress administrator username</label>
              <input
                className="input"
                value={value.integration.username}
                onChange={(e) => patchIntegration('username', e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label>Application password</label>
              <input
                className="input"
                type="password"
                value={value.integration.appPassword}
                onChange={(e) => patchIntegration('appPassword', e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="hint" style={{ marginTop: -4 }}>
            Create one in WordPress under <b>Users → Profile → Application Passwords</b>. Sent as
            HTTP Basic auth over HTTPS.
          </p>

          <details className="advanced">
            <summary>Advanced options</summary>
            <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div className="field">
                <label>Endpoint path</label>
                <input
                  className="input"
                  value={value.integration.studentsPath}
                  onChange={(e) => patchIntegration('studentsPath', e.target.value)}
                  placeholder={DEFAULT_ENDPOINT_PATH}
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label>Records per page</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={value.integration.perPage}
                  onChange={(e) => patchIntegration('perPage', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Course ID filter (optional)</label>
                <input
                  className="input"
                  value={value.integration.courseId}
                  onChange={(e) => patchIntegration('courseId', e.target.value)}
                  placeholder="e.g. 128"
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label>Auth method</label>
                <select
                  className="select"
                  value={value.integration.authType}
                  onChange={(e) => patchIntegration('authType', e.target.value)}
                >
                  <option value="basic">Application password (Basic auth)</option>
                  <option value="bearer">Bearer token</option>
                  <option value="header">Custom header</option>
                  <option value="none">None (public endpoint)</option>
                </select>
              </div>
            </div>

            {value.integration.authType === 'bearer' && (
              <div className="field">
                <label>Access token</label>
                <input
                  className="input"
                  type="password"
                  value={value.integration.token}
                  onChange={(e) => patchIntegration('token', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            {value.integration.authType === 'header' && (
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Header name</label>
                  <input
                    className="input"
                    value={value.integration.headerName}
                    onChange={(e) => patchIntegration('headerName', e.target.value)}
                    placeholder="X-API-Key"
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label>Header value</label>
                  <input
                    className="input"
                    type="password"
                    value={value.integration.headerValue}
                    onChange={(e) => patchIntegration('headerValue', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            <div className="field" style={{ marginBottom: 0 }}>
              <label>JSON path to the student list (optional)</label>
              <input
                className="input"
                value={value.integration.jsonPath}
                onChange={(e) => patchIntegration('jsonPath', e.target.value)}
                placeholder="data.students"
                spellCheck={false}
              />
              <span className="hint">Leave blank to auto-detect (defaults to the “data” array).</span>
            </div>
          </details>

          {testResult && (
            <div className={`alert ${testResult.type}`} style={{ marginTop: 14, marginBottom: 0 }}>
              {testResult.text}
            </div>
          )}

          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>
              <IconRefresh /> {testing ? 'Testing…' : 'Test connection'}
            </button>
            <span className="hint">
              <IconPlug width={14} height={14} style={{ verticalAlign: -2 }} /> Tests the values
              currently in the form. Save to keep them.
            </span>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Default design</h3>
              <p className="muted small" style={{ margin: '3px 0 0' }}>
                Used when a certificate is generated with a template that has no custom design.
              </p>
            </div>
            <SaveTemplateButton
              design={value.defaultDesign}
              defaultName={`${value.organization.name || 'Organization'} Template`}
              label="Save as template"
              onSaved={(saved) =>
                setMsg({ type: 'success', text: `Saved as template "${saved.name}".` })
              }
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <DesignEditor value={value.defaultDesign} onChange={patchDesign} />
          </div>
        </div>
      </div>

      <div className="preview-panel">
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Brand preview</h3>
          </div>
          <div className="preview-frame">
            <CertificatePreview>
              <Certificate
                certificate={{
                  ...SAMPLE_CERT,
                  certificateId: `${sanitizeCertificatePrefix(value.certificatePrefix)}-2026-0A1B2C`
                }}
                design={value.defaultDesign}
                organization={value.organization}
                signature={value.signature}
              />
            </CertificatePreview>
          </div>
        </div>
        <div className="card card-pad">
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving || !draft}>
            <IconCheck /> {saving ? 'Saving…' : 'Save changes'}
          </button>
          {!draft && <div className="hint" style={{ textAlign: 'center', marginTop: 10 }}>No unsaved changes.</div>}
        </div>
      </div>
    </div>
  )
}
