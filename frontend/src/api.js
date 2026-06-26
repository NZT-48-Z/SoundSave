const BASE = '/api/v1'

export async function searchTracks(query, page = 1, perPage = 20) {
  const p = new URLSearchParams({ q: query, page, per_page: perPage })
  const r = await fetch(`${BASE}/search?${p}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json() // { results, page, per_page, has_more }
}

export async function resolveUrl(url) {
  const r = await fetch(`${BASE}/resolve?url=${encodeURIComponent(url)}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function importFromYandex(url) {
  const r = await fetch(`${BASE}/import/yandex?url=${encodeURIComponent(url)}`)
  if (!r.ok) {
    const text = await r.text()
    if (r.status === 401) throw Object.assign(new Error('YANDEX_NOT_CONNECTED'), { code: 'YANDEX_NOT_CONNECTED' })
    throw new Error(text)
  }
  return r.json()
}

export async function getYandexAuthStatus() {
  const r = await fetch(`${BASE}/import/yandex/auth/status`)
  if (!r.ok) return { connected: false }
  return r.json()
}

export async function startYandexAuth() {
  const r = await fetch(`${BASE}/import/yandex/auth/start`, { method: 'POST' })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function pollYandexAuth(sessionId) {
  const r = await fetch(`${BASE}/import/yandex/auth/poll/${sessionId}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function disconnectYandex() {
  await fetch(`${BASE}/import/yandex/auth`, { method: 'DELETE' })
}

export async function getAlternatives(title, artist, limit = 5) {
  const p = new URLSearchParams({ title, artist, limit })
  const r = await fetch(`${BASE}/alternatives?${p}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function importBatch(items) {
  const r = await fetch(`${BASE}/import/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() // { results: [{ value, track, error }], found, not_found }
}

export async function startBulkDownload(items) {
  const r = await fetch(`${BASE}/download/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getDownloads() {
  try {
    const r = await fetch(`${BASE}/downloads`)
    if (!r.ok) return []
    return r.json()
  } catch {
    return []
  }
}

export async function cancelDownload(id) {
  const r = await fetch(`${BASE}/downloads/${id}/cancel`, { method: 'POST' })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function clearHistory() {
  const r = await fetch(`${BASE}/downloads`, { method: 'DELETE' })
  if (!r.ok) throw new Error('Failed to clear history')
  return r.json()
}

export async function uploadCover(file) {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/cover`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(await r.text())
  return r.json() // { url }
}
