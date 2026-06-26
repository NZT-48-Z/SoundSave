// Shared formatting helpers — kept in one place so the duration/speed
// formatting stays identical across panels.

export function fmtDuration(sec) {
  if (!sec) return ''
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function fmtSpeed(bps) {
  if (!bps) return ''
  const kbps = bps / 1024
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`
  return `${kbps.toFixed(0)} KB/s`
}
