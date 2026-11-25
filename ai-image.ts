// POST /api/ai-image — server-only AI ad-image generation (AI Ad Creative Studio).
// Uses the OpenAI Images API (gpt-image-1) with the server-side key.
// Rules: (1) caller must send a verified Supabase JWT; (2) business_id is
// resolved server-side from that user — never trusted from the body;
// (3) plan AI-generation limits are checked and counted (1 count per image);
// (4) image key is server-only — IMAGE_API_KEY, falling back to AI_API_KEY.
// If missing, return 503 — NEVER return a fake or stock image as generated;
// (5) this endpoint NEVER publishes anything. It only returns generated images.
// Sizes: the ad formats the app offers (1080x1080, 1080x1350, 1080x1920,
// 1200x628) are mapped to the closest size gpt-image-1 supports
// (1024x1024, 1024x1536, 1536x1024). The response always states the actual
// size generated, so the UI never claims a size it did not produce.
// Uploads: an uploaded product photo is sent to the Images Edits API so the
// real product appears in the ad. A brand logo is NOT sent to the model
// (image models cannot reproduce a logo faithfully) — the app overlays the
// logo in the browser when downloading instead.
import { verifySupabaseUser, readJsonBody, rateLimit, validateString } from './_lib/auth.js'
import { getServiceClient, getBusinessForUser } from './_lib/supabase-server.js'
export const config = { runtime: 'nodejs' }

const PLATFORMS: Record<string, string> = {
  facebook: 'Facebook feed ad',
  instagram: 'Instagram feed ad, visually striking',
  google: 'Google Display ad, clear headline space, readable even at small sizes',
  linkedin: 'LinkedIn ad, professional B2B tone',
  tiktok: 'TikTok ad, vertical, bold, energetic, made for a young audience',
  pinterest: 'Pinterest ad, inspirational, beautiful imagery',
  youtube: 'YouTube ad, bold thumbnail style, high contrast',
}
const STYLES: Record<string, string> = {
  professional: 'clean professional business advertisement, trustworthy, sharp corporate look',
  realistic: 'realistic product photography, studio lighting, photorealistic, high detail',
  luxury: 'luxury advertising, premium, elegant, high-end feel',
  modern: 'modern promotional ad, bold colors, dynamic layout, contemporary design',
  minimalist: 'minimalist advertising, lots of white space, simple, one clear focal point',
  lifestyle: 'lifestyle advertising, real people using the product in everyday life, warm and relatable',
  before_after: 'before and after comparison ad, split view showing the transformation, dramatic visible difference',
  ecommerce: 'e-commerce product ad, product centered on a clean background, space for a price and shop button',
  local: 'local business ad, friendly neighbourhood feel, community trust, clear space for phone and location',
  seasonal: 'seasonal promotional ad, festive, timely seasonal mood',
}
const SIZES: Record<string, { api: string; label: string }> = {
  square: { api: '1024x1024', label: 'Square 1080 × 1080' },
  portrait: { api: '1024x1536', label: 'Portrait 1080 × 1350' },
  story: { api: '1024x1536', label: 'Story / Reels 1080 × 1920' },
  landscape: { api: '1536x1024', label: 'Landscape 1200 × 628' },
}

function buildPrompt(b: any, platform: string, style: string, sizeLabel: string): string {
  const parts = [
    `Create a ${sizeLabel} advertisement image for ${PLATFORMS[platform] || PLATFORMS.facebook}.`,
    `Business: ${b.businessName} (${b.industry}).`,
    `Product or service: ${b.product}.`,
    `Target audience: ${b.audience} in ${b.country}.`,
    `Style: ${STYLES[style] || STYLES.professional}.`,
  ]
  if (b.brandColor1 || b.brandColor2) parts.push(`Brand colors: ${[b.brandColor1, b.brandColor2].filter(Boolean).join(' and ')} — use them in the design.`)
  if (b.background) parts.push(`Background: ${b.background}.`)
  if (b.customPrompt) parts.push(`Extra direction: ${b.customPrompt}`)
  parts.push(`Include the business name "${b.businessName}" as clear, readable text in the design. Leave clean space for a headline and a call to action.`)
  parts.push('Do not invent prices, guarantees, testimonials, or fake reviews. Photorealistic, high quality, advertising-grade.')
  return parts.join(' ')
}

function b64ToBlob(b64: string): Blob | null {
  try {
    const clean = String(b64).replace(/^data:image\/\w+;base64,/, '')
    if (!clean || clean.length > 6_000_000) return null
    return new Blob([Buffer.from(clean, 'base64')], { type: 'image/jpeg' })
  } catch { return null }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if (!rateLimit(`ai-image:${user.id}`, 10, 60_000)) return res.status(429).json({ error: 'Too many image requests. Please wait a minute and try again.' })
  const business = await getBusinessForUser(user.id)
  if (!business) return res.status(400).json({ error: 'Finish business onboarding first — no business profile was found for this account.' })
  const body = readJsonBody(req)
  const apiKey = process.env.IMAGE_API_KEY || process.env.AI_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'AI image generation is not configured yet: IMAGE_API_KEY (or AI_API_KEY) is missing on the server. Add it in Vercel Environment Variables (never in frontend code or GitHub), then redeploy. No image was generated.' })
  const imageBase = (process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.IMAGE_MODEL || 'gpt-image-1'
  const platform = PLATFORMS[body.platform] ? String(body.platform) : 'facebook'
  const style = STYLES[body.style] ? String(body.style) : 'professional'
  const sizeKey = SIZES[body.size] ? String(body.size) : 'square'
  const size = SIZES[sizeKey]
  const variations = [1, 2, 4].includes(Number(body.variations)) ? Number(body.variations) : 1
  const fields = {
    businessName: validateString(body.businessName || business.business_name, 120) || business.business_name,
    industry: validateString(body.industry || business.industry, 80) || business.industry,
    product: validateString(body.product, 200) || 'our services',
    audience: validateString(body.audience, 200) || 'local homeowners',
    country: validateString(body.country, 80) || 'United States',
    brandColor1: validateString(body.brandColor1, 20),
    brandColor2: validateString(body.brandColor2, 20),
    background: validateString(body.background, 200),
    customPrompt: validateString(body.customPrompt, 1000),
  }
  const promptOverride = validateString(body.promptOverride, 2000)
  const prompt = promptOverride || buildPrompt(fields, platform, style, size.label)
  const productImageB64 = typeof body.productImageB64 === 'string' ? body.productImageB64 : ''
  const baseImageB64 = typeof body.baseImageB64 === 'string' ? body.baseImageB64 : ''
  // Plan limit check (monthly count, best-effort). Each image counts as 1.
  try {
    const sb = getServiceClient()
    const month = new Date().toISOString().slice(0, 7)
    const { data: sub } = await sb.from('subscriptions').select('plan_id').eq('business_id', business.id).eq('status', 'active').maybeSingle()
    const { data: plan } = sub ? await sb.from('plans').select('ai_generation_limit').eq('id', (sub as any).plan_id).maybeSingle() : { data: null }
    const limit = (plan as any)?.ai_generation_limit as number | null
    if (limit != null) {
      const since = `${month}-01T00:00:00.000Z`
      const { count } = await sb.from('ai_generations').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since)
      if ((count || 0) + variations > limit) return res.status(402).json({ error: `Your plan's AI limit (${limit} generations/month) does not cover ${variations} image(s) — ${limit - (count || 0)} left this month. Generate fewer variations or upgrade your plan.` })
    }
  } catch { /* limit check failure must not block generation silently — continue */ }

  async function generateOnce(): Promise<{ b64: string; revisedPrompt?: string }> {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
    const inputImage = baseImageB64 || productImageB64
    if (inputImage) {
      const blob = b64ToBlob(inputImage)
      if (!blob) throw new Error('The uploaded image could not be read. Try a smaller JPG or PNG (under 4 MB).')
      const editPrompt = baseImageB64
        ? (promptOverride || `Keep the product, people and layout of this ad exactly the same. Only change the background to: ${fields.background || 'a clean, bright, professional setting'}. Do not change any text. Photorealistic, advertising-grade.`)
        : `Use the uploaded product photo as the hero product in this advertisement. Keep the product exactly as shown — same shape, color and details. ${prompt}`
      const form = new FormData()
      form.append('image', blob, 'product.jpg')
      form.append('prompt', editPrompt)
      form.append('model', model)
      form.append('size', size.api)
      form.append('n', '1')
      form.append('response_format', 'b64_json')
      const r = await fetch(`${imageBase}/images/edits`, { method: 'POST', headers, body: form })
      if (!r.ok) { const t = await r.text(); throw new Error(`AI provider returned an error (${r.status}). ${t.slice(0, 300)}`) }
      const j: any = await r.json()
      const item = j?.data?.[0]
      if (!item?.b64_json) throw new Error('AI provider returned no image.')
      return { b64: item.b64_json, revisedPrompt: item.revised_prompt }
    }
    const r = await fetch(`${imageBase}/images/generations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: size.api, n: 1, response_format: 'b64_json' }),
    })
    if (!r.ok) { const t = await r.text(); throw new Error(`AI provider returned an error (${r.status}). ${t.slice(0, 300)}`) }
    const j: any = await r.json()
    const item = j?.data?.[0]
    if (!item?.b64_json) throw new Error('AI provider returned no image.')
    return { b64: item.b64_json, revisedPrompt: item.revised_prompt }
  }

  try {
    const results = await Promise.all(Array.from({ length: variations }, () => generateOnce()))
    try {
      const sb = getServiceClient()
      for (let i = 0; i < results.length; i++) {
        await sb.from('ai_generations').insert({ business_id: business.id, user_id: user.id, kind: 'image', prompt_excerpt: prompt.slice(0, 200) })
      }
    } catch { /* counting failure is non-fatal */ }
    return res.status(200).json({
      model,
      requestedSize: size.label,
      actualSize: size.api,
      prompt,
      images: results.map((r) => ({ b64: r.b64, format: 'png', sizeLabel: size.label, actualSize: size.api, prompt, revisedPrompt: r.revisedPrompt || null })),
      note: `Generated at ${size.api} (closest supported size to ${size.label}).`,
    })
  } catch (e: any) {
    return res.status(502).json({ error: `Image generation failed: ${e?.message || 'unknown error'}` })
  }
}
