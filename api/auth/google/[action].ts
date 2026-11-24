// Merged dynamic route — one Vercel Serverless Function serving the URLs below,
// so the Hobby plan's 12-function limit is not exceeded. URLs are unchanged.
import { getQuery, verifySupabaseUser } from '../../_lib/auth.js'
import { encryptToken, hashState } from '../../_lib/crypto.js'
import { getServiceClient, setIntegrationToken } from '../../_lib/supabase-server.js'
import { randomBytes } from 'node:crypto'
const APP_URL = process.env.VITE_APP_URL || 'https://niketdigital.ai'

async function startHandler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(503).send('Google OAuth is not configured yet: GOOGLE_CLIENT_ID is missing on the server.')
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!redirectUri) return res.status(503).send('Google OAuth is not configured yet: GOOGLE_REDIRECT_URI is missing on the server.')
  const user = await verifySupabaseUser(req)
  const state = randomBytes(32).toString('hex')
  if (user) {
    try {
      const sb = getServiceClient()
      const { data: biz } = await sb.from('businesses').select('id').eq('owner_id', user.id).maybeSingle()
      await sb.from('oauth_states').insert({ state_hash: hashState(state), business_id: (biz as any)?.id || null, user_id: user.id, provider: 'google', kind: 'state', expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    } catch { /* callback will fail closed */ }
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/adwords', access_type: 'offline', prompt: 'consent', state })
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 'Set-Cookie': `oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` })
  res.end()

}

async function callbackHandler(req: any, res: any) {
  const q = getQuery(req)
  const code = q.code || ''; const state = q.state || ''
  if (!code || !state) return res.redirect(302, `${APP_URL}/?integration=google&result=error`)
  const clientId = process.env.GOOGLE_CLIENT_ID; const clientSecret = process.env.GOOGLE_CLIENT_SECRET; const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return res.status(503).send('Google OAuth is not configured on the server.')
  try {
    const sb = getServiceClient()
    const { data: st } = await sb.from('oauth_states').select('business_id,user_id,expires_at').eq('state_hash', hashState(state)).eq('provider', 'google').maybeSingle()
    if (!st || new Date((st as any).expires_at).getTime() <= Date.now()) return res.redirect(302, `${APP_URL}/?integration=google&result=error&reason=state`)
    await sb.from('oauth_states').delete().eq('state_hash', hashState(state))
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
    const j: any = await r.json()
    if (!r.ok || !j.access_token) return res.redirect(302, `${APP_URL}/?integration=google&result=error&reason=token`)
    const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null
    await setIntegrationToken((st as any).business_id, (st as any).user_id, 'google', { encryptedAccessToken: encryptToken(j.access_token), encryptedRefreshToken: j.refresh_token ? encryptToken(j.refresh_token) : null, tokenExpiresAt: expiresAt, scopes: 'https://www.googleapis.com/auth/adwords' })
    return res.redirect(302, `${APP_URL}/?integration=google&result=connected`)
  } catch { return res.redirect(302, `${APP_URL}/?integration=google&result=error`) }

}

export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  const action = String((req.query && (req.query as any).action) || '')
  switch (action) {
    case 'start': return startHandler(req, res);
    case 'callback': return callbackHandler(req, res);
    default: return res.status(404).json({ error: `Unknown API action: ${action}` })
  }
}
