// Merged dynamic route — one Vercel Serverless Function serving the URLs below,
// so the Hobby plan's 12-function limit is not exceeded. URLs are unchanged.
import { rateLimit, readJsonBody, validateString, verifySupabaseUser } from '../_lib/auth.js'
import { audit, getBusinessForUser, getServiceClient, setIntegrationToken } from '../_lib/supabase-server.js'
import { decryptToken, encryptToken } from '../_lib/crypto.js'

async function statusHandler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(200).json({ connected: false, status: 'not_configured' })
  try {
    const sb = getServiceClient()
    const { data } = await sb.from('integrations').select('status,token_expires_at,scopes').eq('business_id', business.id).eq('provider', 'google').maybeSingle()
    if (!data) return res.status(200).json({ connected: false, status: 'not_connected', note: 'Google Ads API also needs a developer token (GOOGLE_ADS_DEVELOPER_TOKEN) — see README.md.' })
    const expired = (data as any).token_expires_at ? new Date((data as any).token_expires_at).getTime() <= Date.now() : false
    return res.status(200).json({ connected: !expired && (data as any).status === 'connected', needsReconnect: expired, status: expired ? 'needs_reconnect' : (data as any).status, scopes: (data as any).scopes, tokenExpiresAt: (data as any).token_expires_at })
  } catch { return res.status(503).json({ error: 'Server is not configured yet.' }) }

}

async function campaignsHandler(req: any, res: any) {
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

const ADS_API = 'https://googleads.googleapis.com/v21'

async function refreshAccessToken(businessId: string, userId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    const j: any = await r.json()
    if (!r.ok || !j.access_token) return null
    const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null
    await setIntegrationToken(businessId, userId, 'google', {
      encryptedAccessToken: encryptToken(j.access_token),
      encryptedRefreshToken: encryptToken(refreshToken),
      tokenExpiresAt: expiresAt,
      scopes: 'https://www.googleapis.com/auth/adwords',
    })
    return j.access_token as string
  } catch { return null }
}

async function adAccountsHandler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first.' })

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) return res.status(503).json({ error: 'Google Ads API is not configured yet: GOOGLE_ADS_DEVELOPER_TOKEN is missing on the server.' })

  const sb = getServiceClient()
  const { data: integ } = await sb.from('integrations')
    .select('encrypted_access_token, encrypted_refresh_token, token_expires_at, status')
    .eq('business_id', business.id).eq('provider', 'google').maybeSingle()
  if (!integ?.encrypted_access_token || (integ as any).status !== 'connected') {
    return res.status(200).json({ connected: false, accounts: [] })
  }

  let accessToken: string | null = null
  const expired = (integ as any).token_expires_at
    ? new Date((integ as any).token_expires_at).getTime() <= Date.now()
    : false
  if (expired) {
    const refreshToken = (integ as any).encrypted_refresh_token ? decryptToken((integ as any).encrypted_refresh_token) : null
    if (!refreshToken) return res.status(200).json({ connected: false, needsReconnect: true, accounts: [], error: 'Google sign-in expired. Reconnect Google Ads in Integrations.' })
    accessToken = await refreshAccessToken(business.id, user.id, refreshToken)
    if (!accessToken) return res.status(200).json({ connected: false, needsReconnect: true, accounts: [], error: 'Could not refresh the Google sign-in. Reconnect Google Ads in Integrations.' })
  } else {
    try { accessToken = decryptToken((integ as any).encrypted_access_token) } catch { accessToken = null }
    if (!accessToken) return res.status(200).json({ connected: false, accounts: [] })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  try {
    const r = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, { method: 'GET', headers })
    const j: any = await r.json()
    if (!r.ok) {
      const msg = j?.error?.message || 'Google Ads returned an error.'
      return res.status(502).json({ error: msg, hint: 'If this mentions access level or permissions, check the Explorer Access limits for project 78121176167.' })
    }
    const resourceNames: string[] = Array.isArray(j.resourceNames) ? j.resourceNames : []
    const accounts: Array<{ id: string; name: string; currency: string | null }> = []
    for (const rn of resourceNames) {
      const id = String(rn).replace('customers/', '')
      let name = id
      let currency: string | null = null
      try {
        const cr = await fetch(`${ADS_API}/customers/${id}`, { method: 'GET', headers })
        const cj: any = await cr.json()
        if (cr.ok && cj) {
          if (cj.descriptiveName) name = cj.descriptiveName
          if (cj.currencyCode) currency = cj.currencyCode
        }
      } catch { /* keep id-only entry; the account is still real */ }
      accounts.push({ id, name, currency })
    }
    for (const a of accounts) {
      await sb.from('ad_accounts').upsert(
        { business_id: business.id, provider: 'google', external_account_id: a.id, name: a.name, currency: a.currency },
        { onConflict: 'business_id,provider,external_account_id' },
      )
    }
    return res.status(200).json({
      connected: true,
      accounts,
      note: 'Live Google Ads accounts (Explorer Access: 2,880 operations/day on real accounts). Campaigns in the app are still drafts only.',
    })
  } catch (e: any) {
    return res.status(502).json({ error: `Could not reach Google Ads: ${e?.message || 'unknown error'}` })
  }
}

export const config = { runtime: 'nodejs' }
export default async function handler(req: any, res: any) {
  const action = String((req.query && (req.query as any).action) || '')
  switch (action) {
    case 'status': return statusHandler(req, res);
    case 'campaigns': return campaignsHandler(req, res);
    case 'ad-accounts': return adAccountsHandler(req, res);
    default: return res.status(404).json({ error: `Unknown API action: ${action}` })
  }
}
