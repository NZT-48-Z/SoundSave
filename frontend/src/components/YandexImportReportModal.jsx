import { useEffect } from 'react'
import { bg, border, neutral, semantic, text } from '../theme'
import CloseBtn from './CloseBtn'

export default function YandexImportReportModal({ report, onClose }) {
  const { total, found, not_found_tracks: notFound = [] } = report
  const allFound = notFound.length === 0

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
                background: allFound ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {allFound ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={semantic.success} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={semantic.warning} strokeWidth="2.5" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )}
              </div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 16, color: text.primary, margin: 0, lineHeight: 1.2 }}>
                  {allFound ? 'Playlist imported' : 'Playlist import finished'}
                </h2>
                <p style={{ fontSize: 13, color: neutral[500], margin: '4px 0 0' }}>
                  {found} of {total} track{total !== 1 ? 's' : ''} found on SoundSave
                </p>
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <StatBox value={found} label="Found" color={semantic.success} bg="rgba(34,197,94,0.08)" />
            {notFound.length > 0 && (
              <StatBox value={notFound.length} label="Not found" color={semantic.error} bg={semantic.errorBg} />
            )}
            <StatBox value={total} label="Total" color={neutral[500]} bg="rgba(255,255,255,0.04)" />
          </div>
        </div>

        {/* Track list */}
        {notFound.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 8px' }}>
            <SectionLabel color={semantic.error}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Not found on SoundCloud ({notFound.length})
            </SectionLabel>
            {notFound.map((t, i) => (
              <TrackRow key={i} track={t} />
            ))}
          </div>
        )}

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
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = text.primary }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = text.secondary }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function TrackRow({ track }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px', borderRadius: 7, marginBottom: 2,
      background: 'rgba(239,68,68,0.03)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        background: 'rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={semantic.error} strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11, color: neutral[500], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artist}
        </div>
      </div>
    </div>
  )
}

function StatBox({ value, label, color, bg }) {
  return (
    <div style={{ flex: 1, padding: '8px 12px', background: bg, borderRadius: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: neutral[600], textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
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
