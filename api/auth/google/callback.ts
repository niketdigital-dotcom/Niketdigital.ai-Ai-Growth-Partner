// GET /api/auth/google/callback — Google OAuth callback (server only).
// Verifies state, exchanges code for tokens, stores ONLY the encrypted
// access + refresh tokens in integrations. Never returns a token to the browser.
import { getServiceClient, setIntegrationToken } from '../../_lib/supabase-server.js'
import { hashState, encryptToken } from '../../_lib/crypto.js'
import { getQuery } from '../../_lib/auth.js'
export const config = { runtime: 'nodejs' }
const APP_URL = process.env.VITE_APP_URL || 'https://niketdigital.ai'
export default async function handler(req: any, res: any) {
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
