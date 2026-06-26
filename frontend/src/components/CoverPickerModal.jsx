import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uploadCover } from '../api'
import { accent, bg, border, neutral, semantic, text } from '../theme'

export default function CoverPickerModal({ item, onClose, onConfirm }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleFile = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('Only image files are allowed')
      return
    }
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleConfirm = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await uploadCover(file)
      onConfirm(result)
    } catch {
      setError('Upload failed — try again')
      setLoading(false)
    }
  }

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
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={handleDrop}
        style={{
          background: bg.overlay,
          border: `1px solid ${dragging ? accent[500] : border.default}`,
          borderRadius: 12, padding: 24,
          width: 340, display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          transition: 'border-color 0.15s',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: text.primary }}>Change cover</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: text.muted, cursor: 'pointer',
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, transition: 'color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = text.primary}
            onMouseLeave={e => e.currentTarget.style.color = text.muted}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Before / After previews */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <CoverThumb src={item.artwork_url} label="Current" />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <CoverThumb src={preview} label="New" highlight onClick={() => inputRef.current?.click()} />
        </div>

        {/* Drop zone hint */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? accent[500] : border.default}`,
            borderRadius: 8, padding: '18px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
            background: dragging ? 'rgba(249,115,22,0.05)' : 'transparent',
            userSelect: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dragging ? accent[500] : text.muted} strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span style={{ fontSize: 13, color: dragging ? accent[500] : text.secondary }}>
            {dragging ? 'Drop image here' : file ? file.name : 'Click or drag image here'}
          </span>
          <span style={{ fontSize: 11, color: text.muted }}>JPG · PNG · WebP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {error && (
          <span style={{ fontSize: 12, color: semantic.error, textAlign: 'center' }}>{error}</span>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px', background: 'transparent',
              border: `1px solid ${border.default}`, borderRadius: 7,
              color: text.secondary, fontSize: 13, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = border.strong}
            onMouseLeave={e => e.currentTarget.style.borderColor = border.default}
          >Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!file || loading}
            style={{
              padding: '7px 14px',
              background: !file || loading ? 'rgba(249,115,22,0.35)' : accent[500],
              border: 'none', borderRadius: 7,
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: !file || loading ? 'default' : 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (file && !loading) e.currentTarget.style.background = accent[600] }}
            onMouseLeave={e => { if (file && !loading) e.currentTarget.style.background = accent[500] }}
          >{loading ? 'Uploading…' : 'Apply'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CoverThumb({ src, label, highlight, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <div
        onClick={onClick}
        onMouseEnter={() => onClick && setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: 88, height: 88, borderRadius: 8,
          background: neutral[900], overflow: 'hidden',
          border: `1px solid ${hov ? accent[500] : highlight ? 'rgba(249,115,22,0.3)' : border.default}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative', transition: 'border-color 0.15s',
        }}
      >
        {src ? (
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={highlight ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.15)'}
            strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        )}
        {onClick && hov && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.52)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
