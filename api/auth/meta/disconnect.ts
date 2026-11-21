// POST /api/auth/meta/disconnect — remove the stored Meta connection.
// Also revokes the token at Meta (best effort) so it cannot be reused.
import { verifySupabaseUser } from '../../_lib/auth.js'
import { getBusinessForUser, deleteIntegration, getDecryptedToken } from '../../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
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
