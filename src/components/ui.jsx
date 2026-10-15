import { useEffect, useState } from 'react'
import { IconClose, IconCopy, IconEye, IconCheck } from './icons.jsx'

export function Spinner() {
  return <div className="spinner" />
}

export function CenterLoader({ label = 'Loading...' }) {
  return (
    <div className="center-box" style={{ flexDirection: 'column', gap: 12 }}>
      <Spinner />
      <div className="muted small">{label}</div>
    </div>
  )
}

export function EmptyState({ icon, title, children }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${size}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ShareLink({ url, label = 'Public link', compact = false }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (!url) return null

  return (
    <div>
      {label && (
        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div className="share-row">
        <input className="input share-input" value={url} readOnly onFocus={(e) => e.target.select()} />
        <button className="btn btn-ghost btn-sm" onClick={copy} type="button">
          {copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />}
          {compact ? '' : copied ? 'Copied' : 'Copy'}
        </button>
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer" type="button">
          <IconEye width={15} height={15} />
          {compact ? '' : 'Open'}
        </a>
      </div>
    </div>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-input">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
