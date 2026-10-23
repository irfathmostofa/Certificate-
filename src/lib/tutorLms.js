/* ------------------------------------------------------------------ */
/* WordPress / Tutor LMS student API integration                       */
/*                                                                     */
/* Endpoint: {domain}/wp-json/custom-tutor/v1/enrolled-students        */
/* Auth:     HTTP Basic (WordPress username + Application Password)    */
/* Shape:                                                              */
/*   { "success": true,                                               */
/*     "data": [ { enrollment_id, user_id, name, email,              */
/*                course: { id, name }, date, status } ],            */
/*     "pagination": { total, page, per_page, total_pages } }         */
/*                                                                     */
/* The admin only supplies the site domain and their WordPress admin   */
/* credentials — everything else has sensible defaults.                */
/* ------------------------------------------------------------------ */

import { local } from './storage.js'

export const DEFAULT_ENDPOINT_PATH = 'custom-tutor/v1/enrolled-students'

export const DEFAULT_INTEGRATION = {
  enabled: false,
  baseUrl: '',
  studentsPath: DEFAULT_ENDPOINT_PATH,
  perPage: 100,
  courseId: '',
  authType: 'basic', // basic | bearer | header | none
  username: '',
  appPassword: '',
  token: '',
  headerName: '',
  headerValue: '',
  jsonPath: ''
}

/* A student as normalized by this module. */
export function emptyStudent() {
  return {
    id: '',
    name: '',
    email: '',
    course: '',
    courseId: '',
    status: '',
    completedAt: '',
    enrollmentId: '',
    raw: null
  }
}

export function normalizeBaseUrl(input) {
  if (!input) return ''
  let url = String(input).trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}

/* Build the enrolled-students URL for a given page. Accepts a bare
   domain (teklabd.com), a URL with /wp-json, or the full endpoint. */
export function buildStudentsUrl(cfg = {}, page) {
  const raw = normalizeBaseUrl(cfg.baseUrl)
  if (!raw) throw new Error('WordPress site URL is required.')

  const path = String(cfg.studentsPath || DEFAULT_ENDPOINT_PATH).replace(/^\/+/, '')
  const wpJsonIdx = raw.toLowerCase().indexOf('/wp-json')

  let endpoint
  if (wpJsonIdx >= 0) {
    const root = raw.slice(0, wpJsonIdx + '/wp-json'.length)
    const after = raw.slice(root.length).replace(/^\/+/, '')
    endpoint = after === path ? raw : `${root}/${path}`
  } else {
    endpoint = `${raw}/wp-json/${path}`
  }

  const url = new URL(endpoint)
  if (cfg.perPage) url.searchParams.set('per_page', String(cfg.perPage))
  if (page) url.searchParams.set('page', String(page))
  if (cfg.courseId) url.searchParams.set('course_id', String(cfg.courseId))
  return url.toString()
}

const STUDENTS_CACHE_KEY = 'tutor-students-cache'

function cacheKeyFor(cfg = {}) {
  return [
    normalizeBaseUrl(cfg.baseUrl),
    String(cfg.studentsPath || DEFAULT_ENDPOINT_PATH),
    String(cfg.courseId || ''),
    String(cfg.perPage || '')
  ].join('|')
}

export function readCachedStudents(cfg = {}) {
  const stored = local.get(STUDENTS_CACHE_KEY)
  if (!stored || stored.key !== cacheKeyFor(cfg) || !Array.isArray(stored.students)) return null
  return stored
}

export function writeCachedStudents(cfg = {}, payload) {
  local.set(STUDENTS_CACHE_KEY, {
    key: cacheKeyFor(cfg),
    students: payload.students || [],
    total: payload.total ?? (payload.students || []).length,
    pages: payload.pages || 1,
    url: payload.url || '',
    fetchedAt: payload.fetchedAt || new Date().toISOString()
  })
}

export function formatFetchedAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

/* Base64 that survives non-Latin usernames / passwords. */
function toBase64(value) {
  const bytes = new TextEncoder().encode(String(value))
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export function buildHeaders(cfg = {}) {
  const headers = { Accept: 'application/json' }
  const type = cfg.authType || 'none'

  if (type === 'basic') {
    const user = String(cfg.username || '').trim()
    const pass = String(cfg.appPassword || '')
    if (user) headers.Authorization = `Basic ${toBase64(`${user}:${pass}`)}`
  } else if (type === 'bearer') {
    const token = String(cfg.token || '').trim()
    if (token) headers.Authorization = `Bearer ${token}`
  } else if (type === 'header') {
    const name = String(cfg.headerName || '').trim()
    if (name) headers[name] = String(cfg.headerValue || '')
  }

  if (headers.Authorization) {
    headers['X-Authorization'] = headers.Authorization
  }

  return headers
}

function getByPath(obj, path) {
  if (!path) return undefined
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

const WRAPPER_KEYS = ['data', 'students', 'results', 'items', 'users', 'enrollments', 'records']

/* Find the first array of records we can use, honouring an explicit path. */
export function extractStudentArray(json, jsonPath) {
  if (json == null) return []

  if (jsonPath) {
    const value = getByPath(json, jsonPath)
    if (Array.isArray(value)) return value
  }

  if (Array.isArray(json)) return json

  for (const key of WRAPPER_KEYS) {
    const value = json[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      for (const nested of WRAPPER_KEYS) {
        if (Array.isArray(value[nested])) return value[nested]
      }
    }
  }

  return []
}

function pickValue(source, keys) {
  for (const key of keys) {
    const value = key.includes('.') ? getByPath(source, key) : source[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

/* Map a Tutor LMS enrollment record to our student shape. */
export function normalizeStudent(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {}

  const first = pickValue(safe, ['first_name', 'firstName', 'user.first_name', 'name.first'])
  const last = pickValue(safe, ['last_name', 'lastName', 'user.last_name', 'name.last'])
  const display = pickValue(safe, [
    'name',
    'display_name',
    'displayName',
    'student_name',
    'full_name',
    'fullname',
    'user.display_name',
    'user.name',
    'username'
  ])

  const combined = [first, last].filter(Boolean).join(' ').trim()
  const name = String(display || combined || '').trim()

  const email = pickValue(safe, ['email', 'user_email', 'user.email', 'student_email', 'mail'])
  const course = pickValue(safe, [
    'course.name',
    'course_title',
    'course_name',
    'course',
    'program',
    'enrolled_course',
    'course.title'
  ])
  const courseId = pickValue(safe, ['course.id', 'course_id', 'courseId'])
  const status = pickValue(safe, [
    'status',
    'completion',
    'completion_status',
    'course_completion',
    'progress',
    'completed'
  ])
  const completedAt = pickValue(safe, [
    'date',
    'completion_date',
    'completed_at',
    'completed_date',
    'course_completed_at'
  ])
  const enrollmentId = pickValue(safe, ['enrollment_id', 'enrolment_id', 'id'])
  const userId = pickValue(safe, ['user_id', 'ID', 'user.id'])
  const id = pickValue(safe, ['enrollment_id', 'enrolment_id', 'id', 'user_id', 'user.id'])
    || email
    || name

  return {
    id: String(id || ''),
    name,
    email: String(email || '').trim(),
    course: String(course || '').trim(),
    courseId: courseId === '' ? '' : String(courseId),
    status: status === '' ? '' : String(status),
    completedAt: String(completedAt || '').trim(),
    enrollmentId: enrollmentId === '' ? '' : String(enrollmentId),
    userId: userId === '' ? '' : String(userId),
    raw: safe
  }
}

/* Best-effort check for whether a student has finished a course. */
export function isCompleted(student) {
  const value = student?.status
  if (value === '' || value == null) return false
  if (value === true) return true
  const text = String(value).toLowerCase()
  if (['1', 'true', 'yes', 'complete', 'completed', 'passed', 'finished', '100'].includes(text)) {
    return true
  }
  const num = Number(text.replace('%', ''))
  return !Number.isNaN(num) && num >= 100
}

/* Same-origin proxies. Never call WordPress from the browser on cPanel —
   that is a cross-origin request and is what triggers the CORS error. */
function proxyUrlsFor(url) {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
  const encoded = encodeURIComponent(url)
  return [
    `${origin}/api/wp-proxy?url=${encoded}`,
    `${origin}/api/wp-proxy.php?url=${encoded}`,
    `${origin}/wp-proxy.php?url=${encoded}`
  ]
}

function isJsonResponse(res) {
  const type = (res.headers.get('content-type') || '').toLowerCase()
  return type.includes('application/json')
}

async function requestJson(url, headers) {
  let res = null

  for (const target of proxyUrlsFor(url)) {
    try {
      const next = await fetch(target, { headers, credentials: 'omit' })
      if (!isJsonResponse(next)) continue
      res = next
      break
    } catch {
      /* try the next proxy */
    }
  }

  if (!res) {
    throw new Error(
      'WordPress proxy is missing on this host. Upload wp-proxy.php and .htaccess to the site root, then retry.'
    )
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Authentication failed (${res.status}). Check the WordPress username and Application Password.`
    )
  }
  if (res.status === 404) {
    throw new Error(
      'Endpoint not found (404). Verify the domain and that the Custom Tutor endpoint is active.'
    )
  }
  if (!res.ok) {
    throw new Error(`WordPress API returned ${res.status} ${res.statusText || ''}`.trim() + '.')
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('The API did not return valid JSON. Check the endpoint URL.')
  }

  if (json && json.success === false) {
    throw new Error(json.message || 'The API reported an error.')
  }

  return json
}

const MAX_PAGES = 100

/* Fetch every page and return the combined, de-duplicated student list. */
export async function fetchTutorStudents(cfg = {}) {
  const headers = buildHeaders(cfg)
  const perPage = Number(cfg.perPage) || 100
  const seen = new Set()
  const students = []
  let total = null
  let totalPages = 1
  let firstUrl = ''
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = buildStudentsUrl(cfg, page)
    if (page === 1) firstUrl = url

    const json = await requestJson(url, headers)
    const array = extractStudentArray(json, cfg.jsonPath)

    for (const item of array) {
      const student = normalizeStudent(item)
      if (!student.name && !student.email) continue
      if (student.id && seen.has(student.id)) continue
      if (student.id) seen.add(student.id)
      students.push(student)
    }

    const pagination = json && json.pagination
    if (pagination && Number(pagination.total_pages) > 0) {
      totalPages = Number(pagination.total_pages)
      if (Number.isFinite(Number(pagination.total))) total = Number(pagination.total)
    } else {
      totalPages = array.length >= perPage ? page + 1 : page
    }

    hasMore = page < totalPages && page < MAX_PAGES && array.length > 0
    page += 1
  }

  return {
    students,
    total: total ?? students.length,
    pages: totalPages,
    url: firstUrl
  }
}
