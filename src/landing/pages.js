// Public pages that have their own address: what search engines index and can show as
// sitelinks under the main result. Shared by the app (routing, links) and vite.config.js
// (one prerendered HTML file per page with its own title/description, and the sitemap).
// Everything else lives behind "#/" and is the app itself.

export const PUBLIC_PAGES = [
  { id: 'features', path: '/imkoniyatlar', title: 'lp.page.features.title', desc: 'lp.page.features.desc' },
  { id: 'templates', path: '/shablonlar', title: 'lp.page.templates.title', desc: 'lp.page.templates.desc' },
  { id: 'pricing', path: '/narxlar', title: 'lp.page.pricing.title', desc: 'lp.page.pricing.desc' },
  { id: 'faq', path: '/savollar', title: 'lp.page.faq.title', desc: 'lp.page.faq.desc' },
  { id: 'login', path: '/kirish', auth: 'login', title: 'au.titleLogin', desc: 'au.descLogin' },
  { id: 'signup', path: '/royxatdan-otish', auth: 'register', title: 'au.titleSignup', desc: 'au.descSignup' },
]

const BY_PATH = Object.fromEntries(PUBLIC_PAGES.map((p) => [p.path, p]))
const BY_ID = Object.fromEntries(PUBLIC_PAGES.map((p) => [p.id, p]))

/** "/narxlar/" → the pricing page; "/" or anything unknown → null (the home landing). */
export const pageByPath = (pathname) => BY_PATH[pathname.replace(/\/+$/, '')] ?? null
export const pathOf = (id) => BY_ID[id]?.path ?? '/'
