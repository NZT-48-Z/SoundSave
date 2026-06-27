import { useState } from 'react'
import { startBulkDownload } from '../api'
import { accent, bg, border, neutral, semantic, text } from '../theme'
import AlternativesPanel from './AlternativesPanel'
import CoverPickerModal from './CoverPickerModal'
import EmptyState from './EmptyState'
import { isModifiedTitle } from '../utils/trackModifiers'
import { fmtDuration, fmtTotalDuration } from '../utils/format'

const COLS = '20px 32px 44px 1fr 1fr 150px 110px 50px 28px 28px'

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
        background: focused ? neutral[900] : 'transparent',
        border: `1px solid ${focused ? neutral[700] : 'transparent'}`,
        borderRadius: 5, padding: '5px 7px',
        color: color || neutral[50], fontSize: 13,
        fontWeight: color ? 400 : 500,
        width: '100%', fontFamily: "'Space Grotesk', sans-serif",
        transition: 'border-color 0.1s', outline: 'none',
      }}
    />
  )
}

export default function QueuePanel({ queue, onRemove, onUpdate, onClear, onReorder, onDownloaded, showToast, onPreview, previewTrackId, isPreviewPlaying, previewLoading }) {
  const [selected, setSelected] = useState(new Set())
  const [bulkArtist, setBulkArtist] = useState('')
  const [bulkAlbum, setBulkAlbum] = useState('')
  const [bulkGenre, setBulkGenre] = useState('')
  const [bulkCover, setBulkCover] = useState(null)
  const [bulkCoverOpen, setBulkCoverOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [coverPickerId, setCoverPickerId] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

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
      if (bulkArtist.trim()) u.artist = bulkArtist.trim()
      if (bulkAlbum.trim()) u.album = bulkAlbum.trim()
      if (bulkGenre.trim()) u.genre = bulkGenre.trim()
      if (bulkCover) { u.artwork_url = bulkCover.url; u.artwork_local_path = bulkCover.path }
      if (Object.keys(u).length) onUpdate(id, u)
    })
    setBulkArtist('')
    setBulkAlbum('')
    setBulkGenre('')
    setBulkCover(null)
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

  const handleDownloadSelected = async () => {
    const items = queue.filter(i => selected.has(i.id))
    if (!items.length) return
    setLoading(true)
    try {
      const payload = items.map(i => ({
        url: i.url, title: i.title, artist: i.artist,
        album: i.album || null, genre: i.genre || null,
        artwork_url: i.artwork_url || null,
        artwork_local_path: i.artwork_local_path || null,
      }))
      const result = await startBulkDownload(payload)
      onDownloaded(items.map(i => i.id), result.ids || [])
    } catch (e) {
      console.error('Download failed', e)
      showToast?.('Download failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const queueTotalSecs = queue.reduce((s, item) => s + (Number(item.duration) || 0), 0)
  const queueTotalDuration = queueTotalSecs > 0 ? fmtTotalDuration(queueTotalSecs) : null

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      {!queue.length ? (
        <EmptyState title="Queue is empty" subtitle="Add tracks from Search to build your download queue">
          <line x1="21" y1="10" x2="7" y2="10"/>
          <line x1="21" y1="6" x2="3" y2="6"/>
          <line x1="21" y1="14" x2="7" y2="14"/>
          <line x1="21" y1="18" x2="3" y2="18"/>
        </EmptyState>
      ) : (
        <>
      {/* Toolbar — sticky below nav */}
      <div style={{
        position: 'sticky', top: 58, zIndex: 10,
        background: bg.page, paddingBottom: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{queue.length} tracks in queue</span>
          {queueTotalDuration && (
            <span style={{ fontSize: 12, color: text.muted }}>· {queueTotalDuration} min</span>
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
            onMouseEnter={e => { e.currentTarget.style.borderColor = semantic.error; e.currentTarget.style.color = semantic.error }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = neutral[800]; e.currentTarget.style.color = neutral[500] }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Clear
          </button>
          {hasSelected && (
            <button
              onClick={handleDownloadSelected}
              disabled={loading}
              style={{
                padding: '7px 14px', background: 'transparent',
                border: `1px solid ${border.default}`, borderRadius: 7,
                color: text.secondary, fontSize: 13, fontWeight: 500,
                cursor: loading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = accent[500]; e.currentTarget.style.color = accent[500] } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border.default; e.currentTarget.style.color = text.secondary }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download ({selected.size})
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{
              padding: '7px 16px', background: loading ? accent[800] : accent[500],
              border: 'none', borderRadius: 7, color: 'white',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = accent[700] }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = accent[500] }}
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent[500]} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span style={{ fontSize: 12, color: accent[500], fontWeight: 600, whiteSpace: 'nowrap' }}>{selected.size} selected —</span>
          <BulkInput value={bulkArtist} onChange={setBulkArtist} placeholder="Artist for all…" width={120} />
          <BulkInput value={bulkAlbum} onChange={setBulkAlbum} placeholder="Album for all…" width={120} />
          <BulkInput value={bulkGenre} onChange={setBulkGenre} placeholder="Genre for all…" width={110} />
          <BulkCoverBtn cover={bulkCover} onClick={() => setBulkCoverOpen(true)} onClear={() => setBulkCover(null)} />
          <button
            onClick={applyBulk}
            style={{
              padding: '4px 12px', background: accent[500], border: 'none', borderRadius: 5,
              color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = accent[700]}
            onMouseLeave={e => e.currentTarget.style.background = accent[500]}
          >Apply</button>
          <button
            onClick={() => {
              selected.forEach(id => onRemove(id))
              setSelected(new Set())
            }}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 5,
              color: semantic.error, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >Remove</button>
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: COLS,
        gap: 8, padding: '0 8px 8px', borderBottom: `1px solid ${border.default}`, marginBottom: 2,
        alignItems: 'center',
      }}>
        <div />
        <div />
        <div />
        {['Title', 'Artist', 'Album', 'Genre'].map(h => (
          <div key={h} style={{ fontSize: 11, fontWeight: 600, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right', paddingRight: 4 }}>Dur.</div>
        <div />
        <div />
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {queue.map((item, index) => {
          const modified = isModifiedTitle(item.title)
          const expanded = expandedId === item.id
          return (
            <div key={item.id}>
              <QueueRow
                item={item}
                index={index}
                isSelected={selected.has(item.id)}
                isModified={modified}
                isExpanded={expanded}
                isDragging={dragIndex === index}
                isDragOver={dragOverIndex === index && dragIndex !== index}
                onToggle={() => toggle(item.id)}
                onUpdate={(field, val) => onUpdate(item.id, { [field]: val })}
                onRemove={() => {
                  onRemove(item.id)
                  setSelected(prev => { const n = new Set(prev); n.delete(item.id); return n })
                  if (expandedId === item.id) setExpandedId(null)
                }}
                onToggleAlternatives={() => setExpandedId(expanded ? null : item.id)}
                onPickCover={() => setCoverPickerId(item.id)}
                onPreview={() => onPreview(item)}
                isPreviewActive={previewTrackId === item.id}
                isPreviewPlaying={isPreviewPlaying}
                previewLoading={previewLoading}
                onDragStart={() => setDragIndex(index)}
                onDragOver={() => setDragOverIndex(index)}
                onDrop={() => {
                  if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                    onReorder(dragIndex, dragOverIndex)
                  }
                  setDragIndex(null)
                  setDragOverIndex(null)
                }}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
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

      {bulkCoverOpen && (
        <CoverPickerModal
          item={queue.find(i => selected.has(i.id)) || {}}
          onClose={() => setBulkCoverOpen(false)}
          onConfirm={({ url, path }) => {
            setBulkCover({ url, path })
            setBulkCoverOpen(false)
          }}
        />
      )}
    </div>
  )
}

function QueueRow({ item, index, isSelected, isModified, isExpanded, isDragging, isDragOver, onToggle, onUpdate, onRemove, onToggleAlternatives, onPickCover, onPreview, isPreviewActive, isPreviewPlaying, previewLoading, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [delHov, setDelHov] = useState(false)
  const [warnHov, setWarnHov] = useState(false)
  const [rowHov, setRowHov] = useState(false)
  const [thumbHov, setThumbHov] = useState(false)
  const [playHov, setPlayHov] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setRowHov(true)}
      onMouseLeave={() => setRowHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: COLS,
        gap: 8, padding: '5px 8px',
        borderRadius: isExpanded ? '7px 7px 0 0' : 7,
        background: isExpanded
          ? 'rgba(234,179,8,0.04)'
          : isSelected ? 'rgba(249,115,22,0.05)'
          : rowHov ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderTop: isDragOver ? `2px solid ${accent[500]}` : '2px solid transparent',
        borderBottom: isExpanded ? '1px solid rgba(234,179,8,0.15)' : 'none',
        alignItems: 'center', transition: 'background 0.1s',
        opacity: isDragging ? 0.4 : 1,
      }}>

      {/* Drag handle */}
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: rowHov ? neutral[600] : 'transparent',
          cursor: 'grab', transition: 'color 0.1s', userSelect: 'none',
        }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="2.5" r="1.2"/>
          <circle cx="7" cy="2.5" r="1.2"/>
          <circle cx="3" cy="7" r="1.2"/>
          <circle cx="7" cy="7" r="1.2"/>
          <circle cx="3" cy="11.5" r="1.2"/>
          <circle cx="7" cy="11.5" r="1.2"/>
        </svg>
      </div>

      {/* Checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggle} style={{ width: 15, height: 15 }} />
      </div>

      {/* Artwork */}
      <div
        onClick={onPickCover}
        onMouseEnter={() => setThumbHov(true)}
        onMouseLeave={() => setThumbHov(false)}
        style={{
          width: 40, height: 40, borderRadius: 6,
          background: item.color || neutral[900],
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
              color: semantic.warning,
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

      <InlineInput value={item.artist} onChange={v => onUpdate('artist', v)} placeholder="Artist" color={neutral[400]} />
      <InlineInput value={item.album} onChange={v => onUpdate('album', v)} placeholder="Album" color={neutral[500]} />
      <InlineInput value={item.genre} onChange={v => onUpdate('genre', v)} placeholder="Genre" color={neutral[500]} />

      {/* Duration */}
      <div style={{ fontSize: 11, color: neutral[600], fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', paddingRight: 4 }}>
        {item.duration > 0 ? fmtDuration(item.duration) : ''}
      </div>

      {/* Preview button */}
      <button
        onClick={onPreview}
        onMouseEnter={() => setPlayHov(true)}
        onMouseLeave={() => setPlayHov(false)}
        title="Preview"
        style={{
          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isPreviewActive ? 'rgba(249,115,22,0.12)' : playHov ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: `1px solid ${isPreviewActive ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
          borderRadius: 5,
          color: isPreviewActive ? accent[500] : playHov ? text.secondary : neutral[600],
          cursor: 'pointer', transition: 'all 0.1s', padding: 0,
        }}
      >
        {isPreviewActive && previewLoading ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : isPreviewActive && isPreviewPlaying ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1"/>
            <rect x="15" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21"/>
          </svg>
        )}
      </button>

      {/* Delete button */}
      <button
        onClick={onRemove}
        onMouseEnter={() => setDelHov(true)}
        onMouseLeave={() => setDelHov(false)}
        style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: delHov ? semantic.errorBg : 'transparent',
          border: 'none', borderRadius: 5,
          color: delHov ? semantic.error : neutral[600],
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
        color: hov ? neutral[50] : neutral[500], fontSize: 12,
        cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
        transition: 'all 0.15s',
        borderColor: hov ? neutral[700] : neutral[800],
      }}
    >{children}</button>
  )
}

function BulkCoverBtn({ cover, onClick, onClear }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title="Set cover for all selected"
        style={{
          height: 28, padding: '0 8px',
          background: cover ? 'rgba(249,115,22,0.12)' : bg.surface,
          border: `1px solid ${cover ? accent[500] : hov ? neutral[700] : neutral[800]}`,
          borderRadius: 5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          color: cover ? accent[500] : hov ? text.primary : text.secondary,
          fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
          transition: 'all 0.12s',
        }}
      >
        {cover ? (
          <img src={cover.url} alt="" style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover' }} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )}
        <span>{cover ? 'Cover set' : 'Cover…'}</span>
      </button>
      {cover && (
        <button
          onClick={onClear}
          title="Clear cover"
          style={{
            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: neutral[500], padding: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = semantic.error}
          onMouseLeave={e => e.currentTarget.style.color = neutral[500]}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
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
        border: `1px solid ${focused ? accent[500] : neutral[800]}`,
        borderRadius: 5, color: text.primary, fontSize: 12, width,
        outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
      }}
    />
  )
}
