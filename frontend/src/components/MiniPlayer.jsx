import { useEffect, useRef, useState } from 'react'
import { accent, border, neutral, text } from '../theme'
import { fmtDuration } from '../utils/format'

export default function MiniPlayer({ track, audioRef, loading, onClose }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(track.duration || 0)
  const barRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => { if (isFinite(audio.duration)) setDuration(audio.duration) }
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
    }
  }, [audioRef])

  const togglePlay = () => {
    const audio = audioRef.current
    audio.paused ? audio.play() : audio.pause()
  }

  const handleSeek = (e) => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * duration
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(12,12,16,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${border.default}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', height: 68, gap: 16,
      animation: 'slideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Artwork */}
      <div style={{ width: 44, height: 44, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: neutral[900] }}>
        {track.artwork_url ? (
          <img src={track.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}
      </div>

      {/* Track info */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11, color: text.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artist}
        </div>
      </div>

      {/* Progress */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: text.muted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {fmtDuration(Math.floor(currentTime)) || '0:00'}
        </span>
        <div
          ref={barRef}
          onClick={handleSeek}
          style={{ flex: 1, height: 4, borderRadius: 2, background: neutral[800], cursor: 'pointer', position: 'relative' }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progress * 100}%`,
            background: loading ? neutral[600] : accent[500],
            borderRadius: 2,
            transition: 'width 0.25s linear',
          }} />
        </div>
        <span style={{ fontSize: 11, color: text.muted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {fmtDuration(Math.floor(duration)) || '--:--'}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <VolumeControl audioRef={audioRef} />
        <button
          onClick={togglePlay}
          disabled={loading}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: loading ? neutral[800] : accent[500],
            border: 'none', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = accent[600] }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = loading ? neutral[800] : accent[500] }}
        >
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21"/>
            </svg>
          )}
        </button>

        <button
          onClick={onClose}
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: text.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = text.primary }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = text.muted }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function VolumeControl({ audioRef }) {
  const [volume, setVolume] = useState(1)
  const [prevVolume, setPrevVolume] = useState(1)
  const [hov, setHov] = useState(false)

  const toggleMute = () => {
    const audio = audioRef.current
    if (volume > 0) {
      setPrevVolume(volume)
      setVolume(0)
      audio.volume = 0
    } else {
      const v = prevVolume > 0 ? prevVolume : 1
      setVolume(v)
      audio.volume = v
    }
  }

  const handleSlider = (e) => {
    const v = Number(e.target.value)
    setVolume(v)
    audioRef.current.volume = v
    if (v > 0) setPrevVolume(v)
  }

  const muted = volume === 0

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 0 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Slider — slides in on hover */}
      <div style={{
        overflow: 'hidden',
        width: hov ? 72 : 0,
        marginRight: hov ? 6 : 0,
        transition: 'width 0.2s ease, margin-right 0.2s ease',
        display: 'flex', alignItems: 'center',
      }}>
        <input
          type="range" min="0" max="1" step="0.02"
          value={volume}
          onChange={handleSlider}
          style={{
            width: 72, cursor: 'pointer',
            accentColor: accent[500],
            background: 'transparent',
          }}
        />
      </div>

      {/* Icon */}
      <button
        onClick={toggleMute}
        title={muted ? 'Unmute' : 'Mute'}
        style={{
          width: 28, height: 28, borderRadius: 6,
          background: hov ? 'rgba(255,255,255,0.07)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: muted ? neutral[600] : text.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.12s, background 0.12s', flexShrink: 0,
        }}
      >
        {muted ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : volume < 0.5 ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
      </button>
    </div>
  )
}
