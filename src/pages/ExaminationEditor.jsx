import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { Modal, EmptyState, ShareLink } from '../components/ui.jsx'
import {
  IconPlus,
  IconTrash,
  IconUpload,
  IconDownload,
  IconUsers,
  IconMail,
  IconCheck,
  IconExam
} from '../components/icons.jsx'
import {
  blankExam,
  blankQuestion,
  cachedStudents,
  collectCourseOptions,
  createInvitation,
  getExamination,
  listAttempts,
  listInvitations,
  markAttemptCertificateSent,
  regenerateInvitation,
  revokeInvitation,
  saveExamination
} from '../lib/exams.js'
import { downloadQuestionTemplate, optionLabel, parseQuestionFile } from '../lib/examImport.js'
import { makeCertificateId, makePublicToken, todayLong } from '../lib/data.js'
import { buildPublicUrl, formatDate } from '../lib/certUtils.js'
import { isEmailjsConfigured, isValidEmail, sendCertificateEmail } from '../lib/emailjs.js'
import { uid } from '../lib/storage.js'

const TABS = [
  { id: 'settings', label: 'Settings' },
  { id: 'questions', label: 'Questions' },
  { id: 'participants', label: 'Participants' }
]

function optionIdAt(index) {
  return String.fromCharCode(97 + index)
}

function QuestionEditor({ question, marksPerQuestion, onChange, onRemove }) {
  const set = (key, value) => onChange({ ...question, [key]: value })
  const setOption = (id, text) =>
    onChange({
      ...question,
      options: question.options.map((opt) => (opt.id === id ? { ...opt, text } : opt))
    })
  const addOption = () =>
    onChange({
      ...question,
      options: [...question.options, { id: optionIdAt(question.options.length), text: '' }]
    })
  const removeOption = (id) => {
    if (question.options.length <= 4) return
    const options = question.options.filter((opt) => opt.id !== id)
    onChange({
      ...question,
      options,
      correctOptionId: options.some((opt) => opt.id === question.correctOptionId)
        ? question.correctOptionId
        : options[0]?.id
    })
  }

  return (
    <div className="card card-pad exam-question-card">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="muted small" style={{ fontWeight: 700 }}>
          Question
        </div>
        <button className="icon-btn" onClick={onRemove} aria-label="Remove question">
          <IconTrash width={16} height={16} />
        </button>
      </div>
      <div className="field">
        <label>Question text</label>
        <textarea className="textarea" value={question.text} onChange={(e) => set('text', e.target.value)} />
      </div>
      <div className="grid grid-2">
        {question.options.map((opt, index) => (
          <div className="exam-option-row" key={opt.id}>
            <label className="check-inline" style={{ marginTop: 8 }}>
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOptionId === opt.id}
                onChange={() => set('correctOptionId', opt.id)}
              />
              {optionLabel(index)}
            </label>
            <input
              className="input"
              placeholder={`Option ${optionLabel(index)}`}
              value={opt.text}
              onChange={(e) => setOption(opt.id, e.target.value)}
            />
            {question.options.length > 4 && (
              <button className="icon-btn" onClick={() => removeOption(opt.id)} aria-label="Remove option">
                <IconTrash width={14} height={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm" type="button" onClick={addOption} style={{ margin: '8px 0 12px' }}>
        <IconPlus width={14} height={14} /> Add option
      </button>
      <div className="grid grid-3">
        <div className="field">
          <label>Marks</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.25"
            value={question.marks ?? marksPerQuestion}
            onChange={(e) => set('marks', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Category (optional)</label>
          <input className="input" value={question.category} onChange={(e) => set('category', e.target.value)} />
        </div>
        <div className="field">
          <label>Explanation (optional)</label>
          <input className="input" value={question.explanation} onChange={(e) => set('explanation', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

export default function ExaminationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { certificates, templates, settings, addCertificates, findTemplate } = useData()
  const isNew = id === 'new'
  const [tab, setTab] = useState('settings')
  const [exam, setExam] = useState(() => blankExam())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [invitations, setInvitations] = useState([])
  const [attempts, setAttempts] = useState([])
  const [inviteForm, setInviteForm] = useState({ studentName: '', studentEmail: '', studentId: '' })
  const [generatedLink, setGeneratedLink] = useState(null)
  const [regeneratingId, setRegeneratingId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [sendTarget, setSendTarget] = useState(null)
  const [sending, setSending] = useState(false)

  const courses = useMemo(
    () => collectCourseOptions(certificates, exam.courseTitle ? [exam.courseTitle] : []),
    [certificates, exam.courseTitle]
  )
  const students = useMemo(() => {
    const fromLms = cachedStudents()
    const fromCerts = certificates.map((cert) => ({
      id: cert.id,
      name: cert.recipientName,
      email: cert.recipientEmail || '',
      course: cert.courseTitle
    }))
    const all = [...fromLms, ...fromCerts]
    const seen = new Set()
    return all.filter((student) => {
      const key = `${String(student.name || '').toLowerCase()}|${String(student.email || '').toLowerCase()}`
      if (!student.name || seen.has(key)) return false
      seen.add(key)
      if (!exam.courseTitle) return true
      return !student.course || student.course === exam.courseTitle
    })
  }, [exam.courseTitle, certificates])

  const loadRelated = async (examId) => {
    const [inv, att] = await Promise.all([listInvitations(examId), listAttempts(examId)])
    setInvitations(inv)
    setAttempts(att)
  }

  useEffect(() => {
    if (isNew) return
    let active = true
    setLoading(true)
    getExamination(id)
      .then(async (found) => {
        if (!active) return
        if (!found) {
          setMsg({ type: 'error', text: 'Examination not found.' })
          return
        }
        setExam(found)
        await loadRelated(found.id)
      })
      .catch((e) => {
        if (active) setMsg({ type: 'error', text: e.message || 'Could not load examination.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, isNew])

  const set = (key, value) => setExam((prev) => ({ ...prev, [key]: value }))

  const persist = async (nextExam = exam) => {
    setSaving(true)
    setMsg(null)
    try {
      const saved = await saveExamination(nextExam)
      setExam(saved)
      if (isNew) navigate(`/examinations/${saved.id}`, { replace: true })
      setMsg({ type: 'success', text: 'Examination saved.' })
      return saved
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not save examination.' })
      return null
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () =>
    setExam((prev) => ({ ...prev, questions: [...prev.questions, blankQuestion(prev.marksPerQuestion)] }))

  const updateQuestion = (question) =>
    setExam((prev) => ({
      ...prev,
      questions: prev.questions.map((item) => (item.id === question.id ? question : item))
    }))

  const removeQuestion = (questionId) =>
    setExam((prev) => ({ ...prev, questions: prev.questions.filter((item) => item.id !== questionId) }))

  const onImportFile = async (file) => {
    setImportBusy(true)
    setMsg(null)
    try {
      const result = await parseQuestionFile(file)
      setImportPreview(result)
      setImportOpen(true)
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not read the file.' })
    } finally {
      setImportBusy(false)
    }
  }

  const confirmImport = () => {
    if (!importPreview?.valid?.length) return
    setExam((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        ...importPreview.valid.map((question) => ({
          ...question,
          marks: question.marks == null ? prev.marksPerQuestion : question.marks
        }))
      ]
    }))
    setImportOpen(false)
    setImportPreview(null)
    setTab('questions')
    setMsg({ type: 'success', text: `Imported ${importPreview.valid.length} question${importPreview.valid.length === 1 ? '' : 's'}.` })
  }

  const createLink = async (student) => {
    if (isNew) {
      setMsg({ type: 'error', text: 'Save the examination first, then generate a link.' })
      setTab('settings')
      return
    }
    const saved = await persist()
    if (!saved) return
    if (!saved.questions.length) {
      setMsg({ type: 'error', text: 'Add questions before creating an invitation link.' })
      setTab('questions')
      return
    }
    try {
      const result = await createInvitation(saved.id, student)
      setGeneratedLink(result)
      setInvitations((prev) => [result.invitation, ...prev])
      setInviteForm({ studentName: '', studentEmail: '', studentId: '' })
      setMsg({ type: 'success', text: `One-time exam link created for ${result.invitation.studentName}.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not create invitation.' })
    }
  }

  const regenerateLink = async (invitation) => {
    if (isNew) {
      setMsg({ type: 'error', text: 'Save the examination first, then generate a link.' })
      return
    }
    if (!window.confirm(`Regenerate the exam link for ${invitation.studentName}? The previous link will stop working.`)) return
    setRegeneratingId(invitation.id)
    setMsg(null)
    try {
      const result = await regenerateInvitation(invitation)
      setGeneratedLink(result)
      await loadRelated(exam.id)
      setMsg({ type: 'success', text: `New exam link created for ${result.invitation.studentName}. Copy it now.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not regenerate invitation.' })
    } finally {
      setRegeneratingId('')
    }
  }

  const sendCertificate = async (attempt) => {
    const template = findTemplate(templates[0]?.id) || templates[0]
    if (!template) {
      setMsg({ type: 'error', text: 'Create or select a certificate template first.' })
      return
    }
    setSending(true)
    try {
      let issued = certificates.find((item) => item.id === attempt.certificateId) || null
      if (!issued) {
        const created = await addCertificates([
          {
            recipientName: attempt.studentName,
            recipientEmail: attempt.studentEmail,
            courseTitle: exam.courseTitle,
            issueDate: todayLong(),
            certificateId: makeCertificateId(settings?.certificatePrefix),
            publicToken: makePublicToken(settings?.certificatePrefix),
            templateId: template.id,
            design: template.design
          }
        ])
        issued = created[0] || null
      }
      await markAttemptCertificateSent(attempt.id, issued?.id || '')
      if (isEmailjsConfigured(settings?.emailjs) && isValidEmail(attempt.studentEmail) && issued) {
        await sendCertificateEmail({
          config: settings.emailjs,
          certificate: issued,
          organization: settings?.organization,
          publicUrl: buildPublicUrl(issued)
        })
      }
      setAttempts((prev) =>
        prev.map((item) =>
          item.id === attempt.id ? { ...item, certificateSent: true, certificateId: issued?.id || item.certificateId } : item
        )
      )
      setSendTarget(null)
      setMsg({ type: 'success', text: `Certificate sent for ${attempt.studentName}.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not send certificate.' })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="muted">Loading examination…</div>
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <Link className="muted small" to="/examinations">
            ← Examinations
          </Link>
          <h3 style={{ margin: '4px 0 0' }}>{isNew ? 'New examination' : exam.title || 'Examination'}</h3>
        </div>
        <button className="btn btn-primary" onClick={() => persist()} disabled={saving}>
          {saving ? 'Saving…' : 'Save examination'}
        </button>
      </div>

      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`tab${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="card card-pad">
          <div className="grid grid-2">
            <div className="field">
              <label>Examination title</label>
              <input className="input" value={exam.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="field">
              <label>Associated course</label>
              <input
                className="input"
                list="exam-courses"
                value={exam.courseTitle}
                onChange={(e) => set('courseTitle', e.target.value)}
                placeholder="Course title"
              />
              <datalist id="exam-courses">
                {courses.map((course) => (
                  <option key={course} value={course} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={exam.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Shown to students before the exam starts."
            />
          </div>
          <div className="grid grid-4">
            <div className="field">
              <label>Total marks</label>
              <input
                className="input"
                type="number"
                min="0"
                value={exam.totalMarks}
                onChange={(e) => set('totalMarks', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Marks per question</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.25"
                value={exam.marksPerQuestion}
                onChange={(e) => set('marksPerQuestion', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Pass marks</label>
              <input
                className="input"
                type="number"
                min="0"
                value={exam.passMarks}
                onChange={(e) => set('passMarks', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Duration (minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={exam.durationMinutes}
                onChange={(e) => set('durationMinutes', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>Questions to display</label>
              <input
                className="input"
                type="number"
                min="0"
                value={exam.questionsToDisplay}
                onChange={(e) => set('questionsToDisplay', Number(e.target.value))}
              />
              <div className="hint">Use 0 to show every question in the bank.</div>
            </div>
            <div className="field">
              <label>Negative marks (if enabled)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.25"
                value={exam.negativeMarks}
                onChange={(e) => set('negativeMarks', Number(e.target.value))}
                disabled={!exam.negativeMarking}
              />
            </div>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={exam.negativeMarking}
              onChange={(e) => set('negativeMarking', e.target.checked)}
            />
            <span>
              <b>Negative marking</b>
              <span className="hint">Deduct marks for incorrect answers.</span>
            </span>
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={exam.randomize} onChange={(e) => set('randomize', e.target.checked)} />
            <span>
              <b>Randomize questions</b>
              <span className="hint">Shuffle question order for each student.</span>
            </span>
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={exam.active} onChange={(e) => set('active', e.target.checked)} />
            <span>
              <b>Examination is active</b>
              <span className="hint">Inactive exams cannot be started from an invitation link.</span>
            </span>
          </label>
        </div>
      )}

      {tab === 'questions' && (
        <div className="grid" style={{ gap: 14 }}>
          <div className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b>{exam.questions.length} question{exam.questions.length === 1 ? '' : 's'}</b>
              <div className="muted small">Add questions manually or import from Excel / CSV.</div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => downloadQuestionTemplate('csv')}>
                <IconDownload width={14} height={14} /> CSV template
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => downloadQuestionTemplate('xlsx')}>
                <IconDownload width={14} height={14} /> Excel template
              </button>
              <label className="btn btn-ghost btn-sm">
                <IconUpload width={14} height={14} />
                {importBusy ? 'Reading…' : 'Import file'}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  onChange={(e) => {
                    onImportFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              <button className="btn btn-primary btn-sm" type="button" onClick={addQuestion}>
                <IconPlus width={14} height={14} /> Add question
              </button>
            </div>
          </div>
          {exam.questions.length === 0 ? (
            <div className="card">
              <EmptyState icon={<IconExam width={40} height={40} />} title="No questions yet">
                Add at least four-option MCQs. Invalid import rows are skipped and listed with row numbers.
              </EmptyState>
            </div>
          ) : (
            exam.questions.map((question) => (
              <QuestionEditor
                key={question.id}
                question={question}
                marksPerQuestion={exam.marksPerQuestion}
                onChange={updateQuestion}
                onRemove={() => removeQuestion(question.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'participants' && (
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>Create a one-time exam link</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Each link is unique, hashed on the server, and can be used only once. Refreshing or leaving the exam makes it unavailable.
            </p>
            <div className="grid grid-2">
              <div className="field">
                <label>Student name</label>
                <input
                  className="input"
                  list="exam-students"
                  value={inviteForm.studentName}
                  onChange={(e) => {
                    const name = e.target.value
                    const match = students.find((s) => s.name === name)
                    setInviteForm({
                      studentName: name,
                      studentEmail: match?.email || inviteForm.studentEmail,
                      studentId: match?.id || ''
                    })
                  }}
                />
                <datalist id="exam-students">
                  {students.map((student) => (
                    <option key={student.id || student.email} value={student.name}>
                      {student.email}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Student email</label>
                <input
                  className="input"
                  value={inviteForm.studentEmail}
                  onChange={(e) => setInviteForm((f) => ({ ...f, studentEmail: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => createLink(inviteForm)}
              disabled={!inviteForm.studentName.trim()}
            >
              <IconUsers width={15} height={15} /> Generate secure link
            </button>
            {generatedLink && (
              <div style={{ marginTop: 16 }}>
                <ShareLink url={generatedLink.url} label={`Invitation for ${generatedLink.invitation.studentName}`} />
                <p className="hint">Copy this link now. The raw token is not stored. Use Regenerate in the list if a student needs a new one.</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-pad">
              <h3 style={{ margin: 0 }}>Invitations</h3>
            </div>
            {invitations.length === 0 ? (
              <EmptyState title="No invitations yet">Generate a link after the student applies for the exam.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.studentName}</div>
                          <div className="muted small">{item.studentEmail || '—'}</div>
                        </td>
                        <td>
                          <span className={`badge ${item.status === 'unused' ? 'gold' : item.status === 'used' ? 'green' : 'gray'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="muted">{formatDate(item.createdAt)}</td>
                        <td>
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              disabled={regeneratingId === item.id}
                              onClick={() => regenerateLink(item)}
                            >
                              {regeneratingId === item.id ? 'Regenerating…' : 'Regenerate'}
                            </button>
                            {item.status === 'unused' && (
                              <button className="btn btn-ghost btn-sm" onClick={() => revokeInvitation(item.id).then(() => loadRelated(exam.id))}>
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-pad">
              <h3 style={{ margin: 0 }}>Participant results</h3>
            </div>
            {attempts.length === 0 ? (
              <EmptyState title="No attempts yet">Results appear after a student starts the examination.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Result</th>
                      <th>Started</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.studentName}</div>
                          <div className="muted small">{item.studentEmail || '—'}</div>
                        </td>
                        <td>
                          <span className={`badge ${item.status === 'submitted' ? 'green' : item.status === 'voided' ? 'red' : 'gold'}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{item.score == null ? '—' : item.score}</td>
                        <td>
                          {item.status !== 'submitted' ? (
                            <span className="muted">—</span>
                          ) : (
                            <span className={`badge ${item.passed ? 'green' : 'red'}`}>
                              {item.passed ? 'Pass' : 'Fail'}
                            </span>
                          )}
                        </td>
                        <td className="muted">{formatDate(item.startedAt)}</td>
                        <td>
                          {item.passed && item.status === 'submitted' && (
                            <button
                              className="btn btn-gold btn-sm"
                              onClick={() => setSendTarget(item)}
                              disabled={item.certificateSent}
                            >
                              {item.certificateSent ? <IconCheck width={14} height={14} /> : <IconMail width={14} height={14} />}
                              {item.certificateSent ? 'Sent' : 'Send'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {importOpen && importPreview && (
        <Modal
          title="Import preview"
          size="lg"
          onClose={() => setImportOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setImportOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={!importPreview.valid.length}>
                Import {importPreview.valid.length} valid question{importPreview.valid.length === 1 ? '' : 's'}
              </button>
            </>
          }
        >
          <p className="muted small">
            Invalid or incomplete questions are not imported. Fix the listed rows and upload again if needed.
          </p>
          {importPreview.errors.length > 0 && (
            <div className="alert error">
              {importPreview.errors.slice(0, 12).map((err) => (
                <div key={`${err.row}-${err.message}`}>
                  Row {err.row}: {err.message}
                </div>
              ))}
              {importPreview.errors.length > 12 && <div>…and {importPreview.errors.length - 12} more</div>}
            </div>
          )}
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Question</th>
                  <th>Options</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.preview.map((row) => (
                  <tr key={`${row.row}-${row.id || uid()}`}>
                    <td>{row.row}</td>
                    <td>{row.text || '—'}</td>
                    <td className="muted small">{row.options?.map((opt) => opt.text).join(' · ')}</td>
                    <td>
                      <span className={`badge ${row.ok ? 'green' : 'red'}`}>{row.ok ? 'Ready' : 'Skipped'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {sendTarget && (
        <Modal
          title={`Send certificate to ${sendTarget.studentName}`}
          onClose={() => !sending && setSendTarget(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setSendTarget(null)} disabled={sending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => sendCertificate(sendTarget)} disabled={sending}>
                {sending ? 'Sending…' : 'Issue and send'}
              </button>
            </>
          }
        >
          <p>
            This student passed <b>{exam.courseTitle}</b> and is eligible for a certificate.
          </p>
          <p className="muted small">
            A certificate will be generated for this course. If EmailJS is configured and an email is available, it will also be sent to the student.
          </p>
        </Modal>
      )}
    </div>
  )
}
