export default function BadgeSeal({ primary, accent, text = 'OFFICIAL' }) {
  return (
    <svg viewBox="0 0 140 150" width="118" height="126" aria-hidden="true">
      <g>
        <path
          d="M40 96 L26 146 L52 132 L64 148 L70 104 Z"
          fill={accent}
          opacity="0.9"
        />
        <path
          d="M100 96 L114 146 L88 132 L76 148 L70 104 Z"
          fill={accent}
          opacity="0.75"
        />
        <circle cx="70" cy="66" r="54" fill={primary} />
        <circle cx="70" cy="66" r="54" fill="none" stroke={accent} strokeWidth="4" />
        <circle cx="70" cy="66" r="44" fill="none" stroke={accent} strokeWidth="1.5" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2
          return (
            <circle
              key={i}
              cx={70 + Math.cos(a) * 49}
              cy={66 + Math.sin(a) * 49}
              r="1.4"
              fill={accent}
            />
          )
        })}
        <text
          x="70"
          y="60"
          textAnchor="middle"
          fontFamily='"Cinzel", serif'
          fontSize="13"
          letterSpacing="1.5"
          fill={accent}
        >
          VERIFIED
        </text>
        <text
          x="70"
          y="84"
          textAnchor="middle"
          fontFamily='"Playfair Display", serif'
          fontSize="17"
          fontWeight="700"
          fill="#fff"
        >
          {text}
        </text>
      </g>
    </svg>
  )
}
