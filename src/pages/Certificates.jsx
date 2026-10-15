import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import { Modal, EmptyState, ShareLink } from '../components/ui.jsx'
import { resolveDesign, resolveOrganization, resolveSignature, certFileName, buildPublicUrl, formatDate } from '../lib/certUtils.js'
import { exportPDF, exportPNG, exportJPEG } from '../lib/export.js'
import { IconSearch, IconTrash, IconDownload, IconEye, IconCertificate, IconLink, IconCheck } from '../components/icons.jsx'

export default function Certificates() {
  const { certificates, templates, settings, removeCertificate, loading } = useData()
  const [query, setQuery] = useState('')
  const [templateFilter, setTemplateFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [pending, setPending] = useState(null)
  const exportRef = useRef(null)
  const rowExportRef = useRef(null)

  // Render a single certificate off-screen on demand, then export it. This
  // keeps per-row downloads working for libraries of any size without having
  // to mount every certificate in the DOM at once.
  useEffect(() => {
    if (!pending) return
    let active = true
    const { cert, type } = pending
    const run = async () => {
      try {
        const node = rowExportRef.current
        if (!node) throw new Error('Renderer not ready.')
        const file = certFileName(cert)
        if (type === 'pdf') await exportPDF(node, file)
        else if (type === 'png') await exportPNG(node, file)
        else await exportJPEG(node, file)
      } catch {
        setSelected(cert)
      } finally {
        if (active) setPending(null)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [pending])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return certificates.filter((c) => {
      const matchQ =
        !q ||
        c.recipientName?.toLowerCase().includes(q) ||
        c.courseTitle?.toLowerCase().includes(q) ||
        c.certificateId?.toLowerCase().includes(q)
      const matchT = templateFilter === 'All' || c.templateId === templateFilter
      return matchQ && matchT
    })
  }, [certificates, query, templateFilter])

  const selectedDesign = selected ? resolveDesign(selected, templates, settings) : null

  const doExport = async (type) => {
    setExporting(type)
    try {
      const file = certFileName(selected)
      if (type === 'pdf') await exportPDF(exportRef.current, file)
      else if (type === 'png') await exportPNG(exportRef.current, file)
      else await exportJPEG(exportRef.current, file)
    } finally {
      setExporting('')
    }
  }

  const del = async (cert) => {
    if (!window.confirm(`Delete certificate for "${cert.recipientName}"?`)) return
    await removeCertificate(cert.id)
    if (selected?.id === cert.id) setSelected(null)
  }

  const templateNames = [...new Set(certificates.map((c) => c.templateId))]

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <IconSearch
              width={16}
              height={16}
              style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }}
            />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by name, course or certificate ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <select
          className="select"
          style={{ maxWidth: 220 }}
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
        >
          <option value="All">All templates</option>
          {templateNames.map((t) => {
            const tpl = templates.find((x) => x.id === t)
            return (
              <option key={t} value={t}>
                {tpl?.name || t}
              </option>
            )
          })}
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconCertificate width={42} height={42} />}
            title={loading ? 'Loading…' : 'No certificates found'}
          >
            {certificates.length === 0
              ? 'Generate a certificate to populate your library.'
              : 'Try a different search or filter.'}
          </EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 210 }}>Certificate</th>
                  <th>Recipient</th>
                  <th>Course</th>
                  <th>Template</th>
                  <th>Issued</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert) => {
                  const design = resolveDesign(cert, templates, settings)
                  return (
                    <tr key={cert.id}>
                      <td>
                        <div style={{ width: 200 }}>
                          <CertificatePreview maxWidth={200}>
                            <Certificate
                              certificate={cert}
                              design={design}
                              organization={resolveOrganization(cert, settings)}
                              signature={resolveSignature(cert, settings)}
                            />
                          </CertificatePreview>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{cert.recipientName}</div>
                        <div className="muted small">{cert.certificateId}</div>
                      </td>
                      <td className="muted">{cert.courseTitle}</td>
                      <td>
                        <span className="badge gold">{cert.templateId}</span>
                      </td>
                      <td className="muted small">{formatDate(cert.issueDate)}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="icon-btn" title="Preview" onClick={() => setSelected(cert)}>
                            <IconEye />
                          </button>
                          <button
                            className="icon-btn"
                            title="Copy public link"
                            onClick={async () => {
                              const url = buildPublicUrl(cert)
                              try {
                                await navigator.clipboard.writeText(url)
                              } catch {
                                /* clipboard unavailable */
                              }
                              setCopiedId(cert.id)
                              setTimeout(() => setCopiedId(null), 1600)
                            }}
                          >
                            {copiedId === cert.id ? <IconCheck /> : <IconLink />}
                          </button>
                          <button
                            className="icon-btn"
                            title="Download PDF"
                            disabled={!!pending}
                            onClick={() => setPending({ cert, type: 'pdf' })}
                          >
                            <IconDownload />
                          </button>
                          <button className="icon-btn" title="Delete" onClick={() => del(cert)}>
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal
          size="lg"
          title={`${selected.recipientName} — ${selected.courseTitle}`}
          onClose={() => setSelected(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => doExport('png')} disabled={!!exporting}>
                {exporting === 'png' ? '…' : 'PNG'}
              </button>
              <button className="btn btn-ghost" onClick={() => doExport('jpg')} disabled={!!exporting}>
                {exporting === 'jpg' ? '…' : 'JPEG'}
              </button>
              <button className="btn btn-primary" onClick={() => doExport('pdf')} disabled={!!exporting}>
                <IconDownload /> {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
              </button>
            </>
          }
        >
          <div className="preview-frame">
            <CertificatePreview>
              <Certificate
                certificate={selected}
                design={selectedDesign}
                organization={resolveOrganization(selected, settings)}
                signature={resolveSignature(selected, settings)}
              />
            </CertificatePreview>
          </div>
          <div className="row-between" style={{ marginTop: 14 }}>
            <span className="hint">Certificate ID: {selected.certificateId}</span>
            <span className="hint">Issued {formatDate(selected.issueDate)}</span>
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <ShareLink url={buildPublicUrl(selected)} label="Shareable public link" />
          </div>
        </Modal>
      )}

      {/* Off-screen surfaces used for high-resolution exports */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
        {pending && (
          <Certificate
            ref={rowExportRef}
            certificate={pending.cert}
            design={resolveDesign(pending.cert, templates, settings)}
            organization={resolveOrganization(pending.cert, settings)}
            signature={resolveSignature(pending.cert, settings)}
          />
        )}
        {selected && (
          <Certificate
            ref={exportRef}
            certificate={selected}
            design={selectedDesign}
            organization={resolveOrganization(selected, settings)}
            signature={resolveSignature(selected, settings)}
          />
        )}
      </div>
    </div>
  )
}
