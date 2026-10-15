import { useState } from 'react'
import {
  FONT_OPTIONS,
  BORDER_OPTIONS,
  WATERMARK_OPTIONS,
  LAYOUT_OPTIONS
} from '../lib/templates.js'
import { ColorField } from './ui.jsx'

const BORDER_LABELS = {
  ornate: 'Ornate flourish',
  double: 'Double line',
  minimal: 'Minimal single',
  geo: 'Geometric',
  ribbon: 'Ribbon bands'
}

const WATERMARK_LABELS = {
  seal: 'Guilloché seal',
  monogram: 'Monogram initials',
  text: 'Rotated text',
  none: 'None'
}

export default function DesignEditor({ value, onChange }) {
  const [tab, setTab] = useState('layout')
  const d = value

  const patch = (p) => onChange({ ...d, ...p })
  const patchColor = (key, v) => onChange({ ...d, colors: { ...d.colors, [key]: v } })
  const patchFont = (key, v) => onChange({ ...d, fonts: { ...d.fonts, [key]: v } })

  return (
    <div>
      <div className="tabs">
        {[
          ['layout', 'Layout'],
          ['colors', 'Colors'],
          ['type', 'Typography'],
          ['deco', 'Decoration']
        ].map(([k, label]) => (
          <div key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'layout' && (
        <>
          <div className="field">
            <label>Composition</label>
            <select className="select" value={d.layout} onChange={(e) => patch({ layout: e.target.value })}>
              {LAYOUT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Border style</label>
            <select className="select" value={d.border} onChange={(e) => patch({ border: e.target.value })}>
              {BORDER_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {BORDER_LABELS[b]}
                </option>
              ))}
            </select>
          </div>
          <label className="row" style={{ gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!d.strip}
              onChange={(e) => patch({ strip: e.target.checked })}
            />
            <span className="small" style={{ fontWeight: 600 }}>
              Show accent strip
            </span>
          </label>
          {d.strip && (
            <div className="field">
              <label>Strip position</label>
              <select
                className="select"
                value={d.stripPosition}
                onChange={(e) => patch({ stripPosition: e.target.value })}
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          )}
          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={d.showSeal !== false}
              onChange={(e) => patch({ showSeal: e.target.checked })}
            />
            <span className="small" style={{ fontWeight: 600 }}>
              Show authorized seal badge
            </span>
          </label>
        </>
      )}

      {tab === 'colors' && (
        <div className="grid grid-2" style={{ gap: 12 }}>
          <ColorField label="Primary" value={d.colors.primary} onChange={(v) => patchColor('primary', v)} />
          <ColorField label="Secondary" value={d.colors.secondary} onChange={(v) => patchColor('secondary', v)} />
          <ColorField label="Accent / gold" value={d.colors.accent} onChange={(v) => patchColor('accent', v)} />
          <ColorField label="Background" value={d.colors.background} onChange={(v) => patchColor('background', v)} />
          <ColorField label="Text" value={d.colors.text} onChange={(v) => patchColor('text', v)} />
        </div>
      )}

      {tab === 'type' && (
        <>
          <div className="field">
            <label>Heading font (org, course)</label>
            <select className="select" value={d.fonts.heading} onChange={(e) => patchFont('heading', e.target.value)}>
              {FONT_OPTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Recipient name font</label>
            <select className="select" value={d.fonts.name} onChange={(e) => patchFont('name', e.target.value)}>
              {FONT_OPTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Body font</label>
            <select className="select" value={d.fonts.body} onChange={(e) => patchFont('body', e.target.value)}>
              {FONT_OPTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {tab === 'deco' && (
        <>
          <div className="field">
            <label>Watermark</label>
            <select
              className="select"
              value={d.watermark}
              onChange={(e) => patch({ watermark: e.target.value })}
            >
              {WATERMARK_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {WATERMARK_LABELS[w]}
                </option>
              ))}
            </select>
          </div>
          {d.watermark !== 'none' && (
            <>
              <div className="field">
                <label>Watermark text</label>
                <input
                  className="input"
                  value={d.watermarkText || ''}
                  onChange={(e) => patch({ watermarkText: e.target.value })}
                  placeholder="CERTIFIED"
                />
              </div>
              <div className="field">
                <label>Watermark opacity: {Math.round((d.watermarkOpacity ?? 0.08) * 100)}%</label>
                <input
                  type="range"
                  min="0.02"
                  max="0.3"
                  step="0.01"
                  value={d.watermarkOpacity ?? 0.08}
                  onChange={(e) => patch({ watermarkOpacity: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
