// GET /api/admin/overview — super-admin only (profiles.is_admin checked server-side).
// Returns real counts from the database. Empty tables return 0 — never invented numbers.
import { verifySupabaseUser } from '../_lib/auth.js'
import { getServiceClient, isAdmin } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!(await isAdmin(user.id))) return res.status(403).json({ error: 'Admin access only. Ask the platform owner to set profiles.is_admin = true for your account in Supabase.' })
  const sb = getServiceClient()
  const [customers, subs, orders, tickets, ai] = await Promise.all([
    sb.from('businesses').select('id', { count: 'exact', head: true }),
    sb.from('subscriptions').select('plan_id,status', { count: 'exact' }),
    sb.from('website_orders').select('status', { count: 'exact' }),
    sb.from('support_tickets').select('status', { count: 'exact' }),
    sb.from('ai_generations').select('id', { count: 'exact', head: true }),
  ])
  return res.status(200).json({
    customers: customers.count || 0,
    subscriptions: subs.data || [],
    websiteOrders: orders.data || [],
    supportTickets: tickets.data || [],
    aiGenerationsTotal: ai.count || 0,
    note: 'Revenue is calculated in Stripe (Dashboard > Billing), not invented here. MRR = sum of active Stripe subscriptions.',
  })
}
