import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import DesignEditor from '../components/DesignEditor.jsx'
import { uploadAsset } from '../lib/data.js'
import { SAMPLE_CERT } from '../lib/certUtils.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { IconUpload, IconCheck, IconTrash } from '../components/icons.jsx'

export default function Settings() {
  const { settings, persistSettings, loading } = useData()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [uploading, setUploading] = useState('')

  const value = draft || settings

  if (loading || !value) {
    return <div className="center-box"><div className="spinner" /></div>
  }

  const patchOrg = (k, v) => setDraft({ ...value, organization: { ...value.organization, [k]: v } })
  const patchSig = (k, v) => setDraft({ ...value, signature: { ...value.signature, [k]: v } })
  const patchDesign = (design) => setDraft({ ...value, defaultDesign: design })

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
      await persistSettings(value)
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
          <h3 style={{ marginTop: 0 }}>Default design</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Used when a certificate is generated with a template that has no custom design.
          </p>
          <DesignEditor value={value.defaultDesign} onChange={patchDesign} />
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
                certificate={SAMPLE_CERT}
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
