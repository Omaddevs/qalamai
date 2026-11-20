// Link-in-Bio definitions shared by the web app (live preview) and the API (public page
// renderer), so a published page looks exactly like the preview.

export const BIO_FONTS = {
  inter: { label: 'Inter', css: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;500;600;700' },
  grotesk: { label: 'Space Grotesk', css: "'Space Grotesk', 'Inter', sans-serif", google: 'Space+Grotesk:wght@500;600;700' },
  serif: { label: 'Playfair', css: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@600;700' },
  display: { label: 'Unbounded', css: "'Unbounded', 'Inter', sans-serif", google: 'Unbounded:wght@500;700' },
  hand: { label: 'Caveat', css: "'Caveat', cursive", google: 'Caveat:wght@600;700' },
}

/** Page themes. `pattern` is an extra CSS background layer drawn over `bg`. */
export const BIO_THEMES = {
  qalam: {
    name: 'Qalam',
    bg: '#fbfaf7',
    text: '#16181d',
    muted: '#6b717a',
    btnBg: '#0b0b0d',
    btnText: '#ffffff',
    btnBorder: '#0b0b0d',
    accent: '#14b8a6',
    font: 'inter',
  },
  midnight: {
    name: 'Tun',
    bg: 'radial-gradient(120% 70% at 50% -10%, #312e81 0%, #0b0b14 60%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,.7)',
    btnBg: 'rgba(255,255,255,.08)',
    btnText: '#ffffff',
    btnBorder: 'rgba(255,255,255,.18)',
    accent: '#5eead4',
    font: 'grotesk',
    dark: true,
  },
  sunset: {
    name: 'Shafaq',
    bg: 'linear-gradient(160deg, #ff9a3c 0%, #ef4f6f 55%, #7a1b5c 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,.85)',
    btnBg: '#ffffff',
    btnText: '#7a1b5c',
    btnBorder: '#ffffff',
    accent: '#ffe08a',
    font: 'grotesk',
    dark: true,
  },
  atlas: {
    name: 'Atlas',
    bg: '#fdf4f8',
    pattern:
      'repeating-linear-gradient(90deg, rgba(194,24,91,.07) 0 18px, transparent 18px 36px), repeating-linear-gradient(0deg, rgba(14,116,144,.06) 0 26px, transparent 26px 52px)',
    text: '#3b0d24',
    muted: '#86506b',
    btnBg: '#c2185b',
    btnText: '#ffffff',
    btnBorder: '#c2185b',
    accent: '#0e7490',
    font: 'serif',
  },
  mint: {
    name: 'Yalpiz',
    bg: 'linear-gradient(180deg, #ccfbf1 0%, #f0fdfa 60%)',
    text: '#0f3d38',
    muted: '#3f6f69',
    btnBg: '#ffffff',
    btnText: '#0f3d38',
    btnBorder: '#99f6e4',
    accent: '#14b8a6',
    font: 'inter',
  },
  neon: {
    name: 'Neon',
    bg: '#07060d',
    pattern: 'radial-gradient(60% 40% at 80% 0%, rgba(192,132,252,.35), transparent 70%), radial-gradient(50% 35% at 0% 100%, rgba(34,211,238,.25), transparent 70%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,.66)',
    btnBg: 'transparent',
    btnText: '#f5d0fe',
    btnBorder: '#c084fc',
    accent: '#c084fc',
    font: 'display',
    dark: true,
  },
  paper: {
    name: 'Qogʻoz',
    bg: '#f6f0e4',
    pattern: 'repeating-linear-gradient(0deg, transparent 0 31px, rgba(154,59,31,.08) 31px 32px)',
    text: '#2b2118',
    muted: '#7a6a58',
    btnBg: '#f6f0e4',
    btnText: '#2b2118',
    btnBorder: '#2b2118',
    accent: '#9a3b1f',
    font: 'hand',
  },
  ocean: {
    name: 'Okean',
    bg: 'linear-gradient(170deg, #0ea5e9 0%, #2563eb 50%, #1e1b4b 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,.8)',
    btnBg: 'rgba(255,255,255,.16)',
    btnText: '#ffffff',
    btnBorder: 'rgba(255,255,255,.35)',
    accent: '#bae6fd',
    font: 'inter',
    dark: true,
  },
}

export const BUTTON_STYLES = {
  fill: 'Toʻla',
  outline: 'Chiziqli',
  soft: 'Yumshoq',
  shadow: 'Soyali',
}

/** Social networks: how a handle becomes a URL. */
export const SOCIALS = [
  { id: 'telegram', label: 'Telegram', placeholder: '@username', url: (v) => `https://t.me/${v.replace(/^@/, '')}` },
  { id: 'instagram', label: 'Instagram', placeholder: '@username', url: (v) => `https://instagram.com/${v.replace(/^@/, '')}` },
  { id: 'youtube', label: 'YouTube', placeholder: '@kanal', url: (v) => `https://youtube.com/${v.startsWith('@') ? v : `@${v}`}` },
  { id: 'tiktok', label: 'TikTok', placeholder: '@username', url: (v) => `https://tiktok.com/${v.startsWith('@') ? v : `@${v}`}` },
  { id: 'facebook', label: 'Facebook', placeholder: 'username', url: (v) => `https://facebook.com/${v.replace(/^@/, '')}` },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'in/username', url: (v) => `https://linkedin.com/${v.replace(/^@/, '').replace(/^(?!in\/|company\/)/, 'in/')}` },
  { id: 'x', label: 'X (Twitter)', placeholder: '@username', url: (v) => `https://x.com/${v.replace(/^@/, '')}` },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: '+998 90 123 45 67', url: (v) => `https://wa.me/${v.replace(/\D/g, '')}` },
  { id: 'github', label: 'GitHub', placeholder: 'username', url: (v) => `https://github.com/${v.replace(/^@/, '')}` },
  { id: 'email', label: 'Email', placeholder: 'siz@mail.uz', url: (v) => `mailto:${v}` },
  { id: 'phone', label: 'Telefon', placeholder: '+998 90 123 45 67', url: (v) => `tel:${v.replace(/[^\d+]/g, '')}` },
  { id: 'website', label: 'Veb-sayt', placeholder: 'sayt.uz', url: (v) => normalizeUrl(v) },
]
export const SOCIAL_IDS = SOCIALS.map((s) => s.id)

/** Turn what people type ("t.me/x", "sayt.uz") into a safe absolute URL, or null. */
export function normalizeUrl(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (/^(mailto|tel):/i.test(v)) return v
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return u.href
  } catch {
    return null
  }
}

export function socialUrl(id, value) {
  const s = SOCIALS.find((x) => x.id === id)
  const v = String(value ?? '').trim()
  if (!s || !v) return null
  if (/^https?:\/\//i.test(v)) return normalizeUrl(v)
  if (id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null
  if ((id === 'phone' || id === 'whatsapp') && v.replace(/\D/g, '').length < 7) return null
  return s.id === 'website' ? normalizeUrl(v) : s.url(v)
}

/** Public page addresses: 3–30 chars, lowercase letters, digits, "-" and "_". */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28})[a-z0-9]$/
export const RESERVED_SLUGS = new Set(['admin', 'api', 'app', 'b', 'qalam', 'qalamai', 'login', 'register', 'help', 'support', 'about', 'settings', 'www', 'docs', 'static'])

export const BIO_DEFAULT = {
  name: '',
  bio: '',
  avatar: null,
  theme: 'qalam',
  buttonStyle: 'fill',
  font: null, // null = the theme's font
  links: [],
  socials: {},
}
