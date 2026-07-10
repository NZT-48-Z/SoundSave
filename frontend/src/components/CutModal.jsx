import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPreviewUrl } from '../api'
import { accent, bg, border, neutral, semantic, text } from '../theme'

const MIN_GAP = 1

function fmtMMSS(sec) {
  sec = Math.max(0, sec || 0)
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

function parseMMSS(str) {
  const s = (str || '').trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return Number(s)
  const m = s.match(/^(\d+):([0-5]?\d)$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export default function CutModal({ item, onClose, onConfirm }) {
  const [duration, setDuration] = useState(item.duration || 0)
  const [start, setStart] = useState(item.cut_start ?? 0)
  const [end, setEnd] = useState(item.cut_end ?? (item.duration || 0))
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(item.cut_start ?? 0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startInput, setStartInput] = useState(fmtMMSS(item.cut_start ?? 0))
  const [endInput, setEndInput] = useState(fmtMMSS(item.cut_end ?? (item.duration || 0)))
  const editingRef = useRef({ start: false, end: false })
  const audioRef = useRef(null)
  const trackRef = useRef(null)
  const draggingRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const audio = new Audio()
    audioRef.current = audio
    getPreviewUrl(item.url)
      .then(({ stream_url, duration: d }) => {
        if (cancelled) return
        audio.src = stream_url
        if (!item.duration && d) setDuration(d)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setError('Preview unavailable'); setLoading(false) } })

    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => { if (isFinite(audio.duration) && !item.duration) setDuration(audio.duration) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      cancelled = true
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [item.url, item.duration])

  // Pause playback once it passes the cut end, so previewing the cut is easy
  useEffect(() => {
    if (playing && currentTime >= end) {
      audioRef.current?.pause()
    }
  }, [currentTime, end, playing])

  useEffect(() => {
    if (!editingRef.current.start) setStartInput(fmtMMSS(start))
  }, [start])
  useEffect(() => {
    if (!editingRef.current.end) setEndInput(fmtMMSS(end))
  }, [end])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const timeFromEvent = (e) => {
    if (!trackRef.current || !duration) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const startDrag = (handle) => (e) => {
    e.stopPropagation()
    draggingRef.current = handle
    const onMove = (mv) => {
      if (draggingRef.current !== handle) return
      const t = timeFromEvent(mv)
      if (handle === 'start') setStart(Math.min(t, end - MIN_GAP))
      else setEnd(Math.max(t, start + MIN_GAP))
    }
    const onUp = () => {
      draggingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const seekPlayback = (e) => {
    const t = timeFromEvent(e)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (audio.currentTime < start || audio.currentTime >= end) audio.currentTime = start
      audio.play()
    } else {
      audio.pause()
    }
  }

  const commitStart = () => {
    editingRef.current.start = false
    const v = parseMMSS(startInput)
    if (v == null) { setStartInput(fmtMMSS(start)); return }
    setStart(Math.max(0, Math.min(v, end - MIN_GAP)))
  }
  const commitEnd = () => {
    editingRef.current.end = false
    const v = parseMMSS(endInput)
    if (v == null) { setEndInput(fmtMMSS(end)); return }
    setEnd(Math.max(start + MIN_GAP, Math.min(v, duration || v)))
  }

  const reset = () => {
    setStart(0)
    setEnd(duration)
  }

  const apply = () => {
    audioRef.current?.pause()
    const cut_start = start > 0.05 ? Number(start.toFixed(2)) : null
    const cut_end = duration && end < duration - 0.05 ? Number(end.toFixed(2)) : null
    onConfirm({ cut_start, cut_end })
  }

  const startPct = duration ? (start / duration) * 100 : 0
  const endPct = duration ? (end / duration) * 100 : 100
  const playPct = duration ? Math.max(0, Math.min(1, currentTime / duration)) * 100 : 0
  const isCut = start > 0.05 || (duration && end < duration - 0.05)

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, animation: 'fadeIn 0.12s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: bg.overlay,
          border: `1px solid ${border.default}`,
          borderRadius: 12, padding: 24,
          width: 400, display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cut track</div>
            <div style={{ fontSize: 12, color: text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title} — {item.artist}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: text.muted, cursor: 'pointer', flexShrink: 0,
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = text.primary}
            onMouseLeave={e => e.currentTarget.style.color = text.muted}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error ? (
          <span style={{ fontSize: 12, color: semantic.error, textAlign: 'center' }}>{error}</span>
        ) : (
          <>
            {/* Play + range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={togglePlay}
                disabled={loading}
                style={{
                  width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: accent[500], border: 'none', borderRadius: '50%',
                  color: 'white', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
                }}
              >
                {playing ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21"/>
                  </svg>
                )}
              </button>

              <div
                ref={trackRef}
                onClick={seekPlayback}
                style={{ position: 'relative', flex: 1, height: 26, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: neutral[800] }} />
                <div style={{
                  position: 'absolute', height: 4, borderRadius: 2, background: accent[500],
                  left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%`,
                }} />
                {duration > 0 && (
                  <div style={{
                    position: 'absolute', top: 3, bottom: 3, width: 2, background: 'rgba(255,255,255,0.7)',
                    left: `${playPct}%`, pointerEvents: 'none',
                  }} />
                )}
                <div
                  onMouseDown={startDrag('start')}
                  style={{
                    position: 'absolute', left: `${startPct}%`, transform: 'translateX(-50%)',
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    border: `2px solid ${accent[500]}`, cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
                <div
                  onMouseDown={startDrag('end')}
                  style={{
                    position: 'absolute', left: `${endPct}%`, transform: 'translateX(-50%)',
                    width: 14, height: 14, borderRadius: '50%', background: 'white',
                    border: `2px solid ${accent[500]}`, cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </div>
            </div>

            {/* mm:ss inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <TimeField
                label="Start"
                value={startInput}
                onChange={v => { editingRef.current.start = true; setStartInput(v) }}
                onFocus={() => { editingRef.current.start = true }}
                onBlur={commitStart}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="1.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <TimeField
                label="End"
                value={endInput}
                onChange={v => { editingRef.current.end = true; setEndInput(v) }}
                onFocus={() => { editingRef.current.end = true }}
                onBlur={commitEnd}
              />
              <span style={{ fontSize: 11, color: text.muted, marginLeft: 4 }}>of {fmtMMSS(duration)}</span>
            </div>
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={reset}
            disabled={!isCut}
            style={{
              padding: '7px 12px', background: 'transparent',
              border: 'none', borderRadius: 7,
              color: isCut ? text.secondary : neutral[700], fontSize: 12.5,
              cursor: isCut ? 'pointer' : 'default',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >Reset to full track</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px', background: 'transparent',
                border: `1px solid ${border.default}`, borderRadius: 7,
                color: text.secondary, fontSize: 13, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >Cancel</button>
            <button
              onClick={apply}
              style={{
                padding: '7px 14px', background: accent[500],
                border: 'none', borderRadius: 7,
                color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >Apply</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function TimeField({ label, value, onChange, onFocus, onBlur }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        style={{
          width: 52, padding: '5px 7px', background: neutral[900],
          border: `1px solid ${neutral[700]}`, borderRadius: 5,
          color: text.primary, fontSize: 13, textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace", outline: 'none',
        }}
      />
    </div>
  )
}
