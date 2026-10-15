import { useEffect, useRef, useState } from 'react'

const CERT_W = 1000
const CERT_H = 707

export default function CertificatePreview({ children, className = '', maxWidth = 1000 }) {
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const w = Math.min(el.clientWidth, maxWidth)
      setScale(w / CERT_W)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ width: '100%', height: CERT_H * scale, position: 'relative', overflow: 'hidden' }}
    >
      <div
        style={{
          width: CERT_W,
          height: CERT_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {children}
      </div>
    </div>
  )
}

export { CERT_W, CERT_H }
