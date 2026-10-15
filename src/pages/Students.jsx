import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import { EmptyState, Modal, ShareLink } from '../components/ui.jsx'
import { fetchTutorStudents, isCompleted } from '../lib/tutorLms.js'
import { buildPublicUrl } from '../lib/certUtils.js'
import { makeCertificateId, todayLong } from '../lib/data.js'
import { exportManyPDF } from '../lib/export.js'
import { uid } from '../lib/storage.js'
import {
  IconRefresh,
  IconPlus,
  IconTrash,
  IconDownload,
  IconCheck,
  IconSparkles,
  IconUsers,
  IconSearch,
  IconPlug
} from '../components/icons.jsx'

export default function Students() {
  const { settings, templates, addCertificates, findTemplate } = useData()
  const integration = settings?.integration
  const configured = Boolean(integration?.enabled && integration?.baseUrl)

  const [templateId, setTemplateId] = useState('')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [meta, setMeta] = useState(null)

  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [onlyCompleted, setOnlyCompleted] = useState(false)

  const [common, setCommon] = useState({
    eyebrow: 'Certificate of Achievement',
    description:
      'Awarded in recognition of the successful completion of all program requirements and assessments.',
    courseTitle: '',
    issueDate: todayLong()
  })

  const [manual, setManual] = useState({ recipientName: '', courseTitle: '', email: '' })
  const [manualRows, setManualRows] = useState([])

  const [generated, setGenerated] = useState([])
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const nodeRefs = useRef({})

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  const template = findTemplate(templateId) || templates[0]

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

  const queue = useMemo(
    () => [
      ...selectedStudents.map((s) => ({
        recipientName: s.name || s.email,
        courseTitle: s.course || common.courseTitle,
        email: s.email
      })),
      ...manualRows.map((r) => ({
        recipientName: r.recipientName,
        courseTitle: r.courseTitle || common.courseTitle,
        email: r.email
      }))
    ],
    [selectedStudents, manualRows, common.courseTitle]
  )

  const load = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const { students: list, total, pages, url } = await fetchTutorStudents(integration)
      setStudents(list)
      setSelected(new Set())
      setMeta({ total, pages, url })
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

  const selectAllFiltered = () => setSelected((prev) => {
    const next = new Set(prev)
    filtered.forEach((s) => next.add(s.id))
    return next
  })

  const clearSelection = () => setSelected(new Set())

  const addManual = () => {
    if (!manual.recipientName.trim()) return
    setManualRows((r) => [...r, { ...manual, rowId: uid() }])
    setManual({ recipientName: '', courseTitle: '', email: '' })
  }

  const removeManual = (rowId) => setManualRows((r) => r.filter((x) => x.rowId !== rowId))

  const generate = async () => {
    if (!queue.length) {
      setMsg({ type: 'error', text: 'Select students or add a recipient manually.' })
      return
    }
    setGenerating(true)
    setMsg(null)
    try {
      const items = queue.map((r) => ({
        recipientName: r.recipientName,
        courseTitle: r.courseTitle || 'Course Title',
        description: common.description,
        eyebrow: common.eyebrow,
        issueDate: common.issueDate,
        certificateId: makeCertificateId(),
        templateId,
        design: template?.design || null
      }))
      const created = await addCertificates(items)
      setGenerated(created)
      setMsg({
        type: 'success',
        text: `${created.length} certificate${created.length === 1 ? '' : 's'} generated and saved.`
      })
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

  if (!configured) {
    return (
      <div className="card card-pad">
        <EmptyState icon={<IconPlug width={40} height={40} />} title="Student API not configured">
          <p style={{ maxWidth: 520, margin: '0 auto 16px' }}>
            Add your WordPress Tutor LMS API details in Organization settings, then enable student
            import to pull students and generate their certificates here.
          </p>
          <Link className="btn btn-primary" to="/settings">
            <IconPlug /> Configure student API
          </Link>
        </EmptyState>
      </div>
    )
  }

  const previewCert = {
    recipientName: queue[0]?.recipientName || 'Recipient Name',
    courseTitle: queue[0]?.courseTitle || 'Course Title',
    eyebrow: common.eyebrow,
    description: common.description,
    issueDate: common.issueDate,
    certificateId: 'CERT-PREVIEW'
  }

  return (
    <div className="editor-layout">
      <div className="grid" style={{ gap: 20 }}>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Import from Tutor LMS</h3>
            <span className={`badge ${students.length ? 'green' : 'gray'}`}>
              {students.length} loaded
            </span>
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Fetch enrolled students from your connected WordPress site, then generate certificates
            for the ones you select.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              <IconRefresh /> {loading ? 'Fetching…' : students.length ? 'Refresh students' : 'Fetch students'}
            </button>
            {meta?.url && (
              <span className="hint" style={{ wordBreak: 'break-all' }}>
                {meta.url}
              </span>
            )}
          </div>
        </div>

        {students.length > 0 && (
          <div className="card card-pad">
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
              <span className="badge">{filtered.length} shown · {selected.size} selected</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={selectAllFiltered}>
                  Select all shown
                </button>
                <button className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={!selected.size}>
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
                      <td className="muted">{s.course || common.courseTitle || '—'}</td>
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
          </div>
        )}

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Add recipient manually</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Generate a certificate for someone who is not in the Tutor LMS list.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: '2 1 200px' }}
              placeholder="Recipient name"
              value={manual.recipientName}
              onChange={(e) => setManual({ ...manual, recipientName: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
            />
            <input
              className="input"
              style={{ flex: '2 1 180px' }}
              placeholder="Course (optional)"
              value={manual.courseTitle}
              onChange={(e) => setManual({ ...manual, courseTitle: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
            />
            <input
              className="input"
              style={{ flex: '2 1 180px' }}
              placeholder="Email (optional)"
              value={manual.email}
              onChange={(e) => setManual({ ...manual, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
            />
            <button className="btn btn-ghost" onClick={addManual}>
              <IconPlus /> Add
            </button>
          </div>

          {manualRows.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 14 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Email</th>
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((r) => (
                    <tr key={r.rowId}>
                      <td style={{ fontWeight: 600 }}>{r.recipientName}</td>
                      <td className="muted">{r.courseTitle || common.courseTitle || '—'}</td>
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
        </div>

        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Batch settings</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Design template</label>
              <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.custom ? '(custom)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Default course (used when a student has none)</label>
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
            <label>Date of issue</label>
            <input
              className="input"
              value={common.issueDate}
              onChange={(e) => setCommon({ ...common, issueDate: e.target.value })}
            />
          </div>
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
                certificate={previewCert}
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
            disabled={generating || !queue.length}
          >
            <IconSparkles />
            {generating ? 'Generating…' : `Generate ${queue.length || ''} certificate${queue.length === 1 ? '' : 's'}`}
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

              <div className="links-scroll">
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
            You are about to generate <b>{queue.length}</b> certificate{queue.length === 1 ? '' : 's'}{' '}
            from <b>{selectedStudents.length}</b> imported and <b>{manualRows.length}</b> manual
            recipient{manualRows.length === 1 ? '' : 's'}, using the <b>{template?.name}</b>{' '}
            template.
          </p>
          <div className="hint">
            <IconUsers width={14} height={14} style={{ verticalAlign: -2 }} /> They will be saved to
            your certificate library with unique IDs and public share links.
          </div>
        </Modal>
      )}
    </div>
  )
}
