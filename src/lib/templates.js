export const FONTS = {
  playfair: '"Playfair Display", Georgia, serif',
  cinzel: '"Cinzel", "Times New Roman", serif',
  cormorant: '"Cormorant Garamond", Georgia, serif',
  greatvibes: '"Great Vibes", cursive',
  inter: '"Inter", system-ui, sans-serif',
  opensans: '"Open Sans", system-ui, sans-serif'
}

export const FONT_OPTIONS = [
  { key: 'playfair', label: 'Playfair Display' },
  { key: 'cinzel', label: 'Cinzel' },
  { key: 'cormorant', label: 'Cormorant Garamond' },
  { key: 'greatvibes', label: 'Great Vibes (script)' },
  { key: 'inter', label: 'Inter' },
  { key: 'opensans', label: 'Open Sans' }
]

export const BORDER_OPTIONS = ['ornate', 'double', 'minimal', 'geo', 'ribbon']
export const WATERMARK_OPTIONS = ['seal', 'monogram', 'text', 'orgname', 'logo', 'none']

export const LAYOUT_OPTIONS = [
  { key: 'center', label: 'Centered / Formal' },
  { key: 'split', label: 'Split Accent' },
  { key: 'band', label: 'Top Band' }
]

/* Default element sizes (px) and the range each control is allowed to take.
   `watermark` is a percentage scale rather than a px value. */
export const DEFAULT_SIZES = {
  org: 25,
  logo: 62,
  logoGap: 14,
  eyebrow: 17,
  name: 74,
  lead: 17,
  course: 34,
  desc: 15,
  signature: 52,
  signerName: 15,
  signerTitle: 12,
  meta: 14,
  seal: 118,
  watermark: 100
}

export const LOGO_POSITION_OPTIONS = [
  { key: 'left', label: 'Beside name' },
  { key: 'top', label: 'Above name' }
]

export const HEADER_ALIGN_OPTIONS = [
  { key: 'center', label: 'Center' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' }
]

export const SIZE_FIELDS = [
  { key: 'logo', label: 'Logo / avatar', min: 24, max: 140 },
  { key: 'logoGap', label: 'Logo to name spacing', min: 0, max: 48 },
  { key: 'org', label: 'Organization name', min: 12, max: 48 },
  { key: 'eyebrow', label: 'Eyebrow / label', min: 9, max: 34 },
  { key: 'name', label: 'Recipient name', min: 32, max: 120 },
  { key: 'lead', label: '"has completed" line', min: 10, max: 34 },
  { key: 'course', label: 'Course title', min: 16, max: 64 },
  { key: 'desc', label: 'Description', min: 10, max: 28 },
  { key: 'signature', label: 'Signature', min: 24, max: 120 },
  { key: 'signerName', label: 'Signatory name', min: 10, max: 30 },
  { key: 'signerTitle', label: 'Signatory title', min: 8, max: 24 },
  { key: 'meta', label: 'Date / ID text', min: 9, max: 26 },
  { key: 'seal', label: 'Seal badge', min: 50, max: 220 }
]

/* Merge a possibly-partial/legacy design with the size defaults so older
   saved designs still render correctly. */
export function resolveSizes(design = {}) {
  return { ...DEFAULT_SIZES, ...(design?.sizes || {}) }
}

export function blankDesign(overrides = {}) {
  return {
    layout: 'center',
    border: 'ornate',
    watermark: 'seal',
    watermarkText: 'CERTIFIED',
    watermarkOpacity: 0.08,
    watermarkRotation: 0,
    strip: true,
    stripPosition: 'top',
    colors: {
      primary: '#8a6d1f',
      secondary: '#3a2e12',
      accent: '#c9a227',
      background: '#fffdf6',
      text: '#2b2313'
    },
    fonts: {
      heading: 'cinzel',
      name: 'greatvibes',
      body: 'cormorant'
    },
    sizes: { ...DEFAULT_SIZES },
    showSeal: true,
    showLogo: true,
    logoPosition: 'left',
    headerAlign: 'center',
    ...overrides
  }
}

export const TEMPLATE_PRESETS = [
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    category: 'Formal',
    description: 'Ornate gold double frame with embossed seal and script name.',
    design: blankDesign({
      layout: 'center',
      border: 'ornate',
      watermark: 'seal',
      strip: true,
      stripPosition: 'top',
      colors: {
        primary: '#9a7b1f',
        secondary: '#5a4713',
        accent: '#d4af37',
        background: '#fffdf7',
        text: '#2b2313'
      },
      fonts: { heading: 'cinzel', name: 'greatvibes', body: 'cormorant' }
    })
  },
  {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    category: 'Formal',
    description: 'Deep navy double border with gold accents and monogram watermark.',
    design: blankDesign({
      layout: 'center',
      border: 'double',
      watermark: 'monogram',
      strip: false,
      colors: {
        primary: '#12285a',
        secondary: '#0b1a3d',
        accent: '#c9a227',
        background: '#fbfcff',
        text: '#16213e'
      },
      fonts: { heading: 'playfair', name: 'cormorant', body: 'opensans' }
    })
  },
  {
    id: 'modern-graphite',
    name: 'Modern Graphite',
    category: 'Modern',
    description: 'Clean angular frame with a bold accent strip and sans typography.',
    design: blankDesign({
      layout: 'band',
      border: 'geo',
      watermark: 'text',
      watermarkText: 'EXCELLENCE',
      watermarkOpacity: 0.05,
      strip: true,
      stripPosition: 'bottom',
      colors: {
        primary: '#111827',
        secondary: '#374151',
        accent: '#2563eb',
        background: '#ffffff',
        text: '#111827'
      },
      fonts: { heading: 'inter', name: 'inter', body: 'inter' }
    })
  },
  {
    id: 'emerald-classic',
    name: 'Emerald Classic',
    category: 'Academic',
    description: 'Academic green frame with wax-style seal and gold detailing.',
    design: blankDesign({
      layout: 'center',
      border: 'double',
      watermark: 'seal',
      strip: true,
      stripPosition: 'top',
      colors: {
        primary: '#0f5132',
        secondary: '#08331f',
        accent: '#d4af37',
        background: '#fbfdf9',
        text: '#123524'
      },
      fonts: { heading: 'cinzel', name: 'cormorant', body: 'cormorant' }
    })
  },
  {
    id: 'crimson-heritage',
    name: 'Crimson Heritage',
    category: 'Formal',
    description: 'Regal burgundy ribbon bands with a classic serif composition.',
    design: blankDesign({
      layout: 'center',
      border: 'ribbon',
      watermark: 'seal',
      strip: false,
      colors: {
        primary: '#7a1f2b',
        secondary: '#4d1219',
        accent: '#d4af37',
        background: '#fffaf7',
        text: '#3a1216'
      },
      fonts: { heading: 'playfair', name: 'greatvibes', body: 'cormorant' }
    })
  },
  {
    id: 'slate-tech',
    name: 'Slate Tech',
    category: 'Corporate',
    description: 'Contemporary geometric layout for courses, bootcamps and seminars.',
    design: blankDesign({
      layout: 'split',
      border: 'geo',
      watermark: 'monogram',
      strip: true,
      stripPosition: 'top',
      colors: {
        primary: '#0f172a',
        secondary: '#1e293b',
        accent: '#06b6d4',
        background: '#ffffff',
        text: '#0f172a'
      },
      fonts: { heading: 'inter', name: 'inter', body: 'opensans' }
    })
  },
  {
    id: 'vintage-sepia',
    name: 'Vintage Sepia',
    category: 'Academic',
    description: 'Antique paper tones with ornamental corners and sepia text.',
    design: blankDesign({
      layout: 'center',
      border: 'ornate',
      watermark: 'text',
      watermarkText: 'MERIT',
      watermarkOpacity: 0.06,
      strip: false,
      colors: {
        primary: '#6b4f2a',
        secondary: '#4a361c',
        accent: '#a67c2e',
        background: '#f7f0e0',
        text: '#40301a'
      },
      fonts: { heading: 'cinzel', name: 'greatvibes', body: 'cormorant' }
    })
  }
]

export const CATEGORIES = ['Formal', 'Modern', 'Academic', 'Corporate']
