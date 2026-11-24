// Merged dynamic route — one Vercel Serverless Function serving the URLs below,
// so the Hobby plan's 12-function limit is not exceeded. URLs are unchanged.
import { rateLimit, readJsonBody, validateString, verifySupabaseUser } from '../_lib/auth.js'
import { audit, getBusinessForUser, getDecryptedToken, getServiceClient } from '../_lib/supabase-server.js'

async function statusHandler(req: any, res: any) {
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

async function adAccountsHandler(req: any, res: any) {
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

async function campaignsHandler(req: any, res: any) {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const sb = getServiceClient()
  const body = req.method === 'POST' ? readJsonBody(req) : {}
  const action = String(body.action || (req.method === 'GET' ? 'list' : ''))
  if (action === 'list') {
    const { data, error } = await sb.from('campaigns').select('*').eq('business_id', business.id).eq('provider', 'meta').order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ campaigns: data || [], note: 'Only campaigns saved in this app are listed here. Live Meta data appears only after a Meta account is connected.' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  if (!rateLimit(`meta-campaigns:${user.id}`, 20, 60_000)) return res.status(429).json({ error: 'Too many requests. Please wait and try again.' })
  if (action === 'create') {
    // Always a paused draft in this build, regardless of what the caller asks.
    const name = validateString(body.name, 200)
    if (!name) return res.status(400).json({ error: 'Campaign name is required.' })
    const { data, error } = await sb.from('campaigns').insert({ business_id: business.id, provider: 'meta', ad_account_id: body.ad_account_id || null, name, objective: validateString(body.objective, 100) || null, status: 'paused', approved_to_publish: false, budget_cents: Number(body.budget_cents) || null, targeting: body.targeting || {}, ai_copy: body.ai_copy || null }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    await audit(business.id, user.id, 'meta_campaign.draft_created', 'campaign', (data as any).id, { name })
    return res.status(201).json({ campaign: data, note: 'Draft created as PAUSED. It will not run or spend until you explicitly approve publishing.' })
  }
  if (action === 'publish') {
    // Explicit approval gate — all three conditions are required.
    if (body.confirmPublish !== true || body.approvedByCustomer !== true) return res.status(403).json({ error: 'Publishing requires explicit confirmation: confirmPublish: true and approvedByCustomer: true. The campaign stays paused.' })
    const { data: draft } = await sb.from('campaigns').select('*').eq('id', body.campaign_id).eq('business_id', business.id).eq('provider', 'meta').maybeSingle()
    if (!draft) return res.status(404).json({ error: 'Campaign draft not found.' })
    const token = await getDecryptedToken(business.id, 'meta')
    if (!token) return res.status(400).json({ error: 'Meta is not connected. Connect your Meta account first.' })
    // Live Meta creation is intentionally NOT performed until the Meta app
    // has Marketing API approval for this business. The draft is marked
    // approved_to_publish here; the live publish call is the next
    // deployment step after Meta approval (see README.md).
    await sb.from('campaigns').update({ approved_to_publish: true }).eq('id', (draft as any).id)
    await audit(business.id, user.id, 'meta_campaign.publish_approved', 'campaign', (draft as any).id, { note: 'Customer approved publishing; live Meta publish pending Meta app approval.' })
    return res.status(200).json({ ok: true, note: 'Publishing approved and recorded. The live Meta publish call runs only after Meta Marketing API approval for this business — see README.md. The campaign remains paused in Meta until then.' })
  }
  if (action === 'pause') {
    const { error } = await sb.from('campaigns').update({ status: 'paused' }).eq('id', body.campaign_id).eq('business_id', business.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, note: 'Campaign paused in this app. If it was live in Meta, pause it in Ads Manager too until the live pause call is enabled.' })
  }
  return res.status(400).json({ error: `Unknown action: ${action}` })

}

export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  const action = String((req.query && (req.query as any).action) || '')
  switch (action) {
    case 'status': return statusHandler(req, res);
    case 'ad-accounts': return adAccountsHandler(req, res);
    case 'campaigns': return campaignsHandler(req, res);
    default: return res.status(404).json({ error: `Unknown API action: ${action}` })
  }
}
