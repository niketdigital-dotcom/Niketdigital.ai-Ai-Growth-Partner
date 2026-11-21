// Server-only Stripe helpers. NEVER import from src/.
// Raw card data is never handled here — Stripe Checkout / Customer Portal
// collect payment details on Stripe's own pages.
import Stripe from 'stripe'
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing on the server.')
  return new Stripe(key)
}
// Plan id -> Stripe price env var. Prices are created in the Stripe Dashboard
// (see README.md); only the price IDs live in env vars, never in code.
export const PLAN_PRICES: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: 'STRIPE_PRICE_STARTER_MONTHLY', annual: 'STRIPE_PRICE_STARTER_ANNUAL' },
  growth: { monthly: 'STRIPE_PRICE_GROWTH_MONTHLY', annual: 'STRIPE_PRICE_GROWTH_ANNUAL' },
  professional: { monthly: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY', annual: 'STRIPE_PRICE_PROFESSIONAL_ANNUAL' },
  agency: { monthly: 'STRIPE_PRICE_AGENCY_MONTHLY', annual: 'STRIPE_PRICE_AGENCY_ANNUAL' },
}
export function priceIdFor(plan: string, interval: 'monthly' | 'annual'): string | null {
  const entry = PLAN_PRICES[plan]
  if (!entry) return null
  return process.env[entry[interval]] || null
}
