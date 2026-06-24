import { useState } from 'react'
import { cancelDownload } from '../api'
import { bg, border, text } from '../theme'

function fmtSpeed(bps) {
  if (!bps) return ''
  const kbps = bps / 1024
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`
  return `${kbps.toFixed(0)} KB/s`
}

const ACTIVE_STATUSES = new Set(['pending', 'downloading', 'converting', 'tagging'])

const STATUS_MAP = {
  pending:     { label: 'Pending',     color: '#a1a1aa', bg: 'rgba(161,161,170,0.08)' },
  downloading: { label: 'Downloading', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  converting:  { label: 'Converting',  color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  tagging:     { label: 'Tagging',     color: '#eab308', bg: 'rgba(234,179,8,0.1)'   },
  done:        { label: 'Done',        color: '#22c55e', bg: 'rgba(34,197,94,0.08)'  },
  cancelled:   { label: 'Cancelled',   color: '#71717a', bg: 'rgba(113,113,122,0.08)' },
  error:       { label: 'Error',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
}

function statusColor(s) { return (STATUS_MAP[s] || STATUS_MAP.pending).color }

function DownloadRow({ dl }) {
  const st = STATUS_MAP[dl.status] || STATUS_MAP.pending
  const pct = Math.round(dl.progress)
  const speed = dl.status === 'downloading' && dl.speed ? fmtSpeed(dl.speed) : ''
  const canCancel = ACTIVE_STATUSES.has(dl.status)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async (e) => {
    e.stopPropagation()
    if (cancelling) return
    setCancelling(true)
    try {
      await cancelDownload(dl.id)
    } catch {
      setCancelling(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: bg.surface, border: `1px solid ${border.default}`, borderRadius: 10 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 7,
        background: dl.color || '#1e1b22',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
      }}>
        {dl.artwork_url ? (
          <img src={dl.artwork_url} alt={dl.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: text.primary }}>{dl.title}</span>
            <span style={{ fontSize: 13, color: '#71717a', marginLeft: 8 }}>{dl.artist}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: st.color,
              background: st.bg, borderRadius: 4, padding: '2px 8px',
              whiteSpace: 'nowrap', letterSpacing: '0.04em',
            }}>{st.label}</span>
            {canCancel && (
              <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#71717a', minWidth: 36, textAlign: 'right' }}>
                {`${pct}%`}
              </span>
            )}
            {speed && (
              <span style={{ fontSize: 11, color: '#52525b', minWidth: 64, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{speed}</span>
            )}
            {canCancel && (
              <CancelBtn onClick={handleCancel} loading={cancelling} />
            )}
          </div>
        </div>

        {dl.status === 'error' ? (
          <p style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>{dl.error || 'Download failed'}</p>
        ) : dl.status === 'cancelled' ? (
          <p style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>Cancelled by user</p>
        ) : (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: 3,
              background: statusColor(dl.status),
              borderRadius: 2, transition: 'width 0.45s ease',
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

function CancelBtn({ onClick, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Cancel download"
      style={{
        width: 26, height: 26, borderRadius: 5, flexShrink: 0,
        background: hov ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hov ? 'rgba(239,68,68,0.35)' : border.subtle}`,
        color: hov ? '#ef4444' : '#52525b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {loading ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      )}
    </button>
  )
}

export default function DownloadsPanel({ downloads, onClearHistory }) {
  const done = downloads.filter(d => d.status === 'done').length
  const active = downloads.filter(d => ['downloading', 'converting', 'tagging'].includes(d.status)).length
  const errors = downloads.filter(d => d.status === 'error').length
  const total = downloads.length

  // Donut: circumference of r=16 circle = 2π×16 ≈ 100.53
  const circ = 100.53
  const fill = total ? ((done / total) * circ).toFixed(1) : '0'

  if (!downloads.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '88px 0', gap: 14, textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <div>
          <p style={{ fontSize: 15, color: '#52525b', fontWeight: 500, marginBottom: 6 }}>No downloads yet</p>
          <p style={{ fontSize: 13, color: '#3f3f46' }}>Add tracks to queue and click Download All</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{total} download{total !== 1 ? 's' : ''}</span>
        <button
          onClick={onClearHistory}
          style={{
            padding: '6px 12px', background: 'transparent', border: `1px solid ${border.default}`,
            borderRadius: 6, color: '#71717a', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Clear History
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px', background: bg.surface, border: `1px solid ${border.default}`, borderRadius: 10, marginBottom: 14 }}>
        <svg width="44" height="44" viewBox="0 0 40 40" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="20" cy="20" r="16" fill="none" stroke="#27272a" strokeWidth="3.5"/>
          <circle cx="20" cy="20" r="16" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Stat value={total} label="Total" color="#fafafa" />
          <div style={{ width: 1, height: 28, background: '#27272a' }} />
          <Stat value={done} label="Done" color="#22c55e" />
          <Stat value={active} label="Active" color="#3b82f6" />
          {errors > 0 && <Stat value={errors} label="Errors" color="#ef4444" />}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {downloads.map(dl => <DownloadRow key={dl.id} dl={dl} />)}
      </div>
    </div>
  )
}

function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: '#52525b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
