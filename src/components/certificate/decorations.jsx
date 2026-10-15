/* Reusable decorative SVG layers for certificate templates. */

export function CornerFlourish({ color }) {
  return (
    <svg viewBox="0 0 140 140" width="100%" height="100%" fill="none">
      <path d="M14 14 H96 M14 14 V96" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M22 22 H76 C76 52 52 76 22 76"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M30 30 H58 C58 44 44 58 30 58"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="14" cy="14" r="4" fill={color} />
      <circle cx="96" cy="14" r="2.6" fill={color} />
      <circle cx="14" cy="96" r="2.6" fill={color} />
      <path d="M14 104 V120 M104 14 H120" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="118" cy="14" r="2" fill={color} opacity="0.8" />
      <circle cx="14" cy="118" r="2" fill={color} opacity="0.8" />
    </svg>
  )
}

export function OrnateBorder({ design }) {
  const { primary, accent } = design.colors
  const flourishInset = '2.2%'
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: '2%',
          border: `9px double ${primary}`,
          borderRadius: 4,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '3.6%',
          border: `1.5px solid ${accent}`,
          pointerEvents: 'none'
        }}
      />
      {[
        { top: flourishInset, left: flourishInset },
        { top: flourishInset, right: flourishInset, transform: 'scaleX(-1)' },
        { bottom: flourishInset, left: flourishInset, transform: 'scaleY(-1)' },
        { bottom: flourishInset, right: flourishInset, transform: 'scale(-1,-1)' }
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '13%',
            height: '18%',
            ...pos,
            pointerEvents: 'none'
          }}
        >
          <CornerFlourish color={primary} />
        </div>
      ))}
    </>
  )
}

export function DoubleBorder({ design }) {
  const { primary, accent } = design.colors
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: '3%',
          border: `3px solid ${primary}`,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '4.2%',
          border: `1px solid ${accent}`,
          pointerEvents: 'none'
        }}
      />
    </>
  )
}

export function MinimalBorder({ design }) {
  const { primary } = design.colors
  return (
    <div
      style={{
        position: 'absolute',
        inset: '4.5%',
        border: `2px solid ${primary}`,
        pointerEvents: 'none'
      }}
    />
  )
}

export function GeoBorder({ design }) {
  const { primary, accent } = design.colors
  return (
    <>
      <svg
        viewBox="0 0 1000 707"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        fill="none"
      >
        <rect x="34" y="34" width="932" height="639" stroke={primary} strokeWidth="4" />
        <path d="M34 120 L120 34" stroke={accent} strokeWidth="3" />
        <path d="M966 120 L880 34" stroke={accent} strokeWidth="3" />
        <path d="M34 587 L120 673" stroke={accent} strokeWidth="3" />
        <path d="M966 587 L880 673" stroke={accent} strokeWidth="3" />
        <rect x="52" y="52" width="896" height="603" stroke={accent} strokeWidth="1" opacity="0.6" />
      </svg>
    </>
  )
}

export function RibbonBorder({ design }) {
  const { primary, accent, background } = design.colors
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background }} />
      <div
        style={{
          position: 'absolute',
          inset: '3.5%',
          border: `2px solid ${primary}`,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '3.5%',
          left: '3.5%',
          right: '3.5%',
          height: 26,
          background: `linear-gradient(90deg, ${primary}, ${accent}, ${primary})`,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '3.5%',
          left: '3.5%',
          right: '3.5%',
          height: 26,
          background: `linear-gradient(90deg, ${primary}, ${accent}, ${primary})`,
          pointerEvents: 'none'
        }}
      />
    </>
  )
}

const borderMap = {
  ornate: OrnateBorder,
  double: DoubleBorder,
  minimal: MinimalBorder,
  geo: GeoBorder,
  ribbon: RibbonBorder
}

export function BorderLayer({ design }) {
  const Comp = borderMap[design.border] || DoubleBorder
  return <Comp design={design} />
}

export function SealWatermark({ design }) {
  const { primary } = design.colors
  const opacity = design.watermarkOpacity ?? 0.07
  const text = design.watermarkText || design.organization?.name || 'CERTIFIED'
  return (
    <svg
      viewBox="0 0 320 320"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '46%',
        transform: 'translate(-50%, -50%)',
        opacity,
        pointerEvents: 'none'
      }}
    >
      <g fill="none" stroke={primary}>
        <circle cx="160" cy="160" r="150" strokeWidth="4" />
        <circle cx="160" cy="160" r="138" strokeWidth="1.5" />
        <circle cx="160" cy="160" r="96" strokeWidth="1.5" strokeDasharray="3 6" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2
          return (
            <line
              key={i}
              x1={160 + Math.cos(a) * 138}
              y1={160 + Math.sin(a) * 138}
              x2={160 + Math.cos(a) * 150}
              y2={160 + Math.sin(a) * 150}
              strokeWidth="1"
            />
          )
        })}
        <circle cx="160" cy="160" r="70" strokeWidth="3" />
      </g>
      <text
        x="160"
        y="168"
        textAnchor="middle"
        fontFamily='"Cinzel", serif'
        fontSize="30"
        fontWeight="700"
        fill={primary}
        letterSpacing="2"
      >
        {text.slice(0, 14).toUpperCase()}
      </text>
    </svg>
  )
}

export function MonogramWatermark({ design }) {
  const { primary } = design.colors
  const opacity = design.watermarkOpacity ?? 0.06
  const letters = (design.watermarkText || design.organization?.name || 'CS')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: '"Playfair Display", serif',
        fontWeight: 900,
        fontSize: '30vw',
        lineHeight: 1,
        color: primary,
        opacity,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      {letters}
    </div>
  )
}

export function TextWatermark({ design }) {
  const { primary } = design.colors
  const opacity = design.watermarkOpacity ?? 0.06
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          transform: 'rotate(-24deg)',
          fontFamily: '"Cinzel", serif',
          fontWeight: 700,
          fontSize: '7vw',
          letterSpacing: '0.15em',
          color: primary,
          opacity,
          whiteSpace: 'nowrap',
          userSelect: 'none'
        }}
      >
        {(design.watermarkText || 'CERTIFIED').toUpperCase()}
      </div>
    </div>
  )
}

const watermarkMap = {
  seal: SealWatermark,
  monogram: MonogramWatermark,
  text: TextWatermark,
  none: () => null
}

export function WatermarkLayer({ design }) {
  const Comp = watermarkMap[design.watermark] || SealWatermark
  return <Comp design={design} />
}

export function Strip({ design }) {
  if (!design.strip) return null
  const { primary, accent } = design.colors
  return (
    <div
      style={{
        position: 'absolute',
        left: '2%',
        right: '2%',
        top: design.stripPosition === 'bottom' ? undefined : '2%',
        bottom: design.stripPosition === 'bottom' ? '2%' : undefined,
        height: 10,
        background: `repeating-linear-gradient(45deg, ${primary}, ${primary} 12px, ${accent} 12px, ${accent} 24px)`,
        borderRadius: 2,
        pointerEvents: 'none'
      }}
    />
  )
}
