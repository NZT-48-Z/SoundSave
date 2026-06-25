import { useState } from 'react'
import { bg, border, text } from '../theme'

export default function DownloadReportModal({ report, onClose }) {
  const { done, errors } = report
  const total = done.length + errors.length
  const allOk = errors.length === 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg.overlay, border: `1px solid ${border.default}`,
          borderRadius: 16, width: 460, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.22s ease',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: allOk ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {allOk ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )}
              </div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 16, color: text.primary, margin: 0, lineHeight: 1.2 }}>
                  {allOk ? 'All downloads complete' : 'Downloads finished'}
                </h2>
                <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>
                  {done.length} of {total} track{total !== 1 ? 's' : ''} downloaded successfully
                </p>
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <StatBox value={done.length} label="Downloaded" color="#22c55e" bg="rgba(34,197,94,0.08)" />
            {errors.length > 0 && (
              <StatBox value={errors.length} label="Failed" color="#ef4444" bg="rgba(239,68,68,0.08)" />
            )}
            <StatBox value={total} label="Total" color="#71717a" bg="rgba(255,255,255,0.04)" />
          </div>
        </div>

        {/* Track list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 8px' }}>

          {errors.length > 0 && (
            <>
              <SectionLabel color="#ef4444">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Failed ({errors.length})
              </SectionLabel>
              {errors.map(dl => <TrackRow key={dl.id} dl={dl} isError />)}
            </>
          )}

          {done.length > 0 && (
            <>
              <SectionLabel color="#22c55e">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Downloaded ({done.length})
              </SectionLabel>
              {done.map(dl => <TrackRow key={dl.id} dl={dl} isError={false} />)}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border.subtle}`, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: `1px solid ${border.default}`, borderRadius: 8,
              color: text.secondary, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#eeeef2' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9898a6' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function TrackRow({ dl, isError }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px', borderRadius: 7, marginBottom: 2,
      background: isError ? 'rgba(239,68,68,0.03)' : 'transparent',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isError ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      <div style={{
        width: 34, height: 34, borderRadius: 5, flexShrink: 0, overflow: 'hidden',
        background: dl.color || '#27272a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {dl.artwork_url ? (
          <img src={dl.artwork_url} alt={dl.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dl.title}
        </div>
        <div style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dl.artist}
          {isError && dl.error && (
            <span style={{ color: '#ef4444', marginLeft: 6 }}>— {dl.error}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({ value, label, color, bg }) {
  return (
    <div style={{ flex: 1, padding: '8px 12px', background: bg, borderRadius: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SectionLabel({ children, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px', color, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {children}
    </div>
  )
}

function CloseBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? '#27272a' : 'transparent', border: 'none', borderRadius: 5,
        color: hov ? '#fafafa' : '#71717a', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}
