// Server-only Supabase JWT verification. NEVER trust a user_id, email or
// business_id sent in a request body. Identity comes only from the Supabase
// Auth /user endpoint, using the caller's Bearer token.
export type AuthedUser = { id: string; email?: string }
export function getBearerToken(req: any): string {
  const raw = req.headers?.authorization || req.headers?.Authorization || ''
  if (typeof raw === 'string' && raw.trim()) return raw.replace(/^Bearer\s+/i, '').trim()
  // OAuth start links are plain browser navigations (<a href>), which cannot
  // send an Authorization header. The frontend therefore passes the short-lived
  // Supabase JWT as ?access_token= to OUR OWN server only (HTTPS); the server
  // verifies it against Supabase Auth below and never forwards it to Meta/Google.
  const q = req.query && typeof req.query === 'object' ? req.query : {}
  const fromQuery = q.access_token || q.accessToken || ''
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
  try { const u = new URL(req.url || '/', 'https://example.com'); const t = u.searchParams.get('access_token') || ''; if (t) return t } catch { /* fall through */ }
  return ''
}
export async function verifySupabaseUser(req: any): Promise<AuthedUser | null> {
  const token = getBearerToken(req)
  if (!token) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const data: any = await r.json()
    if (!data?.id) return null
    return { id: String(data.id), email: data.email ? String(data.email) : undefined }
  } catch { return null }
}
export function readJsonBody(req: any): any {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body) } catch { return {} } }
  return {}
}
export function getQuery(req: any): Record<string, string> {
  if (req.query && typeof req.query === 'object') {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.query)) out[k] = Array.isArray(v) ? String(v[0]) : String(v)
    return out
  }
  try { const u = new URL(req.url || '/', 'https://example.com'); return Object.fromEntries(u.searchParams.entries()) } catch { return {} }
}
// Rate limiting (in-memory, per Vercel instance — good enough for launch;
// move to Upstash/Redis before serving thousands of tenants).
const hits = new Map<string, { count: number; resetAt: number }>()
export function rateLimit(key: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now(); const e = hits.get(key)
  if (!e || now > e.resetAt) { hits.set(key, { count: 1, resetAt: now + windowMs }); return true }
  e.count += 1; return e.count <= max
}
export function validateString(v: unknown, max = 500): string {
  if (typeof v !== 'string') return ''
  return v.trim().slice(0, max)
}
export function requireFields(body: any, fields: string[]): string | null {
  for (const f of fields) if (!body?.[f] || String(body[f]).trim() === '') return `Missing required field: ${f}`
  return null
}
