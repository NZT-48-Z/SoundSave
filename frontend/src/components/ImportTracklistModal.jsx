import { useState } from 'react'
import { importBatch } from '../api'
import { accent, bg, border, neutral, semantic, text } from '../theme'
import CloseBtn from './CloseBtn'

const IS_URL = /^https?:\/\//
const IS_TIMESTAMP = /^\d+:\d+/

function parseInput(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const items = []
  const seenUrls = new Set()
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (IS_TIMESTAMP.test(line)) { i++; continue }

    const isUrl = IS_URL.test(line)
    const next = lines[i + 1]
    const nextIsUrl = next && IS_URL.test(next) && !IS_TIMESTAMP.test(next)

    if (!isUrl && nextIsUrl) {
      // title + URL pair — use URL directly, title from text
      if (!seenUrls.has(next)) {
        seenUrls.add(next)
        const dash = line.indexOf(' - ')
        items.push({
          kind: 'direct',
          url: next,
          title: dash > -1 ? line.slice(dash + 3) : line,
          artist: dash > -1 ? line.slice(0, dash) : '',
          label: line,
        })
      }
      i += 2
    } else if (isUrl) {
      if (!seenUrls.has(line)) {
        seenUrls.add(line)
        items.push({ kind: 'url', value: line, label: line })
      }
      i++
    } else {
      items.push({ kind: 'query', value: line, label: line })
      i++
    }
  }
  return items
}

function getHost(url) {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return url }
}

export default function ImportTracklistModal({ onClose, onBatchAdd }) {
  const [rawText, setRawText] = useState('')
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | resolving | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null) // { added, skipped }

  const items = parseInput(rawText)
  const directCount = items.filter(i => i.kind === 'direct').length
  const urlCount = items.filter(i => i.kind === 'url').length
  const queryCount = items.filter(i => i.kind === 'query').length
  const needsNetwork = urlCount + queryCount

  const handleAdd = async () => {
    if (items.length === 0 || phase === 'resolving') return
    setPhase('resolving')
    setProgress({ done: 0, total: items.length })

    const tracks = []

    // Direct items need no network
    for (const item of items.filter(i => i.kind === 'direct')) {
      tracks.push({ id: crypto.randomUUID(), url: item.url, title: item.title, artist: item.artist, artwork_url: null })
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    // Resolve/search items via batch endpoint
    const networkItems = items
      .filter(i => i.kind === 'url' || i.kind === 'query')
      .map(i => ({ type: i.kind === 'url' ? 'url' : 'query', value: i.value }))

    if (networkItems.length > 0) {
      try {
        const res = await importBatch(networkItems)
        for (const r of res.results) {
          if (r.track) {
            tracks.push({ id: crypto.randomUUID(), url: r.track.url, title: r.track.title, artist: r.track.artist, artwork_url: r.track.artwork_url || null })
          }
          setProgress(p => ({ ...p, done: p.done + 1 }))
        }
        setSummary({ added: tracks.length, skipped: items.length - tracks.length })
      } catch {
        setPhase('error')
        return
      }
    } else {
      setSummary({ added: tracks.length, skipped: 0 })
    }

    onBatchAdd(tracks)
    setPhase('done')
    setTimeout(onClose, 900)
  }

  const descParts = []
  if (queryCount) descParts.push(`${queryCount} name${queryCount !== 1 ? 's' : ''}`)
  if (urlCount) descParts.push(`${urlCount} URL${urlCount !== 1 ? 's' : ''}`)
  if (directCount) descParts.push(`${directCount} direct`)

  const isResolving = phase === 'resolving'
  const isDone = phase === 'done'
  const isError = phase === 'error'

  return (
    <div
      onClick={!isResolving ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.76)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg.overlay, border: `1px solid ${border.default}`,
          borderRadius: 16, padding: 28, width: 500,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'fadeIn 0.2s ease', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: `linear-gradient(135deg, ${accent[500]}, ${accent[700]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: text.primary }}>Import Tracklist</span>
          </div>
          {!isResolving && <CloseBtn onClick={onClose} />}
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: text.muted, lineHeight: 1.65, margin: 0, flexShrink: 0 }}>
          Paste track names, YouTube links, or a mix. One item per line — timestamps are skipped automatically.
        </p>

        {/* Textarea */}
        <textarea
          autoFocus
          value={rawText}
          disabled={isResolving || isDone}
          onChange={e => setRawText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={'Ghost of Tsushima - Seion\nKatana Zero - Overdose\nhttps://youtu.be/EO2lkMIxvUU'}
          style={{
            width: '100%', minHeight: 150, maxHeight: 240,
            background: bg.page,
            border: `1px solid ${focused ? accent[500] : border.default}`,
            borderRadius: 9, padding: '12px 14px',
            color: isResolving || isDone ? text.muted : text.primary,
            fontSize: 13, lineHeight: 1.65,
            resize: 'vertical', outline: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: focused ? `0 0 0 3px ${accent.subtle}` : 'none',
            boxSizing: 'border-box', flexShrink: 0,
          }}
        />

        {/* Item preview list */}
        {items.length > 0 && !isResolving && !isDone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: text.muted }}>
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
              {descParts.length > 0 && (
                <span style={{ fontSize: 11, color: text.muted, opacity: 0.6 }}>· {descParts.join(', ')}</span>
              )}
            </div>
            <div style={{
              overflowY: 'auto', flex: 1,
              borderRadius: 9, border: `1px solid ${border.default}`,
              background: bg.page,
            }}>
              {items.map((item, i) => (
                <ItemRow key={i} item={item} isLast={i === items.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* Progress state */}
        {isResolving && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent[500]} strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontSize: 13, color: text.secondary }}>
                  {progress.done < directCount
                    ? 'Preparing…'
                    : `Searching${needsNetwork > 0 ? ` ${progress.done - directCount} / ${needsNetwork}` : '…'}`
                  }
                </span>
              </div>
              <span style={{ fontSize: 12, color: text.muted }}>{progress.done} / {progress.total}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: border.default, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: accent[500],
                borderRadius: 2,
                transition: 'width 0.2s ease',
              }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: semantic.successBg, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 9, flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={semantic.success} strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: 13, color: semantic.success }}>
              {summary.added} track{summary.added !== 1 ? 's' : ''} added to queue
              {summary.skipped > 0 && <span style={{ color: text.muted, fontWeight: 400 }}> · {summary.skipped} not found</span>}
            </span>
          </div>
        )}

        {isError && (
          <p style={{ fontSize: 13, color: semantic.error, margin: 0, flexShrink: 0 }}>
            Something went wrong. Check your connection and try again.
          </p>
        )}

        {/* Add button */}
        {!isDone && (
          <button
            onClick={handleAdd}
            disabled={items.length === 0 || isResolving}
            style={{
              padding: '11px 16px', flexShrink: 0,
              background: items.length === 0 ? 'transparent' : accent[500],
              border: items.length === 0 ? `1px solid ${border.default}` : 'none',
              borderRadius: 8,
              color: items.length === 0 ? text.muted : 'white',
              fontSize: 14, fontWeight: 600,
              cursor: items.length === 0 || isResolving ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 0.15s',
              fontFamily: "'Space Grotesk', sans-serif",
              opacity: isResolving ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (items.length > 0 && !isResolving) e.currentTarget.style.background = accent[600] }}
            onMouseLeave={e => { if (items.length > 0 && !isResolving) e.currentTarget.style.background = accent[500] }}
          >
            {isResolving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Working…
              </>
            ) : items.length > 0 ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add {items.length} track{items.length !== 1 ? 's' : ''} to Queue
              </>
            ) : (
              'Paste your list above'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function ItemRow({ item, isLast }) {
  const [hov, setHov] = useState(false)
  const isUrl = item.kind === 'url'
  const isDirect = item.kind === 'direct'

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px',
        borderBottom: isLast ? 'none' : `1px solid ${border.subtle}`,
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Type icon */}
      <div style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: isDirect ? 'rgba(249,115,22,0.1)' : isUrl ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isDirect ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={accent[500]} strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        ) : isUrl ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={semantic.info} strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        )}
      </div>

      {/* Label */}
      <span style={{
        flex: 1, fontSize: 12, color: text.secondary,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {isDirect
          ? `${item.artist ? item.artist + ' — ' : ''}${item.title}`
          : isUrl
            ? getHost(item.value)
            : item.value
        }
      </span>

      {/* Suffix */}
      {isDirect && (
        <span style={{ fontSize: 10, color: text.muted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {getHost(item.url)}
        </span>
      )}
    </div>
  )
}
