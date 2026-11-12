import { supabase, isSupabaseConfigured } from './supabase.js'
import { local, uid } from './storage.js'

const EXAMS_KEY = 'examinations'
const INVITES_KEY = 'exam-invitations'
const ATTEMPTS_KEY = 'exam-attempts'
const SEED_KEY = 'exam-seeded'

export function blankExam() {
  return {
    id: uid(),
    title: '',
    description: '',
    courseTitle: '',
    totalMarks: 100,
    marksPerQuestion: 1,
    passMarks: 40,
    durationMinutes: 30,
    negativeMarking: false,
    negativeMarks: 0.25,
    questionsToDisplay: 0,
    randomize: true,
    active: true,
    questions: [],
    createdAt: new Date().toISOString()
  }
}

export function blankQuestion(marks = 1) {
  return {
    id: uid(),
    text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' }
    ],
    correctOptionId: 'a',
    explanation: '',
    marks,
    category: ''
  }
}

export async function hashToken(token) {
  const encoded = new TextEncoder().encode(String(token || ''))
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function makeExamToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function examInviteUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/exam/${encodeURIComponent(token)}`
}

function shuffle(list) {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function publicExamMeta(exam) {
  if (!exam) return null
  const displayCount =
    exam.questionsToDisplay > 0
      ? Math.min(exam.questionsToDisplay, exam.questions?.length || 0)
      : exam.questions?.length || 0
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    courseTitle: exam.courseTitle,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    passMarks: exam.passMarks,
    negativeMarking: exam.negativeMarking,
    questionsToDisplay: displayCount,
    active: exam.active !== false
  }
}

function sanitizeQuestion(question, fallbackMarks) {
  const options = (question.options || [])
    .map((opt, index) => ({
      id: String(opt.id || String.fromCharCode(97 + index)),
      text: String(opt.text || '').trim()
    }))
    .filter((opt) => opt.text)
  return {
    id: question.id || uid(),
    text: String(question.text || '').trim(),
    options,
    correctOptionId: String(question.correctOptionId || options[0]?.id || ''),
    explanation: String(question.explanation || '').trim(),
    marks: question.marks == null || question.marks === '' ? fallbackMarks : toNumber(question.marks, fallbackMarks),
    category: String(question.category || '').trim()
  }
}

export function validateExam(exam) {
  const errors = []
  if (!String(exam.title || '').trim()) errors.push('Examination title is required.')
  if (!String(exam.courseTitle || '').trim()) errors.push('Associated course is required.')
  if (toNumber(exam.durationMinutes) <= 0) errors.push('Duration must be at least 1 minute.')
  if (toNumber(exam.totalMarks) < 0) errors.push('Total marks cannot be negative.')
  if (toNumber(exam.marksPerQuestion) < 0) errors.push('Marks per question cannot be negative.')
  if (toNumber(exam.passMarks) < 0) errors.push('Pass marks cannot be negative.')
  if (exam.negativeMarking && toNumber(exam.negativeMarks) < 0) errors.push('Negative marks cannot be negative.')
  if (toNumber(exam.questionsToDisplay) < 0) errors.push('Questions to display cannot be negative.')
  return errors
}

export function validateQuestion(question) {
  const errors = []
  if (!String(question.text || '').trim()) errors.push('Question text is required.')
  const options = (question.options || []).filter((opt) => String(opt.text || '').trim())
  if (options.length < 4) errors.push('Add at least four answer options.')
  const texts = options.map((opt) => opt.text.trim().toLowerCase())
  if (new Set(texts).size !== texts.length) errors.push('Options must be unique.')
  if (!options.some((opt) => opt.id === question.correctOptionId)) {
    errors.push('Select one correct answer from the options.')
  }
  return errors
}

function scoreAttempt(exam, questionIds, answers) {
  let score = 0
  const details = []
  ;(questionIds || []).forEach((id) => {
    const question = (exam.questions || []).find((item) => item.id === id)
    if (!question) return
    const marks = toNumber(question.marks, exam.marksPerQuestion)
    const chosen = answers?.[id]
    let earned = 0
    if (chosen == null || chosen === '') earned = 0
    else if (chosen === question.correctOptionId) earned = marks
    else if (exam.negativeMarking) earned = -toNumber(exam.negativeMarks)
    score += earned
    details.push({
      questionId: id,
      chosen: chosen || '',
      correct: chosen === question.correctOptionId,
      earned
    })
  })
  return {
    score: Math.round(score * 100) / 100,
    passed: score >= toNumber(exam.passMarks),
    details
  }
}

function studentQuestions(exam, questionIds) {
  return (questionIds || [])
    .map((id) => {
      const question = (exam.questions || []).find((item) => item.id === id)
      if (!question) return null
      return {
        id: question.id,
        text: question.text,
        options: question.options,
        marks: question.marks,
        category: question.category || ''
      }
    })
    .filter(Boolean)
}

function seedDemoExams() {
  if (local.get(SEED_KEY)) return
  const examId = uid()
  const questions = [
    {
      id: uid(),
      text: 'Which chart is best for showing parts of a whole?',
      options: [
        { id: 'a', text: 'Line chart' },
        { id: 'b', text: 'Pie chart' },
        { id: 'c', text: 'Scatter plot' },
        { id: 'd', text: 'Histogram' }
      ],
      correctOptionId: 'b',
      explanation: 'Pie charts compare parts of a whole.',
      marks: 1,
      category: 'Visualization'
    },
    {
      id: uid(),
      text: 'What does a primary key uniquely identify?',
      options: [
        { id: 'a', text: 'A database server' },
        { id: 'b', text: 'A column data type' },
        { id: 'c', text: 'A row in a table' },
        { id: 'd', text: 'A backup file' }
      ],
      correctOptionId: 'c',
      explanation: 'A primary key uniquely identifies each row.',
      marks: 1,
      category: 'Databases'
    },
    {
      id: uid(),
      text: 'Which value is a measure of central tendency?',
      options: [
        { id: 'a', text: 'Mean' },
        { id: 'b', text: 'Variance' },
        { id: 'c', text: 'Range' },
        { id: 'd', text: 'Outlier count' }
      ],
      correctOptionId: 'a',
      explanation: 'Mean, median and mode are measures of central tendency.',
      marks: 1,
      category: 'Statistics'
    },
    {
      id: uid(),
      text: 'In ETL, the Load step typically writes data to:',
      options: [
        { id: 'a', text: 'A source CSV only' },
        { id: 'b', text: 'A destination system or warehouse' },
        { id: 'c', text: 'A browser cookie' },
        { id: 'd', text: 'A DNS record' }
      ],
      correctOptionId: 'b',
      explanation: 'Load writes transformed data to the target system.',
      marks: 1,
      category: 'Data'
    },
    {
      id: uid(),
      text: 'Which SQL keyword sorts result rows?',
      options: [
        { id: 'a', text: 'WHERE' },
        { id: 'b', text: 'JOIN' },
        { id: 'c', text: 'ORDER BY' },
        { id: 'd', text: 'HAVING' }
      ],
      correctOptionId: 'c',
      explanation: 'ORDER BY sorts the result set.',
      marks: 1,
      category: 'SQL'
    }
  ]
  local.set(EXAMS_KEY, [
    {
      id: examId,
      title: 'Advanced Data Analytics Assessment',
      description: 'MCQ examination required to qualify for the course certificate.',
      courseTitle: 'Advanced Data Analytics',
      totalMarks: 5,
      marksPerQuestion: 1,
      passMarks: 3,
      durationMinutes: 15,
      negativeMarking: false,
      negativeMarks: 0.25,
      questionsToDisplay: 5,
      randomize: true,
      active: true,
      questions,
      createdAt: new Date().toISOString()
    }
  ])
  local.set(INVITES_KEY, [])
  local.set(ATTEMPTS_KEY, [])
  local.set(SEED_KEY, true)
}

function rowToExam(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    courseTitle: row.course_title,
    totalMarks: toNumber(row.total_marks),
    marksPerQuestion: toNumber(row.marks_per_question, 1),
    passMarks: toNumber(row.pass_marks),
    durationMinutes: toNumber(row.duration_minutes, 30),
    negativeMarking: Boolean(row.negative_marking),
    negativeMarks: toNumber(row.negative_marks),
    questionsToDisplay: toNumber(row.questions_to_display),
    randomize: row.randomize !== false,
    active: row.active !== false,
    questions: Array.isArray(row.questions) ? row.questions : [],
    createdAt: row.created_at
  }
}

function examToRow(exam) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description || '',
    course_title: exam.courseTitle,
    total_marks: toNumber(exam.totalMarks),
    marks_per_question: toNumber(exam.marksPerQuestion, 1),
    pass_marks: toNumber(exam.passMarks),
    duration_minutes: toNumber(exam.durationMinutes, 30),
    negative_marking: Boolean(exam.negativeMarking),
    negative_marks: toNumber(exam.negativeMarks),
    questions_to_display: toNumber(exam.questionsToDisplay),
    randomize: exam.randomize !== false,
    active: exam.active !== false,
    questions: exam.questions || [],
    created_at: exam.createdAt || new Date().toISOString()
  }
}

function rowToInvitation(row) {
  return {
    id: row.id,
    examId: row.exam_id,
    studentName: row.student_name,
    studentEmail: row.student_email || '',
    tokenHash: row.token_hash,
    status: row.status,
    createdAt: row.created_at,
    usedAt: row.used_at || null
  }
}

function rowToAttempt(row) {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    examId: row.exam_id,
    studentName: row.student_name,
    studentEmail: row.student_email || '',
    status: row.status,
    questionIds: row.question_ids || [],
    answers: row.answers || {},
    score: row.score,
    passed: row.passed,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    submittedAt: row.submitted_at,
    remainingSeconds: row.remaining_seconds,
    voidReason: row.void_reason || '',
    certificateSent: Boolean(row.certificate_sent),
    certificateId: row.certificate_id || ''
  }
}

async function demoExams() {
  seedDemoExams()
  return local.get(EXAMS_KEY, [])
}

async function demoInvitations() {
  seedDemoExams()
  return local.get(INVITES_KEY, [])
}

async function demoAttempts() {
  seedDemoExams()
  return local.get(ATTEMPTS_KEY, [])
}

export async function listExaminations() {
  if (isSupabaseConfigured) {
    const [{ data: exams, error: examError }, { data: invitations, error: invError }, { data: attempts, error: attError }] =
      await Promise.all([
        supabase.from('examinations').select('*').order('created_at', { ascending: false }),
        supabase.from('exam_invitations').select('id, exam_id, status'),
        supabase.from('exam_attempts').select('id, exam_id, passed, status')
      ])
    if (examError) throw examError
    if (invError) throw invError
    if (attError) throw attError
    return (exams || []).map((row) => {
      const exam = rowToExam(row)
      const examInvites = (invitations || []).filter((item) => item.exam_id === exam.id)
      const examAttempts = (attempts || []).filter((item) => item.exam_id === exam.id)
      return {
        ...exam,
        questionCount: exam.questions.length,
        invitationCount: examInvites.length,
        attemptCount: examAttempts.length,
        passCount: examAttempts.filter((item) => item.passed).length
      }
    })
  }
  const exams = await demoExams()
  const invitations = await demoInvitations()
  const attempts = await demoAttempts()
  return exams
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((exam) => ({
      ...exam,
      questionCount: exam.questions?.length || 0,
      invitationCount: invitations.filter((item) => item.examId === exam.id).length,
      attemptCount: attempts.filter((item) => item.examId === exam.id).length,
      passCount: attempts.filter((item) => item.examId === exam.id && item.passed).length
    }))
}

export async function getExamination(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('examinations').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? rowToExam(data) : null
  }
  return (await demoExams()).find((exam) => exam.id === id) || null
}

export async function saveExamination(exam) {
  const record = {
    ...exam,
    id: exam.id || uid(),
    title: String(exam.title || '').trim(),
    description: String(exam.description || '').trim(),
    courseTitle: String(exam.courseTitle || '').trim(),
    questions: (exam.questions || []).map((question) => sanitizeQuestion(question, toNumber(exam.marksPerQuestion, 1))),
    createdAt: exam.createdAt || new Date().toISOString()
  }
  const errors = validateExam(record)
  if (errors.length) throw new Error(errors[0])
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('examinations').upsert(examToRow(record), { onConflict: 'id' }).select().single()
    if (error) throw error
    return rowToExam(data)
  }
  const all = await demoExams()
  const index = all.findIndex((item) => item.id === record.id)
  if (index >= 0) all[index] = record
  else all.unshift(record)
  local.set(EXAMS_KEY, all)
  return record
}

export async function deleteExamination(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('examinations').delete().eq('id', id)
    if (error) throw error
    return
  }
  local.set(
    EXAMS_KEY,
    (await demoExams()).filter((exam) => exam.id !== id)
  )
  local.set(
    INVITES_KEY,
    (await demoInvitations()).filter((item) => item.examId !== id)
  )
  local.set(
    ATTEMPTS_KEY,
    (await demoAttempts()).filter((item) => item.examId !== id)
  )
}

export async function listInvitations(examId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('exam_invitations')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(rowToInvitation)
  }
  return (await demoInvitations())
    .filter((item) => item.examId === examId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function createInvitation(examId, student) {
  const studentName = String(student?.studentName || student?.name || '').trim()
  const studentEmail = String(student?.studentEmail || student?.email || '').trim()
  if (!studentName) throw new Error('Student name is required.')
  const token = makeExamToken()
  const tokenHash = await hashToken(token)
  const record = {
    id: uid(),
    examId,
    studentName,
    studentEmail,
    tokenHash,
    status: 'unused',
    createdAt: new Date().toISOString(),
    usedAt: null
  }
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('exam_invitations')
      .insert({
        id: record.id,
        exam_id: examId,
        student_name: studentName,
        student_email: studentEmail,
        token_hash: tokenHash,
        status: 'unused'
      })
      .select()
      .single()
    if (error) throw error
    return { invitation: rowToInvitation(data), token, url: examInviteUrl(token) }
  }
  const all = await demoInvitations()
  all.unshift(record)
  local.set(INVITES_KEY, all)
  return { invitation: record, token, url: examInviteUrl(token) }
}

export async function revokeInvitation(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('exam_invitations').update({ status: 'revoked' }).eq('id', id).eq('status', 'unused')
    if (error) throw error
    return
  }
  const all = await demoInvitations()
  const next = all.map((item) => (item.id === id && item.status === 'unused' ? { ...item, status: 'revoked' } : item))
  local.set(INVITES_KEY, next)
}

export async function listAttempts(examId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', examId)
      .order('started_at', { ascending: false })
    if (error) throw error
    return (data || []).map(rowToAttempt)
  }
  return (await demoAttempts())
    .filter((item) => item.examId === examId)
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
}

export async function markAttemptCertificateSent(attemptId, certificateId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .update({ certificate_sent: true, certificate_id: certificateId || '' })
      .eq('id', attemptId)
      .select()
      .single()
    if (error) throw error
    return rowToAttempt(data)
  }
  const all = await demoAttempts()
  const next = all.map((item) =>
    item.id === attemptId ? { ...item, certificateSent: true, certificateId: certificateId || item.certificateId || '' } : item
  )
  local.set(ATTEMPTS_KEY, next)
  return next.find((item) => item.id === attemptId)
}

function unwrapRpc(data) {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return data
}

function findInvitationByHash(invitations, hash) {
  return invitations.find((item) => item.tokenHash === hash) || null
}

export async function peekExamInvitation(token) {
  if (!token) return { ok: false, error: 'invalid' }
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('peek_exam_invitation', { p_token: token })
    if (error) throw error
    return unwrapRpc(data) || { ok: false, error: 'invalid' }
  }
  const hash = await hashToken(token)
  const invitations = await demoInvitations()
  const invitation = findInvitationByHash(invitations, hash)
  if (!invitation) return { ok: false, error: 'invalid' }
  const exam = (await demoExams()).find((item) => item.id === invitation.examId)
  const attempt = (await demoAttempts()).find((item) => item.invitationId === invitation.id)
  return {
    ok: true,
    status: invitation.status,
    studentName: invitation.studentName,
    studentEmail: invitation.studentEmail,
    exam: publicExamMeta(exam),
    attemptStatus: attempt?.status || null
  }
}

export async function startExamAttempt(token) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('start_exam_attempt', { p_token: token })
    if (error) throw error
    const payload = unwrapRpc(data)
    if (!payload?.ok) throw new Error(payload?.error || 'This examination link is no longer available.')
    return payload
  }
  const hash = await hashToken(token)
  const invitations = await demoInvitations()
  const invitation = findInvitationByHash(invitations, hash)
  if (!invitation) throw new Error('This examination link is invalid.')
  if (invitation.status !== 'unused') throw new Error('This examination link is no longer available.')
  const exams = await demoExams()
  const exam = exams.find((item) => item.id === invitation.examId)
  if (!exam || exam.active === false) throw new Error('This examination is not available.')
  if (!exam.questions?.length) throw new Error('This examination has no questions yet.')

  let questionIds = exam.questions.map((question) => question.id)
  if (exam.randomize) questionIds = shuffle(questionIds)
  const limit = exam.questionsToDisplay > 0 ? Math.min(exam.questionsToDisplay, questionIds.length) : questionIds.length
  questionIds = questionIds.slice(0, limit)

  const startedAt = new Date()
  const attempt = {
    id: uid(),
    invitationId: invitation.id,
    examId: exam.id,
    studentName: invitation.studentName,
    studentEmail: invitation.studentEmail,
    status: 'in_progress',
    questionIds,
    answers: {},
    score: null,
    passed: null,
    startedAt: startedAt.toISOString(),
    endsAt: new Date(startedAt.getTime() + toNumber(exam.durationMinutes, 30) * 60 * 1000).toISOString(),
    submittedAt: null,
    remainingSeconds: toNumber(exam.durationMinutes, 30) * 60,
    voidReason: '',
    certificateSent: false,
    certificateId: ''
  }
  invitation.status = 'used'
  invitation.usedAt = attempt.startedAt
  local.set(INVITES_KEY, invitations)
  const attempts = await demoAttempts()
  attempts.unshift(attempt)
  local.set(ATTEMPTS_KEY, attempts)
  return {
    ok: true,
    attempt,
    exam: publicExamMeta(exam),
    questions: studentQuestions(exam, questionIds)
  }
}

export async function saveExamProgress(token, answers, remainingSeconds) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('save_exam_progress', {
      p_token: token,
      p_answers: answers || {},
      p_remaining: remainingSeconds ?? null
    })
    if (error) throw error
    const payload = unwrapRpc(data)
    if (!payload?.ok) throw new Error(payload?.error || 'Could not save progress.')
    return payload
  }
  const hash = await hashToken(token)
  const invitation = findInvitationByHash(await demoInvitations(), hash)
  if (!invitation) throw new Error('This examination link is invalid.')
  const attempts = await demoAttempts()
  const index = attempts.findIndex((item) => item.invitationId === invitation.id && item.status === 'in_progress')
  if (index < 0) throw new Error('No active examination attempt was found.')
  attempts[index] = {
    ...attempts[index],
    answers: answers || {},
    remainingSeconds: remainingSeconds ?? attempts[index].remainingSeconds
  }
  local.set(ATTEMPTS_KEY, attempts)
  return { ok: true }
}

export async function submitExamAttempt(token, answers) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('submit_exam_attempt', {
      p_token: token,
      p_answers: answers || {}
    })
    if (error) throw error
    const payload = unwrapRpc(data)
    if (!payload?.ok) throw new Error(payload?.error || 'Could not submit the examination.')
    return payload
  }
  const hash = await hashToken(token)
  const invitation = findInvitationByHash(await demoInvitations(), hash)
  if (!invitation) throw new Error('This examination link is invalid.')
  const attempts = await demoAttempts()
  const index = attempts.findIndex((item) => item.invitationId === invitation.id)
  if (index < 0) throw new Error('No examination attempt was found.')
  const attempt = attempts[index]
  if (attempt.status === 'submitted') {
    return { ok: true, already: true, score: attempt.score, passed: attempt.passed, totalMarks: null }
  }
  if (attempt.status !== 'in_progress') throw new Error('This examination can no longer be submitted.')
  const exam = (await demoExams()).find((item) => item.id === attempt.examId)
  const result = scoreAttempt(exam, attempt.questionIds, answers || {})
  attempts[index] = {
    ...attempt,
    answers: answers || {},
    status: 'submitted',
    score: result.score,
    passed: result.passed,
    submittedAt: new Date().toISOString(),
    remainingSeconds: 0
  }
  local.set(ATTEMPTS_KEY, attempts)
  return {
    ok: true,
    score: result.score,
    passed: result.passed,
    totalMarks: exam.totalMarks,
    passMarks: exam.passMarks
  }
}

export async function voidExamAttempt(token, reason) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('void_exam_attempt', {
      p_token: token,
      p_reason: reason || 'left-exam'
    })
    if (error) throw error
    return unwrapRpc(data) || { ok: true }
  }
  const hash = await hashToken(token)
  const invitation = findInvitationByHash(await demoInvitations(), hash)
  if (!invitation) return { ok: false, error: 'invalid' }
  const attempts = await demoAttempts()
  const index = attempts.findIndex((item) => item.invitationId === invitation.id && item.status === 'in_progress')
  if (index < 0) return { ok: true }
  attempts[index] = {
    ...attempts[index],
    status: 'voided',
    voidReason: reason || 'left-exam',
    submittedAt: new Date().toISOString()
  }
  local.set(ATTEMPTS_KEY, attempts)
  return { ok: true }
}

export function collectCourseOptions(certificates = [], extra = []) {
  const set = new Set()
  certificates.forEach((cert) => {
    if (cert.courseTitle) set.add(cert.courseTitle)
  })
  extra.forEach((value) => {
    if (value) set.add(value)
  })
  const cached = local.get('tutor-students-cache')
  cached?.students?.forEach((student) => {
    if (student.course) set.add(student.course)
  })
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function cachedStudents() {
  const cached = local.get('tutor-students-cache')
  return Array.isArray(cached?.students) ? cached.students : []
}

export function remainingSeconds(endsAt) {
  if (!endsAt) return 0
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return 0
  return Math.max(0, Math.floor((end - Date.now()) / 1000))
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
