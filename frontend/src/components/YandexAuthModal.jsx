import { useEffect, useRef, useState } from 'react'
import { disconnectYandex, pollYandexAuth, startYandexAuth } from '../api'
import { accent, bg, border, neutral, semantic, text } from '../theme'
import CloseBtn from './CloseBtn'

export default function YandexAuthModal({ onSuccess, onClose, onDisconnect, isConnected }) {
  const [state, setState] = useState(isConnected ? 'connected' : 'starting')
  const [info, setInfo] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const pollRef = useRef(null)
  const sessionRef = useRef(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (isConnected) return
    cancelRef.current = false

    async function begin() {
      try {
        const data = await startYandexAuth()
        if (cancelRef.current) return
        setInfo(data)
        sessionRef.current = data.session_id
        setState('waiting')
        schedulePoll()
      } catch (e) {
        if (!cancelRef.current) { setErrorMsg(e.message); setState('error') }
      }
    }

    function schedulePoll() {
      pollRef.current = setTimeout(async () => {
        if (cancelRef.current || !sessionRef.current) return
        try {
          const res = await pollYandexAuth(sessionRef.current)
          if (cancelRef.current) return
          if (res.status === 'done') { setState('done'); setTimeout(onSuccess, 700) }
          else if (res.status === 'error') { setState('error'); setErrorMsg(res.error || 'Authorization failed') }
          else schedulePoll()
        } catch { if (!cancelRef.current) schedulePoll() }
      }, 3000)
    }

    begin()
    return () => { cancelRef.current = true; clearTimeout(pollRef.current) }
  }, [isConnected, onSuccess])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectYandex()
      onDisconnect?.()
      onClose()
    } catch {
      setDisconnecting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(8px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg.overlay, border: `1px solid ${border.default}`,
          borderRadius: 16, padding: 28, width: 400,
          maxWidth: 'calc(100vw - 32px)',
          animation: 'fadeIn 0.22s ease',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#fc3f1d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 17, color: 'white', letterSpacing: '-0.02em',
              boxShadow: '0 2px 10px rgba(252,63,29,0.4)',
              flexShrink: 0,
            }}>Я</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: text.primary }}>
              {state === 'connected' ? 'Yandex Music' : 'Connect Yandex Music'}
            </span>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Connected state */}
        {state === 'connected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: semantic.successBg, border: `1px solid rgba(34,197,94,0.18)`, borderRadius: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={semantic.success} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: text.primary }}>Account connected</div>
                <div style={{ fontSize: 12, color: text.secondary, marginTop: 2 }}>Yandex Music playlists are available for import</div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: `1px solid rgba(239,68,68,0.28)`, borderRadius: 8,
                color: disconnecting ? text.muted : semantic.error,
                fontSize: 13, fontWeight: 500,
                cursor: disconnecting ? 'not-allowed' : 'pointer',
                fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
              onMouseEnter={e => { if (!disconnecting) { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.28)' }}
            >
              {disconnecting ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              )}
              {disconnecting ? 'Disconnecting…' : 'Disconnect account'}
            </button>
          </div>
        )}

        {/* Starting state */}
        {state === 'starting' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent[500]} strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ fontSize: 13, color: text.muted }}>Starting authorization…</span>
          </div>
        )}

        {/* Waiting state */}
        {state === 'waiting' && info && (
          <>
            <p style={{ fontSize: 13, color: text.secondary, lineHeight: 1.65, marginBottom: 18 }}>
              Open <strong style={{ color: text.primary }}>ya.ru/device</strong> and enter this code to link your Yandex Music account:
            </p>
            <div style={{
              background: bg.page, border: `1px solid ${border.strong}`, borderRadius: 10,
              padding: '20px 18px', textAlign: 'center', marginBottom: 18,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 500,
              letterSpacing: '0.22em', color: text.primary, userSelect: 'all',
            }}>
              {info.user_code}
            </div>
            <a
              href="https://ya.ru/device"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 16px', background: accent[500], borderRadius: 8,
                color: 'white', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', marginBottom: 14, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = accent[600]}
              onMouseLeave={e => e.currentTarget.style.background = accent[500]}
            >
              Open ya.ru/device
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize: 12, color: text.muted }}>Waiting for confirmation…</span>
            </div>
          </>
        )}

        {/* Done state */}
        {state === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: semantic.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={semantic.success} strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: semantic.success, fontWeight: 500 }}>Connected! Importing playlist…</p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px 14px', background: semantic.errorBg, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: semantic.error, margin: 0 }}>{errorMsg || 'Something went wrong'}</p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: `1px solid ${border.default}`, borderRadius: 8,
                color: text.secondary, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = text.primary }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = text.secondary }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
