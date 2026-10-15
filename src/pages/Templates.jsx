import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import DesignEditor from '../components/DesignEditor.jsx'
import { Modal, EmptyState } from '../components/ui.jsx'
import { SAMPLE_CERT } from '../lib/certUtils.js'
import { blankDesign, CATEGORIES } from '../lib/templates.js'
import { IconPlus, IconEdit, IconTrash, IconSparkles } from '../components/icons.jsx'

function Swatches({ colors }) {
  return (
    <span className="tpl-swatch">
      {[colors.primary, colors.secondary, colors.accent, colors.background].map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  )
}

export default function Templates() {
  const { templates, settings, persistTemplate, removeTemplate } = useData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('All')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(
    () => (filter === 'All' ? templates : templates.filter((t) => t.category === filter)),
    [templates, filter]
  )

  const openNew = () => {
    setError('')
    setDraft({
      id: null,
      name: 'My Custom Template',
      category: 'Custom',
      description: '',
      design: blankDesign(),
      custom: true
    })
  }

  const openCustomize = (tpl) => {
    setError('')
    setDraft({
      id: tpl.custom ? tpl.id : null,
      name: tpl.custom ? tpl.name : `${tpl.name} (Custom)`,
      category: tpl.category,
      description: tpl.description,
      design: structuredClone(tpl.design),
      custom: true
    })
  }

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Please provide a template name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await persistTemplate({
        id: draft.id,
        name: draft.name.trim(),
        category: draft.category,
        description: draft.description,
        design: draft.design
      })
      setDraft(null)
    } catch (e) {
      setError(e.message || 'Could not save template.')
    } finally {
      setBusy(false)
    }
  }

  const del = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return
    await removeTemplate(tpl.id)
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button className="btn btn-gold" onClick={openNew}>
          <IconPlus /> New template
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<IconEdit width={40} height={40} />} title="No templates in this category">
          Create a new custom template to get started.
        </EmptyState>
      ) : (
        <div className="tpl-grid">
          {filtered.map((tpl) => (
            <div className="card tpl-card" key={tpl.id}>
              <div className="tpl-thumb">
                <CertificatePreview maxWidth={360}>
                  <Certificate
                    certificate={SAMPLE_CERT}
                    design={tpl.design}
                    organization={settings?.organization}
                    signature={settings?.signature}
                  />
                </CertificatePreview>
              </div>
              <div className="tpl-meta">
                <div className="row-between">
                  <h3>{tpl.name}</h3>
                  <span className={`badge ${tpl.custom ? 'green' : 'gold'}`}>
                    {tpl.custom ? 'Custom' : tpl.category}
                  </span>
                </div>
                <p className="muted small" style={{ margin: 0, flex: 1, minHeight: 34 }}>
                  {tpl.description || 'No description.'}
                </p>
                <div className="row-between" style={{ marginTop: 4 }}>
                  <Swatches colors={tpl.design.colors} />
                  <span className="hint">{tpl.design.border} · {tpl.design.watermark}</span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/generate?template=${encodeURIComponent(tpl.id)}`)}
                  >
                    <IconSparkles /> Use
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openCustomize(tpl)}>
                    <IconEdit /> Customize
                  </button>
                  {tpl.custom && (
                    <button
                      className="icon-btn"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => del(tpl)}
                      title="Delete template"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <Modal
          size="lg"
          title={draft.id ? 'Edit template' : 'Create custom template'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save template'}
              </button>
            </>
          }
        >
          {error && <div className="alert error">{error}</div>}
          <div className="editor-layout">
            <div>
              <div className="field">
                <label>Template name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Category</label>
                  <select
                    className="select"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    {['Custom', ...CATEGORIES].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  className="input"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Short note about this template"
                />
              </div>
              <DesignEditor value={draft.design} onChange={(design) => setDraft({ ...draft, design })} />
            </div>
            <div className="preview-panel">
              <div className="hint" style={{ marginBottom: 8, fontWeight: 600 }}>
                LIVE PREVIEW
              </div>
              <div className="preview-frame">
                <CertificatePreview maxWidth={520}>
                  <Certificate
                    certificate={SAMPLE_CERT}
                    design={draft.design}
                    organization={settings?.organization}
                    signature={settings?.signature}
                  />
                </CertificatePreview>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
