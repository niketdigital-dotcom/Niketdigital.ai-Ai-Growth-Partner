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


/* All services of the NiketDigital.ai tool — shown on the home page.
   Stripe Billing and Super-Admin are NOT listed here (they stay inside the
   app only, in the Billing and Admin dashboard views). */
const U = (id: string) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`
export const ALL_SERVICES: { title: string; desc: string; benefit: string; icon: string; grad: string; tint: string; img: string; target: View }[] = [
  { title: 'AI Website Development', desc: 'Order a professional website for your trade — Home, Services, Gallery, Contact and more — with an AI design concept and a clear quotation first.', benefit: 'A fast, professional website that turns visitors into estimate requests.', icon: 'globe', grad: 'from-sky-500 to-blue-700', tint: 'bg-sky-100 text-sky-700', img: U('photo-1600585154340-be6161a56a0c'), target: 'website' },
  { title: 'AI Marketing Assistant', desc: 'Facebook, Instagram and Google ad copy, headlines, keywords, landing-page content and local marketing ideas — generated in seconds.', benefit: 'Hours of writing done in minutes, in your trade’s language.', icon: 'spark', grad: 'from-orange-500 to-amber-500', tint: 'bg-orange-100 text-orange-600', img: U('photo-1556761175-b413da4baf72'), target: 'ai' },
  { title: 'Meta Ads', desc: 'Connect your Facebook and Instagram ad account with official OAuth. Campaigns are created as drafts, paused by default.', benefit: 'Reach homeowners on Facebook and Instagram in the areas you serve.', icon: 'mega', grad: 'from-indigo-500 to-violet-600', tint: 'bg-indigo-100 text-indigo-700', img: U('photo-1522071820081-009f0129c71c'), target: 'meta' },
  { title: 'Google Ads', desc: 'Connect Google Ads with official OAuth. Search campaigns stay as drafts until you review and approve them.', benefit: 'Show up first when someone searches for your service near them.', icon: 'target', grad: 'from-emerald-500 to-teal-600', tint: 'bg-emerald-100 text-emerald-700', img: U('photo-1581094794329-c8112a89af12'), target: 'google' },
  { title: 'Campaign Management', desc: 'See all your campaign drafts in one place. Nothing is published, and no budget is changed, without your explicit confirmation.', benefit: 'Every campaign, draft and budget in one clear place — no surprises.', icon: 'rocket', grad: 'from-rose-500 to-pink-600', tint: 'bg-rose-100 text-rose-700', img: U('photo-1504307651254-35680f356dfd'), target: 'campaigns' },
  { title: 'Lead CRM', desc: 'Capture every lead and track it from New to Won — Contacted, Qualified, Estimate Scheduled, Proposal Sent — with CSV export.', benefit: 'No lead is forgotten — follow up on time and win more jobs.', icon: 'users', grad: 'from-[#0f2447] to-[#274e96]', tint: 'bg-slate-200 text-[#0f2447]', img: U('photo-1521791136064-7986c2920216'), target: 'crm' },
  { title: 'Analytics & Reporting', desc: 'Reports calculated only from your saved leads and connected ad accounts. No invented numbers — empty means no data yet.', benefit: 'See exactly where your leads and jobs come from, every month.', icon: 'chart', grad: 'from-cyan-500 to-sky-600', tint: 'bg-cyan-100 text-cyan-700', img: U('photo-1460925895917-afdab827c52f'), target: 'analytics' },
  { title: 'Integrations', desc: 'Connect Meta, Google Ads and Stripe with official OAuth. A connection is only shown as connected after a successful live check.', benefit: 'Your ad accounts and payments connect securely, in a few clicks.', icon: 'link', grad: 'from-amber-500 to-orange-600', tint: 'bg-amber-100 text-amber-700', img: U('photo-1519389950473-47ba0277781c'), target: 'integrations' },
  { title: 'Support Center', desc: 'Raise a support ticket from inside the app and the NiketDigital team will reply by email.', benefit: 'Help from a real team whenever you are stuck.', icon: 'headset', grad: 'from-teal-500 to-emerald-600', tint: 'bg-teal-100 text-teal-700', img: U('photo-1600880292203-757bb62b4baf'), target: 'support' },
  { title: 'AI Automation', desc: 'Automation workflows that save time on follow-ups and reporting — part of the Professional and Agency plans.', benefit: 'Follow-ups and reports happen automatically while you work on site.', icon: 'gear', grad: 'from-slate-600 to-slate-800', tint: 'bg-slate-200 text-slate-700', img: U('photo-1497366216548-37526070297c'), target: 'ai' },
]
/* Royalty-free industry photos (Unsplash, free to use). Verified to load. */
export const INDUSTRY_IMAGES: Record<Industry, string> = {
  'Roofing': U('photo-1632759145351-1d592919f522'),
  'Home Remodeling': U('photo-1556911220-bff31c812dba'),
  'Construction': U('photo-1541888946425-d81bb19240f5'),
  'Pest Control': U('photo-1600607687939-ce8a6c25118c'),
}
export const HERO_IMAGE = U('photo-1600585154340-be6161a56a0c')
export const WHATSAPP_NUMBER = '918141402701'
export const CONTACT_EMAIL = 'niketdigital@gmail.com'
/* Sample reviews only — replace with real customer quotes. No real customers are named here. */
export const SAMPLE_REVIEWS: { name: string; role: string; quote: string }[] = [
  { name: 'Mike', role: 'Roofing contractor', quote: 'The website and the lead list are finally in one place. I can see every enquiry, from the first call to the booked job.' },
  { name: 'Sarah', role: 'Remodeling business owner', quote: 'The AI ad copy saves me hours every week. I review the drafts, approve what I like, and nothing goes live without me.' },
  { name: 'David', role: 'Pest control owner', quote: 'Signing up was simple, and the dashboard is easy to understand — even without any technical knowledge.' },
]

/* Industry detail pages — clicked from the header menu on the home page. */
export const INDUSTRY_DETAILS: Record<Industry, { short: string; tagline: string; blurb: string; gradient: string; icon: string; services: [string, string][]; pages: string[]; marketing: string; ads: string; crm: string }> = {
  'Roofing': {
    short: 'Roofing', tagline: 'More roof jobs, less chasing leads.', blurb: 'A website, ads and follow-up built for roofers — so homeowners in your service area find you first when a roof leaks, a storm hits, or a replacement is due.',
    gradient: 'from-[#0a1a33] via-[#0f2447] to-[#1e3f7a]', icon: 'home',
    services: [['Roof Replacement', 'Full tear-off and replacement, with photos, materials and warranty details on the page.'], ['Roof Repair', 'Leaks, missing shingles and flashing repairs — with a fast estimate form.'], ['Storm Damage Repair', 'Hail and wind damage help, inspections and insurance paperwork support.'], ['Gutters', 'Gutter installation, repair and cleaning as an add-on service on your site.'], ['Roof Inspections', 'Free or paid inspections that turn into booked repair and replacement jobs.']],
    pages: ['Home', 'Roofing Services', 'Roof Replacement', 'Roof Repair', 'Service Areas', 'Gallery', 'Contact Us'],
    marketing: 'Ad copy and keywords for roof replacement and repair — for example "roof replacement near me" — plus landing pages for Roof Replacement and Roof Repair.',
    ads: 'Meta and Google campaigns for roof-replacement and storm-damage leads in your cities. Campaigns stay paused until you approve them.',
    crm: 'Every roofing lead tracked from New to Won — inspection booked, estimate sent, job won.',
  },
  'Home Remodeling': {
    short: 'Remodeling', tagline: 'Fill your calendar with remodel projects.', blurb: 'A premium website and marketing that shows off your work — so homeowners planning a kitchen, bathroom or whole-home remodel choose you, not the next quote.',
    gradient: 'from-[#2b1055] via-[#4c1d95] to-[#7c3aed]', icon: 'tool',
    services: [['Kitchen Remodeling', 'Cabinets, worktops and layouts — with before-and-after galleries on your site.'], ['Bathroom Remodeling', 'Showers, baths and fittings, with a clear estimate and booking form.'], ['Basement Finishing', 'Turn unused space into a living room, office or rental — shown as a service page.'], ['Home Additions', 'Extra rooms and extensions, with project steps and timelines explained.'], ['Whole-Home Remodeling', 'Full-home projects with a portfolio page that builds trust before the first call.']],
    pages: ['Home', 'Services', 'Kitchen Remodeling', 'Bathroom Remodeling', 'Gallery', 'Service Areas', 'Contact Us'],
    marketing: 'Ad copy and keywords for kitchen and bathroom remodeling — for example "kitchen remodeling contractor" — plus landing pages for Kitchen and Bathroom Remodeling.',
    ads: 'Meta and Google campaigns for kitchen, bathroom and whole-home remodel leads in your service area. Campaigns stay paused until you approve them.',
    crm: 'Every remodel lead tracked from New to Won — consultation booked, proposal sent, project won.',
  },
  'Construction': {
    short: 'Construction', tagline: 'Win bigger builds with a bigger presence.', blurb: 'A professional website and marketing for builders and general contractors — so clients, developers and commercial customers trust you with their next project.',
    gradient: 'from-[#1c1917] via-[#44403c] to-[#a16207]', icon: 'building',
    services: [['General Contracting', 'Your full service list, licences and past projects on one professional site.'], ['New Home Builds', 'Custom-home pages with floor plans, progress photos and enquiry forms.'], ['Commercial Construction', 'Offices, retail and industrial work, with a portfolio that wins tenders.'], ['Renovations', 'Structural and interior renovations, with timelines and budgets explained.'], ['Project Management', 'Timelines, milestones and client updates — shown as a service on your site.']],
    pages: ['Home', 'About Us', 'Services', 'Gallery', 'Service Areas', 'Contact Us'],
    marketing: 'Ad copy and keywords for general contracting and new builds — for example "general contractor near me" — plus landing pages for your main services.',
    ads: 'Meta and Google campaigns for new-build, renovation and commercial construction enquiries. Campaigns stay paused until you approve them.',
    crm: 'Every construction enquiry tracked from New to Won — site visit, proposal sent, contract won.',
  },
  'Pest Control': {
    short: 'Pest Control', tagline: 'More bookings, season after season.', blurb: 'A fast website and local marketing for pest control — so homeowners and businesses call you first when they need help, and keep coming back for regular treatments.',
    gradient: 'from-[#052e16] via-[#166534] to-[#16a34a]', icon: 'bug',
    services: [['Residential Pest Control', 'Regular home treatments, with plans and pricing explained on your site.'], ['Termite Control', 'Inspections and treatments, with trust-building detail for worried homeowners.'], ['Rodent Control', 'Rats and mice removal, with a fast booking form for urgent jobs.'], ['Mosquito Control', 'Seasonal treatments for gardens and outdoor spaces.'], ['Commercial Pest Control', 'Restaurants, offices and rentals — with service contracts and scheduled visits.']],
    pages: ['Home', 'Pest Control Services', 'Service Areas', 'Gallery', 'Contact Us'],
    marketing: 'Ad copy and keywords for pest control — for example "pest control near me" — plus landing pages for Residential and Termite Control.',
    ads: 'Meta and Google campaigns for residential and commercial pest-control bookings in your area. Campaigns stay paused until you approve them.',
    crm: 'Every pest-control lead tracked from New to Won — inspection booked, treatment plan sent, customer won.',
  },
}

type View = 'landing' | 'industry' | 'about' | 'privacy' | 'terms' | 'contact' | 'auth' | 'onboarding' | 'dashboard' | 'website' | 'ai' | 'meta' | 'google' | 'campaigns' | 'crm' | 'analytics' | 'billing' | 'integrations' | 'support' | 'admin'
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
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  tool: 'M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 8h3a1 1 0 0 1 1 1v12M2 21h20M8 7h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2',
  bug: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0 8Zm-8 0h4m-4 8h4m8-8h4m-4 8h4M12 3v3m0 12v3M9 9l-2-2m9 2 2-2M9 15l-2 2m9-2 2 2',
  card: 'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm0 4h20M6 15h4',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  headset: 'M3 13a9 9 0 0 1 18 0M3 13v4a2 2 0 0 0 2 2h1v-7H5a2 2 0 0 0-2 1Zm18 0v4a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 1ZM21 19v1a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v4Z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z',
  crown: 'M2 8l4 4 6-6 6 6 4-4-1.5 10h-17L2 8Zm2 13h16',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-4a1 1 0 1 0 0-2',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-2 2v6h6M9 13h6m-6 4h6',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4 8 6 8-6',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
  whatsapp: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5Z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z',
}
function Input({ label, value, onChange, type = 'text', placeholder = '', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input required={required} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
}
function Btn({ children, onClick, variant = 'primary', type = 'button', disabled = false }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean }) {
  const cls = variant === 'primary' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 hover:from-orange-600 hover:to-orange-500' : variant === 'outline' ? 'border-2 border-[#0f2447] bg-white text-[#0f2447] hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-100'
  return <button type={type} disabled={disabled} onClick={onClick} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${cls}`}>{children}</button>
}
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{text}</p> }
function SiteFooter({ go, openIndustry }: { go: (v: View) => void; openIndustry: (i: Industry) => void }) {
  const link = 'block py-1 text-sm text-slate-400 transition hover:text-white'
  return <footer className="bg-[#0a1a33] px-4 py-10 text-slate-300">
    <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-lg font-black text-white">NiketDigital<span className="text-orange-500">.ai</span></p><p className="mt-2 text-sm text-slate-400">Your AI-Powered Business Growth Partner.</p><p className="mt-2 text-sm text-slate-400">Websites, AI marketing, Meta &amp; Google Ads drafts, and a lead CRM — built for US roofing, remodeling, construction and pest control businesses.</p><p className="mt-3 text-sm text-slate-400">Vadodara, Gujarat, India</p><p className="mt-1 text-sm"><a className="text-slate-300 hover:text-white" href="mailto:niketdigital@gmail.com">niketdigital@gmail.com</a></p><p className="mt-1 text-sm"><a className="text-slate-300 hover:text-white" href="https://wa.me/918141402701" target="_blank" rel="noreferrer">WhatsApp: +91 81414 02701</a></p></div>
      <div><p className="font-bold text-white">Company</p><div className="mt-2"><button className={link} onClick={() => go('landing')}>Home</button><button className={link} onClick={() => go('about')}>About Us</button><button className={link} onClick={() => go('contact')}>Contact Us</button><button className={link} onClick={() => go('auth')}>Sign in</button><button className={link} onClick={() => go('auth')}>Start free trial</button></div></div>
      <div><p className="font-bold text-white">Industries</p><div className="mt-2">{INDUSTRIES.map(i => <button key={i} className={link} onClick={() => openIndustry(i)}>{i}</button>)}</div><p className="mt-4 font-bold text-white">Services</p><div className="mt-2">{ALL_SERVICES.slice(0, 5).map(sv => <button key={sv.title} className={link} onClick={() => go('landing')}>{sv.title}</button>)}</div></div>
      <div><p className="font-bold text-white">Legal</p><div className="mt-2"><button className={link} onClick={() => go('privacy')}>Privacy Policy</button><button className={link} onClick={() => go('terms')}>Terms of Service</button><button className={link} onClick={() => go('billing')}>Pricing — from $49/mo</button></div><p className="mt-4 text-sm text-slate-400">Questions? Sign in and raise a ticket in the Support Center inside the app.</p></div>
    </div>
    <p className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-4 text-center text-xs text-slate-500">© 2026 NiketDigital.ai — Built for US roofing, remodeling, construction &amp; pest control businesses.</p>
  </footer>
}

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [industry, setIndustry] = useState<Industry>('Roofing')
  const openIndustry = (i: Industry) => { setIndustry(i); setView('industry'); window.scrollTo(0, 0) }
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [business, setBusiness] = useState<Business>({ business_name: '', industry: 'Roofing', business_email: '', phone: '', website: '', service_locations: '', address: '', services: '', logo_url: '' })
  const [leads, setLeads] = useState<Lead[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [msg, setMsg] = useState('')
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('growth')
  const [contactName, setContactName] = useState(''); const [contactEmail, setContactEmail] = useState(''); const [contactMsgText, setContactMsgText] = useState(''); const [contactSent, setContactSent] = useState('')
  const [contactBusiness, setContactBusiness] = useState(''); const [contactPhone, setContactPhone] = useState(''); const [contactService, setContactService] = useState(ALL_SERVICES[0].title)
  const goSection = (id: string) => { setView('landing'); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60) }
  const goHome = () => { setView('landing'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60) }
  const openWhatsApp = (message: string) => { window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank') }

  useEffect(() => {
    document.title = 'NiketDigital.ai — AI-Powered Business Growth Partner for Roofing, Remodeling, Construction & Pest Control'
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta')
    meta.setAttribute('name', 'description')
    meta.setAttribute('content', 'NiketDigital.ai helps roofing, remodeling, construction and pest control businesses grow with AI-powered website development, digital advertising and lead generation.')
    if (!meta.parentElement) document.head.appendChild(meta)
  }, [])

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
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-600" aria-label="Main menu">
            <button onClick={goHome} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Home</button>
            <button onClick={() => goSection('services')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Services</button>
            <button onClick={() => goSection('pricing')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Pricing</button>
            <button onClick={() => setView('contact')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Contact Us</button>
          </nav>
          <div className="flex gap-2"><Btn variant="outline" onClick={() => setView('auth')}>Sign in</Btn><Btn onClick={() => setView('auth')}>Start free trial</Btn></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section id="top" className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1a33] via-[#0f2447] to-[#274e96] px-6 py-12 text-white shadow-xl sm:px-10 lg:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" /><div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-white/20"><Icon d={ICONS.spark} cls="h-3.5 w-3.5" /> AI-powered growth for US contractors</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Grow Your Business <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">with AI.</span></h1>
              <p className="mt-4 max-w-xl text-slate-300">NiketDigital.ai helps roofing, remodeling, construction and pest control businesses grow through AI-powered website development, digital advertising and lead generation — more enquiries, more booked jobs, less wasted time.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="font-bold text-slate-300">Explore:</span>{INDUSTRIES.map(i => <button key={i} onClick={() => openIndustry(i)} className="rounded-full bg-white/10 px-3 py-1.5 font-bold text-white ring-1 ring-white/20 transition hover:bg-orange-500">{INDUSTRY_DETAILS[i].short}</button>)}</div>
              <div className="mt-6 flex flex-wrap gap-3"><Btn onClick={() => setView('contact')}>Get a Free Consultation</Btn><Btn variant="outline" onClick={() => setView('auth')}>Grow Your Business with AI</Btn></div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-200"><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.check} cls="h-3.5 w-3.5 text-emerald-400" /> No card charged without your approval</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.shield} cls="h-3.5 w-3.5 text-emerald-400" /> Ads paused until you approve</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15"><Icon d={ICONS.users} cls="h-3.5 w-3.5 text-sky-300" /> One business per account</span></div>
            </div>
            <div>
              <img src={HERO_IMAGE} alt="Modern home — a professional website and AI marketing for roofing, remodeling, construction and pest control businesses" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} className="h-56 w-full rounded-2xl object-cover shadow-2xl sm:h-64" />
              <div className="mt-4 rounded-2xl bg-white p-5 text-slate-800 shadow-2xl">
              <div className="flex items-center justify-between"><p className="font-bold text-[#0f2447]">Your dashboard — preview</p><span className="flex gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span></div>
              <p className="mt-1 text-xs text-slate-500">Example layout only — your real numbers appear here after you add leads and orders.</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[['Total leads', 'bg-[#0f2447]'], ['Won', 'bg-emerald-600'], ['Pipeline', 'bg-orange-500']].map(([l, c]) => <div key={l} className={`rounded-xl ${c} px-2 py-3 text-white`}><p className="text-lg font-black">—</p><p className="text-[11px] font-medium opacity-90">{l}</p></div>)}</div>
              <div className="mt-4 space-y-3">{[['New leads', 'w-3/4 bg-orange-500'], ['Contacted', 'w-1/2 bg-[#274e96]'], ['Won', 'w-1/3 bg-emerald-500']].map(([l, c]) => <div key={l}><div className="flex justify-between text-xs font-semibold text-slate-600"><span>{l}</span><span>Preview</span></div><div className="mt-1 h-2.5 rounded-full bg-slate-100"><div className={`h-2.5 rounded-full ${c}`} /></div></div>)}</div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><Icon d={ICONS.rocket} cls="h-4 w-4 text-orange-500" /> Website order → Quotation → In Development → Published</div>
            </div>
            </div>
          </div>
        </section>
        <section id="services" className="mt-10 scroll-mt-24"><h2 className="text-center text-2xl font-black text-[#0f2447]">All services — everything included</h2><p className="mt-1 text-center text-sm text-slate-500">One platform — website, marketing, ads and leads, in one place. Click a service to open it after signing in.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_SERVICES.map(sv => (
              <div key={sv.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative h-40 overflow-hidden"><img src={sv.img} alt={`${sv.title} — NiketDigital.ai`} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} className="h-full w-full object-cover transition duration-500 hover:scale-105" /><div className={`absolute inset-0 bg-gradient-to-t ${sv.grad} opacity-25`} /><span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-[#0f2447] shadow"><Icon d={ICONS[sv.icon as keyof typeof ICONS]} cls="h-6 w-6" /></span></div>
                <div className="p-5"><h3 className="font-bold text-[#0f2447]">{sv.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{sv.desc}</p><p className="mt-2 flex gap-1.5 text-sm font-semibold text-emerald-700"><Icon d={ICONS.check} cls="mt-0.5 h-4 w-4 shrink-0" />{sv.benefit}</p><button onClick={() => setView('auth')} className="mt-3 text-sm font-bold text-orange-600 hover:text-orange-500">Open {sv.title} →</button></div>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">Explore industries</h2><p className="mt-1 text-center text-sm text-slate-500">Tap an industry to see its services, website preview and marketing.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map(i => (
              <button key={i} onClick={() => openIndustry(i)} className="overflow-hidden rounded-2xl text-left shadow-md transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative h-36 overflow-hidden"><img src={INDUSTRY_IMAGES[i]} alt={`${INDUSTRY_DETAILS[i].short} — NiketDigital.ai`} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} className="h-full w-full object-cover transition duration-500 hover:scale-105" /><div className={`absolute inset-0 bg-gradient-to-t ${INDUSTRY_DETAILS[i].gradient} opacity-60`} /><span className="absolute bottom-3 left-3 flex items-center gap-2 text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/40 backdrop-blur-sm"><Icon d={ICONS[INDUSTRY_DETAILS[i].icon as keyof typeof ICONS]} cls="h-5 w-5" /></span><span className="font-black drop-shadow">{INDUSTRY_DETAILS[i].short}</span></span></div>
                <div className="bg-white px-4 py-3"><p className="text-sm text-slate-600">{INDUSTRY_DETAILS[i].tagline}</p><p className="mt-1 text-sm font-bold text-[#0f2447]">View {INDUSTRY_DETAILS[i].short} services →</p></div>
              </button>
            ))}
          </div>
        </section>
        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><div className="flex h-36 items-center justify-center gap-3 bg-gradient-to-br from-[#0a1a33] via-[#0f2447] to-[#274e96] text-white"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-2xl font-black">N</span><span><span className="block text-2xl font-black">NiketDigital<span className="text-orange-400">.ai</span></span><span className="text-sm text-slate-300">Your AI-Powered Business Growth Partner</span></span></div><div className="p-6"><h2 className="text-xl font-black text-[#0f2447]">About NiketDigital.ai</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">NiketDigital.ai is an AI-powered growth platform built for US roofing, remodeling, construction and pest control businesses. It brings together a professional AI-built website, an AI marketing assistant, Meta and Google Ads drafts, and a lead CRM — so a busy contractor can get more enquiries, follow up faster, and grow without needing technical knowledge or a marketing team.</p><p className="mt-2 text-sm leading-relaxed text-slate-600">Everything is designed for non-technical owners: sign up, tell us about your business, and start with a website order or your first AI-generated ad copy. Campaigns are always created as drafts, paused by default, and nothing is published or charged without your explicit approval.</p><button onClick={() => setView('about')} className="mt-3 text-sm font-bold text-orange-600 hover:text-orange-500">Read more about us →</button></div></div>
          <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 text-white shadow-md"><h2 className="text-xl font-black">Why contractors choose us</h2><ul className="mt-4 space-y-3 text-sm">{['One platform for website, marketing, ads and leads.', 'AI does the writing — you approve everything before it goes live.', 'Real numbers only — reports come from your saved leads and connected accounts.', 'No card charged without your approval. Ads stay paused until you say yes.'].map(t => <li key={t} className="flex gap-2"><Icon d={ICONS.check} cls="mt-0.5 h-5 w-5 shrink-0" />{t}</li>)}</ul><div className="mt-5"><Btn onClick={() => setView('auth')}>Start free trial</Btn></div></div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">What contractors say</h2><p className="mt-1 text-center text-sm text-slate-500">Sample reviews — real customer quotes will be added here.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {SAMPLE_REVIEWS.map(r => (
              <div key={r.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-1 text-amber-400">{[0, 1, 2, 3, 4].map(n => <Icon key={n} d={ICONS.star} cls="h-4 w-4" />)}</div><p className="mt-3 text-sm leading-relaxed text-slate-700">“{r.quote}”</p><p className="mt-4 font-bold text-[#0f2447]">{r.name}</p><p className="text-xs text-slate-500">{r.role}</p><p className="mt-3 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">Sample review — replace with a real customer quote</p></div>
            ))}
          </div>
        </section>
        <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-center text-2xl font-black text-[#0f2447]">How it works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">{[['1', 'Create your account', 'Sign up with email or Google, then tell us about your business.'], ['2', 'Order & generate', 'Order a website or generate ad copy, keywords and landing pages with AI.'], ['3', 'Track leads & grow', 'Follow every lead from New to Won in the CRM and connect your ad accounts.']].map(([n, t, d]) => (
            <div key={t} className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-lg font-black text-white shadow-md shadow-orange-500/30">{n}</span><h3 className="mt-3 font-bold text-[#0f2447]">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
          ))}</div>
        </section>
        <section id="pricing" className="mt-10 scroll-mt-24"><h2 className="text-center text-2xl font-black text-[#0f2447]">Simple pricing</h2><p className="mt-1 text-center text-sm text-slate-500">Website development is priced separately from the monthly subscription. Advertising budgets are billed separately by Meta / Google.</p>
          <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">{PLANS.map(p => <div key={p.id} className={`relative flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:shadow-lg ${p.id === 'growth' ? 'border-orange-500 shadow-lg shadow-orange-500/20 lg:-translate-y-2' : 'border-slate-200'}`}>{p.id === 'growth' && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-1 text-xs font-black text-white shadow">MOST POPULAR</span>}<h3 className="font-bold text-[#0f2447]">{p.name}</h3><p className="mt-1 text-3xl font-black text-[#0f2447]">${p.monthly}<span className="text-sm font-normal text-slate-500">/mo</span></p><p className="text-xs text-slate-500">{p.leads} · {p.ai}</p><ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">{p.features.map(f => <li key={f} className="flex gap-2"><Icon d={ICONS.check} cls="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}</ul><Btn onClick={() => setView('auth')} variant={p.id === 'growth' ? 'primary' : 'outline'}>Choose {p.name}</Btn></div>)}</div></section>
        {!isSupabaseConfigured && <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Setup notice: Supabase is not configured yet in this deployment. Sign-up and saved data will work only after VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. See README.md.</p>}
        <section className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1a33] via-[#0f2447] to-[#274e96] px-6 py-10 text-center text-white shadow-xl sm:px-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-orange-500/25 blur-3xl" />
          <h2 className="relative text-2xl font-black sm:text-3xl">Ready to grow your business with AI?</h2>
          <p className="relative mx-auto mt-2 max-w-xl text-sm text-slate-300">Get a free consultation — tell us about your business and we will show you exactly how NiketDigital.ai can bring you more enquiries and booked jobs.</p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3"><Btn onClick={() => setView('contact')}>Get a Free Consultation</Btn><Btn variant="outline" onClick={() => setView('auth')}>Grow Your Business with AI</Btn></div>
        </section>
      </main>
      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi NiketDigital.ai, I want a free consultation for my business.')}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-emerald-500/40 transition hover:scale-110"><Icon d={ICONS.whatsapp} cls="h-7 w-7" /></a>
      <SiteFooter go={(v) => setView(v)} openIndustry={openIndustry} />
    </div>
  )



  // ---- About / Privacy / Terms / Contact ----
  if (view === 'about' || view === 'privacy' || view === 'terms' || view === 'contact') {
    const titles: Record<string, [string, string]> = {
      about: ['About Us', 'Who we are and what NiketDigital.ai does for contractors.'],
      privacy: ['Privacy Policy', 'How we handle your information.'],
      terms: ['Terms of Service', 'The rules for using NiketDigital.ai.'],
      contact: ['Contact Us', 'Get in touch with the NiketDigital team.'],
    }
    const [title, sub] = titles[view]
    return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button onClick={() => setView('landing')} className="flex items-center gap-2 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2447] to-[#274e96] text-lg font-black text-orange-400">N</span><span><span className="block text-xl font-black leading-none text-[#0f2447]">NiketDigital<span className="text-orange-500">.ai</span></span><span className="text-[11px] text-slate-500">Your AI-Powered Business Growth Partner</span></span></button>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-600" aria-label="Main menu">
            <button onClick={goHome} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Home</button>
            <button onClick={() => goSection('services')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Services</button>
            <button onClick={() => goSection('pricing')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Pricing</button>
            <button onClick={() => setView('contact')} className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-orange-700">Contact Us</button>
          </nav>
          <div className="flex gap-2"><Btn variant="outline" onClick={() => setView('auth')}>Sign in</Btn><Btn onClick={() => setView('auth')}>Start free trial</Btn></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <button onClick={() => setView('landing')} className="mt-4 text-sm font-bold text-[#0f2447] hover:text-orange-600">← Back to home</button>
        <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-3xl font-black text-[#0f2447]">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{sub}</p>
          {view === 'about' && <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            <p><strong>NiketDigital.ai — Your AI-Powered Business Growth Partner.</strong> We build AI-powered growth tools for US roofing, remodeling, construction and pest control businesses.</p>
            <p>Many contractors are great at their trade but do not have time — or technical knowledge — for websites, ads and follow-ups. NiketDigital.ai brings it together in one simple platform: order a professional AI-built website, generate ad copy and landing pages with the AI Marketing Assistant, create Meta and Google Ads drafts, and track every lead from New to Won in the CRM.</p>
            <p>Our promise is simple: real numbers only, no invented results. Reports come from your saved leads and your connected ad accounts. Campaigns are always created as drafts, paused by default, and nothing is published, and nothing is charged, without your explicit approval.</p>
            <p>Plans start at $49/month. Website development is priced separately from the monthly subscription, and advertising budgets are billed separately by Meta and Google.</p>
          </div>}
          {view === 'privacy' && <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            <p><strong>What we collect.</strong> When you create an account we store your email address and password (handled securely by Supabase Auth). When you complete onboarding we store your business profile — business name, industry, contact details, services and service locations. When you use the platform we store the leads, website orders and support tickets you create.</p>
            <p><strong>Connected accounts.</strong> If you choose to connect Meta, Google Ads or Stripe, we store only the connection details needed to work with those services, using official OAuth. We never ask for, and never store, your Meta or Google account password. Card details are handled by Stripe on its secure pages — this app never sees or stores raw card numbers.</p>
            <p><strong>How we use it.</strong> Your data is used only to run your account, show your dashboard, generate the marketing content you ask for, and reply to support tickets. Your business data is yours — other customers cannot see it.</p>
            <p><strong>Your choices.</strong> You can update your business profile at any time, export your leads as a CSV from the CRM, and ask us to close your account through the Support Center. If you have questions about this policy, raise a ticket in the Support Center after signing in.</p>
            <p className="text-xs text-slate-500">Last updated: November 2026.</p>
          </div>}
          {view === 'terms' && <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            <p><strong>Plans and billing.</strong> Subscriptions are Starter $49/month, Growth $99/month, Professional $199/month, Agency $399/month, billed monthly or annually through Stripe. Annual billing uses the lower monthly rate shown on the pricing page. You can upgrade, downgrade or cancel at any time; changes take effect as Stripe confirms them.</p>
            <p><strong>Website development is priced separately.</strong> Ordering a website starts with a quotation — nothing is charged for a website until you approve the quotation. Website order statuses run from New Order to Published.</p>
            <p><strong>Advertising.</strong> Meta and Google campaigns are created as drafts, paused by default. Nothing is published, and no advertising budget is changed, without your explicit confirmation. Advertising budgets are billed separately by Meta and Google, not by NiketDigital.ai.</p>
            <p><strong>No charge without authorisation.</strong> We never charge your card without your approval. You are responsible for keeping your account details safe and for the accuracy of the business information and leads you enter.</p>
            <p><strong>Fair use.</strong> AI generations and leads are limited by your plan. Do not use the platform for unlawful, misleading or harmful content. We may suspend accounts that break these terms.</p>
          </div>}
          {view === 'contact' && <div className="mt-4">
            <div className="grid gap-3 rounded-2xl bg-gradient-to-br from-[#0f2447] to-[#274e96] p-5 text-white shadow-md sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wider text-orange-300">Business</p><p className="mt-1 font-black">NiketDigital.ai</p><p className="mt-3 text-xs font-bold uppercase tracking-wider text-orange-300">Address</p><p className="mt-1 text-sm">Vadodara, Gujarat, India</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-orange-300">Email</p><p className="mt-1 text-sm"><a className="font-semibold underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p><p className="mt-3 text-xs font-bold uppercase tracking-wider text-orange-300">WhatsApp</p><p className="mt-1 text-sm"><a className="font-semibold underline" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">+91 81414 02701</a></p></div>
            </div>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi NiketDigital.ai, I want a free consultation for my business.')}`} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:bg-[#1eb856]"><Icon d={ICONS.whatsapp} cls="h-5 w-5" /> Chat on WhatsApp — replies fastest</a>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">Fill in the form below and it will open WhatsApp with your message ready to send. Or write to us at <a className="font-semibold text-orange-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            <form onSubmit={e => { e.preventDefault(); const lines = [`Hi NiketDigital.ai, I would like a free consultation.`, ``, `Name: ${contactName}`, `Business: ${contactBusiness}`, `Email: ${contactEmail}`, `Phone: ${contactPhone}`, `Service: ${contactService}`, ``, `Message: ${contactMsgText}`]; openWhatsApp(lines.join('\n')); setContactSent('Thanks — WhatsApp has opened with your message ready. Just press Send there, and we will reply as soon as possible.') }} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Full Name" value={contactName} onChange={setContactName} required />
                <Input label="Business Name" value={contactBusiness} onChange={setContactBusiness} required />
                <Input label="Email Address" type="email" value={contactEmail} onChange={setContactEmail} required />
                <Input label="Phone Number" type="tel" value={contactPhone} onChange={setContactPhone} required />
              </div>
              <label className="block text-sm font-medium text-slate-700">Select a Service<select value={contactService} onChange={e => setContactService(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{ALL_SERVICES.map(sv => <option key={sv.title} value={sv.title}>{sv.title}</option>)}<option value="Other / Not sure yet">Other / Not sure yet</option></select></label>
              <label className="block text-sm font-medium text-slate-700">Message<textarea value={contactMsgText} onChange={e => setContactMsgText(e.target.value)} required rows={4} placeholder="Tell us about your business and what you need help with…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <Btn type="submit">Send via WhatsApp</Btn>
            </form>
            {contactSent && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{contactSent}</p>}
          </div>}
          <div className="mt-6 flex flex-wrap gap-3"><Btn onClick={() => setView('landing')}>Back to home</Btn><Btn variant="outline" onClick={() => setView('auth')}>Start free trial</Btn></div>
        </div>
      </main>
      <SiteFooter go={(v) => setView(v)} openIndustry={openIndustry} />
    </div>
    )
  }

  // ---- Industry detail ----
  if (view === 'industry') {
    const d = INDUSTRY_DETAILS[industry]
    return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button onClick={() => setView('landing')} className="flex items-center gap-2 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2447] to-[#274e96] text-lg font-black text-orange-400">N</span><span><span className="block text-xl font-black leading-none text-[#0f2447]">NiketDigital<span className="text-orange-500">.ai</span></span><span className="text-[11px] text-slate-500">Your AI-Powered Business Growth Partner</span></span></button>
          <nav className="flex flex-wrap gap-1 text-sm font-medium text-slate-600">{INDUSTRIES.map(i => <button key={i} onClick={() => openIndustry(i)} className={`rounded-full px-3 py-1 transition ${i === industry ? 'bg-[#0f2447] font-bold text-white' : 'bg-slate-100 hover:bg-orange-100 hover:text-orange-700'}`}>{INDUSTRY_DETAILS[i].short}</button>)}</nav>
          <div className="flex gap-2"><Btn variant="outline" onClick={() => setView('auth')}>Sign in</Btn><Btn onClick={() => setView('auth')}>Start free trial</Btn></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <button onClick={() => setView('landing')} className="mt-4 text-sm font-bold text-[#0f2447] hover:text-orange-600">← Back to home</button>
        <section className={`relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br ${d.gradient} px-6 py-12 text-white shadow-xl sm:px-10`}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Icon d={ICONS[d.icon as keyof typeof ICONS]} cls="h-8 w-8" /></span>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{d.short} growth, powered by AI.</h1>
              <p className="mt-2 text-lg font-bold text-orange-300">{d.tagline}</p>
              <p className="mt-3 max-w-xl text-slate-200">{d.blurb}</p>
              <div className="mt-6 flex flex-wrap gap-3"><Btn onClick={() => setView('auth')}>Start free trial</Btn><Btn variant="outline" onClick={() => setView('landing')}>See all industries</Btn></div>
            </div>
            <div className="rounded-2xl bg-white p-5 text-slate-800 shadow-2xl">
              <div className="flex items-center justify-between"><p className="font-bold text-[#0f2447]">Your {d.short.toLowerCase()} website — preview</p><span className="flex gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span></div>
              <p className="mt-1 text-xs text-slate-500">Example layout only — your real website is built after your quotation is approved.</p>
              <div className="relative mt-4 overflow-hidden rounded-xl"><img src={INDUSTRY_IMAGES[industry]} alt={`${d.short} — NiketDigital.ai`} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} className="h-44 w-full object-cover" /><div className={`absolute inset-0 bg-gradient-to-t ${d.gradient} opacity-40`} /><div className="absolute bottom-3 left-3 text-white"><p className="text-lg font-black drop-shadow">Your {d.short} Business</p><p className="text-xs text-slate-100 drop-shadow">{d.tagline}</p></div><span className="absolute right-3 top-3 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow">Get a free estimate</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{d.pages.map(pg => <span key={pg} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{pg}</span>)}</div>
              <div className="mt-3 space-y-2">{d.services.slice(0, 3).map(([name]) => <div key={name} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"><Icon d={ICONS.check} cls="h-4 w-4 shrink-0 text-emerald-500" />{name}</div>)}</div>
            </div>
          </div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">{d.short} services we build for</h2><p className="mt-1 text-center text-sm text-slate-500">Each service gets its own page, estimate form and ad copy on your website.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.services.map(([name, desc], idx) => (
              <div key={name} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${idx === 0 ? 'sm:col-span-2 lg:col-span-1 ring-2 ring-orange-200' : ''}`}><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><Icon d={ICONS[d.icon as keyof typeof ICONS]} cls="h-5 w-5" /></span><h3 className="mt-3 font-bold text-[#0f2447]">{name}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p></div>
            ))}
            <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-[#0f2447] to-[#274e96] p-5 text-white shadow-md"><p className="text-lg font-black">Plus your other services</p><p className="mt-1 text-sm text-slate-300">Tell us what you offer in onboarding — every service can be added as a page on your website.</p><Btn onClick={() => setView('auth')}>Start free trial</Btn></div>
          </div>
        </section>
        <section className="mt-10"><h2 className="text-center text-2xl font-black text-[#0f2447]">What you get with NiketDigital.ai</h2><p className="mt-1 text-center text-sm text-slate-500">Built for {d.short.toLowerCase()} businesses — not a generic template.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[['AI Website', d.pages.join(', ') + ' — a professional website for your trade, with a clear quotation before any payment.', ICONS.globe, 'bg-sky-100 text-sky-700'], ['AI Marketing', d.marketing, ICONS.spark, 'bg-orange-100 text-orange-600'], ['Meta & Google Ads', d.ads, ICONS.mega, 'bg-indigo-100 text-indigo-700'], ['Lead CRM', d.crm, ICONS.chart, 'bg-emerald-100 text-emerald-700']].map(([t, desc, icon, tint]) => (
              <div key={t as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon d={icon as string} /></span><h3 className="mt-3 font-bold text-[#0f2447]">{t}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p></div>
            ))}
          </div>
        </section>
        <section className="mt-10 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-2xl font-black text-[#0f2447]">Ready to grow your {d.short.toLowerCase()} business?</h2><p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Plans from $49/mo — Starter $49, Growth $99, Professional $199, Agency $399. Website development is priced separately from the monthly subscription, and ad budgets are billed separately by Meta / Google.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Btn onClick={() => setView('auth')}>Start free trial</Btn><Btn variant="outline" onClick={() => setView('landing')}>Back to home</Btn></div></section>
      </main>
      <SiteFooter go={(v) => setView(v)} openIndustry={openIndustry} />
    </div>
    )
  }

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
  useEffect(() => { (async () => { const { data } = await supabase.auth.getSession(); const token = data.session?.access_token || ''; const url = token ? `${statusPath}?access_token=${encodeURIComponent(token)}` : statusPath; fetch(url).then(r => r.json()).then(j => setStatus(j.connected ? `Connected${j.scopes ? ` — scopes: ${j.scopes}` : ''}` : j.error ? `Not connected — ${j.error}` : 'Not connected')).catch(() => setStatus('Not connected — status check failed (server may not be configured yet).')) })() }, [statusPath])
  const connect = async () => { const { data } = await supabase.auth.getSession(); const token = data.session?.access_token || ''; if (!token) { setStatus('Not connected — sign in first, then click Connect.'); return }; window.location.href = `${connectPath}?access_token=${encodeURIComponent(token)}` }
  return <Card title={`${provider} — connection`} sub="Official OAuth only. Never share your ad-account password with this app."><p className="text-sm"><strong>Status:</strong> {status}</p><div className="mt-3 flex gap-2"><button type="button" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white" onClick={connect}>Connect {provider} account</button>{provider === 'Meta' && <Btn variant="outline" onClick={async () => { const j = await api('/api/auth/meta/disconnect', {}); setStatus(j.ok ? 'Not connected' : `Error: ${j.error || 'disconnect failed'}`) }}>Disconnect</Btn>}</div><p className="mt-3 text-xs text-slate-500">After connecting, choose an ad account, then create drafts. Publishing needs your explicit confirmation on the Campaigns page.</p></Card>
}

function Campaigns({ api }: { api: (p: string, b?: unknown) => Promise<any> }) {
  const [accounts, setAccounts] = useState<{ id: string; name: string; currency: string | null; accountStatus: number }[]>([])
  const [accountsMsg, setAccountsMsg] = useState('Loading your Meta ad accounts…')
  const [accountId, setAccountId] = useState('')
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('Leads')
  const [budget, setBudget] = useState('500')
  const [drafts, setDrafts] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function loadAccounts() {
    setAccountsMsg('Loading your Meta ad accounts…')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token || ''
    if (!token) { setAccountsMsg('Sign in first, then refresh.'); return }
    try {
      const r = await fetch(`/api/meta/ad-accounts?access_token=${encodeURIComponent(token)}`)
      const j = await r.json()
      if (j.error) { setAccountsMsg(`Could not load ad accounts: ${j.error}`); return }
      if (!j.connected) { setAccountsMsg('Meta is not connected. Connect it in Integrations first.'); return }
      setAccounts(j.accounts || [])
      if ((j.accounts || []).length) { setAccountId(j.accounts[0].id); setAccountsMsg('') }
      else setAccountsMsg('No ad accounts found on this Meta login. Check in Ads Manager that this Facebook user has access to an ad account, then refresh.')
    } catch { setAccountsMsg('Could not reach the server. Try refresh.') }
  }
  useEffect(() => { loadAccounts() }, [])
  async function loadDrafts() {
    const j = await api('/api/meta/campaigns', { action: 'list' })
    if (j.error) { setMsg(`Could not list drafts: ${j.error}`); return }
    setDrafts(j.campaigns || [])
  }
  useEffect(() => { loadDrafts() }, [])
  async function createDraft(e: React.FormEvent) {
    e.preventDefault(); setMsg(''); setBusy(true)
    if (!accountId) { setMsg('Pick an ad account first.'); setBusy(false); return }
    if (!name.trim()) { setMsg('Give the campaign a name.'); setBusy(false); return }
    const j = await api('/api/meta/campaigns', { action: 'create', name: name.trim(), objective, ad_account_id: accountId, budget_cents: Math.round(Number(budget || '0') * 100) })
    setBusy(false)
    if (j.error) { setMsg(`Could not create the draft: ${j.error}`); return }
    setMsg(`Draft created as PAUSED: ${j.campaign?.name || name}. It will not run or spend until you approve publishing — and the live Meta publish runs only after Meta Marketing API approval (see the note below).`)
    setName(''); loadDrafts()
  }
  async function approvePublish(id: string) {
    if (!window.confirm('Approve this draft for publishing? It stays paused in Meta until the live publish step is enabled after Meta Marketing API approval.')) return
    const j = await api('/api/meta/campaigns', { action: 'publish', campaign_id: id, confirmPublish: true, approvedByCustomer: true })
    setMsg(j.error ? `Could not approve: ${j.error}` : (j.note || 'Publishing approved and recorded.'))
    loadDrafts()
  }
  return <>
    <Card title="1 — Pick your Meta ad account" sub="These come live from the Meta account you just connected.">
      {accountsMsg ? <p className="text-sm text-slate-600">{accountsMsg}</p> : <label className="block text-sm font-medium text-slate-700">Ad account<select value={accountId} onChange={e => setAccountId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.id}{a.currency ? ` (${a.currency})` : ''}</option>)}</select></label>}
      <div className="mt-3"><Btn variant="outline" onClick={loadAccounts}>Refresh ad accounts</Btn></div>
    </Card>
    <Card title="2 — Create a campaign draft" sub="Drafts are always created PAUSED. Nothing runs or spends until you approve it.">
      <form onSubmit={createDraft} className="grid gap-3 sm:grid-cols-2">
        <Input label="Campaign name" value={name} onChange={setName} placeholder="e.g. Roof replacement leads — Dallas" required />
        <label className="block text-sm font-medium text-slate-700">Objective<select value={objective} onChange={e => setObjective(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{['Leads', 'Sales', 'Traffic', 'Engagement', 'Awareness'].map(o => <option key={o}>{o}</option>)}</select></label>
        <Input label="Monthly budget (USD)" type="number" value={budget} onChange={setBudget} placeholder="500" />
        <div className="flex items-end"><Btn type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create paused draft'}</Btn></div>
      </form>
      <p className="mt-3 text-sm text-slate-600">Tip: generate the ad text first in the <strong>AI Marketing Assistant</strong>, then use it when you build the live ad. To make a draft live in Ads Manager today, copy the draft details into Ads Manager and publish there — the in-app live publish is enabled after Meta Marketing API approval.</p>
    </Card>
    <Card title="3 — Your campaign drafts" sub="Approve a draft here when you are ready. Approving records your permission; the live Meta publish call is the next step after Meta approval.">
      <div className="mb-3 flex flex-wrap gap-2"><Btn variant="outline" onClick={loadDrafts}>Refresh drafts</Btn></div>
      {drafts.length ? <ul className="space-y-2">{drafts.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span><strong>{d.name}</strong> · {d.objective || '—'} · {d.status} · {d.budget_cents ? `$${(d.budget_cents / 100).toLocaleString()}/mo` : 'no budget'}{d.approved_to_publish ? ' · Approved to publish' : ''}</span>{!d.approved_to_publish && <Btn variant="outline" onClick={() => approvePublish(d.id)}>Approve to publish</Btn>}</li>)}</ul> : <Empty text="No drafts yet. Create your first paused draft above." />}
      {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
    </Card>
  </>
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
