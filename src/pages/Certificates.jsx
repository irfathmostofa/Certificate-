import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import Certificate from '../components/certificate/Certificate.jsx'
import CertificatePreview from '../components/certificate/CertificatePreview.jsx'
import { Modal, EmptyState, ShareLink } from '../components/ui.jsx'
import { resolveDesign, resolveOrganization, resolveSignature, certFileName, buildPublicUrl, formatDate } from '../lib/certUtils.js'
import { exportPDF, exportPNG, exportJPEG } from '../lib/export.js'
import { isEmailjsConfigured, isValidEmail, sendCertificateEmail } from '../lib/emailjs.js'
import { IconSearch, IconTrash, IconDownload, IconEye, IconCertificate, IconLink, IconCheck, IconMail } from '../components/icons.jsx'

export default function Certificates() {
  const { certificates, templates, settings, removeCertificate, loading } = useData()
  const [query, setQuery] = useState('')
  const [templateFilter, setTemplateFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [exporting, setExporting] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [pending, setPending] = useState(null)
  const [sendQueue, setSendQueue] = useState(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState(null)
  const [sendProgress, setSendProgress] = useState(null)
  const exportRef = useRef(null)
  const rowExportRef = useRef(null)
  const emailReady = isEmailjsConfigured(settings?.emailjs)

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
    setChecked((prev) => {
      const next = new Set(prev)
      next.delete(cert.id)
      return next
    })
    if (selected?.id === cert.id) setSelected(null)
  }

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () =>
    setChecked((prev) => {
      const next = new Set(prev)
      filtered.forEach((c) => next.add(c.id))
      return next
    })

  const clearChecked = () => setChecked(new Set())

  const checkedCerts = useMemo(
    () => certificates.filter((c) => checked.has(c.id)),
    [certificates, checked]
  )

  const allFilteredChecked = filtered.length > 0 && filtered.every((c) => checked.has(c.id))

  const resolveRecipientEmail = (cert) => {
    const own = String(cert?.recipientEmail || '').trim()
    if (isValidEmail(own)) return own
    const name = String(cert?.recipientName || '').trim().toLowerCase()
    if (!name) return own
    const match = certificates.find(
      (c) =>
        c.id !== cert?.id &&
        String(c.recipientName || '').trim().toLowerCase() === name &&
        isValidEmail(c.recipientEmail)
    )
    return match ? String(match.recipientEmail).trim() : own
  }

  const withAutoContact = (cert) => ({
    ...cert,
    recipientName: String(cert?.recipientName || '').trim(),
    recipientEmail: resolveRecipientEmail(cert)
  })

  const deleteSelected = async () => {
    if (!checkedCerts.length) return
    const label =
      checkedCerts.length === 1
        ? `Delete certificate for "${checkedCerts[0].recipientName}"?`
        : `Delete ${checkedCerts.length} selected certificates?`
    if (!window.confirm(label)) return
    const ids = checkedCerts.map((c) => c.id)
    for (const id of ids) {
      await removeCertificate(id)
    }
    if (selected && ids.includes(selected.id)) setSelected(null)
    clearChecked()
  }

  const openSend = (certs) => {
    const list = (Array.isArray(certs) ? certs : [certs]).map(withAutoContact)
    if (!list.length) return
    setSendQueue(list)
    setSendEmail(list.length === 1 ? list[0].recipientEmail || '' : '')
    setSendMsg(null)
    setSendProgress(null)
  }

  const closeSend = () => {
    if (sending) return
    setSendQueue(null)
    setSendProgress(null)
  }

  const sendToStudent = async () => {
    if (!sendQueue?.length) return
    setSending(true)
    setSendMsg(null)
    const jobs =
      sendQueue.length === 1
        ? [{ ...sendQueue[0], recipientEmail: sendEmail }]
        : sendQueue
    let sent = 0
    let skipped = 0
    const errors = []
    setSendProgress({ done: 0, total: jobs.length })
    try {
      for (let i = 0; i < jobs.length; i++) {
        const cert = jobs[i]
        const email = String(cert.recipientEmail || '').trim()
        if (!isValidEmail(email)) {
          skipped += 1
          setSendProgress({ done: i + 1, total: jobs.length })
          continue
        }
        try {
          await sendCertificateEmail({
            config: settings?.emailjs,
            certificate: { ...cert, recipientEmail: email },
            organization: resolveOrganization(cert, settings),
            publicUrl: buildPublicUrl(cert)
          })
          sent += 1
        } catch (e) {
          errors.push(`${cert.recipientName}: ${e.message || 'Failed'}`)
        }
        setSendProgress({ done: i + 1, total: jobs.length })
      }
      if (errors.length && !sent) {
        setSendMsg({ type: 'error', text: errors[0] })
      } else {
        const parts = []
        if (sent) parts.push(`Sent ${sent}`)
        if (skipped) parts.push(`skipped ${skipped} without a valid email`)
        if (errors.length) parts.push(`${errors.length} failed`)
        setSendMsg({
          type: errors.length ? 'error' : 'success',
          text: `${parts.join(', ')}.`
        })
        if (sent && sendQueue.length > 1) clearChecked()
      }
    } finally {
      setSending(false)
    }
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

      {checkedCerts.length > 0 && (
        <div className="card card-pad bulk-bar">
          <div className="muted" style={{ fontWeight: 600 }}>
            {checkedCerts.length} selected
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={clearChecked}>
              Clear
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openSend(checkedCerts)}
              title={emailReady ? 'Email selected certificates' : 'Configure EmailJS in Organization settings'}
            >
              <IconMail width={15} height={15} /> Send
            </button>
            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
              <IconTrash width={15} height={15} /> Delete
            </button>
          </div>
        </div>
      )}

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
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allFilteredChecked}
                      onChange={(e) => (e.target.checked ? selectAllFiltered() : clearChecked())}
                    />
                  </th>
                  <th style={{ width: 210 }}>Certificate</th>
                  <th>Recipient</th>
                  <th>Course</th>
                  <th>Template</th>
                  <th>Issued</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert) => {
                  const design = resolveDesign(cert, templates, settings)
                  const isChecked = checked.has(cert.id)
                  return (
                    <tr key={cert.id} className={isChecked ? 'row-selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${cert.recipientName}`}
                          checked={isChecked}
                          onChange={() => toggle(cert.id)}
                        />
                      </td>
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
                        <span className="badge gold">
                          {templates.find((x) => x.id === cert.templateId)?.name || cert.templateId}
                        </span>
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
                          <button
                            className="icon-btn"
                            title={emailReady ? 'Email certificate' : 'Configure EmailJS in Organization settings'}
                            onClick={() => openSend([cert])}
                          >
                            <IconMail />
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
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openSend([selected])}>
                <IconMail width={15} height={15} /> Email to student
              </button>
            </div>
          </div>
        </Modal>
      )}

      {sendQueue && (
        <Modal
          title={
            sendQueue.length === 1
              ? `Email certificate — ${sendQueue[0].recipientName}`
              : `Email ${sendQueue.length} certificates`
          }
          onClose={closeSend}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeSend} disabled={sending}>
                {sendMsg?.type === 'success' ? 'Close' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                onClick={sendToStudent}
                disabled={
                  sending ||
                  !emailReady ||
                  (sendQueue.length === 1 && !isValidEmail(sendEmail))
                }
              >
                <IconMail />{' '}
                {sending
                  ? sendProgress
                    ? `Sending ${sendProgress.done}/${sendProgress.total}…`
                    : 'Sending…'
                  : sendQueue.length === 1
                    ? 'Send certificate'
                    : `Send ${sendQueue.length}`}
              </button>
            </>
          }
        >
          {!emailReady && (
            <div className="alert info">
              EmailJS is not configured.{' '}
              <Link to="/settings">Open Organization settings</Link> and add your public key, service
              ID and template ID.
            </div>
          )}
          {sendMsg && <div className={`alert ${sendMsg.type}`}>{sendMsg.text}</div>}
          {sendQueue.length === 1 ? (
            <>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Student name</label>
                  <input className="input" value={sendQueue[0].recipientName} readOnly />
                </div>
                <div className="field">
                  <label>Student email</label>
                  <input
                    className="input"
                    type="email"
                    value={sendEmail}
                    readOnly={isValidEmail(sendQueue[0].recipientEmail)}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="student@example.com"
                  />
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 0 }}>
                Name and email are taken from the student record. Sends:{' '}
                <code>{buildPublicUrl(sendQueue[0])}</code>
              </p>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Each student is emailed the public certificate link. Recipients without a valid email
                are skipped.
              </p>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Email</th>
                      <th>Course</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendQueue.map((cert) => (
                      <tr key={cert.id}>
                        <td style={{ fontWeight: 600 }}>{cert.recipientName}</td>
                        <td className={isValidEmail(cert.recipientEmail) ? 'muted' : 'danger-text'}>
                          {cert.recipientEmail || 'Missing email'}
                        </td>
                        <td className="muted">{cert.courseTitle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
