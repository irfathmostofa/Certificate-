import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { Modal } from './ui.jsx'
import { CATEGORIES } from '../lib/templates.js'
import { IconPlus, IconCheck } from './icons.jsx'

/* Persists the current design as a reusable custom template. Used wherever a
   design can be customized (Generate, Settings) so the saved template becomes
   selectable in every template picker, including bulk generation. */
export default function SaveTemplateButton({
  design,
  defaultName = '',
  onSaved,
  className = 'btn btn-ghost btn-sm',
  label = 'Save as template'
}) {
  const { persistTemplate } = useData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [category, setCategory] = useState('Custom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = () => {
    setError('')
    setName(defaultName || 'My Custom Template')
    setCategory('Custom')
    setOpen(true)
  }

  const save = async () => {
    if (!name.trim()) {
      setError('Please provide a template name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await persistTemplate({
        name: name.trim(),
        category,
        description: 'Saved from the design editor',
        design: structuredClone(design)
      })
      setOpen(false)
      onSaved?.(saved)
    } catch (e) {
      setError(e.message || 'Could not save template.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={!design}>
        <IconPlus width={15} height={15} /> {label}
      </button>

      {open && (
        <Modal
          title="Save design as template"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                <IconCheck /> {busy ? 'Saving…' : 'Save template'}
              </button>
            </>
          }
        >
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Template name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Science 2026"
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {['Custom', ...CATEGORIES].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            The template appears in the design template list on Generate and Bulk Generate.
          </p>
        </Modal>
      )}
    </>
  )
}
