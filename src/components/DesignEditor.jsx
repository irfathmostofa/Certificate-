import { useState } from 'react'
import {
  FONT_OPTIONS,
  BORDER_OPTIONS,
  WATERMARK_OPTIONS,
  LAYOUT_OPTIONS,
  LOGO_POSITION_OPTIONS,
  HEADER_ALIGN_OPTIONS,
  SIZE_FIELDS,
  DEFAULT_SIZES,
  resolveSizes
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
  orgname: 'Organization name',
  logo: 'Organization logo',
  none: 'None'
}

export default function DesignEditor({ value, onChange }) {
  const [tab, setTab] = useState('layout')
  const d = value

  const patch = (p) => onChange({ ...d, ...p })
  const patchColor = (key, v) => onChange({ ...d, colors: { ...d.colors, [key]: v } })
  const patchFont = (key, v) => onChange({ ...d, fonts: { ...d.fonts, [key]: v } })
  const patchSize = (key, v) => onChange({ ...d, sizes: { ...resolveSizes(d), [key]: Number(v) } })

  const sizes = resolveSizes(d)

  const RangeField = ({ label, value, min, max, step = 1, suffix = 'px', onChange }) => (
    <div className="field">
      <label>
        {label}
      </label>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          className="input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 84 }}
        />
        <span className="hint" style={{ minWidth: 18 }}>
          {suffix}
        </span>
      </div>
    </div>
  )

  return (
    <div>
      <div className="tabs">
        {[
          ['layout', 'Layout'],
          ['colors', 'Colors'],
          ['type', 'Typography'],
          ['sizes', 'Sizes'],
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
          <label className="row" style={{ gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={d.showSeal !== false}
              onChange={(e) => patch({ showSeal: e.target.checked })}
            />
            <span className="small" style={{ fontWeight: 600 }}>
              Show authorized seal badge
            </span>
          </label>
          <label className="row" style={{ gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={d.showLogo !== false}
              onChange={(e) => patch({ showLogo: e.target.checked })}
            />
            <span className="small" style={{ fontWeight: 600 }}>
              Show logo / avatar
            </span>
          </label>
          {d.showLogo !== false && (
            <div className="field">
              <label>Logo placement</label>
              <select
                className="select"
                value={d.logoPosition || 'left'}
                onChange={(e) => patch({ logoPosition: e.target.value })}
              >
                {LOGO_POSITION_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Header alignment</label>
            <select
              className="select"
              value={d.headerAlign || 'center'}
              onChange={(e) => patch({ headerAlign: e.target.value })}
            >
              {HEADER_ALIGN_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
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

      {tab === 'sizes' && (
        <>
          {SIZE_FIELDS.map((f) => (
            <RangeField
              key={f.key}
              label={f.label}
              value={sizes[f.key]}
              min={f.min}
              max={f.max}
              onChange={(v) => patchSize(f.key, v)}
            />
          ))}
          <RangeField
            label="Watermark size"
            value={sizes.watermark}
            min={25}
            max={200}
            suffix="%"
            onChange={(v) => patchSize('watermark', v)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => patch({ sizes: { ...DEFAULT_SIZES } })}
          >
            Reset sizes to default
          </button>
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
              {(d.watermark === 'text' || d.watermark === 'orgname') && (
                <div className="field">
                  <label>{d.watermark === 'orgname' ? 'Watermark text (defaults to organization name)' : 'Watermark text'}</label>
                  <input
                    className="input"
                    value={d.watermarkText || ''}
                    onChange={(e) => patch({ watermarkText: e.target.value })}
                    placeholder={d.watermark === 'orgname' ? 'Organization name' : 'CERTIFIED'}
                  />
                </div>
              )}
              {d.watermark === 'logo' && (
                <p className="hint" style={{ marginTop: -2 }}>
                  Uses the logo uploaded in Organization settings. Falls back to the organization name
                  when no logo is set.
                </p>
              )}
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
              <div className="field">
                <label>Watermark rotation: {d.watermarkRotation ?? 0}°</label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={d.watermarkRotation ?? 0}
                  onChange={(e) => patch({ watermarkRotation: Number(e.target.value) })}
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
