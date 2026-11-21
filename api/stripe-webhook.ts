// POST /api/stripe-webhook — Stripe webhook receiver.
// VERIFIES the Stripe signature (STRIPE_WEBHOOK_SECRET) before trusting
// anything. Never trust a webhook body without a valid signature.
// Handles: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.
// NOTE (Vercel): this handler needs the RAW request body for signature
// verification. If Vercel parses req.body first, verification will fail —
// in that case read the raw body from the request stream (see Stripe docs
// for Vercel raw-body handling) before deploying this route live.
import { getStripe } from './_lib/stripe.js'
import { getServiceClient, audit } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
async function readRawBody(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is missing on the server.' })
  let event: any
  try {
    const stripe = getStripe()
    const raw = await readRawBody(req)
    const sig = req.headers?.['stripe-signature'] || req.headers?.['Stripe-Signature'] || ''
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (e: any) { return res.status(400).json({ error: `Webhook signature verification failed: ${e?.message || 'invalid signature'}` }) }
  const sb = getServiceClient()
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const obj: any = event.data.object
      const subId = obj.subscription || obj.id
      const businessId = obj.metadata?.business_id || obj.subscription_data?.metadata?.business_id
      if (businessId && subId) {
        const statusMap: Record<string, string> = { active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled', incomplete: 'incomplete', unpaid: 'unpaid' }
        const status = statusMap[obj.status] || 'active'
        await sb.from('subscriptions').upsert({
          business_id: businessId, user_id: obj.metadata?.user_id || null,
          plan_id: obj.metadata?.plan_id || 'growth', interval: obj.metadata?.interval || 'monthly',
          status, stripe_customer_id: obj.customer || null, stripe_subscription_id: String(subId),
          current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' })
        await audit(businessId, obj.metadata?.user_id || null, `stripe.${event.type}`, 'subscription', String(subId), { status })
      }
    }
    if (event.type === 'invoice.payment_failed') {
      const inv: any = event.data.object
      await audit(null, null, 'stripe.invoice.payment_failed', 'invoice', String(inv.id || ''), { customer: inv.customer || null, amount_due: inv.amount_due || null })
      // Failed-payment notification email is sent from Stripe's own settings
      // (Stripe Dashboard > Billing > failed payments). This app does not
      // invent a payment failure or email the customer itself here.
    }
    return res.status(200).json({ received: true })
  } catch (e: any) { return res.status(500).json({ error: `Webhook handling failed: ${e?.message || 'unknown error'}` }) }
}
