// Merged dynamic route — one Vercel Serverless Function serving the URLs below,
// so the Hobby plan's 12-function limit is not exceeded. URLs are unchanged.
import { getQuery, verifySupabaseUser } from '../../_lib/auth.js'
import { encryptToken, hashState } from '../../_lib/crypto.js'
import { deleteIntegration, getBusinessForUser, getDecryptedToken, getServiceClient, setIntegrationToken } from '../../_lib/supabase-server.js'
import { randomBytes } from 'node:crypto'
const APP_URL = process.env.VITE_APP_URL || 'https://niketdigital.ai'

async function startHandler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  const appId = process.env.META_APP_ID
  if (!appId) return res.status(503).send('Meta OAuth is not configured yet: META_APP_ID is missing on the server. Add it in Vercel Environment Variables only (never in frontend code or GitHub), then redeploy.')
  const redirectUri = process.env.META_REDIRECT_URI
  if (!redirectUri) return res.status(503).send('Meta OAuth is not configured yet: META_REDIRECT_URI is missing on the server.')
  // Link the OAuth state to the signed-in user so the callback can only ever
  // store a token against that user (fail-closed if no link exists).
  const user = await verifySupabaseUser(req)
  const state = randomBytes(32).toString('hex')
  if (user) {
    try {
      const sb = getServiceClient()
      const { data: biz } = await sb.from('businesses').select('id').eq('owner_id', user.id).maybeSingle()
      await sb.from('oauth_states').insert({ state_hash: hashState(state), business_id: (biz as any)?.id || null, user_id: user.id, provider: 'meta', kind: 'state', expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    } catch { /* linkage failure: callback will fail closed */ }
  }
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: 'code' })
  const configId = process.env.META_CONFIG_ID
  if (configId) params.set('config_id', configId)
  else params.set('scope', 'ads_read,ads_management,business_management')
  res.writeHead(302, { Location: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`, 'Set-Cookie': `oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` })
  res.end()

}

async function callbackHandler(req: any, res: any) {
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

async function disconnectHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'No business profile found.' })
  try {
    const token = await getDecryptedToken(business.id, 'meta')
    if (token) { try { await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' }) } catch { /* revoke failure is non-fatal; local delete still happens */ } }
  } catch { /* ignore */ }
  await deleteIntegration(business.id, 'meta')
  return res.status(200).json({ ok: true })

}

export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  const action = String((req.query && (req.query as any).action) || '')
  switch (action) {
    case 'start': return startHandler(req, res);
    case 'callback': return callbackHandler(req, res);
    case 'disconnect': return disconnectHandler(req, res);
    default: return res.status(404).json({ error: `Unknown API action: ${action}` })
  }
}
