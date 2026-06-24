// Layer 1 – neutral foundation (4 levels, dark theme: 4-6% lightness gap each)
export const bg = {
  base:    '#06060a',   // nav/frame anchor — darkest, "frames" the app
  page:    '#09090b',   // page background
  surface: '#141418',   // cards, panels — elevated (+7.5% lightness vs page)
  overlay: '#1e1e24',   // modals, dropdowns — highest elevation
}

// Borders — white-alpha adapts to any surface automatically
export const border = {
  subtle:  'rgba(255,255,255,0.06)',  // section dividers
  default: 'rgba(255,255,255,0.09)',  // card edges
  strong:  'rgba(255,255,255,0.15)',  // focused/active state
  accent:  'rgba(249,115,22,0.40)',   // orange highlight
}

// Text — 3 clear levels (guide: 89% / 65% / 40% white)
export const text = {
  primary:   '#eeeef2',   // ~93% white — headings, important labels
  secondary: '#9898a6',   // ~62% — body, descriptions
  muted:     '#56566a',   // ~36% — hints, placeholders, disabled
}

// Layer 2 – accent ramp (orange, 400→700)
export const accent = {
  subtle: 'rgba(249,115,22,0.08)',
  400:    '#fb923c',   // light — links, secondary indicators
  500:    '#f97316',   // primary
  600:    '#e8640f',   // hover
  700:    '#c2410c',   // active / pressed
}

// Layer 3 – semantic colors (always mean the same thing)
export const semantic = {
  success:     '#22c55e',
  successBg:   'rgba(34,197,94,0.10)',
  error:       '#ef4444',
  errorBg:     'rgba(239,68,68,0.10)',
  warning:     '#eab308',
  warningBg:   'rgba(234,179,8,0.10)',
  info:        '#3b82f6',
  infoBg:      'rgba(59,130,246,0.10)',
}
