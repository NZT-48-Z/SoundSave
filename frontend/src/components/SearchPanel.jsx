import { useCallback, useEffect, useRef, useState } from 'react'
import { importFromYandex, resolveUrl, searchTracks } from '../api'
import { accent, bg, border, semantic, text } from '../theme'
import { fmtDuration } from '../utils/format'
import EmptyState from './EmptyState'

const SC_URL = /soundcloud\.com\//i
const YM_URL = /music\.yandex\.(ru|com)\/playlists\//i

function TrackCard({ track, isAdded, onAdd, onRemove, index }) {
  const [hov, setHov] = useState(false)

  return (
    <div
      style={{
        background: bg.surface,
        border: `1px solid ${hov ? (isAdded ? 'rgba(239,68,68,0.45)' : border.accent) : border.default}`,
        borderRadius: 10, overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov ? '0 12px 32px rgba(0,0,0,0.55)' : '0 0 0 rgba(0,0,0,0)',
        animation: 'cardIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${Math.min(index * 40, 480)}ms`,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => isAdded ? onRemove() : onAdd()}
    >
      {/* Artwork */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', background: track.color || '#18181b' }}>
        {track.artwork_url ? (
          <img
            src={track.artwork_url}
            alt={track.title}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
              transform: hov ? 'scale(1.04)' : 'scale(1)',
            }}
            loading="lazy"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: isAdded
            ? 'rgba(0,0,0,0.45)'
            : `rgba(0,0,0,${hov ? 0.42 : 0})`,
          transition: 'background 0.22s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isAdded ? (
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: hov ? 'rgba(239,68,68,0.88)' : 'rgba(34,197,94,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.18s',
              boxShadow: hov ? '0 4px 16px rgba(239,68,68,0.45)' : 'none',
            }}>
              {hov ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          ) : hov && (
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(249,115,22,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(249,115,22,0.5)',
              animation: 'fadeIn 0.15s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
          )}
        </div>

        {track.duration > 0 && (
          <div style={{
            position: 'absolute', bottom: 7, right: 7,
            background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)',
            borderRadius: 4, padding: '2px 6px', fontSize: 11,
            color: '#d4d4d8', fontFamily: "'JetBrains Mono', monospace",
            transition: 'opacity 0.2s',
            opacity: hov ? 0 : 1,
          }}>
            {fmtDuration(track.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '11px 12px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: text.primary, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
        <div style={{ fontSize: 12, color: hov ? text.secondary : text.muted, marginBottom: isAdded ? 8 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.15s' }}>{track.artist}</div>
        {isAdded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: hov ? 'rgba(239,68,68,0.9)' : semantic.success, fontSize: 11, fontWeight: 500, transition: 'color 0.18s' }}>
            {hov ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {hov ? 'Remove from queue' : 'Added to queue'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPanel({ queue, onAddToQueue, onRemoveFromQueue, showToast, yandexConnected, onYandexConnected, onOpenYandexAuth, onOpenImport }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [importStats, setImportStats] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const pendingYandexUrl = useRef(null)
  const debounce = useRef(null)
  const currentQuery = useRef('')

  const PAGE_SIZE = 20

  const doSearch = useCallback(async (q, p = 1) => {
    if (!q.trim()) { setResults([]); setImportStats(null); setPage(1); setHasMore(false); return }
    setLoading(true)
    setError('')
    if (p === 1) setImportStats(null)
    currentQuery.current = q
    try {
      let tracks
      if (YM_URL.test(q)) {
        setLoadingMsg('Fetching Yandex Music playlist…')
        try {
          const res = await importFromYandex(q)
          tracks = res.results || []
          setImportStats({ total: res.total, found: res.found, not_found: res.not_found })
          setHasMore(false)
        } catch (e) {
          if (e.code === 'YANDEX_NOT_CONNECTED') {
            pendingYandexUrl.current = q
            onOpenYandexAuth?.()
            setLoading(false)
            setLoadingMsg('')
            return
          }
          throw e
        }
      } else if (SC_URL.test(q)) {
        setLoadingMsg('Resolving SoundCloud URL…')
        const res = await resolveUrl(q)
        if (res.type === 'playlist') tracks = res.tracks || []
        else if (res.id) tracks = [res]
        else tracks = []
        setHasMore(false)
      } else {
        setLoadingMsg('')
        const res = await searchTracks(q, p, PAGE_SIZE)
        tracks = res.results || []
        setHasMore(res.has_more)
        setPage(p)
      }
      setResults(tracks)
    } catch {
      setError('Failed. Check the URL or try again.')
      setResults([])
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [onOpenYandexAuth])

  const handleInput = (e) => {
    const val = e.target.value
    setQuery(val)
    setPage(1)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => doSearch(val, 1), 500)
  }

  const handleAdd = (track) => {
    onAddToQueue(track)
  }

  const handleRemove = (track) => {
    onRemoveFromQueue(track.id)
  }

  const isInQueue = (id) => queue.some(q => q.id === id)

  const handleAddAll = () => {
    results.filter(t => !isInQueue(t.id)).forEach(t => handleAdd(t))
  }

  const addAllCount = results.filter(t => !isInQueue(t.id)).length

  const goToPage = (p) => {
    doSearch(currentQuery.current || query, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (yandexConnected && pendingYandexUrl.current) {
      doSearch(pendingYandexUrl.current)
      pendingYandexUrl.current = null
    }
  }, [yandexConnected, doSearch])

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
        {/* Search bar + Import button on same row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: text.muted, display: 'flex', pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <SearchInput value={query} onChange={handleInput} loading={loading} />
          </div>
          <ImportListBtn onClick={onOpenImport} />
        </div>

        {/* Results toolbar */}
        {results.length > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: text.muted }}>
              {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + results.length} tracks
              {hasMore && <span> · more available</span>}
              {importStats && <span> · {importStats.not_found} not found on SoundCloud</span>}
            </span>
            {addAllCount > 0 && (
              <button
                onClick={handleAddAll}
                style={{
                  padding: '7px 14px', background: accent[500], border: 'none', borderRadius: 7,
                  color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.background = accent[600]}
                onMouseLeave={e => e.currentTarget.style.background = accent[500]}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add All ({addAllCount})
              </button>
            )}
          </div>
        )}

        {error && <p style={{ color: semantic.error, fontSize: 13, marginBottom: 16 }}>{error}</p>}

        {/* Loading skeleton */}
        {loading && (
          <div>
            {loadingMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent[500]} strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontSize: 13, color: text.muted }}>{loadingMsg}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(188px, 1fr))', gap: 13 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', background: bg.surface, border: `1px solid ${border.default}`, animationDelay: `${i * 60}ms` }}>
                  <div className="skeleton" style={{ width: '100%', paddingBottom: '100%' }} />
                  <div style={{ padding: '11px 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div className="skeleton" style={{ height: 14, width: '80%' }} />
                    <div className="skeleton" style={{ height: 12, width: '55%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Track grid */}
        {!loading && results.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(188px, 1fr))', gap: 13 }}>
              {results.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  index={index}
                  isAdded={isInQueue(track.id)}
                  onAdd={() => handleAdd(track)}
                  onRemove={() => handleRemove(track)}
                />
              ))}
            </div>
            {(page > 1 || hasMore) && (
              <Pagination page={page} hasMore={hasMore} onChange={goToPage} />
            )}
          </>
        )}

        {/* Empty state — shown until results arrive, text adapts to query */}
        {!loading && results.length === 0 && !error && (
          <EmptyState
            title={query.trim() ? `No results for "${query}"` : 'Search for music'}
            subtitle={query.trim() ? null : 'Paste a SoundCloud or Yandex Music URL, or type a track or artist name'}
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </EmptyState>
        )}
    </div>
  )
}

function Pagination({ page, hasMore, onChange }) {
  const visiblePages = []
  const start = Math.max(1, page - 2)
  for (let i = start; i <= page + (hasMore ? 1 : 0); i++) visiblePages.push(i)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 }}>
      <NavBtn disabled={page === 1} onClick={() => onChange(page - 1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </NavBtn>

      {start > 1 && (
        <>
          <PageBtn p={1} active={false} onClick={() => onChange(1)} />
          {start > 2 && <span style={{ color: text.muted, fontSize: 13 }}>…</span>}
        </>
      )}

      {visiblePages.map(p => (
        <PageBtn key={p} p={p} active={p === page} onClick={() => onChange(p)} />
      ))}

      {hasMore && <span style={{ color: text.muted, fontSize: 13 }}>…</span>}

      <NavBtn disabled={!hasMore} onClick={() => onChange(page + 1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </NavBtn>
    </div>
  )
}

function PageBtn({ p, active, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, borderRadius: 7, border: 'none',
        background: active ? accent[500] : hov ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? 'white' : hov ? text.primary : text.secondary,
        fontSize: 13, fontWeight: active ? 700 : 400,
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: "'Space Grotesk', sans-serif",
        boxShadow: active ? '0 2px 10px rgba(249,115,22,0.4)' : 'none',
      }}
    >
      {p}
    </button>
  )
}

function NavBtn({ disabled, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, borderRadius: 7,
        background: hov && !disabled ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: `1px solid ${border.subtle}`,
        color: disabled ? text.muted : hov ? text.primary : text.secondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function ImportListBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '0 16px', height: 46, flexShrink: 0,
        background: hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${hov ? border.strong : border.default}`,
        borderRadius: 10,
        color: hov ? text.secondary : text.muted,
        fontSize: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 7,
        fontFamily: "'Space Grotesk', sans-serif",
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
      Import list
    </button>
  )
}

function SearchInput({ value, onChange, loading }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="Search tracks, artists, or paste URL…"
      autoFocus
      style={{
        width: '100%', padding: '12px 44px',
        background: bg.surface,
        border: `1px solid ${focused ? accent[500] : border.default}`,
        borderRadius: 10, color: text.primary, fontSize: 15,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? `0 0 0 3px ${accent.subtle}, 0 0 0 1px ${accent[500]}` : 'none',
        outline: 'none',
      }}
    />
  )
}
