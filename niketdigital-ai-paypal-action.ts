// Merged dynamic route — one Vercel Serverless Function serving PayPal payments.
// URLs (path segment = action): /api/paypal/status | /api/paypal/checkout | /api/paypal/webhook
// Server only. No card is charged here: the customer pays on PayPal's page.
// Env (Vercel, server-only): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
// PAYPAL_MODE ('sandbox' or 'live', default 'sandbox'), PAYPAL_WEBHOOK_ID,
// PAYPAL_PLAN_<PLAN>_<INTERVAL> — 8 PayPal billing-plan IDs, e.g.
// PAYPAL_PLAN_STARTER_MONTHLY. Create the product + 8 billing plans in the
// PayPal Dashboard (or via the PayPal API) and put their IDs in Vercel.
// The plan itself sets the price, currency (USD) and trial. This code never
// invents an amount: the charge always comes from the PayPal plan.
// Webhook: verifies PayPal's signature before trusting anything.
import { randomBytes } from 'node:crypto'
import { verifySupabaseUser, readJsonBody, rateLimit } from '../_lib/auth.js'
import { getBusinessForUser, getServiceClient, audit } from '../_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }

const PLANS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: 'PAYPAL_PLAN_STARTER_MONTHLY', annual: 'PAYPAL_PLAN_STARTER_ANNUAL' },
  growth: { monthly: 'PAYPAL_PLAN_GROWTH_MONTHLY', annual: 'PAYPAL_PLAN_GROWTH_ANNUAL' },
  professional: { monthly: 'PAYPAL_PLAN_PROFESSIONAL_MONTHLY', annual: 'PAYPAL_PLAN_PROFESSIONAL_ANNUAL' },
  agency: { monthly: 'PAYPAL_PLAN_AGENCY_MONTHLY', annual: 'PAYPAL_PLAN_AGENCY_ANNUAL' },
}
function planIdFor(plan: string, interval: 'monthly' | 'annual'): string | null {
  const entry = PLANS[plan]
  if (!entry) return null
  return process.env[entry[interval]] || null
}
function planFromId(planId: string): { plan: string; interval: 'monthly' | 'annual' } | null {
  for (const [plan, vars] of Object.entries(PLANS)) {
    for (const interval of ['monthly', 'annual'] as const) {
      if (process.env[vars[interval]] && process.env[vars[interval]] === planId) return { plan, interval }
    }
  }
  return null
}
function paypalBase(): string {
  return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}
async function paypalToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) return null
  try {
    const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })
    const j: any = await r.json()
    return r.ok && j.access_token ? j.access_token as string : null
  } catch { return null }
}

async function statusHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  let plansConfigured = 0
  for (const vars of Object.values(PLANS)) for (const interval of ['monthly', 'annual'] as const) if (process.env[vars[interval]]) plansConfigured++
  return res.status(200).json({ configured, mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox', plansConfigured })
}

async function checkoutHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!rateLimit(`paypal-checkout:${user.id}`, 10, 60_000)) return res.status(429).json({ error: 'Too many checkout attempts. Please wait and try again.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })
  const body = readJsonBody(req)
  const plan = String(body.plan || '')
  const interval = body.interval === 'annual' ? 'annual' : 'monthly'
  const planId = planIdFor(plan, interval)
  if (!planId) return res.status(503).json({ error: 'PayPal is not configured yet: no billing-plan ID is set on the server for this plan. Create the billing plans in the PayPal Dashboard and set the PAYPAL_PLAN_* variables in Vercel, then redeploy. No charge was made.' })
  const token = await paypalToken()
  if (!token) return res.status(503).json({ error: 'PayPal is not configured yet: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are missing or rejected on the server.' })
  const appUrl = process.env.VITE_APP_URL || 'https://niketdigital.ai'
  try {
    const r = await fetch(`${paypalBase()}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'PayPal-Request-Id': randomBytes(16).toString('hex') },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: business.id,
        subscriber: { email_address: user.email || undefined },
        application_context: {
          brand_name: 'NiketDigital.ai',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${appUrl}/?billing=success&gateway=paypal`,
          cancel_url: `${appUrl}/?billing=cancelled&gateway=paypal`,
        },
      }),
    })
    const j: any = await r.json()
    if (!r.ok) return res.status(502).json({ error: `PayPal subscription could not be created: ${j?.message || j?.error || 'unknown error'}` })
    const approve = Array.isArray(j.links) ? j.links.find((l: any) => l.rel === 'approve') : null
    if (!approve?.href) return res.status(502).json({ error: 'PayPal did not return a checkout link.' })
    return res.status(200).json({ url: approve.href, subscription_id: j.id || null })
  } catch (e: any) { return res.status(502).json({ error: `PayPal checkout could not be created: ${e?.message || 'unknown error'}` }) }
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
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return res.status(503).json({ error: 'PAYPAL_WEBHOOK_ID is missing on the server.' })
  const raw = await readRawBody(req)
  let event: any
  try { event = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON body.' }) }
  const h = req.headers || {}
  const token = await paypalToken()
  if (!token) return res.status(503).json({ error: 'PayPal is not configured on the server.' })
  try {
    const vr = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: h['paypal-auth-algo'] || '',
        cert_url: h['paypal-cert-url'] || '',
        transmission_id: h['paypal-transmission-id'] || '',
        transmission_sig: h['paypal-transmission-sig'] || '',
        transmission_time: h['paypal-transmission-time'] || '',
        webhook_id: webhookId,
        webhook_event: event,
      }),
    })
    const vj: any = await vr.json()
    if (!vr.ok || vj.verification_status !== 'SUCCESS') return res.status(400).json({ error: 'Webhook signature verification failed.' })
  } catch (e: any) { return res.status(400).json({ error: `Webhook signature verification failed: ${e?.message || 'unknown error'}` }) }
  const sb = getServiceClient()
  try {
    const type = String(event.event_type || '')
    const resource: any = event.resource || {}
    const supported = ['BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED']
    if (supported.includes(type)) {
      const businessId = String(resource.custom_id || '')
      const planInfo = resource.plan_id ? planFromId(String(resource.plan_id)) : null
      if (businessId) {
        const { data: biz } = await sb.from('businesses').select('owner_id').eq('id', businessId).maybeSingle()
        const { data: existing } = await sb.from('subscriptions').select('plan_id,interval').eq('business_id', businessId).maybeSingle()
        const statusMap: Record<string, string> = { ACTIVE: 'active', CANCELLED: 'canceled', SUSPENDED: 'past_due', EXPIRED: 'canceled' }
        const status = statusMap[String(resource.status || '')] || (type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' ? 'past_due' : 'active')
        await sb.from('subscriptions').upsert({
          business_id: businessId, user_id: (biz as any)?.owner_id || null,
          plan_id: planInfo?.plan || (existing as any)?.plan_id || 'growth',
          interval: planInfo?.interval || (existing as any)?.interval || 'monthly',
          status, gateway: 'paypal',
          gateway_customer_id: resource.subscriber?.payer_id || null,
          gateway_subscription_id: String(resource.id || ''),
          current_period_end: resource.billing_info?.next_billing_time || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' })
        await audit(businessId, (biz as any)?.owner_id || null, `paypal.${type}`, 'subscription', String(resource.id || ''), { status })
      }
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
