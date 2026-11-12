import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui.jsx'
import { IconExam, IconPlus, IconSearch, IconTrash } from '../components/icons.jsx'
import { deleteExamination, listExaminations } from '../lib/exams.js'

export default function Examinations() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [msg, setMsg] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      setExams(await listExaminations())
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not load examinations.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exams
    return exams.filter(
      (exam) =>
        exam.title.toLowerCase().includes(q) || exam.courseTitle.toLowerCase().includes(q)
    )
  }, [exams, query])

  const remove = async (exam) => {
    if (!window.confirm(`Delete examination "${exam.title}"? This also removes invitations and attempts.`)) return
    try {
      await deleteExamination(exam.id)
      setExams((prev) => prev.filter((item) => item.id !== exam.id))
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not delete examination.' })
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="search-box" style={{ maxWidth: 420 }}>
          <IconSearch width={16} height={16} />
          <input
            className="input"
            placeholder="Search by title or course…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Link className="btn btn-primary" to="/examinations/new">
          <IconPlus /> New examination
        </Link>
      </div>

      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconExam width={42} height={42} />}
            title={loading ? 'Loading…' : 'No examinations yet'}
          >
            Create a course-wise MCQ exam. Students who pass become eligible for a certificate.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Course</th>
                  <th>Questions</th>
                  <th>Pass mark</th>
                  <th>Duration</th>
                  <th>Participants</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <Link to={`/examinations/${exam.id}`} style={{ fontWeight: 600 }}>
                        {exam.title}
                      </Link>
                      <div className="muted small">{exam.totalMarks} total marks</div>
                    </td>
                    <td className="muted">{exam.courseTitle}</td>
                    <td>{exam.questionCount || 0}</td>
                    <td>{exam.passMarks}</td>
                    <td>{exam.durationMinutes} min</td>
                    <td>
                      {exam.attemptCount || 0}
                      {exam.passCount ? (
                        <span className="muted small"> · {exam.passCount} passed</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${exam.active ? 'green' : 'gray'}`}>
                        {exam.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <Link className="btn btn-ghost btn-sm" to={`/examinations/${exam.id}`}>
                          Open
                        </Link>
                        <button className="icon-btn" onClick={() => remove(exam)} aria-label="Delete">
                          <IconTrash width={16} height={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
