import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import DesignEditor from '../components/DesignEditor.jsx'
import SaveTemplateButton from '../components/SaveTemplateButton.jsx'
import TemplateSelect from '../components/TemplateSelect.jsx'
import { ShareLink } from '../components/ui.jsx'
import { makeCertificateId, todayLong } from '../lib/data.js'
import { certFileName, buildPublicUrl } from '../lib/certUtils.js'
import { exportPDF, exportPNG, exportJPEG } from '../lib/export.js'
import { IconDownload, IconCheck, IconSparkles, IconCopy } from '../components/icons.jsx'

const emptyForm = () => ({
  recipientName: '',
  courseTitle: '',
  description:
    'Awarded in recognition of the successful completion of all program requirements and assessments.',
  eyebrow: 'Certificate of Achievement',
  issueDate: todayLong(),
  certificateId: makeCertificateId()
})

export default function Generate() {
  const { templates, settings, addCertificates, findTemplate } = useData()
  const [params] = useSearchParams()
  const [templateId, setTemplateId] = useState(params.get('template') || templates[0]?.id)
  const [form, setForm] = useState(emptyForm)
  const [customize, setCustomize] = useState(false)
  const [customDesign, setCustomDesign] = useState(null)
  const [exporting, setExporting] = useState('')
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const exportRef = useRef(null)

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  const template = findTemplate(templateId) || templates[0]
  const design = customize && customDesign ? customDesign : template?.design

  const previewCert = useMemo(() => ({ ...form }), [form])
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const startCustomize = () => {
    if (!customDesign) setCustomDesign(structuredClone(design))
    setCustomize(true)
  }

  const validate = () => {
    if (!form.recipientName.trim()) return 'Recipient name is required.'
    if (!form.courseTitle.trim()) return 'Course / title is required.'
    return ''
  }

  const doExport = async (type) => {
    const err = validate()
    if (err) {
      setMsg({ type: 'error', text: err })
      return
    }
    setMsg(null)
    setExporting(type)
    try {
      const file = certFileName(form)
      if (type === 'pdf') await exportPDF(exportRef.current, file)
      else if (type === 'png') await exportPNG(exportRef.current, file)
      else await exportJPEG(exportRef.current, file)
      setMsg({ type: 'success', text: `${type.toUpperCase()} exported successfully.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Export failed.' })
    } finally {
      setExporting('')
    }
  }

  const saveRecord = async () => {
    const err = validate()
    if (err) {
      setMsg({ type: 'error', text: err })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const [created] = await addCertificates([
        {
          ...form,
          templateId,
          design
        }
      ])
      setLastSaved(created)
      setMsg({ type: 'success', text: 'Certificate saved. A public share link is ready below.' })
      setForm(emptyForm())
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not save certificate.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="editor-layout">
      <div className="grid" style={{ gap: 20 }}>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Design template</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen((v) => !v)}>
              {pickerOpen ? 'Hide gallery' : 'Change template'}
            </button>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <TemplateSelect
              templates={templates}
              value={templateId}
              onChange={setTemplateId}
              style={{ maxWidth: 320 }}
            />
            <span className="badge gold">{template?.border}</span>
            <span className="badge">{template?.category}</span>
            <Link className="btn btn-ghost btn-sm" to="/templates" style={{ marginLeft: 'auto' }}>
              Manage templates
            </Link>
          </div>

          {pickerOpen && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 14,
                marginTop: 16
              }}
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTemplateId(t.id)
                    setCustomize(false)
                    setCustomDesign(null)
                  }}
                  style={{
                    border:
                      t.id === templateId
                        ? '2px solid var(--gold)'
                        : '1px solid var(--line)',
                    borderRadius: 10,
                    padding: 6,
                    background: '#eef1f7',
                    cursor: 'pointer'
                  }}
                >
                  <CertificatePreview maxWidth={220}>
                    <Certificate
                      certificate={{ ...form, recipientName: form.recipientName || 'Recipient Name' }}
                      design={t.design}
                      organization={settings?.organization}
                      signature={settings?.signature}
                    />
                  </CertificatePreview>
                  <div className="small" style={{ fontWeight: 600, marginTop: 6, textAlign: 'center' }}>
                    {t.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Recipient details</h3>
          <div className="field">
            <label>Recipient name *</label>
            <input
              className="input"
              value={form.recipientName}
              onChange={(e) => set('recipientName', e.target.value)}
              placeholder="e.g. Amelia Richardson"
            />
          </div>
          <div className="field">
            <label>Course / award title *</label>
            <input
              className="input"
              value={form.courseTitle}
              onChange={(e) => set('courseTitle', e.target.value)}
              placeholder="e.g. Advanced Data Analytics"
            />
          </div>
          <div className="field">
            <label>Certificate heading</label>
            <input
              className="input"
              value={form.eyebrow}
              onChange={(e) => set('eyebrow', e.target.value)}
              placeholder="Certificate of Achievement"
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Date of issue</label>
              <input
                className="input"
                value={form.issueDate}
                onChange={(e) => set('issueDate', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Certificate ID</label>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  value={form.certificateId}
                  onChange={(e) => set('certificateId', e.target.value)}
                />
                <button
                  className="icon-btn"
                  title="Regenerate ID"
                  onClick={() => set('certificateId', makeCertificateId())}
                >
                  <IconSparkles />
                </button>
                <button
                  className="icon-btn"
                  title="Copy ID"
                  onClick={() => navigator.clipboard?.writeText(form.certificateId)}
                >
                  <IconCopy />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between">
            <div>
              <h3 style={{ margin: 0 }}>Customize this certificate</h3>
              <p className="muted small" style={{ margin: '3px 0 0' }}>
                Override colors, fonts, border and watermark without changing the template.
              </p>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <SaveTemplateButton
                design={design}
                defaultName={template ? `${template.name} (Custom)` : 'My Custom Template'}
                onSaved={(saved) => {
                  setTemplateId(saved.id)
                  setCustomize(false)
                  setCustomDesign(null)
                  setMsg({ type: 'success', text: `Saved as template "${saved.name}".` })
                }}
              />
              <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={customize}
                  onChange={(e) => (e.target.checked ? startCustomize() : setCustomize(false))}
                />
                <span className="small" style={{ fontWeight: 600 }}>
                  Enable
                </span>
              </label>
            </div>
          </div>
          {customize && (
            <div style={{ marginTop: 16 }}>
              <DesignEditor value={customDesign} onChange={setCustomDesign} />
            </div>
          )}
        </div>
      </div>

      <div className="preview-panel">
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Live preview</h3>
            <span className="badge green">A4 landscape</span>
          </div>
          <div className="preview-frame">
            <CertificatePreview>
              <Certificate
                certificate={previewCert}
                design={design}
                organization={settings?.organization}
                signature={settings?.signature}
              />
            </CertificatePreview>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Export & save</h3>
          <div className="grid" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-block" onClick={() => doExport('pdf')} disabled={!!exporting}>
              <IconDownload /> {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </button>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => doExport('png')} disabled={!!exporting}>
                {exporting === 'png' ? '…' : 'PNG'}
              </button>
              <button className="btn btn-ghost" onClick={() => doExport('jpg')} disabled={!!exporting}>
                {exporting === 'jpg' ? '…' : 'JPEG'}
              </button>
            </div>
            <button className="btn btn-gold btn-block" onClick={saveRecord} disabled={saving}>
              <IconCheck /> {saving ? 'Saving…' : 'Generate & save to library'}
            </button>
          </div>

          {lastSaved && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <ShareLink url={buildPublicUrl(lastSaved)} label="Shareable public link" />
              <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                Anyone with this link can view and verify the certificate — no login required.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Off-screen full-size surface used for high-resolution export */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}
      >
        <Certificate
          ref={exportRef}
          certificate={previewCert}
          design={design}
          organization={settings?.organization}
          signature={settings?.signature}
        />
      </div>
    </div>
  )
}
