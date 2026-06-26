import { useState } from 'react'
import { startBulkDownload } from '../api'
import { bg, border, text } from '../theme'
import AlternativesPanel from './AlternativesPanel'
import CoverPickerModal from './CoverPickerModal'
import { isModifiedTitle } from '../utils/trackModifiers'

function fmt(sec) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function InlineInput({ value, onChange, placeholder, color }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: focused ? '#18181b' : 'transparent',
        border: `1px solid ${focused ? '#3f3f46' : 'transparent'}`,
        borderRadius: 5, padding: '5px 7px',
        color: color || '#fafafa', fontSize: 13,
        fontWeight: color ? 400 : 500,
        width: '100%', fontFamily: "'Space Grotesk', sans-serif",
        transition: 'border-color 0.1s', outline: 'none',
      }}
    />
  )
}

export default function QueuePanel({ queue, onRemove, onUpdate, onClear, onDownloaded, showToast }) {
  const [selected, setSelected] = useState(new Set())
  const [bulkAlbum, setBulkAlbum] = useState('')
  const [bulkGenre, setBulkGenre] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [coverPickerId, setCoverPickerId] = useState(null)

  const allSelected = queue.length > 0 && selected.size === queue.length
  const hasSelected = selected.size > 0

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(queue.map(i => i.id)))
  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const applyBulk = () => {
    selected.forEach(id => {
      const u = {}
      if (bulkAlbum.trim()) u.album = bulkAlbum.trim()
      if (bulkGenre.trim()) u.genre = bulkGenre.trim()
      if (Object.keys(u).length) onUpdate(id, u)
    })
    setBulkAlbum('')
    setBulkGenre('')
  }

  const handleDownload = async () => {
    if (!queue.length) return
    setLoading(true)
    try {
      const items = queue.map(i => ({
        url: i.url, title: i.title, artist: i.artist,
        album: i.album || null, genre: i.genre || null,
        artwork_url: i.artwork_url || null,
        artwork_local_path: i.artwork_local_path || null,
      }))
      const result = await startBulkDownload(items)
      onDownloaded(queue.map(i => i.id), result.ids || [])
    } catch (e) {
      console.error('Download failed', e)
      showToast?.('Download failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Queue total duration
  const queueTotalSecs = queue.reduce((s, item) => {
    const p = (item.duration || '0:00').toString().split(':').map(Number)
    return s + (p.length === 2 ? p[0] * 60 + p[1] : 0)
  }, 0)
  const queueTotalMins = Math.floor(queueTotalSecs / 60)
  const queueTotalDuration = queueTotalMins > 0 ? `${queueTotalMins} min` : null

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      {!queue.length ? (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0 180px', gap: 14, textAlign: 'center', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, #2e2e32 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 80%)',
            maskImage: 'radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 80%)',
            pointerEvents: 'none',
          }} />
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="1" strokeLinecap="round" style={{ position: 'relative' }}>
            <line x1="21" y1="10" x2="7" y2="10"/>
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="14" x2="7" y2="14"/>
            <line x1="21" y1="18" x2="3" y2="18"/>
          </svg>
          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: 15, color: text.muted, fontWeight: 500, marginBottom: 6 }}>Queue is empty</p>
            <p style={{ fontSize: 13, color: text.muted, opacity: 0.7 }}>Add tracks from Search to build your download queue</p>
          </div>
        </div>
      ) : (
        <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{queue.length} tracks in queue</span>
          {queueTotalDuration && (
            <span style={{ fontSize: 12, color: text.muted }}>· {queueTotalDuration}</span>
          )}
          <ToolbarBtn onClick={toggleAll}>{allSelected ? 'Deselect All' : 'Select All'}</ToolbarBtn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { onClear(); setSelected(new Set()) }}
            style={{
              padding: '7px 12px', background: 'transparent',
              border: `1px solid ${border.default}`, borderRadius: 7,
              color: text.secondary, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Clear
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{
              padding: '7px 16px', background: loading ? '#7c3010' : '#f97316',
              border: 'none', borderRadius: 7, color: 'white',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#c2410c' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#f97316' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {loading ? 'Starting…' : 'Download All'}
          </button>
        </div>
      </div>

      {/* Bulk edit panel */}
      {hasSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '10px 14px',
          background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.18)',
          borderRadius: 8, flexWrap: 'wrap', animation: 'fadeIn 0.15s ease',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600, whiteSpace: 'nowrap' }}>{selected.size} selected —</span>
          <BulkInput value={bulkAlbum} onChange={setBulkAlbum} placeholder="Album for all…" width={140} />
          <BulkInput value={bulkGenre} onChange={setBulkGenre} placeholder="Genre for all…" width={120} />
          <button
            onClick={applyBulk}
            style={{
              padding: '4px 12px', background: '#f97316', border: 'none', borderRadius: 5,
              color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
            onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
          >Apply</button>
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 44px 1fr 1fr 150px 110px 32px',
        gap: 8, padding: '0 8px 8px', borderBottom: `1px solid ${border.default}`, marginBottom: 2,
        alignItems: 'center',
      }}>
        <div />
        <div />
        {['Title', 'Artist', 'Album', 'Genre'].map(h => (
          <div key={h} style={{ fontSize: 11, fontWeight: 600, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
        ))}
        <div />
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {queue.map(item => {
          const modified = isModifiedTitle(item.title)
          const expanded = expandedId === item.id
          return (
            <div key={item.id}>
              <QueueRow
                item={item}
                isSelected={selected.has(item.id)}
                isModified={modified}
                isExpanded={expanded}
                onToggle={() => toggle(item.id)}
                onUpdate={(field, val) => onUpdate(item.id, { [field]: val })}
                onRemove={() => { onRemove(item.id); setSelected(prev => { const n = new Set(prev); n.delete(item.id); return n }); if (expandedId === item.id) setExpandedId(null) }}
                onToggleAlternatives={() => setExpandedId(expanded ? null : item.id)}
                onPickCover={() => setCoverPickerId(item.id)}
              />
              {expanded && modified && (
                <AlternativesPanel
                  item={item}
                  onReplace={track => {
                    onUpdate(item.id, {
                      url: track.url,
                      title: track.title,
                      artist: track.artist,
                      artwork_url: track.artwork_url || null,
                    })
                    setExpandedId(null)
                    showToast?.(`Replaced with "${track.title}"`)
                  }}
                  onKeep={() => setExpandedId(null)}
                  onClose={() => setExpandedId(null)}
                />
              )}
            </div>
          )
        })}
      </div>
        </>
      )}

      {coverPickerId && (() => {
        const picked = queue.find(i => i.id === coverPickerId)
        return picked ? (
          <CoverPickerModal
            item={picked}
            onClose={() => setCoverPickerId(null)}
            onConfirm={({ url, path }) => {
              onUpdate(coverPickerId, { artwork_url: url, artwork_local_path: path })
              setCoverPickerId(null)
            }}
          />
        ) : null
      })()}
    </div>
  )
}

function QueueRow({ item, isSelected, isModified, isExpanded, onToggle, onUpdate, onRemove, onToggleAlternatives, onPickCover }) {
  const [delHov, setDelHov] = useState(false)
  const [warnHov, setWarnHov] = useState(false)
  const [rowHov, setRowHov] = useState(false)
  const [thumbHov, setThumbHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setRowHov(true)}
      onMouseLeave={() => setRowHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: '32px 44px 1fr 1fr 150px 110px 32px',
        gap: 8, padding: '5px 8px',
        borderRadius: isExpanded ? '7px 7px 0 0' : 7,
        background: isExpanded
          ? 'rgba(234,179,8,0.04)'
          : isSelected ? 'rgba(249,115,22,0.05)'
          : rowHov ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottom: isExpanded ? '1px solid rgba(234,179,8,0.15)' : 'none',
        alignItems: 'center', transition: 'background 0.1s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggle} style={{ width: 15, height: 15 }} />
      </div>
      <div
        onClick={onPickCover}
        onMouseEnter={() => setThumbHov(true)}
        onMouseLeave={() => setThumbHov(false)}
        style={{
          width: 40, height: 40, borderRadius: 6,
          background: item.color || '#18181b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          overflow: 'hidden', cursor: 'pointer', position: 'relative',
        }}
      >
        {item.artwork_url ? (
          <img src={item.artwork_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        )}
        {thumbHov && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.58)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        )}
      </div>

      {/* Title cell — with optional warning badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <InlineInput value={item.title} onChange={v => onUpdate('title', v)} placeholder="Title" />
        {isModified && (
          <button
            onClick={onToggleAlternatives}
            onMouseEnter={() => setWarnHov(true)}
            onMouseLeave={() => setWarnHov(false)}
            title="Modified version detected — click to find originals"
            style={{
              flexShrink: 0, width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isExpanded ? 'rgba(234,179,8,0.15)' : warnHov ? 'rgba(234,179,8,0.1)' : 'transparent',
              border: `1px solid ${isExpanded || warnHov ? 'rgba(234,179,8,0.4)' : 'rgba(234,179,8,0.2)'}`,
              borderRadius: 5, cursor: 'pointer', transition: 'all 0.12s',
              color: '#eab308',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
        )}
      </div>

      <InlineInput value={item.artist} onChange={v => onUpdate('artist', v)} placeholder="Artist" color="#a1a1aa" />
      <InlineInput value={item.album} onChange={v => onUpdate('album', v)} placeholder="Album" color="#71717a" />
      <InlineInput value={item.genre} onChange={v => onUpdate('genre', v)} placeholder="Genre" color="#71717a" />
      <button
        onClick={onRemove}
        onMouseEnter={() => setDelHov(true)}
        onMouseLeave={() => setDelHov(false)}
        style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: delHov ? 'rgba(239,68,68,0.1)' : 'transparent',
          border: 'none', borderRadius: 5,
          color: delHov ? '#ef4444' : '#52525b',
          cursor: 'pointer', transition: 'all 0.1s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  )
}

function ToolbarBtn({ children, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '4px 10px', background: 'transparent',
        border: `1px solid ${border.default}`, borderRadius: 5,
        color: hov ? '#fafafa' : '#71717a', fontSize: 12,
        cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
        transition: 'all 0.15s',
        borderColor: hov ? '#3f3f46' : '#27272a',
      }}
    >{children}</button>
  )
}

function BulkInput({ value, onChange, placeholder, width }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: '4px 9px', background: bg.surface,
        border: `1px solid ${focused ? '#f97316' : '#27272a'}`,
        borderRadius: 5, color: text.primary, fontSize: 12, width,
        outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
      }}
    />
  )
}
