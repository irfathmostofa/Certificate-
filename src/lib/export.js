import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const CERT_W = 1000
const CERT_H = 707

async function ready() {
  try {
    if (document.fonts?.ready) await document.fonts.ready
  } catch {
    /* ignore */
  }
}

export async function captureCanvas(node, scale = 2) {
  if (!node) throw new Error('Nothing to capture.')
  await ready()
  return html2canvas(node, {
    scale,
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: CERT_W,
    height: CERT_H,
    windowWidth: CERT_W,
    windowHeight: CERT_H
  })
}

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function safeName(str = 'certificate') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'certificate'
}

export async function exportPNG(node, filename = 'certificate') {
  const canvas = await captureCanvas(node, 2)
  triggerDownload(canvas.toDataURL('image/png'), `${safeName(filename)}.png`)
}

export async function exportJPEG(node, filename = 'certificate') {
  const canvas = await captureCanvas(node, 2)
  triggerDownload(canvas.toDataURL('image/jpeg', 0.95), `${safeName(filename)}.jpg`)
}

export async function exportPDF(node, filename = 'certificate') {
  const canvas = await captureCanvas(node, 2)
  const img = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  pdf.addImage(img, 'JPEG', 0, 0, w, h)
  pdf.save(`${safeName(filename)}.pdf`)
}

export async function exportManyPDF(nodes, filename = 'certificates', onProgress) {
  const list = Array.from(nodes).filter(Boolean)
  if (!list.length) throw new Error('No certificates to export.')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < list.length; i++) {
    const canvas = await captureCanvas(list[i], 2)
    const img = canvas.toDataURL('image/jpeg', 0.95)
    if (i > 0) pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, 0, w, h)
    onProgress?.(i + 1, list.length)
  }
  pdf.save(`${safeName(filename)}.pdf`)
}
