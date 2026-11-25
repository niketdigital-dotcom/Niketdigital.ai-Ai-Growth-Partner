// Merged dynamic route — one Vercel Serverless Function serving Razorpay payments.
// URLs (path segment = action): /api/razorpay/status | /api/razorpay/checkout | /api/razorpay/webhook
// Server only. No payment is taken here: the customer pays on Razorpay's page.
// Env (Vercel, server-only): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
// RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PLAN_<PLAN>_<INTERVAL> — 8 Razorpay plan
// IDs, e.g. RAZORPAY_PLAN_STARTER_MONTHLY. Create the 8 plans in the
// Razorpay Dashboard (amount in INR, period monthly or yearly) and put their
// IDs in Vercel. The plan itself sets the price and currency (INR). This
// code never invents an amount: the charge always comes from the Razorpay plan.
// Webhook: verifies Razorpay's HMAC signature before trusting anything.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { verifySupabaseUser, readJsonBody, rateLimit } from '../_lib/auth.js'
import { getBusinessForUser, getServiceClient, audit } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }

const PLANS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: 'RAZORPAY_PLAN_STARTER_MONTHLY', annual: 'RAZORPAY_PLAN_STARTER_ANNUAL' },
  growth: { monthly: 'RAZORPAY_PLAN_GROWTH_MONTHLY', annual: 'RAZORPAY_PLAN_GROWTH_ANNUAL' },
  professional: { monthly: 'RAZORPAY_PLAN_PROFESSIONAL_MONTHLY', annual: 'RAZORPAY_PLAN_PROFESSIONAL_ANNUAL' },
  agency: { monthly: 'RAZORPAY_PLAN_AGENCY_MONTHLY', annual: 'RAZORPAY_PLAN_AGENCY_ANNUAL' },
}
function planIdFor(plan: string, interval: 'monthly' | 'annual'): string | null {
  const entry = PLANS[plan]
  if (!entry) return null
  return process.env[entry[interval]] || null
}
function rzrAuth(): string | null {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) return null
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

async function statusHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const configured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  let plansConfigured = 0
  for (const vars of Object.values(PLANS)) for (const interval of ['monthly', 'annual'] as const) if (process.env[vars[interval]]) plansConfigured++
  return res.status(200).json({ configured, plansConfigured })
}

async function checkoutHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!rateLimit(`razorpay-checkout:${user.id}`, 10, 60_000)) return res.status(429).json({ error: 'Too many checkout attempts. Please wait and try again.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const body = readJsonBody(req)
  const plan = String(body.plan || '')
  const interval = body.interval === 'annual' ? 'annual' : 'monthly'
  const planId = planIdFor(plan, interval)
  if (!planId) return res.status(503).json({ error: 'Razorpay is not configured yet: no plan ID is set on the server for this plan. Create the plans in the Razorpay Dashboard and set the RAZORPAY_PLAN_* variables in Vercel, then redeploy. No charge was made.' })
  const auth = rzrAuth()
  if (!auth) return res.status(503).json({ error: 'Razorpay is not configured yet: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing on the server.' })
  try {
    const r = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        quantity: 1,
        total_count: interval === 'annual' ? 10 : 120,
        customer_notify: 1,
        notes: { business_id: business.id, plan, interval },
      }),
    })
    const j: any = await r.json()
    if (!r.ok) return res.status(502).json({ error: `Razorpay subscription could not be created: ${j?.error?.description || j?.error?.code || 'unknown error'}` })
    if (!j.short_url) return res.status(502).json({ error: 'Razorpay did not return a checkout link.' })
    return res.status(200).json({ url: j.short_url, subscription_id: j.id || null })
  } catch (e: any) { return res.status(502).json({ error: `Razorpay checkout could not be created: ${e?.message || 'unknown error'}` }) }
}

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

async function webhookHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return res.status(503).json({ error: 'RAZORPAY_WEBHOOK_SECRET is missing on the server.' })
  const raw = await readRawBody(req)
  const signature = String(req.headers?.['x-razorpay-signature'] || '')
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return res.status(400).json({ error: 'Webhook signature verification failed.' })
  }
  let event: any
  try { event = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON body.' }) }
  const sb = getServiceClient()
  try {
    const type = String(event.event || '')
    const entity: any = event.payload?.subscription?.entity || event.payload?.payment?.entity || {}
    const supported = ['subscription.activated', 'subscription.charged', 'subscription.cancelled', 'subscription.completed', 'subscription.halted', 'subscription.paused']
    if (supported.includes(type)) {
      const notes = entity.notes || {}
      const businessId = String(notes.business_id || '')
      if (businessId) {
        const { data: biz } = await sb.from('businesses').select('owner_id').eq('id', businessId).maybeSingle()
        const { data: existing } = await sb.from('subscriptions').select('plan_id,interval').eq('business_id', businessId).maybeSingle()
        const statusMap: Record<string, string> = { active: 'active', cancelled: 'canceled', completed: 'canceled', halted: 'past_due', paused: 'past_due' }
        const status = statusMap[String(entity.status || '')] || 'active'
        await sb.from('subscriptions').upsert({
          business_id: businessId, user_id: (biz as any)?.owner_id || null,
          plan_id: String(notes.plan || (existing as any)?.plan_id || 'growth'),
          interval: String(notes.interval || (existing as any)?.interval || 'monthly'),
          status, gateway: 'razorpay',
          gateway_customer_id: entity.customer_id || null,
          gateway_subscription_id: String(entity.id || ''),
          current_period_end: entity.current_end ? new Date(Number(entity.current_end) * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' })
        await audit(businessId, (biz as any)?.owner_id || null, `razorpay.${type}`, 'subscription', String(entity.id || ''), { status })
      }
    }
    if (type === 'payment.failed') {
      const pay: any = event.payload?.payment?.entity || {}
      await audit(null, null, 'razorpay.payment.failed', 'payment', String(pay.id || ''), { amount: pay.amount || null })
    }
    return res.status(200).json({ received: true })
  } catch (e: any) { return res.status(500).json({ error: `Webhook handling failed: ${e?.message || 'unknown error'}` }) }
}

export default async function handler(req: any, res: any) {
  const action = String((req.query && (req.query as any).action) || '')
  switch (action) {
    case 'status': return statusHandler(req, res);
    case 'checkout': return checkoutHandler(req, res);
    case 'webhook': return webhookHandler(req, res);
    default: return res.status(404).json({ error: `Unknown API action: ${action}` })
  }
}
