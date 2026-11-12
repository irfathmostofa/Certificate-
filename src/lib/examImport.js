import Papa from 'papaparse'
import { uid } from './storage.js'

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function cleanKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return String(row[name]).trim()
    }
  }
  return ''
}

function normalizeHeaderRow(raw) {
  const mapped = {}
  Object.keys(raw || {}).forEach((key) => {
    mapped[cleanKey(key)] = raw[key]
  })
  return mapped
}

export const QUESTION_TEMPLATE_HEADERS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'correct',
  'explanation',
  'marks',
  'category'
]

export const QUESTION_TEMPLATE_SAMPLE = [
  [
    'Which SQL clause filters rows?',
    'SELECT',
    'WHERE',
    'GROUP BY',
    'ORDER BY',
    '',
    'B',
    'WHERE filters rows before grouping.',
    '1',
    'SQL'
  ],
  [
    'What does ETL stand for?',
    'Extract Transform Load',
    'Edit Transfer List',
    'Encode Transmit Log',
    'Export Table Link',
    '',
    'A',
    '',
    '1',
    'Data'
  ]
]

export function questionTemplateCsv() {
  const lines = [
    QUESTION_TEMPLATE_HEADERS.join(','),
    ...QUESTION_TEMPLATE_SAMPLE.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ]
  return `${lines.join('\n')}\n`
}

export async function downloadQuestionTemplate(kind = 'csv') {
  if (kind === 'xlsx') {
    const mod = await import('xlsx')
    const XLSX = mod.default || mod
    const sheet = XLSX.utils.aoa_to_sheet([QUESTION_TEMPLATE_HEADERS, ...QUESTION_TEMPLATE_SAMPLE])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Questions')
    XLSX.writeFile(book, 'exam-questions-template.xlsx')
    return
  }
  const blob = new Blob([questionTemplateCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'exam-questions-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function optionLetter(index) {
  return OPTION_KEYS[index] || String(index + 1)
}

function resolveCorrect(correctRaw, options) {
  const value = String(correctRaw || '').trim()
  if (!value) return { id: '', error: 'Correct answer is required.' }
  const compact = value.replace(/\s+/g, '')
  const asLetter = compact.toLowerCase()
  const letterIndex = OPTION_KEYS.indexOf(asLetter)
  if (letterIndex >= 0) {
    if (!options[letterIndex]) return { id: '', error: `Correct answer "${value}" does not match an option.` }
    return { id: options[letterIndex].id, error: '' }
  }
  const asNumber = Number(compact)
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return { id: options[asNumber - 1].id, error: '' }
  }
  const match = options.find((opt) => opt.text.toLowerCase() === value.toLowerCase())
  if (match) return { id: match.id, error: '' }
  return { id: '', error: `Correct answer "${value}" does not match an available option.` }
}

export function rowsToQuestions(rawRows) {
  const errors = []
  const valid = []
  const preview = []

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2
    const row = normalizeHeaderRow(raw)
    const text = pick(row, ['question', 'questiontext', 'q', 'prompt'])
    const explanation = pick(row, ['explanation', 'explain', 'rationale'])
    const category = pick(row, ['category', 'topic', 'section'])
    const marksRaw = pick(row, ['marks', 'mark', 'points', 'score'])
    const correctRaw = pick(row, ['correct', 'correctanswer', 'answer', 'rightanswer', 'correctoption'])

    const options = []
    OPTION_KEYS.forEach((letter, i) => {
      const value = pick(row, [
        `option${letter}`,
        `option${i + 1}`,
        letter,
        `choice${letter}`,
        `choice${i + 1}`
      ])
      if (value) options.push({ id: letter, text: value })
    })

    const rowErrors = []
    if (!text) rowErrors.push('Question text is required.')
    if (options.length < 4) rowErrors.push('Each question needs at least four options.')
    const uniqueOptions = new Set(options.map((opt) => opt.text.toLowerCase()))
    if (uniqueOptions.size !== options.length) rowErrors.push('Options must be unique.')

    let correctOptionId = ''
    if (options.length >= 4) {
      const resolved = resolveCorrect(correctRaw, options)
      correctOptionId = resolved.id
      if (resolved.error) rowErrors.push(resolved.error)
    } else if (!correctRaw) {
      rowErrors.push('Correct answer is required.')
    }

    let marks = marksRaw === '' ? null : Number(marksRaw)
    if (marksRaw !== '' && (!Number.isFinite(marks) || marks < 0)) {
      rowErrors.push('Marks must be a number 0 or greater.')
      marks = null
    }

    const question = {
      id: uid(),
      text,
      options,
      correctOptionId,
      explanation,
      marks,
      category
    }

    if (rowErrors.length) {
      rowErrors.forEach((message) => errors.push({ row: rowNumber, message }))
      preview.push({ ...question, row: rowNumber, ok: false, errors: rowErrors })
      return
    }
    valid.push(question)
    preview.push({ ...question, row: rowNumber, ok: true, errors: [] })
  })

  return { valid, errors, preview }
}

function parseCsvText(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => String(h || '').trim()
  })
  if (parsed.errors?.length) {
    const errors = parsed.errors.map((err) => ({
      row: (err.row || 0) + 1,
      message: err.message || 'Could not parse CSV row.'
    }))
    return { valid: [], errors, preview: [] }
  }
  return rowsToQuestions(parsed.data || [])
}

export async function parseQuestionFile(file) {
  if (!file) {
    return { valid: [], errors: [{ row: 0, message: 'No file selected.' }], preview: [] }
  }
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  const isCsv = name.endsWith('.csv') || name.endsWith('.txt') || type.includes('csv')
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('spreadsheet') || type.includes('excel')

  if (!isCsv && !isExcel) {
    return {
      valid: [],
      errors: [{ row: 0, message: 'Unsupported file format. Upload an .xlsx or .csv file.' }],
      preview: []
    }
  }

  if (isCsv) {
    return parseCsvText(await file.text())
  }

  try {
    const mod = await import('xlsx')
    const XLSX = mod.default || mod
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { valid: [], errors: [{ row: 0, message: 'The spreadsheet is empty.' }], preview: [] }
    }
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
    if (!rows.length) {
      return { valid: [], errors: [{ row: 0, message: 'No data rows found in the spreadsheet.' }], preview: [] }
    }
    return rowsToQuestions(rows)
  } catch (error) {
    return {
      valid: [],
      errors: [{ row: 0, message: error.message || 'Could not read the Excel file.' }],
      preview: []
    }
  }
}

export function optionLabel(index) {
  return optionLetter(index).toUpperCase()
}
