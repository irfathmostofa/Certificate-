import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import TemplateSelect from '../components/TemplateSelect.jsx'
import { Modal, ShareLink } from '../components/ui.jsx'
import { buildPublicUrl } from '../lib/certUtils.js'
import { makeCertificateId, makePublicToken, previewCertificateId, todayLong } from '../lib/data.js'
import { resolveCopy } from '../lib/templates.js'
import { exportManyPDF } from '../lib/export.js'
import { uid } from '../lib/storage.js'
import {
  IconUpload,
  IconPlus,
  IconTrash,
  IconDownload,
  IconCheck,
  IconSparkles
} from '../components/icons.jsx'

function normalizeRow(raw) {
  const keys = {}
  Object.keys(raw).forEach((k) => {
    keys[k.toLowerCase().replace(/[^a-z]/g, '')] = raw[k]
  })
  const name =
    keys.name || keys.recipient || keys.recipientname || keys.fullname || keys.student || ''
  const course = keys.course || keys.coursetitle || keys.title || keys.program || ''
  const email = keys.email || keys.emailaddress || ''
  const date = keys.date || keys.issuedate || ''
  return {
    rowId: uid(),
    recipientName: String(name).trim(),
    courseTitle: String(course).trim(),
    email: String(email).trim(),
    issueDate: String(date).trim()
  }
}

const CSV_TEMPLATE = 'name,course,email\nJane Doe,Advanced Data Analytics,jane@example.com\nJohn Smith,Web Development,john@example.com\n'

export default function BulkGenerate() {
  const { templates, settings, addCertificates, findTemplate } = useData()
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const [rows, setRows] = useState([])
  const [common, setCommon] = useState({
    courseTitle: '',
    eyebrow: '',
    description: '',
    issueDate: todayLong()
  })
  const [newRow, setNewRow] = useState({ recipientName: '', courseTitle: '', email: '' })
  const [generated, setGenerated] = useState([])
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [msg, setMsg] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const nodeRefs = useRef({})

  const template = findTemplate(templateId) || templates[0]
  const templateCopy = resolveCopy(template?.design)
  const copySeededFor = useRef(null)

  useEffect(() => {
    if (!templateId) return
    if (copySeededFor.current === templateId) return
    copySeededFor.current = templateId
    setCommon((c) => ({
      ...c,
      eyebrow: templateCopy.eyebrow,
      description: templateCopy.description
    }))
  }, [templateId, templateCopy.eyebrow, templateCopy.description])

  const resolvedRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        courseTitle: r.courseTitle || common.courseTitle
      })),
    [rows, common.courseTitle]
  )

  const firstPreview = {
    recipientName: resolvedRows[0]?.recipientName || 'Recipient Name',
    courseTitle: resolvedRows[0]?.courseTitle || common.courseTitle || 'Course Title',
    eyebrow: common.eyebrow,
    description: common.description,
    issueDate: resolvedRows[0]?.issueDate || common.issueDate,
    certificateId: previewCertificateId(settings?.certificatePrefix),
    publicToken: previewCertificateId(settings?.certificatePrefix)
  }

  const addRow = () => {
    if (!newRow.recipientName.trim()) return
    setRows((r) => [...r, { ...newRow, rowId: uid() }])
    setNewRow({ recipientName: '', courseTitle: '', email: '' })
  }

  const removeRow = (id) => setRows((r) => r.filter((x) => x.rowId !== id))
  const clearAll = () => {
    setRows([])
    setGenerated([])
    setMsg(null)
  }

  const onFile = (file) => {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map(normalizeRow).filter((r) => r.recipientName)
        setRows((prev) => [...prev, ...parsed])
        setMsg({ type: 'success', text: `Imported ${parsed.length} recipients from file.` })
      },
      error: (e) => setMsg({ type: 'error', text: e.message || 'Could not parse file.' })
    })
  }

  const onDrop = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag')
    onFile(e.dataTransfer.files?.[0])
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'recipients-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const generate = async () => {
    if (!resolvedRows.length) {
      setMsg({ type: 'error', text: 'Add at least one recipient.' })
      return
    }
    setGenerating(true)
    setMsg(null)
    try {
      const items = resolvedRows.map((r) => ({
        recipientName: r.recipientName,
        courseTitle: r.courseTitle || 'Course Title',
        description: common.description,
        eyebrow: common.eyebrow,
        issueDate: r.issueDate || common.issueDate,
        certificateId: makeCertificateId(settings?.certificatePrefix),
        publicToken: makePublicToken(settings?.certificatePrefix),
        templateId,
        design: template?.design || null
      }))
      const created = await addCertificates(items)
      setGenerated(created)
      setMsg({ type: 'success', text: `${created.length} certificates generated and saved.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Generation failed.' })
    } finally {
      setGenerating(false)
    }
  }

  const nodesForGenerated = () =>
    generated.map((c) => nodeRefs.current[c.id]).filter(Boolean)

  const exportAll = async () => {
    setExporting(true)
    setProgress({ done: 0, total: generated.length })
    try {
      await exportManyPDF(
        nodesForGenerated(),
        `certificates-${Date.now()}`,
        (done, total) => setProgress({ done, total })
      )
      setMsg({ type: 'success', text: 'Combined PDF exported.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Export failed.' })
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const previewCertFor = (cert) => ({ ...cert, eyebrow: common.eyebrow, description: cert.description || common.description })

  return (
    <div className="editor-layout">
      <div className="grid" style={{ gap: 20 }}>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Batch settings</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Design template</label>
              <TemplateSelect templates={templates} value={templateId} onChange={setTemplateId} />
            </div>
            <div className="field">
              <label>Default course (used when a row has none)</label>
              <input
                className="input"
                value={common.courseTitle}
                onChange={(e) => setCommon({ ...common, courseTitle: e.target.value })}
                placeholder="e.g. Data Science Bootcamp"
              />
            </div>
          </div>
          <div className="field">
            <label>Certificate heading</label>
            <input
              className="input"
              value={common.eyebrow}
              onChange={(e) => setCommon({ ...common, eyebrow: e.target.value })}
              placeholder={templateCopy.eyebrow}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={common.description}
              onChange={(e) => setCommon({ ...common, description: e.target.value })}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default date of issue</label>
            <input
              className="input"
              value={common.issueDate}
              onChange={(e) => setCommon({ ...common, issueDate: e.target.value })}
            />
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Recipients</h3>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                <IconDownload /> CSV template
              </button>
              {rows.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={clearAll}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <label
            className="dropzone"
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('drag')
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <IconUpload width={26} height={26} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>Drop a CSV file or click to upload</div>
            <div className="hint">Columns: name, course (optional), email (optional)</div>
          </label>

          <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: '2 1 200px' }}
              placeholder="Recipient name"
              value={newRow.recipientName}
              onChange={(e) => setNewRow({ ...newRow, recipientName: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRow()}
            />
            <input
              className="input"
              style={{ flex: '2 1 180px' }}
              placeholder="Course (optional)"
              value={newRow.courseTitle}
              onChange={(e) => setNewRow({ ...newRow, courseTitle: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRow()}
            />
            <input
              className="input"
              style={{ flex: '2 1 180px' }}
              placeholder="Email (optional)"
              value={newRow.email}
              onChange={(e) => setNewRow({ ...newRow, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRow()}
            />
            <button className="btn btn-primary" onClick={addRow}>
              <IconPlus /> Add
            </button>
          </div>

          <div className="row-between" style={{ marginTop: 18 }}>
            <span className="badge">{rows.length} recipients</span>
          </div>

          {rows.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Email</th>
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.rowId}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.recipientName}</td>
                      <td className="muted">{r.courseTitle || common.courseTitle || '—'}</td>
                      <td className="muted">{r.email || '—'}</td>
                      <td>
                        <button className="icon-btn" onClick={() => removeRow(r.rowId)}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="preview-panel">
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Preview</h3>
            <span className="badge">{resolvedRows.length} ready</span>
          </div>
          <div className="preview-frame">
            <CertificatePreview>
              <Certificate
                certificate={firstPreview}
                design={template?.design}
                organization={settings?.organization}
                signature={settings?.signature}
              />
            </CertificatePreview>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Generate</h3>
          <button
            className="btn btn-primary btn-block"
            onClick={() => setConfirmOpen(true)}
            disabled={generating || !rows.length}
          >
            <IconSparkles /> {generating ? 'Generating…' : `Generate ${resolvedRows.length || ''} certificates`}
          </button>

          {generated.length > 0 && (
            <>
              <div className="alert success" style={{ marginTop: 16, marginBottom: 10 }}>
                {generated.length} certificates saved to your library.
              </div>
              <button className="btn btn-gold btn-block" onClick={exportAll} disabled={exporting}>
                <IconDownload />
                {exporting
                  ? `Exporting ${progress?.done || 0}/${progress?.total || 0}…`
                  : 'Download all as PDF'}
              </button>

              <div
                style={{
                  marginTop: 16,
                  borderTop: '1px solid var(--line)',
                  paddingTop: 14,
                  maxHeight: 260,
                  overflowY: 'auto'
                }}
              >
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                  Public links
                </label>
                <div className="grid" style={{ gap: 10, marginTop: 8 }}>
                  {generated.map((cert) => (
                    <div key={cert.id}>
                      <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                        {cert.recipientName}
                      </div>
                      <ShareLink url={buildPublicUrl(cert)} label="" compact />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden full-size certificates for export */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
        {generated.map((cert) => (
          <div
            key={cert.id}
            ref={(el) => {
              if (el) nodeRefs.current[cert.id] = el.firstChild
              else delete nodeRefs.current[cert.id]
            }}
          >
            <Certificate
              certificate={previewCertFor(cert)}
              design={template?.design}
              organization={settings?.organization}
              signature={settings?.signature}
            />
          </div>
        ))}
      </div>

      {confirmOpen && (
        <Modal
          title="Generate certificates"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirmOpen(false)
                  generate()
                }}
              >
                <IconCheck /> Generate
              </button>
            </>
          }
        >
          <p>
            You are about to generate <b>{resolvedRows.length}</b> certificates using the{' '}
            <b>{template?.name}</b> template. They will be saved to your certificate library.
          </p>
          <div className="hint">
            Unique certificate IDs are assigned automatically. You can export the batch as a single
            PDF afterwards.
          </div>
        </Modal>
      )}
    </div>
  )
}
