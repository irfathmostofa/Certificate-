import QRCode from 'qrcode'

function qrModules(value) {
  const payload =
    value ||
    (typeof window !== 'undefined' ? `${window.location.origin}/view` : 'certificate')
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const parts = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(y, x)) parts.push(`M${x} ${y}h1v1h-1z`)
      }
    }
    return { n, path: parts.join('') }
  } catch {
    return { n: 21, path: '' }
  }
}

export default function VerifyQr({
  value,
  size = 118,
  primary = '#1e293b',
  accent = '#c9a227',
  label = 'Scan to verify'
}) {
  const width = Number(size) > 0 ? Number(size) : 118
  const { n, path } = qrModules(value)
  const quiet = 1
  const dim = n + quiet * 2

  return (
    <div className="cert-qr" style={{ width }}>
      <svg
        className="cert-qr-svg"
        viewBox={`0 0 ${dim} ${dim}`}
        width={width}
        height={width}
        aria-label="Verification QR code"
      >
        <rect width={dim} height={dim} fill="#ffffff" />
        <rect
          x="0.25"
          y="0.25"
          width={dim - 0.5}
          height={dim - 0.5}
          fill="none"
          stroke={accent}
          strokeWidth="0.5"
        />
        <g transform={`translate(${quiet} ${quiet})`} fill={primary}>
          <path d={path} />
        </g>
      </svg>
      {label ? (
        <div className="cert-qr-label" style={{ color: primary }}>
          {label}
        </div>
      ) : null}
    </div>
  )
}
