// GET /api/meta/ad-accounts — list the user's authorised Meta ad accounts
// (Graph API v21.0, /me/adaccounts). Returns real accounts only; if Meta is
// not connected, returns connected:false — never invented accounts.
import { verifySupabaseUser } from '../_lib/auth.js'
import { getBusinessForUser, getDecryptedToken, getServiceClient } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const token = await getDecryptedToken(business.id, 'meta')
  if (!token) return res.status(200).json({ connected: false, accounts: [] })
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${encodeURIComponent(token)}`)
    const j: any = await r.json()
    if (!r.ok) return res.status(502).json({ error: j?.error?.message || 'Meta returned an error. Reconnect your Meta account and try again.' })
    const accounts = (j.data || []).map((a: any) => ({ id: String(a.id), name: a.name || String(a.id), currency: a.currency || null, accountStatus: a.account_status }))
    const sb = getServiceClient()
    for (const a of accounts) await sb.from('ad_accounts').upsert({ business_id: business.id, provider: 'meta', external_account_id: a.id, name: a.name, currency: a.currency }, { onConflict: 'business_id,provider,external_account_id' })
    return res.status(200).json({ connected: true, accounts })
  } catch (e: any) { return res.status(502).json({ error: `Could not reach Meta: ${e?.message || 'unknown error'}` }) }
}
