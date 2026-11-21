// Server-only Supabase service-role client. NEVER import from src/.
// It bypasses RLS by design, so every caller MUST first verify the Supabase
// user JWT (api/_lib/auth.ts) and then only query rows for that user's business.
import { createClient } from '@supabase/supabase-js'
import { decryptToken, encryptToken } from './crypto.js'
export class ServerConfigError extends Error {}
export function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new ServerConfigError('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing on the server.')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
export async function getBusinessForUser(userId: string) {
  const sb = getServiceClient()
  const { data, error } = await sb.from('businesses').select('id, business_name, industry').eq('owner_id', userId).maybeSingle()
  if (error || !data) return null
  return data as { id: string; business_name: string; industry: string }
}
export async function isAdmin(userId: string): Promise<boolean> {
  const sb = getServiceClient()
  const { data } = await sb.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  return Boolean((data as any)?.is_admin)
}
export async function audit(businessId: string | null, userId: string | null, action: string, entityType?: string, entityId?: string, details: Record<string, unknown> = {}) {
  try {
    const sb = getServiceClient()
    await sb.from('audit_logs').insert({ business_id: businessId, user_id: userId, action, entity_type: entityType || null, entity_id: entityId || null, details })
  } catch { /* audit failure must never break the main request */ }
}
// --- Encrypted integration tokens (provider: 'meta' | 'google') ---
export async function setIntegrationToken(businessId: string, userId: string, provider: string, opts: { encryptedAccessToken: string; encryptedRefreshToken?: string | null; tokenExpiresAt?: string | null; scopes?: string | null; externalUserId?: string | null }) {
  const sb = getServiceClient()
  const { error } = await sb.from('integrations').upsert({ business_id: businessId, user_id: userId, provider, status: 'connected', encrypted_access_token: opts.encryptedAccessToken, encrypted_refresh_token: opts.encryptedRefreshToken || null, token_expires_at: opts.tokenExpiresAt || null, scopes: opts.scopes || null, external_user_id: opts.externalUserId || null, updated_at: new Date().toISOString() }, { onConflict: 'business_id,provider' })
  if (error) throw error
}
export async function getDecryptedToken(businessId: string, provider: string): Promise<string | null> {
  const sb = getServiceClient()
  const { data } = await sb.from('integrations').select('encrypted_access_token, token_expires_at').eq('business_id', businessId).eq('provider', provider).maybeSingle()
  if (!data?.encrypted_access_token) return null
  if ((data as any).token_expires_at && new Date((data as any).token_expires_at).getTime() <= Date.now()) return null
  try { return decryptToken((data as any).encrypted_access_token) } catch { return null }
}
export async function deleteIntegration(businessId: string, provider: string) {
  const sb = getServiceClient()
  await sb.from('integrations').delete().eq('business_id', businessId).eq('provider', provider)
  await sb.from('ad_accounts').delete().eq('business_id', businessId).eq('provider', provider)
}
export { encryptToken }
