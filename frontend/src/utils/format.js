// Shared formatting helpers — kept in one place so the duration/speed
// formatting stays identical across panels.

export function fmtDuration(sec) {
  if (!sec) return ''
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function fmtTotalDuration(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtSpeed(bps) {
  if (!bps) return ''
  const kbps = bps / 1024
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`
  return `${kbps.toFixed(0)} KB/s`
}
