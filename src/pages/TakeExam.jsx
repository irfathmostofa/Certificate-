import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CenterLoader } from '../components/ui.jsx'
import { IconAlert, IconCheck, IconClock } from '../components/icons.jsx'
import {
  formatDuration,
  peekExamInvitation,
  remainingSeconds as secondsUntil,
  saveExamProgress,
  startExamAttempt,
  submitExamAttempt,
  voidExamAttempt
} from '../lib/exams.js'

const WARNINGS = [
  'The examination has a fixed time limit. The timer starts after you agree.',
  'Switching tabs or windows may be recorded as a violation and can terminate this attempt.',
  'Refreshing or leaving the examination may terminate the attempt.',
  'This examination link can be used only once and cannot be reused.',
  'Once submitted, you cannot attempt this examination again using the same invitation.'
]

function statusMessage(peek) {
  if (!peek?.ok) return 'This examination link is invalid or no longer available.'
  if (peek.status === 'revoked') return 'This examination invitation has been revoked.'
  if (peek.status === 'used' || peek.attemptStatus) {
    return 'This examination link has already been used and is no longer available.'
  }
  if (peek.exam && peek.exam.active === false) return 'This examination is not currently active.'
  return ''
}

export default function TakeExam() {
  const { token } = useParams()
  const [phase, setPhase] = useState('loading')
  const [peek, setPeek] = useState(null)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [exam, setExam] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const answersRef = useRef({})
  const remainingRef = useRef(0)
  const startedRef = useRef(false)
  const finishedRef = useRef(false)
  const submittingRef = useRef(false)
  const tokenRef = useRef(token)

  tokenRef.current = token
  answersRef.current = answers
  remainingRef.current = remaining

  const finish = useCallback((nextPhase, payload) => {
    if (finishedRef.current) return
    finishedRef.current = true
    startedRef.current = false
    if (payload) setResult(payload)
    setPhase(nextPhase)
  }, [])

  const submit = useCallback(
    async (auto = false) => {
      if (finishedRef.current || submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      setConfirmOpen(false)
      try {
        const data = await submitExamAttempt(tokenRef.current, answersRef.current)
        finish('result', data)
      } catch (e) {
        if (auto) {
          setError(e.message || 'This examination link is no longer available.')
          finish('unavailable')
        } else {
          submittingRef.current = false
          setError(e.message || 'Could not submit the examination.')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [finish]
  )

  const voidAttempt = useCallback(
    async (reason) => {
      if (!startedRef.current || finishedRef.current || submittingRef.current) return
      finishedRef.current = true
      startedRef.current = false
      try {
        await voidExamAttempt(tokenRef.current, reason)
      } catch {
        /* already unavailable */
      }
      setPhase('unavailable')
      setError('This examination link is no longer available because the attempt was interrupted.')
    },
    []
  )

  useEffect(() => {
    let active = true
    setPhase('loading')
    peekExamInvitation(token)
      .then((data) => {
        if (!active) return
        setPeek(data)
        const blocked = statusMessage(data)
        if (blocked) {
          setError(blocked)
          setPhase('unavailable')
          return
        }
        setExam(data.exam)
        setPhase('warning')
      })
      .catch((e) => {
        if (!active) return
        setError(e.message || 'This examination link is invalid or no longer available.')
        setPhase('unavailable')
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (phase !== 'exam') return
    const tick = setInterval(() => {
      const left = secondsUntil(attempt?.endsAt)
      setRemaining(left)
      remainingRef.current = left
      if (left <= 0) submit(true)
    }, 1000)
    return () => clearInterval(tick)
  }, [phase, attempt?.endsAt, submit])

  useEffect(() => {
    if (phase !== 'exam') return
    const save = setInterval(() => {
      saveExamProgress(tokenRef.current, answersRef.current, remainingRef.current).catch(() => {})
    }, 8000)
    return () => clearInterval(save)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exam') return
    const timer = setTimeout(() => {
      saveExamProgress(tokenRef.current, answersRef.current, remainingRef.current).catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [answers, phase])

  useEffect(() => {
    if (phase !== 'exam') return
    const onVisibility = () => {
      if (document.hidden) voidAttempt('tab-switch')
    }
    const onPageHide = () => {
      voidAttempt('refresh-or-leave')
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [phase, voidAttempt])

  const begin = async () => {
    if (!agreed || starting) return
    setStarting(true)
    setError('')
    try {
      const data = await startExamAttempt(token)
      startedRef.current = true
      setExam(data.exam)
      setAttempt(data.attempt)
      setQuestions(data.questions || [])
      setAnswers(data.attempt?.answers || {})
      setRemaining(secondsUntil(data.attempt?.endsAt) || (data.exam?.durationMinutes || 0) * 60)
      setPhase('exam')
    } catch (e) {
      setError(e.message || 'This examination link is no longer available.')
      setPhase('unavailable')
    } finally {
      setStarting(false)
    }
  }

  const current = questions[index]
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers]
  )

  if (phase === 'loading') {
    return (
      <div className="exam-public">
        <CenterLoader label="Checking examination link…" />
      </div>
    )
  }

  if (phase === 'unavailable') {
    return (
      <div className="exam-public">
        <div className="exam-card">
          <div className="exam-lock">
            <IconAlert width={36} height={36} />
            <h1>Link unavailable</h1>
            <p>{error || 'This examination link cannot be used.'}</p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="exam-public">
        <div className="exam-card exam-result">
          <div className={`exam-result-mark ${result?.passed ? 'pass' : 'fail'}`}>
            {result?.passed ? <IconCheck width={32} height={32} /> : <IconAlert width={32} height={32} />}
          </div>
          <h1>{result?.passed ? 'You passed' : 'Examination submitted'}</h1>
          <p className="muted">
            Score {result?.score ?? '—'}
            {result?.totalMarks != null ? ` / ${result.totalMarks}` : ''}
            {result?.passMarks != null ? ` · pass mark ${result.passMarks}` : ''}
          </p>
          <p>
            {result?.passed
              ? 'You are eligible for the course certificate. The administrator can send it from the examination participants list.'
              : 'This invitation cannot be used again. Contact your administrator if you need another attempt.'}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'warning') {
    return (
      <div className="exam-public">
        <div className="exam-card">
          <div className="exam-kicker">{peek?.exam?.courseTitle}</div>
          <h1>{peek?.exam?.title || 'Examination'}</h1>
          <p className="muted">{peek?.exam?.description || 'Please read the instructions before starting.'}</p>
          <div className="exam-meta-row">
            <span>{peek?.exam?.durationMinutes} minutes</span>
            <span>{peek?.exam?.questionsToDisplay} questions</span>
            <span>Pass mark {peek?.exam?.passMarks}</span>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="exam-warning-box">
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <IconAlert width={18} height={18} />
              <b>Before you start</b>
            </div>
            <ul>
              {WARNINGS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <label className="switch-row" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              <b>I understand and agree</b>
              <span className="hint">The timer starts immediately after you continue.</span>
            </span>
          </label>
          <button className="btn btn-primary btn-block" disabled={!agreed || starting} onClick={begin}>
            {starting ? 'Starting…' : 'Start examination'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="exam-taking">
      <header className="exam-top">
        <div>
          <div className="exam-kicker">{exam?.courseTitle}</div>
          <b>{exam?.title}</b>
        </div>
        <div className={`exam-timer${remaining <= 60 ? ' danger' : ''}`}>
          <IconClock width={16} height={16} />
          {formatDuration(remaining)}
        </div>
      </header>

      <div className="exam-layout">
        <aside className="exam-nav-panel">
          <div className="muted small" style={{ marginBottom: 8 }}>
            {answeredCount} of {questions.length} answered
          </div>
          <div className="exam-q-grid">
            {questions.map((question, i) => (
              <button
                key={question.id}
                className={`exam-q-dot${i === index ? ' current' : ''}${answers[question.id] ? ' answered' : ''}`}
                onClick={() => setIndex(i)}
                type="button"
              >
                {i + 1}
              </button>
            ))}
          </div>
        </aside>

        <section className="exam-main">
          {current ? (
            <>
              <div className="muted small">
                Question {index + 1} of {questions.length}
                {current.marks ? ` · ${current.marks} mark${current.marks === 1 ? '' : 's'}` : ''}
              </div>
              <h2>{current.text}</h2>
              <div className="exam-choices">
                {(current.options || []).map((opt) => (
                  <label key={opt.id} className={`exam-choice${answers[current.id] === opt.id ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      name={current.id}
                      checked={answers[current.id] === opt.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: opt.id }))}
                    />
                    <span>{opt.text}</span>
                  </label>
                ))}
              </div>
              <div className="row-between" style={{ marginTop: 18, flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-ghost" type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                  Previous
                </button>
                <div className="row" style={{ gap: 8 }}>
                  {index < questions.length - 1 ? (
                    <button className="btn btn-primary" type="button" onClick={() => setIndex((i) => i + 1)}>
                      Next
                    </button>
                  ) : (
                    <button className="btn btn-gold" type="button" onClick={() => setConfirmOpen(true)}>
                      Submit examination
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="muted">No questions available.</div>
          )}
        </section>
      </div>

      <div className="exam-submit-bar">
        <button className="btn btn-gold" type="button" onClick={() => setConfirmOpen(true)} disabled={submitting}>
          Submit examination
        </button>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Submit examination?</h2>
            </div>
            <div className="modal-body">
              <p>
                You have answered {answeredCount} of {questions.length} questions. Once submitted, this invitation cannot be used again.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                Continue exam
              </button>
              <button className="btn btn-primary" onClick={() => submit(false)} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
