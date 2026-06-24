const MOD_RE = /\b(slowed|reverb|sped[\s_-]?up|speed[\s_-]?up|nightcore|8d[\s_-]?audio|bass[\s_-]?boost(ed)?|lo[\s_-]?fi|pitched|slowed[\s_-]?down|tiktok)\b/i

const CLEAN_RE = /[\s\-–]+[\(\[\|]?\s*(slowed[\s&+]*reverb|slowed[\s&+]*reverbed|slowed|reverb(ed)?|sped[\s_-]?up|speed[\s_-]?up|nightcore|8d[\s_-]?audio|bass[\s_-]?boost(ed)?|lo[\s_-]?fi|pitched|slowed[\s_-]?down)[^\)\]]*[\)\]]?/gi

export function isModifiedTitle(title) {
  return MOD_RE.test(title || '')
}

export function cleanTitle(title) {
  return (title || '').replace(CLEAN_RE, '').replace(/[\s\-–|(\[]+$/, '').trim()
}
