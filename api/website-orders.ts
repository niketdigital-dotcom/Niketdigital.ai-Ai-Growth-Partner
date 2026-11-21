// POST /api/website-orders — submit a website development order.
// GET  /api/website-orders — list the caller's own orders.
// Website development is priced SEPARATELY from the monthly subscription:
// submitting an order creates status "New Order" only. A quotation follows
// (admin sets quotation_amount_cents); payment is requested only after the
// customer approves the quotation. Nothing is charged by this endpoint.
import { verifySupabaseUser, readJsonBody, rateLimit, validateString, requireFields } from './_lib/auth.js'
import { getServiceClient, getBusinessForUser, audit } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
const ALLOWED_PAGES = ['Home', 'About Us', 'Services', 'Roofing Services', 'Roof Replacement', 'Roof Repair', 'Kitchen Remodeling', 'Bathroom Remodeling', 'Pest Control Services', 'Service Areas', 'Gallery', 'Contact Us']
export default async function handler(req: any, res: any) {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const sb = getServiceClient()
  if (req.method === 'GET') {
    const { data, error } = await sb.from('website_orders').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ orders: data || [] })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  if (!rateLimit(`orders:${user.id}`, 10, 60_000)) return res.status(429).json({ error: 'Too many orders. Please wait and try again.' })
  const body = readJsonBody(req)
  const missing = requireFields(body, ['business_name', 'industry'])
  if (missing) return res.status(400).json({ error: missing })
  const pages = Array.isArray(body.pages) ? body.pages.filter((p: unknown) => ALLOWED_PAGES.includes(String(p))) : []
  const { data, error } = await sb.from('website_orders').insert({
    business_id: business.id, user_id: user.id,
    business_name: validateString(body.business_name, 200), industry: validateString(body.industry, 50),
    design_style: validateString(body.design_style, 100) || null, pages,
    services: Array.isArray(body.services) ? body.services.map((s: unknown) => validateString(s, 100)) : [],
    service_locations: Array.isArray(body.service_locations) ? body.service_locations.map((s: unknown) => validateString(s, 100)) : [],
    contact_info: validateString(body.contact_info, 500) || null,
    additional_features: validateString(body.additional_features, 2000) || null,
    logo_url: validateString(body.logo_url, 500) || null, status: 'New Order',
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await sb.from('website_order_status_history').insert({ website_order_id: (data as any).id, from_status: null, to_status: 'New Order', changed_by: user.id, note: 'Order submitted by customer.' })
  await audit(business.id, user.id, 'website_order.created', 'website_order', (data as any).id, { industry: body.industry })
  return res.status(201).json({ order: data, note: 'Order received as New Order. A quotation will follow — nothing has been charged.' })
}
