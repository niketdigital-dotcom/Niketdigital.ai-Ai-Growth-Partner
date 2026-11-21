# NiketDigital.ai — AI-Powered Contractor Growth SaaS

**Brand:** NiketDigital.ai — *Your AI-Powered Business Growth Partner.*
**For:** US Roofing, Home Remodeling, Construction and Pest Control businesses.
**Stack:** Vite + React 19 + TypeScript + Tailwind 4 · Supabase (PostgreSQL + Auth, RLS) · Stripe Billing · OpenAI (server-only) · Meta Marketing API (Graph v21.0) · Google Ads API · Vercel serverless functions.

This is a **separate platform from AdGenius AI** (different product, different Supabase project, different domain). It mirrors the proven AdGenius production structure — including the hard lesson from the AdGenius Meta fix: **all relative imports in `api/` use `.js` extensions**, because Vercel Node ESM requires them and local `tsc`/`vite` do not catch the missing extension.

## What is built

- **Brand / landing page** — navy `#0f2447` / white / orange `#f97316`, responsive, tagline, plans.
- **Auth** — email sign-up/sign-in, email verification, password reset, Google login (via Supabase Auth), logout, sessions.
- **Onboarding** — industry (Roofing / Home Remodeling / Construction / Pest Control), business name, email, phone, website, service locations, address, services, logo/image URL (Supabase Storage bucket `business-assets`).
- **Customer dashboard** — overview, website development, AI Marketing Assistant, Meta/Instagram Ads, Google Ads, campaigns, CRM, analytics, billing, integrations, support.
- **AI Website Development ordering** — industry, business name, design style, pages (Home, About, Services, Roofing Services, Roof Replacement, Roof Repair, Kitchen/Bathroom Remodeling, Pest Control Services, Service Areas, Gallery, Contact), logo/photo placeholders, services/locations, contact, features, preview concept, submit order. Statuses: New Order → Under Review → Quotation Sent → Payment Pending → In Development → Customer Review → Revisions → Completed → Published. **Priced separately from the monthly subscription; an order creates no charge.**
- **AI Marketing Assistant** — Facebook/Instagram ad copy, Google Ads headlines/descriptions (30/90-char checks), keywords + negative keywords, landing-page content, budget plans, reports. Server-only OpenAI; never publishes anything.
- **Meta Ads** — official OAuth, ad-account listing, campaign **drafts (paused by default)**. Publishing requires `confirmPublish: true` + `approvedByCustomer: true` in `api/meta/campaigns.ts`, and the live Meta publish call is gated until Meta app approval (see below).
- **Google Ads** — official OAuth, Search campaign **drafts only**. Live publish is gated until a Google Ads developer token + API approval exist.
- **CRM** — leads with source tracking, campaign attribution, statuses New / Contacted / Qualified / Estimate Scheduled / Proposal Sent / Won / Lost, follow-up dates, notes, CSV export, analytics (only from real rows).
- **Billing** — Stripe Checkout, plans Starter $49 / Growth $99 / Professional $199 / Agency $399 per month, annual option (2 months free: $39/$79/$159/$319 per month billed annually), 14-day trial, webhook updates subscriptions, failed-payment handling via Stripe. **Website fees and ad budgets are billed separately; nobody is charged without authorisation.**
- **Admin dashboard** — customers, subscriptions, website orders, quotations, API status, AI usage, support, audit logs, settings. Server-checked via `profiles.is_admin`.
- **Security** — multi-tenant RLS on **every** table (users see only their own `business_id` rows), service-role key server-only, AES-256-GCM encrypted OAuth tokens (never plaintext, never in the browser), Stripe signature verification on webhooks, rate limiting, input validation, audit logs. No raw card data is ever handled.

## What is NOT live yet (read this first)

Nothing below is connected or live-tested in this codebase. Do **not** claim otherwise.

| Item | Status in this build | What Niket must do |
|---|---|---|
| GitHub push | NOT pushed | Push this folder to a new repo when ready |
| Supabase SQL | NOT run | Create a **new** Supabase project for NiketDigital.ai (not the AdGenius one), run `supabase/schema.sql` in its SQL Editor, create Storage bucket `business-assets`, enable Google provider in Auth |
| Vercel deploy | NOT deployed | Import the repo in Vercel, set env vars below, deploy |
| Stripe | NOT connected | Create products/prices + webhook (below); no charge works until then |
| OpenAI | NOT connected | Add `AI_API_KEY` server-side; AI returns a clear "not configured" error until then |
| Meta | NOT connected | Create Meta app, add redirect URI, request Marketing API permissions + App Review |
| Google Ads | NOT connected | Google Cloud OAuth client + Google Ads developer token + API approval |
| Live ad publishing | NOT enabled | Drafts/paused only, by design, until the approvals above + explicit customer confirmation |

No fake data is seeded: no fake customers, leads, campaigns or ad metrics anywhere. Empty states say "No data yet".

## Setup

```bash
npm install
cp .env.example .env.local   # fill in YOUR values in .env.local only — never commit it
npm run dev                  # http://localhost:5173
npm run build                # vite build (tsc --noEmit is run separately: npx tsc --noEmit)
```

## Environment variables

See `.env.example` (placeholder names only, no real values). Frontend (`VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_APP_URL`. Server-only (Vercel Environment Variables, never in GitHub or frontend code): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY` (+ optional `AI_BASE_URL`, `AI_MODEL`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*_MONTHLY` / `*_ANNUAL` (8 prices), `TOKEN_ENCRYPTION_KEY` (generate: `openssl rand -hex 32`), `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, optional `META_CONFIG_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

## Credentials / approval checklist

### 1. Supabase (new project, separate from AdGenius AI)
- [ ] Create project at supabase.com; note Project URL + anon key + service-role key.
- [ ] SQL Editor → run `supabase/schema.sql` (or the migration `supabase/migrations/20261121_foundation.sql`, which points at the same schema — run **one** of them).
- [ ] Auth → enable Email provider + Google provider (needs Google OAuth client below).
- [ ] Storage → create public bucket `business-assets` for logos/photos.
- [ ] Admin access: after your own sign-up, set `profiles.is_admin = true` for your user id in Supabase (Table Editor) — never from the app.

### 2. Stripe
- [ ] Create 4 products (Starter/Growth/Professional/Agency) × 2 prices each (monthly + annual) in the Stripe Dashboard; copy the 8 `price_…` IDs into Vercel env vars.
- [ ] Developers → Webhooks → add endpoint `https://YOUR_DOMAIN/api/stripe-webhook`, subscribe to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`; copy the `whsec_…` signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] Test in Stripe test mode first; switch to live keys only when ready to charge real customers.

### 3. OpenAI (server key)
- [ ] Create an API key at platform.openai.com; add as `AI_API_KEY` in Vercel only.
- [ ] Optional: set `AI_MODEL` (default `gpt-4o-mini`).

### 4. Meta (Marketing API)
- [ ] Create a Meta app at developers.facebook.com; add **Facebook Login** (or Facebook Login for Business) and the **Marketing API** product.
- [ ] Valid OAuth Redirect URI, copied exactly: `https://YOUR_DOMAIN/api/auth/meta/callback`
- [ ] Permissions requested: `ads_read`, `ads_management`, `business_management`.
- [ ] Add `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` in Vercel only.
- [ ] **App Review + Business Verification** are required before other businesses can connect; test with an app admin/tester first.
- [ ] Live campaign publishing stays gated in code until this approval exists.

### 5. Google Ads API + Google OAuth
- [ ] Google Cloud Console → create OAuth client (Web); Authorised redirect URI, copied exactly: `https://YOUR_DOMAIN/api/auth/google/callback`; add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel only.
- [ ] Enable the Google Ads API; apply for a **developer token** (`GOOGLE_ADS_DEVELOPER_TOKEN`) — approval can take time and may require a test account; set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` if using a manager account.
- [ ] Enable the same Google OAuth client in Supabase Auth → Google provider (for "Continue with Google" sign-in).

## Deployment checklist (Vercel)

1. Push to GitHub (new repo; confirm `.env.local` is not committed — `.gitignore` excludes it).
2. Vercel → Import project → set **all** server env vars above (Production + Preview as needed).
3. Deploy; open the live site; check the landing page loads.
4. Sign up with a test email, verify it, finish onboarding, confirm the business row appears in Supabase.
5. Run `supabase/schema.sql` **before** testing sign-up (auth works without it, but business/lead/order saves will fail).
6. Test Stripe in test mode (Checkout → webhook shows subscription `active` in Supabase).
7. Test AI generation (needs `AI_API_KEY`); confirm a missing key returns a clear error, not fake copy.
8. Test Meta/Google Connect with an app admin account; confirm status shows "Connected" and tokens are stored encrypted (check the DB value starts with hex `iv:tag:ciphertext`, never a plaintext token).
9. Confirm a campaign created from the UI is a **paused draft** in the database (`status='paused'`, `approved_to_publish=false`).

## Files

- `src/` — frontend (`App.tsx` — landing, auth, onboarding, dashboard, website ordering, AI assistant, Meta/Google, campaigns, CRM, billing, integrations, support, admin; `supabase.ts`; `index.css`)
- `api/_lib/` — `auth.ts` (JWT verify, rate limit, validation), `supabase-server.ts` (service client, tenancy, encrypted tokens, admin check, audit), `crypto.ts` (AES-256-GCM), `stripe.ts` (price mapping)
- `api/` — `ai-generate.ts`, `stripe-checkout.ts`, `stripe-webhook.ts`, `website-orders.ts`, `leads.ts`, `admin/overview.ts`, `auth/meta/{start,callback,disconnect}.ts`, `auth/google/{start,callback}.ts`, `meta/{status,ad-accounts,campaigns}.ts`, `google-ads/{status,campaigns}.ts`
- `supabase/schema.sql` + `supabase/migrations/20261121_foundation.sql` — multi-tenant schema + RLS
- `.env.example` — placeholder variable names only

## Phases (per the brief)

- **Phase 1 (this build):** brand site, registration/auth, onboarding, subscription system, customer dashboard, admin dashboard.
- **Phase 2 (this build, foundation):** AI Marketing Assistant, AI website ordering, website project management, CRM.
- **Phase 3 (this build, architecture + drafts):** Meta/Google OAuth, campaign drafts, reporting — live publishing gated on approvals.
- **Phase 4 (next):** advanced AI automation, analytics, usage-limit enforcement in billing, security testing, production deployment.
