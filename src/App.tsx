// NiketDigital.ai — frontend (Vite + React 19 + TypeScript + Tailwind 4)
// Navy blue / white / orange. Tagline: "Your AI-Powered Business Growth Partner."
// IMPORTANT: this app shows NO fake data as real. Empty states say "No data yet"
// and every metric is computed only from rows the user entered or that came
// back from a connected API. Integrations show "Not connected" until OAuth
// succeeds live. Nothing here publishes ads or charges a card.
import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

export const INDUSTRIES = ['Roofing', 'Home Remodeling', 'Construction', 'Pest Control'] as const
export type Industry = (typeof INDUSTRIES)[number]
export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Estimate Scheduled', 'Proposal Sent', 'Won', 'Lost'] as const
export const WEBSITE_PAGES = ['Home', 'About Us', 'Services', 'Roofing Services', 'Roof Replacement', 'Roof Repair', 'Kitchen Remodeling', 'Bathroom Remodeling', 'Pest Control Services', 'Service Areas', 'Gallery', 'Contact Us']
export const DESIGN_STYLES = ['Modern & Clean', 'Bold & Professional', 'Warm & Trustworthy', 'Premium & Minimal']
export const PLANS = [
  { id: 'starter', name: 'Starter', monthly: 49, annualMonthly: 39, leads: 'Up to 100 leads / mo', ai: '50 AI generations / mo', features: ['AI Marketing Assistant', 'Lead CRM', '1 website order discount', 'Email support'] },
  { id: 'growth', name: 'Growth', monthly: 99, annualMonthly: 79, leads: 'Up to 500 leads / mo', ai: '200 AI generations / mo', features: ['Everything in Starter', 'Meta + Google Ads drafts', 'Campaign reporting', 'Priority support'] },
  { id: 'professional', name: 'Professional', monthly: 199, annualMonthly: 159, leads: 'Up to 2,000 leads / mo', ai: '750 AI generations / mo', features: ['Everything in Growth', 'AI automation workflows', 'Advanced analytics', 'Monthly marketing report'] },
  { id: 'agency', name: 'Agency', monthly: 399, annualMonthly: 319, leads: 'Unlimited leads', ai: 'Unlimited AI generations', features: ['Everything in Professional', 'Multiple businesses', 'White-label reports', 'Dedicated support'] },
] as const

type View = 'landing' | 'auth' | 'onboarding' | 'dashboard' | 'website' | 'ai' | 'meta' | 'google' | 'campaigns' | 'crm' | 'analytics' | 'billing' | 'integrations' | 'support' | 'admin'
type Business = { id?: string; business_name: string; industry: string; business_email: string; phone: string; website: string; service_locations: string; address: string; services: string; logo_url: string }
type Lead = { id: string; name: string; email: string; phone: string; source: string; status: string; notes: string; created_at?: string }
type Order = { id: string; business_name: string; industry: string; design_style: string; status: string; created_at?: string }

const NAV: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'website', label: 'Website Development' },
  { id: 'ai', label: 'AI Marketing Assistant' }, { id: 'meta', label: 'Facebook & Instagram Ads' },
  { id: 'google', label: 'Google Ads' }, { id: 'campaigns', label: 'Campaigns' },
  { id: 'crm', label: 'Lead CRM' }, { id: 'analytics', label: 'Analytics & Reports' },
  { id: 'billing', label: 'Subscription & Billing' }, { id: 'integrations', label: 'Integrations' },
  { id: 'support', label: 'Support Center' }, { id: 'admin', label: 'Admin Dashboard' },
]

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/60 transition-shadow hover:shadow-lg"><h2 className="border-l-4 border-orange-500 pl-3 text-lg font-bold text-[#0f2447]">{title}</h2>{sub && <p className="mt-1 pl-4 text-sm text-slate-500">{sub}</p>}<div className="mt-4">{children}</div></section>
}
/* Simple inline SVG icons — no emoji, no external images. */
function Icon({ d, cls = 'h-6 w-6' }: { d: string; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}
const ICONS = {
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm7 11l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z',
  mega: 'M3 11l14-5v12L3 13v-2Zm14 0a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3M7 13v5a2 2 0 0 0 4 0v-4',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  check: 'M20 6 9 17l-5-5',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Zm12-12.5a9 9 0 0 1 6.5 6.5L12 21.5 3.5 13 14.5 2a9 9 0 0 1 2 2.5Zm-4 4 3 3',
}
function Input({ label, value, onChange, type = 'text', placeholder = '', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input required={required} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
}
function Btn({ children, onClick, variant = 'primary', type = 'button', disabled = false }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean }) {
  const cls = variant === 'primary' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 hover:from-orange-600 hover:to-orange-500' : variant === 'outline' ? 'border-2 border-[#0f2447] bg-white text-[#0f2447] hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-100'
  return <button type={type} disabled={disabled} onClick={onClick} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${cls}`}>{children}</button>
}
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{text}</p> }

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [business, setBusiness] = useState<Business>({ business_name: '', industry: 'Roofing', business_email: '', phone: '', website: '', service_locations: '', address: '', services: '', logo_url: '' })
  const [leads, setLeads] = useState<Lead[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [msg, setMsg] = useState('')
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('growth')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session?.user) { setUser({ id: data.session.user.id, email: data.session.user.email }); setView(v => v === 'landing' ? 'onboarding' : v) } })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => { setUser(s?.user ? { id: s.user.id, email: s.user.email } : null); if (event === 'SIGNED_IN' && s?.user) setView(v => v === 'landing' || v === 'auth' ? 'onboarding' : v) })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) loadData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  async function loadData() {
    if (!user) return
    const { data: b } = await supabase.from('businesses').select('*').eq('owner_id', user.id).maybeSingle()
    if (b) setBusiness({ business_name: b.business_name || '', industry: b.industry || 'Roofing', business_email: b.business_email || '', phone: b.phone || '', website: b.website || '', service_locations: (b.service_locations || []).join(', '), address: b.address || '', services: (b.services || []).join(', '), logo_url: b.logo_url || '' })
    const { data: l } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(50)
    if (l) setLeads(l as Lead[])
    const { data: o } = await supabase.from('website_orders').select('*').order('created_at', { ascending: false }).limit(20)
    if (o) setOrders(o as Order[])
  }
  const stats = useMemo(() => ({ leads: leads.length, won: leads.filter(l => l.status === 'Won').length, openOrders: orders.filter(o => !['Completed', 'Published'].includes(o.status)).length, pipeline: leads.filter(l => !['Won', 'Lost'].includes(l.status)).length }), [leads, orders])

  async function api(path: string, body?: unknown) {
    const { data } = await supabase.auth.getSession()
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: body ? JSON.stringify(body) : undefined })
    return r.json()
  }

  // ---- Landing ----
  if (view === 'landing') return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2447] to-[#274e96] text-lg font-black text-orange-400">N</span><span><span className="block text-xl font-black leading-none text-[#0f2447]">NiketDigital<span className="text-orange-500">.ai</span></span><span className="text-[11px] text-slate-500">Your AI-Powered Business Growth Partner</span></span></div>
          <nav className="hidden flex-wrap gap-1 text-sm font-medium text-slate-600 md:flex">{INDUSTRIES.map(i => <span key={i} className="rounded-full bg-slate-100 px-3 py-1">{i}</span>)}</nav>
          <div className="flex gap-2"><Btn variant="outline" onClick={() => setView('auth')}>Sign in</Btn><Btn onClick={() => setView('auth')}>Start free trial</Btn></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1a33] via-[#0f2447] to-[#274e96] px-6 py-12 text-white shadow-xl sm:px-10 lg:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" /><div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-white/20"><Icon d={ICONS.spark} cls="h-3.5 w-3.5" /> Built for US contractors</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Grow your contracting business <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">with AI.</span></h1>
              <p className="mt-4 max-w-xl text-slate-300">Websites, AI marketing, Meta &amp; Google Ads drafts, and a lead CRM — built for roofing, remodeling, construction and pest control businesses in the United States.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Btn onClick={() => setView('auth')}>Start free trial</Btn><Btn variant="outline" onClick={() => setView('billing')}>See plans — from $49/mo</Btn></div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-200"><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.check} cls="h-3.5 w-3.5 text-emerald-400" /> No card charged without your approval</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.shield} cls="h-3.5 w-3.5 text-emerald-400" /> Ads paused until you approve</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.users} cls="h-3.5 w-3.5 text-sky-300" /> One business per account</span></div>
            </div>
            <div className="rounded-2xl bg-white p-5 text-slate-800 shadow-2xl">
              <div className="flex items-center justify-between"><p className="font-bold text-[#0f2447]">Your dashboard — preview</p><span className="flex gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span></div>
              <p className="mt-1 text-xs text-slate-500">Example layout only — your real numbers appear here after you add leads and orders.</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[['Total leads', 'bg-[#0f2447]'], ['Won', 'bg-emerald-600'], ['Pipeline', 'bg-orange-500']].map(([l, c]) => <div key={l} className={`rounded-xl ${c} px-2 py-3 text-white`}><p className="text-lg font-black">—</p><p className="text-[11px] font-medium opacity-90">{l}</p></div>)}</div>
              <div className="mt-4 space-y-3">{[['New leads', 'w-3/4 bg-orange-500'], ['Contacted', 'w-1/2 bg-[#274e96]'], ['Won', 'w-1/3 bg-emerald-500']].map(([l, c]) => <div key={l}><div className="flex justify-between text-xs font-semibold text-slate-600"><span>{l}</span><span>Preview</span></div><div className="mt-1 h-2.5 rounded-full bg-slate-100"><div className={`h-2.5 rounded-full ${c}`} /></div></div>)}</div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><Icon d={ICONS.rocket} cls="h-4 w-4 text-orange-500" /> Website order → Quotation → In Development → Published</div>
            </div>
          </div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">Everything you need to grow</h2><p className="mt-1 text-center text-sm text-slate-500">One platform — website, marketing, ads and leads, in one place.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[['AI Website Development', 'Order a professional website for your trade, with an AI-generated design concept and a clear quotation.', ICONS.globe, 'bg-sky-100 text-sky-700'], ['AI Marketing Assistant', 'Facebook, Instagram and Google ad copy, keywords, landing pages and local marketing ideas.', ICONS.spark, 'bg-orange-100 text-orange-600'], ['Meta & Google Ads', 'Connect your own ad accounts with official OAuth. Campaigns stay paused until you approve them.', ICONS.mega, 'bg-indigo-100 text-indigo-700'], ['Lead CRM & Analytics', 'Track every lead from New to Won, follow up on time, and see real results — never invented numbers.', ICONS.chart, 'bg-emerald-100 text-emerald-700']].map(([t, d, icon, tint]) => (
              <div key={t as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon d={icon as string} /></span><h3 className="mt-3 font-bold text-[#0f2447]">{t}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p></div>
            ))}
          </div>
        </section>
        <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-center text-2xl font-black text-[#0f2447]">How it works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">{[['1', 'Create your account', 'Sign up with email or Google, then tell us about your business.'], ['2', 'Order & generate', 'Order a website or generate ad copy, keywords and landing pages with AI.'], ['3', 'Track leads & grow', 'Follow every lead from New to Won in the CRM and connect your ad accounts.']].map(([n, t, d]) => (
            <div key={t} className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-lg font-black text-white shadow-md shadow-orange-500/30">{n}</span><h3 className="mt-3 font-bold text-[#0f2447]">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
          ))}</div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">Simple pricing</h2><p className="mt-1 text-center text-sm text-slate-500">Website development is priced separately from the monthly subscription. Advertising budgets are billed separately by Meta / Google.</p>
          <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">{PLANS.map(p => <div key={p.id} className={`relative flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:shadow-lg ${p.id === 'growth' ? 'border-orange-500 shadow-lg shadow-orange-500/20 lg:-translate-y-2' : 'border-slate-200'}`}>{p.id === 'growth' && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-1 text-xs font-black text-white shadow">MOST POPULAR</span>}<h3 className="font-bold text-[#0f2447]">{p.name}</h3><p className="mt-1 text-3xl font-black text-[#0f2447]">${p.monthly}<span className="text-sm font-normal text-slate-500">/mo</span></p><p className="text-xs text-slate-500">{p.leads} · {p.ai}</p><ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">{p.features.map(f => <li key={f} className="flex gap-2"><Icon d={ICONS.check} cls="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}</ul><Btn onClick={() => setView('auth')} variant={p.id === 'growth' ? 'primary' : 'outline'}>Choose {p.name}</Btn></div>)}</div></section>
        {!isSupabaseConfigured && <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Setup notice: Supabase is not configured yet in this deployment. Sign-up and saved data will work only after VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. See README.md.</p>}
      </main>
      <footer className="bg-[#0a1a33] px-4 py-10 text-slate-300"><div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3"><div><p className="text-lg font-black text-white">NiketDigital<span className="text-orange-500">.ai</span></p><p className="mt-1 text-sm text-slate-400">Your AI-Powered Business Growth Partner.</p></div><div><p className="font-bold text-white">Built for</p><p className="mt-1 text-sm">Roofing · Remodeling · Construction · Pest Control</p></div><div><p className="font-bold text-white">Get started</p><p className="mt-1 text-sm">Start free trial — from $49/mo. No card charged without your approval.</p></div></div><p className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-slate-500">NiketDigital.ai — Built for US roofing, remodeling, construction &amp; pest control businesses.</p></footer>
    </div>
  )

  // ---- Auth ----
  if (view === 'auth') return <AuthView onBack={() => setView('landing')} onDone={() => setView('onboarding')} setMsg={setMsg} msg={msg} />

  const shell = (title: string, sub: string, children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1a33] via-[#0f2447] to-[#1e3f7a] px-4 py-3 text-white shadow-md"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-white">N</span><span className="text-xl font-black">NiketDigital<span className="text-orange-400">.ai</span></span></span><span className="hidden text-xs text-slate-300 sm:block">{business.business_name || 'Your business'} · {business.industry}</span><div className="flex gap-2"><button className="rounded-xl px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10" onClick={() => setView('landing')}>View site</button><button className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/20 transition hover:bg-white/20" onClick={async () => { await supabase.auth.signOut(); setUser(null); setView('landing') }}>Log out</button></div></div></header>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row">
        <nav className="h-fit shrink-0 rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200 lg:sticky lg:top-20 lg:w-60"><p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Menu</p><div className="flex flex-row flex-wrap gap-1 lg:flex-col">{NAV.map(n => <button key={n.id} onClick={() => setView(n.id)} className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:flex-none ${view === n.id ? 'bg-gradient-to-r from-[#0f2447] to-[#274e96] text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'}`}>{n.label}</button>)}</div><p className="mt-3 hidden rounded-xl bg-orange-50 px-3 py-2 text-xs leading-relaxed text-orange-800 lg:block">Ads stay paused until you approve them. Nothing is charged without your approval.</p></nav>
        <main className="min-w-0 flex-1"><div className="border-l-4 border-orange-500 pl-3"><h1 className="text-2xl font-black text-[#0f2447]">{title}</h1><p className="text-sm text-slate-500">{sub}</p></div>{msg && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200">{msg}</p>}<div className="mt-4 grid gap-4">{children}</div></main>
      </div>
    </div>
  )

  if (view === 'onboarding') return shell('Business onboarding', 'Tell us about your business. This creates your workspace — one business per account.', <Onboarding business={business} setBusiness={setBusiness} user={user} onDone={() => { setMsg('Business profile saved.'); setView('dashboard') }} />)
  if (view === 'dashboard') return shell('Dashboard', 'Your business at a glance. Figures below come only from your saved leads and orders — empty means no data yet, not zero performance.',
    <><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{([['Total leads', stats.leads, 'from-[#0f2447] to-[#274e96]', ICONS.users], ['Won leads', stats.won, 'from-emerald-600 to-emerald-500', ICONS.check], ['Open pipeline', stats.pipeline, 'from-orange-500 to-amber-500', ICONS.chart], ['Open website orders', stats.openOrders, 'from-sky-600 to-sky-500', ICONS.globe]] as const).map(([l, v, grad, icon]) => <div key={l} className={`rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg`}><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Icon d={icon} cls="h-5 w-5" /></span><p className="mt-3 text-3xl font-black">{v}</p><p className="text-sm font-medium opacity-90">{l}</p></div>)}</div>
    <Card title="Next steps" sub="The fastest path to your first result."><ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700"><li>Finish onboarding and pick a plan in Billing.</li><li>Order a website or generate your first ad copy in the AI Marketing Assistant.</li><li>Connect Meta / Google in Integrations — read-only first, campaigns stay paused until you approve them.</li><li>Add leads in the CRM and follow up.</li></ol></Card>
    <Card title="Recent website orders" sub="Website development is priced separately from your subscription."><OrdersList orders={orders} /></Card></>)
  if (view === 'website') return shell('AI Website Development', 'Choose your industry, style and pages, preview the concept, then submit an order. You will receive a quotation before any payment is requested.', <WebsiteOrder business={business} onSubmitted={(o: Order) => { setOrders([o, ...orders]); setMsg('Website order submitted. Status: New Order. A quotation will follow — nothing is charged yet.') }} />)
  if (view === 'ai') return shell('AI Marketing Assistant', 'Generate ad copy, keywords, landing-page content and local ideas for your trade. AI never publishes anything.', <AiAssistant api={api} business={business} />)
  if (view === 'meta') return shell('Facebook & Instagram Ads', 'Connect your Meta account with official OAuth. Campaigns are created as drafts / paused by default and need your explicit approval before publishing.', <IntegrationPanel provider="Meta" statusPath="/api/meta/status" connectPath="/api/auth/meta/start" api={api} />)
  if (view === 'google') return shell('Google Ads', 'Connect Google Ads with official OAuth. Search campaigns are drafts only until you confirm them.', <IntegrationPanel provider="Google Ads" statusPath="/api/google-ads/status" connectPath="/api/auth/google/start" api={api} />)
  if (view === 'campaigns') return shell('Campaign Management', 'Campaign drafts live here. Nothing is published or spends budget without your explicit approval.', <Campaigns api={api} />)
  if (view === 'crm') return shell('Lead Management CRM', 'Capture leads, track status, follow up, and export. Lead statuses: New → Contacted → Qualified → Estimate Scheduled → Proposal Sent → Won / Lost.', <Crm leads={leads} setLeads={setLeads} user={user} />)
  if (view === 'analytics') return shell('Analytics & Reporting', 'Reports are calculated only from your saved leads and from connected ad accounts. No invented metrics are shown.', <Card title="Your numbers" sub="Add leads and connect an ad account to see reporting here."><Empty text="No analytics yet — add leads in the CRM or connect Meta / Google Ads to see real performance here." /></Card>)
  if (view === 'billing') return shell('Subscription & Billing', 'Monthly or annual billing via Stripe. Website development and ad budgets are billed separately. You are never charged without authorisation.', <Billing annual={billingAnnual} setAnnual={setBillingAnnual} selected={selectedPlan} setSelected={setSelectedPlan} api={api} />)
  if (view === 'integrations') return shell('Integrations', 'Connect the tools you use. A connection is only shown as connected after a successful live OAuth check.', <><IntegrationPanel provider="Meta" statusPath="/api/meta/status" connectPath="/api/auth/meta/start" api={api} /><IntegrationPanel provider="Google Ads" statusPath="/api/google-ads/status" connectPath="/api/auth/google/start" api={api} /><Card title="Stripe" sub="Payments"><Empty text="Stripe is not connected until Stripe keys and webhook are configured on the server. See README.md." /></Card></>)
  if (view === 'support') return shell('Support Center', 'Raise a ticket and the NiketDigital team will reply by email.', <Support user={user} />)
  if (view === 'admin') return shell('Admin Dashboard', 'Super-admin only. This view checks profiles.is_admin on the server — do not rely on this frontend label alone.', <Admin api={api} />)
  return shell('Dashboard', '', <Empty text="Choose a section from the menu." />)
}

function AuthView({ onBack, onDone, setMsg, msg }: { onBack: () => void; onDone: () => void; setMsg: (s: string) => void; msg: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin'); const [err, setErr] = useState('')
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr('')
    try {
      if (mode === 'signup') { const { error } = await supabase.auth.signUp({ email, password }); if (error) throw error; setMsg('Account created. Please check your email to verify it, then sign in.'); }
      else if (mode === 'reset') { const { error } = await supabase.auth.resetPasswordForEmail(email); if (error) throw error; setMsg('Password-reset email sent (if that address is registered). Check your inbox.'); }
      else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; onDone(); }
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Something went wrong.') }
  }
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1a33] via-[#0f2447] to-[#274e96] px-4 py-8"><form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" /><div className="p-6"><h1 className="text-2xl font-black text-[#0f2447]">NiketDigital<span className="text-orange-500">.ai</span></h1><p className="text-sm text-slate-500">Your AI-Powered Business Growth Partner</p>
    <div className="mt-4 flex gap-2">{(['signin', 'signup', 'reset'] as const).map(m => <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? 'bg-[#0f2447] text-white' : 'bg-slate-100'}`}>{m === 'signin' ? 'Sign in' : m === 'signup' ? 'Register' : 'Reset password'}</button>)}</div>
    <div className="mt-4 space-y-3"><Input label="Email" type="email" value={email} onChange={setEmail} required /><Input label="Password" type="password" value={password} onChange={setPassword} required={mode !== 'reset'} /></div>
    {err && <p className="mt-3 text-sm text-red-600">{err}</p>}{msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
    <div className="mt-4 flex gap-2"><Btn type="submit">{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset email'}</Btn><Btn variant="outline" onClick={onBack}>Back</Btn></div>
    <button type="button" className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-semibold" onClick={async () => { const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } }); if (error) setErr(error.message) }}>Continue with Google</button>
    <p className="mt-3 text-xs text-slate-500">Google login works only after Google OAuth is enabled in Supabase Auth. Email verification and password reset use Supabase Auth emails.</p></div></form></div>
}

function Onboarding({ business, setBusiness, user, onDone }: { business: Business; setBusiness: (b: Business) => void; user: { id: string; email?: string } | null; onDone: () => void }) {
  const [err, setErr] = useState('')
  async function save(e: React.FormEvent) { e.preventDefault(); setErr('')
    if (!user) { setErr('Please sign in first.'); return }
    const { error } = await supabase.from('businesses').upsert({ owner_id: user.id, business_name: business.business_name, industry: business.industry, business_email: business.business_email, phone: business.phone, website: business.website || null, service_locations: business.service_locations.split(',').map(s => s.trim()).filter(Boolean), address: business.address, services: business.services.split(',').map(s => s.trim()).filter(Boolean), logo_url: business.logo_url || null }, { onConflict: 'owner_id' })
    if (error) setErr(error.message); else onDone()
  }
  const set = (k: keyof Business) => (v: string) => setBusiness({ ...business, [k]: v })
  return <form onSubmit={save} className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200"><div className="bg-gradient-to-r from-[#0f2447] to-[#274e96] px-5 py-4 text-white"><p className="text-sm font-bold">Step 1 — Your business profile</p><p className="text-xs text-slate-300">This creates your workspace. You can change it later.</p></div><div className="p-5"><div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm font-medium text-slate-700">Industry<select value={business.industry} onChange={e => set('industry')(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></label>
    <Input label="Business name" value={business.business_name} onChange={set('business_name')} required />
    <Input label="Business email" type="email" value={business.business_email} onChange={set('business_email')} required />
    <Input label="Phone number" type="tel" value={business.phone} onChange={set('phone')} required />
    <Input label="Business website (optional)" value={business.website} onChange={set('website')} placeholder="https://example.com" />
    <Input label="Service locations (comma-separated)" value={business.service_locations} onChange={set('service_locations')} placeholder="Dallas, TX; Fort Worth, TX" />
    <Input label="Business address" value={business.address} onChange={set('address')} />
    <Input label="Services offered (comma-separated)" value={business.services} onChange={set('services')} placeholder="Roof replacement, Roof repair" />
    <Input label="Logo / image URL (upload to Supabase Storage — paste the URL here)" value={business.logo_url} onChange={set('logo_url')} placeholder="https://…/logo.png" />
  </div>{err && <p className="mt-3 text-sm text-red-600">{err}</p>}<div className="mt-4"><Btn type="submit">Save business profile</Btn></div>
  <p className="mt-3 text-xs text-slate-500">Logo and business-image uploads use Supabase Storage (bucket: business-assets). Paste the file URL here until the in-app uploader is enabled.</p></div></form>
}

function OrdersList({ orders }: { orders: Order[] }) {
  if (!orders.length) return <Empty text="No website orders yet. Start one from Website Development." />
  return <ul className="space-y-2">{orders.map(o => <li key={o.id} className="flex flex-wrap justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span><strong>{o.business_name}</strong> · {o.industry} · {o.design_style}</span><span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{o.status}</span></li>)}</ul>
}

function WebsiteOrder({ business, onSubmitted }: { business: Business; onSubmitted: (o: Order) => void }) {
  const [style, setStyle] = useState(DESIGN_STYLES[0]); const [pages, setPages] = useState<string[]>(['Home', 'Services', 'Contact Us']); const [features, setFeatures] = useState(''); const [contact, setContact] = useState(''); const [preview, setPreview] = useState(false); const [err, setErr] = useState('')
  async function submit() { setErr('')
    const { data } = await supabase.auth.getSession()
    const r = await fetch('/api/website-orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ business_name: business.business_name, industry: business.industry, design_style: style, pages, services: business.services, service_locations: business.service_locations, contact_info: contact, additional_features: features }) })
    const j = await r.json(); if (!r.ok) { setErr(j.error || 'Could not submit the order.'); return }
    onSubmitted({ id: j.order?.id || `local-${Date.now()}`, business_name: business.business_name, industry: business.industry, design_style: style, status: 'New Order' })
  }
  return <Card title="New website order" sub="Order statuses: New Order → Under Review → Quotation Sent → Payment Pending → In Development → Customer Review → Revisions → Completed → Published.">
    <div className="grid gap-3 sm:grid-cols-2"><p className="text-sm"><strong>Industry:</strong> {business.industry}</p><p className="text-sm"><strong>Business:</strong> {business.business_name || '— (finish onboarding first)'}</p>
    <label className="block text-sm font-medium">Design style<select value={style} onChange={e => setStyle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{DESIGN_STYLES.map(s => <option key={s}>{s}</option>)}</select></label>
    <Input label="Contact information for the site" value={contact} onChange={setContact} placeholder="Phone, email, address" /></div>
    <fieldset className="mt-4"><legend className="text-sm font-semibold">Pages required</legend><div className="mt-2 flex flex-wrap gap-2">{WEBSITE_PAGES.map(p => <button type="button" key={p} onClick={() => setPages(pages.includes(p) ? pages.filter(x => x !== p) : [...pages, p])} className={`rounded-full border px-3 py-1 text-xs font-semibold ${pages.includes(p) ? 'bg-[#0f2447] text-white' : 'bg-white'}`}>{p}</button>)}</div></fieldset>
    <div className="mt-3"><Input label="Additional features / custom requests" value={features} onChange={setFeatures} placeholder="e.g. online estimate form, photo gallery, service-area map" /></div>
    <div className="mt-4 flex flex-wrap gap-2"><Btn variant="outline" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview concept' : 'Preview design concept'}</Btn><Btn onClick={submit}>Submit website order</Btn></div>
    {preview && <div className="mt-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-5"><p className="font-bold text-[#0f2447]">{business.business_name || 'Your Business'} — {style}</p><p className="text-sm text-slate-600">Pages: {pages.join(', ') || 'None selected yet.'}</p><p className="mt-2 text-xs text-slate-500">This is a design concept preview only — the finished website is built after your quotation is approved. No fake live site is shown.</p></div>}
    {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
  </Card>
}

function AiAssistant({ api, business }: { api: (p: string, b?: unknown) => Promise<any>; business: Business }) {
  const [kind, setKind] = useState('ad_copy'); const [prompt, setPrompt] = useState(''); const [out, setOut] = useState(''); const [busy, setBusy] = useState(false)
  async function run() { setBusy(true); setOut('')
    const j = await api('/api/ai-generate', { kind, prompt: `${business.business_name} (${business.industry}) — services: ${business.services}; locations: ${business.service_locations}. ${prompt}`, context: '' })
    setOut(j.error ? `Error: ${j.error}` : JSON.stringify(j.result, null, 2)); setBusy(false)
  }
  return <Card title="Generate marketing content" sub="AI generates drafts only. It never publishes campaigns, spends budget, or changes account permissions.">
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">What to generate<select value={kind} onChange={e => setKind(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{[['ad_copy', 'Facebook / Instagram ad copy'], ['meta_campaign', 'Meta campaign plan'], ['google_campaign', 'Google Ads campaign + keywords'], ['landing_page', 'Landing page content'], ['budget_plan', 'Budget plan'], ['report', 'Monthly marketing report (from your numbers)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <Input label="Objective, locations, services, budget" value={prompt} onChange={setPrompt} placeholder="e.g. Get more roof-replacement leads in Dallas, $1,500/mo budget" /></div>
    <div className="mt-3"><Btn onClick={run} disabled={busy}>{busy ? 'Generating…' : 'Generate'}</Btn></div>
    {out && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{out}</pre>}
  </Card>
}

function IntegrationPanel({ provider, statusPath, connectPath, api }: { provider: string; statusPath: string; connectPath: string; api: (p: string, b?: unknown) => Promise<any> }) {
  const [status, setStatus] = useState('Checking…')
  useEffect(() => { fetch(statusPath).then(r => r.json()).then(j => setStatus(j.connected ? `Connected${j.scopes ? ` — scopes: ${j.scopes}` : ''}` : j.error ? `Not connected — ${j.error}` : 'Not connected')).catch(() => setStatus('Not connected — status check failed (server may not be configured yet).')) }, [statusPath])
  return <Card title={`${provider} — connection`} sub="Official OAuth only. Never share your ad-account password with this app."><p className="text-sm"><strong>Status:</strong> {status}</p><div className="mt-3 flex gap-2"><a className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white" href={connectPath}>Connect {provider} account</a>{provider === 'Meta' && <Btn variant="outline" onClick={async () => { const j = await api('/api/auth/meta/disconnect', {}); setStatus(j.ok ? 'Not connected' : `Error: ${j.error || 'disconnect failed'}`) }}>Disconnect</Btn>}</div><p className="mt-3 text-xs text-slate-500">After connecting, choose an ad account, then create drafts. Publishing needs your explicit confirmation on the Campaigns page.</p></Card>
}

function Campaigns({ api }: { api: (p: string, b?: unknown) => Promise<any> }) {
  const [out, setOut] = useState('')
  return <Card title="Campaign drafts" sub="All campaigns are created PAUSED / draft by default. Publishing or changing a budget needs your explicit confirmation — the API enforces this.">
    <div className="flex flex-wrap gap-2"><Btn onClick={async () => setOut(JSON.stringify(await api('/api/meta/campaigns', { action: 'list' }), null, 2))}>List Meta campaigns</Btn><Btn variant="outline" onClick={async () => setOut(JSON.stringify(await api('/api/google-ads/campaigns', { action: 'list' }), null, 2))}>List Google Ads campaigns</Btn></div>
    <p className="mt-3 text-sm text-slate-600">To create a campaign, first generate a draft in the AI Marketing Assistant, review it, then confirm publishing here. The create endpoints reject any request that does not include <code>confirmPublish: true</code> and a paused status.</p>
    {out && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{out}</pre>}</Card>
}

function Crm({ leads, setLeads, user }: { leads: Lead[]; setLeads: (l: Lead[]) => void; user: { id: string; email?: string } | null }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [source, setSource] = useState('Website form'); const [err, setErr] = useState('')
  async function add(e: React.FormEvent) { e.preventDefault(); setErr(''); if (!user) { setErr('Sign in first.'); return }
    const { data, error } = await supabase.from('leads').insert({ business_id: (await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle()).data?.id, name, email: email || null, phone: phone || null, source, status: 'New' }).select().single()
    if (error) setErr(error.message); else { setLeads([data as Lead, ...leads]); setName(''); setEmail(''); setPhone('') }
  }
  async function setStatus(id: string, status: string) { const { error } = await supabase.from('leads').update({ status }).eq('id', id); if (!error) setLeads(leads.map(l => l.id === id ? { ...l, status } : l)) }
  async function exportCsv() { const rows = [['name', 'email', 'phone', 'source', 'status'], ...leads.map(l => [l.name, l.email, l.phone, l.source, l.status])]; const blob = new Blob([rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'niketdigital-leads.csv'; a.click() }
  return <><Card title="Add a lead" sub="Leads can also arrive from Meta Lead Ads and authorised website forms (see /api/leads)."><form onSubmit={add} className="grid gap-3 sm:grid-cols-4"><Input label="Name" value={name} onChange={setName} required /><Input label="Email" type="email" value={email} onChange={setEmail} /><Input label="Phone" type="tel" value={phone} onChange={setPhone} /><label className="block text-sm font-medium">Source<select value={source} onChange={e => setSource(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{['Website form', 'Meta Lead Ads', 'Google Ads', 'Phone', 'Referral', 'Other'].map(s => <option key={s}>{s}</option>)}</select></label><div className="flex items-end gap-2 sm:col-span-4"><Btn type="submit">Add lead</Btn><Btn variant="outline" onClick={exportCsv}>Export CSV</Btn></div></form>{err && <p className="mt-2 text-sm text-red-600">{err}</p>}</Card>
  <Card title={`Pipeline — ${leads.length} lead(s)`} sub="Drag-and-drop is not included in this build; change status from the dropdown.">{leads.length ? <ul className="space-y-2">{leads.map(l => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span><strong>{l.name}</strong> · {l.email || 'no email'} · {l.phone || 'no phone'} · {l.source}</span><select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="rounded-lg border px-2 py-1 text-xs">{LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}</select></li>)}</ul> : <Empty text="No leads yet. Add your first lead above, or connect Meta Lead Ads." />}</Card></>
}

function Billing({ annual, setAnnual, selected, setSelected, api }: { annual: boolean; setAnnual: (b: boolean) => void; selected: string; setSelected: (s: string) => void; api: (p: string, b?: unknown) => Promise<any> }) {
  const [out, setOut] = useState('')
  return <><Card title="Choose your plan" sub="Annual billing is two months free (annual monthly rate shown). Upgrade, downgrade or cancel any time — changes take effect as Stripe confirms them."><div className="flex gap-2"><Btn variant={annual ? 'primary' : 'outline'} onClick={() => setAnnual(true)}>Annual</Btn><Btn variant={!annual ? 'primary' : 'outline'} onClick={() => setAnnual(false)}>Monthly</Btn></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{PLANS.map(p => <div key={p.id} className={`rounded-2xl border-2 p-4 ${selected === p.id ? 'border-orange-500' : 'border-slate-200'}`}><h3 className="font-bold">{p.name}</h3><p className="text-2xl font-black">${annual ? p.annualMonthly : p.monthly}<span className="text-sm font-normal">/mo{annual ? ' (billed annually)' : ''}</span></p><p className="text-xs text-slate-500">{p.leads} · {p.ai}</p><button className="mt-3 w-full rounded-lg bg-[#0f2447] px-3 py-2 text-sm font-semibold text-white" onClick={() => setSelected(p.id)}>Select {p.name}</button></div>)}</div>
    <div className="mt-4"><Btn onClick={async () => { const j = await api('/api/stripe-checkout', { plan: selected, interval: annual ? 'annual' : 'monthly' }); setOut(j.error ? `Error: ${j.error}` : j.url ? 'Checkout opened in a new tab — complete payment on Stripe\'s secure page.' : JSON.stringify(j)); if (j.url) window.open(j.url, '_blank') }}>Continue to secure Stripe checkout</Btn></div>
    {out && <p className="mt-3 text-sm">{out}</p>}<p className="mt-3 text-xs text-slate-500">Stripe handles card details — this app never sees or stores raw card numbers. Failed payments trigger a Stripe notification; renewals are automatic until you cancel.</p></Card>
  <Card title="Payment history" sub="Shown only after Stripe is connected and a payment exists."><Empty text="No payments yet." /></Card></>
}

function Support({ user }: { user: { id: string; email?: string } | null }) {
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [done, setDone] = useState('')
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!user) return; const { error } = await supabase.from('support_tickets').insert({ user_id: user.id, subject, message: body, status: 'Open' }); setDone(error ? error.message : 'Ticket submitted. The team will reply by email.') }
  return <Card title="Raise a support ticket" sub="Include your business name and what you were doing when the issue happened."><form onSubmit={submit} className="space-y-3"><Input label="Subject" value={subject} onChange={setSubject} required /><label className="block text-sm font-medium">Message<textarea value={body} onChange={e => setBody(e.target.value)} required rows={4} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><Btn type="submit">Submit ticket</Btn></form>{done && <p className="mt-3 text-sm">{done}</p>}</Card>
}

function Admin({ api }: { api: (p: string, b?: unknown) => Promise<any> }) {
  const [out, setOut] = useState('Admin data loads only if your profile has is_admin = true. The server checks this on every admin request.')
  return <Card title="Super-admin overview" sub="Customers, subscriptions, revenue, website orders, quotations, API status, AI usage, support and audit logs."><div className="flex flex-wrap gap-2"><Btn onClick={async () => setOut(JSON.stringify(await api('/api/admin/overview', {}), null, 2))}>Load admin overview</Btn></div><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{out}</pre><p className="mt-3 text-xs text-slate-500">Admin access is granted only by setting profiles.is_admin = true for a trusted user in Supabase — never from this frontend.</p></Card>
}
