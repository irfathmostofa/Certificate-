import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Papa from 'papaparse'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import TemplateSelect from '../components/TemplateSelect.jsx'
import { EmptyState, Modal, ShareLink } from '../components/ui.jsx'
import { fetchTutorStudents, isCompleted } from '../lib/tutorLms.js'
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
  IconSparkles,
  IconRefresh,
  IconUsers,
  IconSearch,
  IconPlug
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

const CSV_TEMPLATE =
  'name,course,email\nJane Doe,Advanced Data Analytics,jane@example.com\nJohn Smith,Web Development,john@example.com\n'

const TABS = [
  { id: 'manual', label: 'Manual' },
  { id: 'csv', label: 'CSV upload' },
  { id: 'tutor', label: 'Fetch Tutor LMS students' }
]

function tabFromParams(params) {
  const value = (params.get('tab') || params.get('source') || '').toLowerCase()
  if (value === 'csv' || value === 'upload') return 'csv'
  if (value === 'tutor' || value === 'students' || value === 'lms') return 'tutor'
  return 'manual'
}

export default function BulkGenerate() {
  const { templates, settings, addCertificates, findTemplate } = useData()
  const [params] = useSearchParams()
  const integration = settings?.integration
  const configured = Boolean(integration?.enabled && integration?.baseUrl)

  const [tab, setTab] = useState(() => tabFromParams(params))
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')

  const [manualRows, setManualRows] = useState([])
  const [newRow, setNewRow] = useState({ recipientName: '', courseTitle: '', email: '' })

  const [csvRows, setCsvRows] = useState([])

  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [onlyCompleted, setOnlyCompleted] = useState(false)

  const [generated, setGenerated] = useState([])
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [msg, setMsg] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const nodeRefs = useRef({})

  useEffect(() => {
    setTab(tabFromParams(params))
  }, [params])

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  const template = findTemplate(templateId) || templates[0]
  const templateCopy = resolveCopy(template?.design)

  const courses = useMemo(() => {
    const set = new Set(students.map((s) => s.course).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (courseFilter !== 'all' && s.course !== courseFilter) return false
      if (onlyCompleted && !isCompleted(s)) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q)
      )
    })
  }, [students, search, courseFilter, onlyCompleted])

  const selectedStudents = useMemo(
    () => students.filter((s) => selected.has(s.id)),
    [students, selected]
  )

  const queue = useMemo(() => {
    if (tab === 'csv') {
      return csvRows.map((r) => ({
        recipientName: r.recipientName,
        courseTitle: r.courseTitle,
        email: r.email,
        issueDate: r.issueDate
      }))
    }
    if (tab === 'tutor') {
      return selectedStudents.map((s) => ({
        recipientName: s.name || s.email,
        courseTitle: s.course,
        email: s.email,
        issueDate: s.completedAt || ''
      }))
    }
    return manualRows.map((r) => ({
      recipientName: r.recipientName,
      courseTitle: r.courseTitle,
      email: r.email,
      issueDate: r.issueDate
    }))
  }, [tab, csvRows, selectedStudents, manualRows])

  const addRow = () => {
    if (!newRow.recipientName.trim()) return
    setManualRows((r) => [...r, { ...newRow, rowId: uid() }])
    setNewRow({ recipientName: '', courseTitle: '', email: '' })
  }

  const removeManual = (id) => setManualRows((r) => r.filter((x) => x.rowId !== id))
  const removeCsv = (id) => setCsvRows((r) => r.filter((x) => x.rowId !== id))

  const clearTab = () => {
    if (tab === 'csv') setCsvRows([])
    else if (tab === 'tutor') setSelected(new Set())
    else setManualRows([])
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
        setCsvRows((prev) => [...prev, ...parsed])
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

  const load = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const { students: list, pages, url } = await fetchTutorStudents(integration)
      setStudents(list)
      setSelected(new Set())
      setMeta({ pages, url })
      setMsg({
        type: 'success',
        text: `Loaded ${list.length} enrollment${list.length === 1 ? '' : 's'}${
          pages > 1 ? ` across ${pages} pages` : ''
        } from Tutor LMS.`
      })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not load students.' })
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((s) => next.add(s.id))
      return next
    })

  const clearSelection = () => setSelected(new Set())

  const generate = async () => {
    if (!template) {
      setMsg({ type: 'error', text: 'Select a template before generating.' })
      return
    }
    if (!queue.length) {
      setMsg({ type: 'error', text: 'Add at least one recipient.' })
      return
    }
    setGenerating(true)
    setMsg(null)
    try {
      const items = queue.map((r) => ({
        recipientName: r.recipientName,
        recipientEmail: r.email || '',
        courseTitle: r.courseTitle || 'Course Title',
        description: templateCopy.description,
        eyebrow: templateCopy.eyebrow,
        issueDate: r.issueDate || todayLong(),
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

  const nodesForGenerated = () => generated.map((c) => nodeRefs.current[c.id]).filter(Boolean)

  const exportAll = async () => {
    setExporting(true)
    setProgress({ done: 0, total: generated.length })
    try {
      await exportManyPDF(nodesForGenerated(), `certificates-${Date.now()}`, (done, total) =>
        setProgress({ done, total })
      )
      setMsg({ type: 'success', text: 'Combined PDF exported.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Export failed.' })
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const firstPreview = {
    recipientName: queue[0]?.recipientName || 'Recipient Name',
    courseTitle: queue[0]?.courseTitle || 'Course Title',
    eyebrow: templateCopy.eyebrow,
    description: templateCopy.description,
    issueDate: queue[0]?.issueDate || todayLong(),
    certificateId: previewCertificateId(settings?.certificatePrefix),
    publicToken: previewCertificateId(settings?.certificatePrefix)
  }

  const canClear =
    (tab === 'manual' && manualRows.length > 0) ||
    (tab === 'csv' && csvRows.length > 0) ||
    (tab === 'tutor' && selected.size > 0)

  return (
    <div className="editor-layout">
      <div className="grid" style={{ gap: 20 }}>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Template</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Select a design. Heading, description and styling come from the template.
          </p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Design template</label>
            <TemplateSelect templates={templates} value={templateId} onChange={setTemplateId} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Recipients</h3>
            <div className="row" style={{ gap: 8 }}>
              {tab === 'csv' && (
                <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                  <IconDownload /> CSV template
                </button>
              )}
              {canClear && (
                <button className="btn btn-danger btn-sm" onClick={clearTab}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="tabs" style={{ marginBottom: 16 }}>
            {TABS.map((t) => (
              <div
                key={t.id}
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => {
                  setTab(t.id)
                  setMsg(null)
                  setGenerated([])
                }}
              >
                {t.label}
              </div>
            ))}
          </div>

          {tab === 'manual' && (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Add recipients one at a time.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
                <span className="badge">{manualRows.length} recipients</span>
              </div>

              {manualRows.length > 0 && (
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
                      {manualRows.map((r, i) => (
                        <tr key={r.rowId}>
                          <td className="muted">{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{r.recipientName}</td>
                          <td className="muted">{r.courseTitle || '—'}</td>
                          <td className="muted">{r.email || '—'}</td>
                          <td>
                            <button className="icon-btn" onClick={() => removeManual(r.rowId)}>
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'csv' && (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Upload a spreadsheet of recipients. Heading, description and styling come from the
                selected template.
              </p>
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
                  onChange={(e) => {
                    onFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <IconUpload width={28} height={28} />
                <div style={{ fontWeight: 600 }}>Drop a CSV file or click to upload</div>
                <div className="hint">Columns: name, course (optional), email (optional)</div>
              </label>

              <div className="row-between" style={{ marginTop: 18 }}>
                <span className="badge">{csvRows.length} recipients</span>
              </div>

              {csvRows.length > 0 && (
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
                      {csvRows.map((r, i) => (
                        <tr key={r.rowId}>
                          <td className="muted">{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{r.recipientName}</td>
                          <td className="muted">{r.courseTitle || '—'}</td>
                          <td className="muted">{r.email || '—'}</td>
                          <td>
                            <button className="icon-btn" onClick={() => removeCsv(r.rowId)}>
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'tutor' && !configured && (
            <EmptyState icon={<IconPlug width={40} height={40} />} title="Student API not configured">
              <p style={{ maxWidth: 520, margin: '0 auto 16px' }}>
                Add your WordPress Tutor LMS API details in Organization settings, then enable student
                import to pull students here.
              </p>
              <Link className="btn btn-primary" to="/settings">
                <IconPlug /> Configure student API
              </Link>
            </EmptyState>
          )}

          {tab === 'tutor' && configured && (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Fetch enrolled students from your connected WordPress site, then generate certificates
                for the ones you select.
              </p>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <button className="btn btn-primary" onClick={load} disabled={loading}>
                  <IconRefresh />{' '}
                  {loading ? 'Fetching…' : students.length ? 'Refresh students' : 'Fetch students'}
                </button>
                <span className={`badge ${students.length ? 'green' : 'gray'}`}>
                  {students.length} loaded
                </span>
                {meta?.url && (
                  <span className="hint" style={{ wordBreak: 'break-all' }}>
                    {meta.url}
                  </span>
                )}
              </div>

              {students.length > 0 && (
                <>
                  <div className="table-toolbar">
                    <div className="search-box">
                      <IconSearch width={16} height={16} />
                      <input
                        className="input"
                        placeholder="Search name, email or course"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="select"
                      style={{ width: 'auto' }}
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="all">All courses</option>
                      {courses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <label className="check-inline">
                      <input
                        type="checkbox"
                        checked={onlyCompleted}
                        onChange={(e) => setOnlyCompleted(e.target.checked)}
                      />
                      Completed only
                    </label>
                  </div>

                  <div className="row-between" style={{ margin: '4px 0 12px' }}>
                    <span className="badge">
                      {filtered.length} shown · {selected.size} selected
                    </span>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={selectAllFiltered}>
                        Select all shown
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={clearSelection}
                        disabled={!selected.size}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 42 }}>
                            <input
                              type="checkbox"
                              aria-label="Select all shown"
                              checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                              onChange={(e) =>
                                e.target.checked ? selectAllFiltered() : clearSelection()
                              }
                            />
                          </th>
                          <th>Student</th>
                          <th>Email</th>
                          <th>Course</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s) => (
                          <tr
                            key={s.id}
                            className={selected.has(s.id) ? 'row-selected' : ''}
                            onClick={() => toggle(s.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selected.has(s.id)}
                                onChange={() => toggle(s.id)}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{s.name || s.email || '—'}</td>
                            <td className="muted">{s.email || '—'}</td>
                            <td className="muted">{s.course || '—'}</td>
                            <td>
                              {isCompleted(s) ? (
                                <span className="badge green">Completed</span>
                              ) : s.status ? (
                                <span className="badge gold" style={{ textTransform: 'capitalize' }}>
                                  {s.status}
                                </span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="preview-panel">
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Preview</h3>
            <span className="badge">{queue.length} ready</span>
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
            disabled={generating || !queue.length || !template}
          >
            <IconSparkles />{' '}
            {generating
              ? 'Generating…'
              : `Generate ${queue.length || ''} certificate${queue.length === 1 ? '' : 's'}`}
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
              certificate={cert}
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
            You are about to generate <b>{queue.length}</b> certificate
            {queue.length === 1 ? '' : 's'} using the <b>{template?.name}</b> template.
          </p>
          <div className="hint">
            <IconUsers width={14} height={14} style={{ verticalAlign: -2 }} /> Unique certificate IDs
            and public share links are assigned automatically.
          </div>
        </Modal>
      )}
    </div>
  )
}
