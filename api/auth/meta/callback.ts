// GET /api/auth/meta/callback — Meta OAuth callback (server only).
// Verifies state (CSRF), exchanges the code for a long-lived token, and
// stores ONLY the AES-256-GCM encrypted token in integrations.
// The token is never returned to the browser and never logged.
import { getServiceClient, setIntegrationToken } from '../../_lib/supabase-server.js'
import { hashState, encryptToken } from '../../_lib/crypto.js'
import { getQuery } from '../../_lib/auth.js'
export const config = { runtime: 'nodejs' }
const APP_URL = process.env.VITE_APP_URL || 'https://niketdigital.ai'
export default async function handler(req: any, res: any) {
  const q = getQuery(req)
  if (q.error) return res.redirect(302, `${APP_URL}/?integration=meta&result=error`)
  const code = q.code || ''; const state = q.state || ''
  if (!code || !state) return res.redirect(302, `${APP_URL}/?integration=meta&result=error`)
  const appId = process.env.META_APP_ID; const appSecret = process.env.META_APP_SECRET; const redirectUri = process.env.META_REDIRECT_URI
  if (!appId || !appSecret || !redirectUri) return res.status(503).send('Meta OAuth is not configured on the server.')
  try {
    const sb = getServiceClient()
    const { data: st } = await sb.from('oauth_states').select('business_id,user_id,expires_at').eq('state_hash', hashState(state)).eq('provider', 'meta').maybeSingle()
    if (!st || new Date((st as any).expires_at).getTime() <= Date.now()) return res.redirect(302, `${APP_URL}/?integration=meta&result=error&reason=state`)
    await sb.from('oauth_states').delete().eq('state_hash', hashState(state))
    // Short-lived token -> long-lived token (Graph API v21.0).
    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`)
    const tokenJson: any = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) return res.redirect(302, `${APP_URL}/?integration=meta&result=error&reason=token`)
    const longRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(tokenJson.access_token)}`)
    const longJson: any = await longRes.json()
    const accessToken = longJson.access_token || tokenJson.access_token
    const expiresAt = longJson.expires_in ? new Date(Date.now() + longJson.expires_in * 1000).toISOString() : null
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(accessToken)}`)
    const me: any = await meRes.json()
    await setIntegrationToken((st as any).business_id, (st as any).user_id, 'meta', { encryptedAccessToken: encryptToken(accessToken), tokenExpiresAt: expiresAt, scopes: 'ads_read,ads_management,business_management', externalUserId: me?.id ? String(me.id) : null })
    return res.redirect(302, `${APP_URL}/?integration=meta&result=connected`)
  } catch { return res.redirect(302, `${APP_URL}/?integration=meta&result=error`) }
}
