// POST /api/ai-generate — server-only OpenAI generation.
// Rules: (1) caller must send a verified Supabase JWT; (2) business_id is
// resolved server-side from that user — never trusted from the body;
// (3) plan AI-generation limits are checked and counted; (4) AI key is
// server-only; if missing, return 503 — NEVER fake a response;
// (5) this endpoint NEVER publishes a campaign, spends budget, or changes
// account permissions. It only returns draft text.
import { verifySupabaseUser, readJsonBody, rateLimit, validateString } from './_lib/auth.js'
import { getServiceClient, getBusinessForUser } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }
const SYSTEM_PROMPTS: Record<string, string> = {
  ad_copy: 'You are NiketDigital.ai, an ad copywriter for US roofing, home remodeling, construction and pest control businesses. Return JSON with keys: variations (array of exactly 5 objects, each with angle, primaryText, headline, description, callToAction), complianceFlags (array flagging misleading claims, unsupported promises, or policy risks; empty if none). Do not guarantee approval or results. Do not invent testimonials, prices, or guarantees.',
  meta_campaign: 'You are NiketDigital.ai, a Meta (Facebook/Instagram) campaign planner for US contractors. Return a campaign plan as JSON with keys: campaignNames (3), objective, adSets (array of {name, audience, placements, budgetNote}), headlines (5), primaryTexts (3), callToActions (3), creativeConcepts (4 with angle + description), testingIdeas (3), trackingChecklist (4). State clearly the campaign is a DRAFT, not published. Do not invent performance numbers.',
  google_campaign: 'You are NiketDigital.ai, a Google Ads planner for US contractors. Return JSON with keys: campaignStructure (3), adGroups (3 {name, keywords}), negativeKeywords (5), headlines (10, each 30 characters or fewer), descriptions (4, each 90 characters or fewer), biddingSuggestion, budgetNote. Never invent search volumes, CPCs, or competition scores; keyword ideas are ideas only.',
  landing_page: 'You are NiketDigital.ai, a landing page writer for US contractors. Return JSON with keys: heroHeadline, heroSubheadline, benefits (4), features (4), faqs (3 {q,a}), callToAction. Do not invent testimonials, certifications, addresses, or trust claims.',
  budget_plan: 'You are NiketDigital.ai, a budget planner. Return JSON with keys: scenarios (3 objects named Conservative, Balanced, Growth-focused, each with allocation, assumptions, tradeoffs, nextSteps). Do not guarantee future performance.',
  report: 'You are NiketDigital.ai, a marketing analyst. Using ONLY the metrics the user provides, return JSON with keys: executiveSummary, strengths (2), weaknesses (2), recommendations (3), nextMonthPlan (3). If data is missing, say so. Never invent missing results.',
  website_draft: 'You are NiketDigital.ai, a website copywriter for US contractors. Return JSON with keys: homeHeadline, homeSubheadline, aboutParagraph, services (array of {name, description}), serviceAreasParagraph, callToAction. Use only the business facts provided; do not invent prices, years in business, or reviews.',
}
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!rateLimit(`ai:${user.id}`, 30, 60_000)) return res.status(429).json({ error: 'Too many AI requests. Please wait a minute and try again.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first — no business profile was found for this account.' })
  const body = readJsonBody(req)
  const kind = validateString(body.kind, 50)
  const system = SYSTEM_PROMPTS[kind]
  if (!system) return res.status(400).json({ error: `Unknown generation kind: ${kind}` })
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'AI is not configured yet: AI_API_KEY is missing on the server. Add it in Vercel Environment Variables (never in frontend code or GitHub), then redeploy. No fake content was generated.' })
  // Plan limit check (monthly count, best-effort; Stripe plan is the source of truth for billing).
  try {
    const sb = getServiceClient()
    const month = new Date().toISOString().slice(0, 7)
    const { data: sub } = await sb.from('subscriptions').select('plan_id').eq('business_id', business.id).eq('status', 'active').maybeSingle()
    const { data: plan } = sub ? await sb.from('plans').select('ai_generation_limit').eq('id', (sub as any).plan_id).maybeSingle() : { data: null }
    const limit = (plan as any)?.ai_generation_limit as number | null
    if (limit != null) {
      const since = `${month}-01T00:00:00.000Z`
      const { count } = await sb.from('ai_generations').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since)
      if ((count || 0) >= limit) return res.status(402).json({ error: `Your plan's AI limit (${limit} generations/month) is reached. Upgrade your plan to continue.` })
    }
  } catch { /* limit check failure must not block generation silently — continue */ }
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions'
  const model = process.env.AI_MODEL || 'gpt-4o-mini'
  try {
    const r = await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: `Business: ${business.business_name} (${business.industry}). Request: ${validateString(body.prompt, 2000)}\nExtra context (user-entered data only): ${validateString(body.context, 2000)}\nReturn JSON only, no markdown fences.` }], temperature: 0.7 }) })
    if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: `AI provider returned an error (${r.status}). Check the server AI key/model, then try again. Provider detail (no key included): ${t.slice(0, 300)}` }) }
    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content || ''
    let parsed: any; try { parsed = JSON.parse(content) } catch { parsed = { raw: content } }
    try { const sb = getServiceClient(); await sb.from('ai_generations').insert({ business_id: business.id, user_id: user.id, kind, prompt_excerpt: validateString(body.prompt, 200) }) } catch { /* counting failure is non-fatal */ }
    return res.status(200).json({ kind, result: parsed })
  } catch (e: any) { return res.status(502).json({ error: `Could not reach the AI provider: ${e?.message || 'unknown error'}` }) }
}
