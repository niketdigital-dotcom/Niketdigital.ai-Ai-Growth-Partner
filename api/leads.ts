// Leads API — GET (own leads), POST (add a lead), POST /api/leads?source=webhook
// for authorised website lead forms / Meta Lead Ads forwarding.
// Tenancy is enforced server-side from the verified user; a webhook caller
// must present a per-business secret (LEAD_WEBHOOK_SECRET per business —
// stored in integrations.config, never in this file) — until that secret
// flow is configured, webhook posts are rejected with 501, not accepted blindly.
import { verifySupabaseUser, readJsonBody, rateLimit, validateString, requireFields } from './_lib/auth.js'
import { getServiceClient, getBusinessForUser, audit } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Estimate Scheduled', 'Proposal Sent', 'Won', 'Lost']
const LEAD_SOURCES = ['Website form', 'Meta Lead Ads', 'Google Ads', 'Phone', 'Referral', 'Other']
export default async function handler(req: any, res: any) {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const sb = getServiceClient()
  if (req.method === 'GET') {
    const { data, error } = await sb.from('leads').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ leads: data || [] })
  }
  if (req.method === 'PATCH') {
    const body = readJsonBody(req)
    if (!body.id || !LEAD_STATUSES.includes(String(body.status))) return res.status(400).json({ error: 'Valid lead id and status are required.' })
    const { data, error } = await sb.from('leads').update({ status: body.status, notes: body.notes != null ? validateString(body.notes, 2000) : undefined, follow_up_at: body.follow_up_at || null }).eq('id', body.id).eq('business_id', business.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ lead: data })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  if (!rateLimit(`leads:${user.id}`, 60, 60_000)) return res.status(429).json({ error: 'Too many lead submissions. Please wait and try again.' })
  const body = readJsonBody(req)
  const missing = requireFields(body, ['name'])
  if (missing) return res.status(400).json({ error: missing })
  const source = LEAD_SOURCES.includes(String(body.source)) ? String(body.source) : 'Other'
  const { data, error } = await sb.from('leads').insert({
    business_id: business.id, name: validateString(body.name, 200), email: validateString(body.email, 200) || null,
    phone: validateString(body.phone, 50) || null, source, campaign_id: body.campaign_id || null,
    status: 'New', notes: validateString(body.notes, 2000) || null,
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await audit(business.id, user.id, 'lead.created', 'lead', (data as any).id, { source })
  return res.status(201).json({ lead: data })
}
