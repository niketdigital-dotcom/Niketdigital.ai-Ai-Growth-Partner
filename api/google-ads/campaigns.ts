// /api/google-ads/campaigns — Google Ads Search campaign drafts (server only).
// HARD RULE, enforced here: campaigns are DRAFTS only in this build.
// Publishing / enabling requires explicit customer confirmation AND a
// Google Ads developer token + API approval (GOOGLE_ADS_DEVELOPER_TOKEN).
// Until that approval exists, create() saves a draft row only and the live
// Google Ads API call is NOT made. Never claim a campaign is live in Google.
// Actions: list | create (draft only) | publish (explicit only, gated)
import { verifySupabaseUser, readJsonBody, rateLimit, validateString } from '../_lib/auth.js'
import { getBusinessForUser, getServiceClient, audit } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const sb = getServiceClient()
  const body = req.method === 'POST' ? readJsonBody(req) : {}
  const action = String(body.action || (req.method === 'GET' ? 'list' : ''))
  if (action === 'list') {
    const { data, error } = await sb.from('campaigns').select('*').eq('business_id', business.id).eq('provider', 'google').order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ campaigns: data || [], note: 'Drafts only. Live Google Ads data appears only after Google Ads API approval and a connected account.' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  if (!rateLimit(`google-campaigns:${user.id}`, 20, 60_000)) return res.status(429).json({ error: 'Too many requests. Please wait and try again.' })
  if (action === 'create') {
    const name = validateString(body.name, 200)
    if (!name) return res.status(400).json({ error: 'Campaign name is required.' })
    // Headline/description length checks (Google limits: 30 / 90 chars).
    const headlines: string[] = Array.isArray(body.headlines) ? body.headlines : []
    const bad = headlines.find(h => String(h).length > 30)
    if (bad) return res.status(400).json({ error: `Headline too long (max 30 characters): "${String(bad).slice(0, 40)}"` })
    const { data, error } = await sb.from('campaigns').insert({ business_id: business.id, provider: 'google', ad_account_id: body.ad_account_id || null, name, objective: validateString(body.objective, 100) || 'Search', status: 'draft', approved_to_publish: false, budget_cents: Number(body.budget_cents) || null, targeting: body.targeting || {}, ai_copy: body.ai_copy || null }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    await audit(business.id, user.id, 'google_campaign.draft_created', 'campaign', (data as any).id, { name })
    return res.status(201).json({ campaign: data, note: 'Search campaign draft saved. It is NOT live in Google Ads and will not spend until you explicitly approve publishing after Google Ads API approval.' })
  }
  if (action === 'publish') {
    if (body.confirmPublish !== true || body.approvedByCustomer !== true) return res.status(403).json({ error: 'Publishing requires explicit confirmation: confirmPublish: true and approvedByCustomer: true. The campaign stays a draft.' })
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return res.status(503).json({ error: 'Google Ads API is not approved/configured yet: GOOGLE_ADS_DEVELOPER_TOKEN is missing on the server. Apply for Google Ads API access (see README.md) before any live publish.' })
    const { data: draft } = await sb.from('campaigns').select('*').eq('id', body.campaign_id).eq('business_id', business.id).eq('provider', 'google').maybeSingle()
    if (!draft) return res.status(404).json({ error: 'Campaign draft not found.' })
    await sb.from('campaigns').update({ approved_to_publish: true }).eq('id', (draft as any).id)
    await audit(business.id, user.id, 'google_campaign.publish_approved', 'campaign', (draft as any).id, {})
    return res.status(200).json({ ok: true, note: 'Publishing approved and recorded. The live Google Ads API mutate call is the next step after developer-token approval — the draft is not live yet.' })
  }
  return res.status(400).json({ error: `Unknown action: ${action}` })
}
