// GET /api/auth/google/start — Google OAuth start (server only).
// Redirect URI must match EXACTLY in Google Cloud Console:
//   https://YOUR_DOMAIN/api/auth/google/callback
// Scope: Google Ads read/write via the official API. Publishing still needs
// explicit customer approval in this app; OAuth alone never publishes.
// NOTE: Google Ads API also needs a developer token (GOOGLE_ADS_DEVELOPER_TOKEN)
// and, for other users, API approval — see README.md.
import { randomBytes } from 'node:crypto'
import { getServiceClient } from '../../_lib/supabase-server.js'
import { hashState } from '../../_lib/crypto.js'
import { verifySupabaseUser } from '../../_lib/auth.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
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
