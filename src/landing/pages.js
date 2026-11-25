// Public pages that have their own address: what search engines index and can show as
// sitelinks under the main result. Shared by the app (routing, links) and vite.config.js
// (one prerendered HTML file per page and language with its own title/description, and the sitemap).
// Everything else lives behind "#/" and is the app itself.
//
// noindex: a public address that must stay out of search results (sign-in / sign-up forms).

export const PUBLIC_PAGES = [
  { id: 'features', path: '/imkoniyatlar', title: 'lp.page.features.title', desc: 'lp.page.features.desc' },
  { id: 'templates', path: '/shablonlar', title: 'lp.page.templates.title', desc: 'lp.page.templates.desc' },
  { id: 'pricing', path: '/narxlar', title: 'lp.page.pricing.title', desc: 'lp.page.pricing.desc' },
  { id: 'faq', path: '/savollar', title: 'lp.page.faq.title', desc: 'lp.page.faq.desc' },
  { id: 'tools', path: '/vositalar', title: 'seo.tools.title', desc: 'seo.tools.desc' },
  { id: 'login', path: '/kirish', auth: 'login', noindex: true, title: 'au.titleLogin', desc: 'au.descLogin' },
  { id: 'signup', path: '/royxatdan-otish', auth: 'register', noindex: true, title: 'au.titleSignup', desc: 'au.descSignup' },
]

/**
 * File tools with their own landing page (/vositalar/<slug>). Title and description come from the
 * tool catalog's own translations (fs.tool.<id> = "title|description" in src/i18n/msg/toolcat.js),
 * so a page says exactly what the tool does. Tools still marked "coming soon" are left out.
 */
export const TOOL_PAGES = [
  { tool: 'pdf-to-docx', slug: 'pdf-dan-word', category: 'pdf' },
  { tool: 'pdf-to-xlsx', slug: 'pdf-dan-excel', category: 'pdf' },
  { tool: 'pdf-to-pptx', slug: 'pdf-dan-powerpoint', category: 'pdf' },
  { tool: 'pdf-to-images', slug: 'pdf-dan-rasm', category: 'pdf' },
  { tool: 'pdf-to-text', slug: 'pdf-dan-matn', category: 'pdf' },
  { tool: 'pdf-edit', slug: 'pdf-muharriri', category: 'edit' },
  { tool: 'pdf-merge', slug: 'pdf-birlashtirish', category: 'edit' },
  { tool: 'pdf-split', slug: 'pdf-ajratish', category: 'edit' },
  { tool: 'pdf-compress', slug: 'pdf-siqish', category: 'edit' },
  { tool: 'pdf-rotate', slug: 'pdf-aylantirish', category: 'edit' },
  { tool: 'pdf-watermark', slug: 'pdf-suv-belgisi', category: 'edit' },
  { tool: 'pdf-page-numbers', slug: 'pdf-sahifa-raqamlari', category: 'edit' },
  { tool: 'image-remove-bg', slug: 'rasm-fonini-olib-tashlash', category: 'image' },
  { tool: 'image-convert', slug: 'rasm-formatini-ozgartirish', category: 'image' },
  { tool: 'image-compress', slug: 'rasm-siqish', category: 'image' },
  { tool: 'image-resize', slug: 'rasm-olchamini-ozgartirish', category: 'image' },
  { tool: 'images-to-pdf', slug: 'rasmdan-pdf', category: 'image' },
  { tool: 'heic-to-jpg', slug: 'heic-dan-jpg', category: 'image' },
  { tool: 'webp-to-jpg', slug: 'webp-dan-jpg', category: 'image' },
  { tool: 'webp-to-png', slug: 'webp-dan-png', category: 'image' },
  { tool: 'png-to-jpg', slug: 'png-dan-jpg', category: 'image' },
  { tool: 'jpg-to-png', slug: 'jpg-dan-png', category: 'image' },
  { tool: 'doc-to-pdf', slug: 'word-dan-pdf', category: 'document' },
  { tool: 'xlsx-to-pdf', slug: 'excel-dan-pdf', category: 'document' },
  { tool: 'pptx-to-pdf', slug: 'powerpoint-dan-pdf', category: 'document' },
].map((p) => ({ ...p, id: `tool:${p.tool}`, path: `/vositalar/${p.slug}`, toolPage: true }))

/** Every public address (sections, auth forms, tool pages). */
export const ALL_PAGES = [...PUBLIC_PAGES, ...TOOL_PAGES]
/** Addresses that belong in the sitemap. */
export const INDEXABLE_PAGES = ALL_PAGES.filter((p) => !p.noindex)

const BY_PATH = Object.fromEntries(ALL_PAGES.map((p) => [p.path, p]))
const BY_ID = Object.fromEntries(ALL_PAGES.map((p) => [p.id, p]))

/** "/narxlar/" → the pricing page; "/" or anything unknown → null (the home landing). */
export const pageByPath = (pathname) => BY_PATH[pathname.replace(/\/+$/, '')] ?? null
export const pathOf = (id) => BY_ID[id]?.path ?? '/'
export const toolPageOf = (toolId) => BY_ID[`tool:${toolId}`] ?? null
/** Other tools of the same category, for "related tools" links. */
export const relatedTools = (page, n = 6) => TOOL_PAGES.filter((p) => p !== page && p.category === page.category).concat(TOOL_PAGES.filter((p) => p.category !== page.category)).slice(0, n)
