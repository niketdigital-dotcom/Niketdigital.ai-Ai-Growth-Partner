// GET /api/auth/meta/start — Meta OAuth start (server only).
// Redirect URI must match EXACTLY in the Meta app console:
//   https://YOUR_DOMAIN/api/auth/meta/callback
// Scopes: ads_read, ads_management, business_management (create & manage ads,
// measure performance). Campaigns created by this app are PAUSED by default
// and need explicit customer approval before publishing — OAuth alone never
// publishes anything.
import { randomBytes } from 'node:crypto'
import { getServiceClient } from '../../_lib/supabase-server.js'
import { hashState } from '../../_lib/crypto.js'
import { verifySupabaseUser } from '../../_lib/auth.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
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
