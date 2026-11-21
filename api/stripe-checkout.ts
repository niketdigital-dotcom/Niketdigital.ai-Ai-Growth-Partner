// POST /api/stripe-checkout — create a Stripe Checkout Session for a plan.
// Server only. No card is charged here: the customer pays on Stripe's page.
// Body: { plan: 'starter'|'growth'|'professional'|'agency', interval: 'monthly'|'annual' }
import { verifySupabaseUser, readJsonBody, rateLimit } from './_lib/auth.js'
import { getStripe, priceIdFor } from './_lib/stripe.js'
import { getServiceClient, getBusinessForUser } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!rateLimit(`checkout:${user.id}`, 10, 60_000)) return res.status(429).json({ error: 'Too many checkout attempts. Please wait and try again.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const body = readJsonBody(req)
  const plan = String(body.plan || '')
  const interval = body.interval === 'annual' ? 'annual' : 'monthly'
  const priceId = priceIdFor(plan, interval)
  if (!priceId) return res.status(503).json({ error: 'Stripe is not configured yet: no price ID is set on the server for this plan. Create the products/prices in the Stripe Dashboard and set the STRIPE_PRICE_* variables in Vercel, then redeploy. No charge was made.' })
  const appUrl = process.env.VITE_APP_URL || 'https://niketdigital.ai'
  try {
    const stripe = getStripe()
    const sb = getServiceClient()
    const { data: existing } = await sb.from('subscriptions').select('stripe_customer_id').eq('business_id', business.id).maybeSingle()
    let customerId = (existing as any)?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: business.business_name, metadata: { business_id: business.id, user_id: user.id } })
      customerId = customer.id
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 14, metadata: { business_id: business.id, user_id: user.id, plan_id: plan, interval } },
      success_url: `${appUrl}/?billing=success`, cancel_url: `${appUrl}/?billing=cancelled`,
      metadata: { business_id: business.id, user_id: user.id, plan_id: plan, interval },
    })
    return res.status(200).json({ url: session.url })
  } catch (e: any) { return res.status(502).json({ error: `Stripe checkout could not be created: ${e?.message || 'unknown error'}` }) }
}
