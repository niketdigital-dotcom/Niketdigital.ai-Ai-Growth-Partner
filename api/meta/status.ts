// GET /api/meta/status — Meta connection status only. Never returns a token.
import { verifySupabaseUser } from '../_lib/auth.js'
import { getBusinessForUser, getServiceClient } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(200).json({ connected: false, status: 'not_configured' })
  try {
    const sb = getServiceClient()
    const { data } = await sb.from('integrations').select('status,token_expires_at,scopes,external_user_id').eq('business_id', business.id).eq('provider', 'meta').maybeSingle()
    if (!data) return res.status(200).json({ connected: false, status: 'not_connected' })
    const expired = (data as any).token_expires_at ? new Date((data as any).token_expires_at).getTime() <= Date.now() : false
    return res.status(200).json({ connected: !expired && (data as any).status === 'connected', needsReconnect: expired, status: expired ? 'needs_reconnect' : (data as any).status, scopes: (data as any).scopes, tokenExpiresAt: (data as any).token_expires_at, metaUserId: (data as any).external_user_id })
  } catch { return res.status(503).json({ error: 'Server is not configured yet. Add the Supabase service-role key in Vercel Environment Variables only, then redeploy.' }) }
}
