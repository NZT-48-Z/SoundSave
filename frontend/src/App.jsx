import { useCallback, useEffect, useRef, useState } from 'react'
import { clearHistory, getDownloads, getYandexAuthStatus } from './api'
import { accent, bg, border, semantic, text } from './theme'
import DownloadReportModal from './components/DownloadReportModal'
import DownloadsPanel from './components/DownloadsPanel'
import QueuePanel from './components/QueuePanel'
import SearchPanel from './components/SearchPanel'
import ImportTracklistModal from './components/ImportTracklistModal'
import YandexAuthModal from './components/YandexAuthModal'

function trackColor(id) {
  const palette = ['#1e1b22','#191d24','#1b1f1b','#1a1e1b','#201c1c','#1e1c1a','#191e1e','#1d1b1f']
  const n = typeof id === 'string'
    ? id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    : (Number(id) || 0)
  return palette[n % palette.length]
}

function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', top: 64, right: 20, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: bg.overlay, border: `1px solid ${border.default}`, borderRadius: 9,
          padding: '10px 14px', fontSize: 13, color: text.primary,
          display: 'flex', alignItems: 'center', gap: 9,
          animation: 'toastIn 0.2s ease', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          maxWidth: 300, pointerEvents: 'all',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.iconColor || semantic.success} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span style={{ lineHeight: 1.4 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('search')
  const [queue, setQueue] = useState([])
  const [downloads, setDownloads] = useState([])
  const [yandexConnected, setYandexConnected] = useState(false)
  const [toasts, setToasts] = useState([])
  const [activeBatch, setActiveBatch] = useState(null) // Set of backend download IDs
  const [batchReport, setBatchReport] = useState(null) // {done: [], errors: []}
  const [showYandexModal, setShowYandexModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    getYandexAuthStatus().then(s => setYandexConnected(!!s.connected))
  }, [])

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const data = await getDownloads()
      setDownloads(data)
    }, 800)
    return () => clearInterval(pollRef.current)
  }, [])

  // Detect when all downloads in the active batch are finished
  useEffect(() => {
    if (!activeBatch || activeBatch.size === 0) return
    const batchDls = downloads.filter(d => activeBatch.has(d.id))
    if (batchDls.length === 0) return
    const terminal = ['done', 'error', 'cancelled']
    const allDone = batchDls.every(d => terminal.includes(d.status))
    if (allDone && batchDls.length >= activeBatch.size) {
      setBatchReport({
        done: batchDls.filter(d => d.status === 'done'),
        errors: batchDls.filter(d => d.status === 'error' || d.status === 'cancelled'),
      })
      setActiveBatch(null)
    }
  }, [downloads, activeBatch])

  const showToast = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random()
    const iconColor = { success: semantic.success, info: semantic.info, error: semantic.error }[type] || semantic.success
    setToasts(prev => [...prev, { id, msg, iconColor }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
  }, [])

  const addToQueue = useCallback((track) => {
    setQueue(prev => {
      if (prev.find(i => i.id === track.id)) return prev
      return [...prev, {
        id: track.id,
        url: track.url,
        artwork_url: track.artwork_url || null,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        genre: track.genre || '',
        duration: track.duration || 0,
        color: trackColor(track.id),
      }]
    })
    showToast(`${track.title} — added to queue`)
  }, [showToast])

  const addBatchToQueue = useCallback((tracks) => {
    setQueue(prev => {
      const existingIds = new Set(prev.map(i => i.id))
      const fresh = tracks
        .filter(t => !existingIds.has(t.id))
        .map(t => ({
          id: t.id,
          url: t.url,
          artwork_url: t.artwork_url || null,
          title: t.title,
          artist: t.artist,
          album: t.album || '',
          genre: t.genre || '',
          duration: t.duration || 0,
          color: trackColor(t.id),
        }))
      return fresh.length ? [...prev, ...fresh] : prev
    })
    showToast(`${tracks.length} track${tracks.length !== 1 ? 's' : ''} added to queue`)
  }, [showToast])

  const removeFromQueue = useCallback((id) => {
    setQueue(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateQueueItem = useCallback((id, updates) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }, [])

  const clearQueue = useCallback(() => setQueue([]), [])

  const openYandexModal = useCallback(() => setShowYandexModal(true), [])
  const openImportModal = useCallback(() => setShowImportModal(true), [])

  const onClearHistory = useCallback(async () => {
    await clearHistory()
    setDownloads([])
  }, [])

  const handleYandexAuthSuccess = useCallback(() => {
    setYandexConnected(true)
    setShowYandexModal(false)
    showToast('Yandex Music connected', 'success')
  }, [showToast])

  const onDownloaded = useCallback((queueIds, downloadIds = []) => {
    setQueue(prev => prev.filter(i => !queueIds.includes(i.id)))
    setActiveTab('downloads')
    showToast(`Downloading ${queueIds.length} track${queueIds.length !== 1 ? 's' : ''}`, 'info')
    if (downloadIds.length > 0) setActiveBatch(new Set(downloadIds))
  }, [showToast])

  const activeDl = downloads.filter(d => ['downloading', 'converting', 'tagging'].includes(d.status)).length
  const queueCount = queue.length

  const tabBtn = (id, label, icon, badge) => {
    const isActive = activeTab === id
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        style={{
          cursor: 'pointer', padding: '0 14px', height: 34, borderRadius: 8,
          border: `1px solid ${isActive ? 'rgba(249,115,22,0.22)' : 'transparent'}`,
          background: isActive ? 'rgba(249,115,22,0.1)' : 'transparent',
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? accent[500] : text.muted,
          display: 'flex', alignItems: 'center',
          gap: 6, flexShrink: 0, transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = text.secondary
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = text.muted
          }
        }}
      >
        {icon}
        {label}
        {badge != null && badge > 0 && (
          <span style={{
            background: id === 'downloads' ? semantic.info : accent[500],
            color: 'white', borderRadius: 10, padding: '1px 7px',
            fontSize: 11, fontWeight: 700, lineHeight: '16px',
            minWidth: 18, textAlign: 'center', display: 'inline-block',
          }}>{badge}</span>
        )}
      </button>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg.page, color: text.primary, display: 'flex', flexDirection: 'column' }}>
      {/* NAV — darker than page bg to act as visual anchor/frame */}
      <nav style={{
        borderBottom: `1px solid ${border.default}`,
        background: `rgba(6,6,10,0.98)`,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 58, gap: 0 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 16, flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: `linear-gradient(135deg, ${accent[500]}, ${accent[700]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(249,115,22,0.4)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>
              Sound<span style={{ color: accent[500] }}>Save</span>
            </span>
          </div>

          {/* Logo / tabs separator */}
          <div style={{ width: 1, height: 20, background: border.default, marginRight: 16, flexShrink: 0 }} />

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 4 }}>
            {tabBtn('search', 'Search', (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            ), null)}
            {tabBtn('queue', 'Queue', (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="21" y1="10" x2="7" y2="10"/>
                <line x1="21" y1="6" x2="3" y2="6"/>
                <line x1="21" y1="14" x2="7" y2="14"/>
                <line x1="21" y1="18" x2="3" y2="18"/>
              </svg>
            ), queueCount)}
            {tabBtn('downloads', 'Downloads', (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            ), activeDl)}
          </div>

          {/* Yandex pill */}
          <button
            onClick={() => setShowYandexModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 12px', height: 34,
              background: yandexConnected ? 'rgba(34,197,94,0.07)' : 'transparent',
              border: `1px solid ${yandexConnected ? 'rgba(34,197,94,0.25)' : border.default}`,
              borderRadius: 8, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = yandexConnected ? 'rgba(34,197,94,0.45)' : border.strong
              e.currentTarget.style.background = yandexConnected ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = yandexConnected ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.09)'
              e.currentTarget.style.background = yandexConnected ? 'rgba(34,197,94,0.07)' : 'transparent'
            }}
          >
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: yandexConnected ? semantic.success : text.muted,
              boxShadow: yandexConnected ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: yandexConnected ? semantic.success : text.muted, whiteSpace: 'nowrap' }}>
              {yandexConnected ? 'Yandex Connected' : 'Yandex Music'}
            </span>
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', padding: '28px 24px', width: '100%' }}>
        <div style={{ display: activeTab === 'search' ? 'block' : 'none' }}>
          <SearchPanel
            queue={queue}
            onAddToQueue={addToQueue}
            onRemoveFromQueue={removeFromQueue}
            showToast={showToast}
            yandexConnected={yandexConnected}
            onYandexConnected={handleYandexAuthSuccess}
            onOpenYandexAuth={openYandexModal}
            onOpenImport={openImportModal}
          />
        </div>
        {activeTab === 'queue' && (
          <div key="queue" style={{ animation: 'panelIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <QueuePanel
              queue={queue}
              onRemove={removeFromQueue}
              onUpdate={updateQueueItem}
              onClear={clearQueue}
              onDownloaded={onDownloaded}
              showToast={showToast}
            />
          </div>
        )}
        {activeTab === 'downloads' && (
          <div key="downloads" style={{ animation: 'panelIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <DownloadsPanel downloads={downloads} onClearHistory={onClearHistory} />
          </div>
        )}
      </main>

      {showImportModal && (
        <ImportTracklistModal
          onClose={() => setShowImportModal(false)}
          onBatchAdd={addBatchToQueue}
        />
      )}
      {showYandexModal && (
        <YandexAuthModal
          isConnected={yandexConnected}
          onSuccess={handleYandexAuthSuccess}
          onDisconnect={() => { setYandexConnected(false); showToast('Yandex Music disconnected') }}
          onClose={() => setShowYandexModal(false)}
        />
      )}
      {batchReport && (
        <DownloadReportModal
          report={batchReport}
          onClose={() => setBatchReport(null)}
        />
      )}
      <Toast toasts={toasts} />
    </div>
  )
}
