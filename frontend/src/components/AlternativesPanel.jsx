import { useEffect, useState } from 'react'
import { getAlternatives } from '../api'
import { accent, bg, border, neutral, semantic } from '../theme'
import { cleanTitle, isModifiedTitle } from '../utils/trackModifiers'
import { fmtDuration } from '../utils/format'

export default function AlternativesPanel({ item, onReplace, onKeep, onClose }) {
  const [state, setState] = useState('loading') // loading | done | error
  const [results, setResults] = useState([])
  const [hovered, setHovered] = useState(null)
  const clean = cleanTitle(item.title)

  useEffect(() => {
    let cancelled = false
    getAlternatives(item.title, item.artist)
      .then(data => {
        if (!cancelled) {
          setResults(data.results || [])
          setState('done')
        }
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [item.title, item.artist])

  return (
    <div style={{
      margin: '0 8px 6px',
      background: bg.overlay,
      border: '1px solid rgba(234,179,8,0.20)',
      borderTop: `2px solid ${semantic.warning}`,
      borderRadius: '0 0 10px 10px',
      overflow: 'hidden',
      animation: 'fadeIn 0.18s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: `1px solid ${border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={semantic.warning} strokeWidth="2.5" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ fontSize: 12, color: neutral[400] }}>
            Modified version detected —{' '}
            <span style={{ color: neutral[50], fontWeight: 500 }}>"{clean}"</span>
            {' '}originals on SoundCloud:
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: neutral[600], cursor: 'pointer', padding: 4, display: 'flex', transition: 'color 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.color = neutral[400]}
          onMouseLeave={e => e.currentTarget.style.color = neutral[600]}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 14px 12px' }}>
        {state === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: neutral[600], fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Searching SoundCloud for originals…
          </div>
        )}

        {state === 'error' && (
          <p style={{ fontSize: 12, color: semantic.error, padding: '8px 0' }}>Could not load alternatives</p>
        )}

        {state === 'done' && results.length === 0 && (
          <p style={{ fontSize: 12, color: neutral[600], padding: '8px 0' }}>No alternatives found</p>
        )}

        {state === 'done' && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map(track => {
              const modified = isModifiedTitle(track.title)
              const isHov = hovered === track.id
              return (
                <div
                  key={track.id}
                  onClick={() => onReplace(track)}
                  onMouseEnter={() => setHovered(track.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    background: isHov ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isHov ? 'rgba(249,115,22,0.2)' : border.subtle}`,
                    transition: 'all 0.12s',
                  }}
                >
                  {/* Artwork */}
                  <div style={{ width: 34, height: 34, borderRadius: 5, flexShrink: 0, overflow: 'hidden', background: neutral[800], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {track.artwork_url ? (
                      <img src={track.artwork_url} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: neutral[50], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.title}
                      </span>
                      {!modified && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: semantic.success, background: semantic.successBg, borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          ORIGINAL
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: neutral[500] }}>{track.artist}</span>
                  </div>

                  {/* Duration */}
                  {track.duration > 0 && (
                    <span style={{ fontSize: 11, color: neutral[600], fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                      {fmtDuration(track.duration)}
                    </span>
                  )}

                  {/* Arrow */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isHov ? accent[500] : neutral[700]} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: 'stroke 0.12s' }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              )
            })}
          </div>
        )}

        {/* Keep button */}
        <button
          onClick={onKeep}
          style={{
            marginTop: 10, padding: '5px 12px', background: 'transparent',
            border: `1px solid ${neutral[800]}`, borderRadius: 6,
            color: neutral[600], fontSize: 12, cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = neutral[400]; e.currentTarget.style.borderColor = neutral[700] }}
          onMouseLeave={e => { e.currentTarget.style.color = neutral[600]; e.currentTarget.style.borderColor = neutral[800] }}
        >
          Keep this version
        </button>
      </div>
    </div>
  )
}
