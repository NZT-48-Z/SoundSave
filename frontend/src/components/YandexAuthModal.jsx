import { useEffect, useRef, useState } from 'react'
import { disconnectYandex, pollYandexAuth, startYandexAuth } from '../api'
import { bg, border, text } from '../theme'

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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: bg.overlay, border: `1px solid ${border.default}`, borderRadius: 16, padding: 28, width: 380, maxWidth: 'calc(100vw - 32px)', animation: 'fadeIn 0.2s ease' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: '#fc3f1d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: 'white', letterSpacing: '-0.02em' }}>Я</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fafafa' }}>
              {state === 'connected' ? 'Yandex Music' : 'Connect Yandex Music'}
            </span>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {state === 'connected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>Account connected</div>
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>Yandex Music playlists are available for import</div>
              </div>
            </div>
            {/* Disconnect button */}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                color: disconnecting ? '#52525b' : '#ef4444',
                fontSize: 13, fontWeight: 500, cursor: disconnecting ? 'not-allowed' : 'pointer',
                fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
              onMouseEnter={e => { if (!disconnecting) { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
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

        {state === 'starting' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ fontSize: 13, color: '#71717a' }}>Starting authorization…</span>
          </div>
        )}

        {state === 'waiting' && info && (
          <>
            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.65, marginBottom: 18 }}>
              Open <strong style={{ color: '#d4d4d8' }}>ya.ru/device</strong> and enter this code to link your Yandex Music account:
            </p>
            <div style={{
              background: bg.page, border: `1px solid ${border.strong}`, borderRadius: 8,
              padding: 18, textAlign: 'center', marginBottom: 18,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 500,
              letterSpacing: '0.2em', color: '#fafafa', userSelect: 'all',
            }}>
              {info.user_code}
            </div>
            <a
              href="https://ya.ru/device"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 16px', background: '#f97316', borderRadius: 8,
                color: 'white', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', marginBottom: 14, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
            >
              Open ya.ru/device
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize: 12, color: '#52525b' }}>Waiting for confirmation…</span>
            </div>
          </>
        )}

        {state === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: '#22c55e', fontWeight: 500 }}>Connected! Importing playlist…</p>
          </div>
        )}

        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#ef4444' }}>{errorMsg || 'Something went wrong'}</p>
            <button onClick={onClose} style={{ padding: '9px 16px', background: '#27272a', border: 'none', borderRadius: 7, color: '#fafafa', fontSize: 13, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>Close</button>
          </div>
        )}
      </div>
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
        color: hov ? '#fafafa' : '#71717a', cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}
