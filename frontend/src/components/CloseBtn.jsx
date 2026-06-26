import { useState } from 'react'
import { text } from '../theme'

// Shared modal close button. Previously copy-pasted into every modal.
export default function CloseBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none', borderRadius: 6,
        color: hov ? text.primary : text.muted,
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}
