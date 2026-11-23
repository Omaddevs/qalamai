// Every font the editor offers for text: Google Fonts families that draw the Uzbek alphabet
// (Ö Ğ Ş Ç — the latin-ext subset); `cyr` ones draw Cyrillic too. Each row was checked against
// the Google Fonts API: the weights / italics in its request all exist (a wrong one fails the
// whole stylesheet). Fonts are loaded only when used: picked in the font menu, scrolled into view
// there, or found on a page being shown (Slide calls loadFonts).
// Row: [family, category, Google request (when not just the family), cyr]

const ROWS = [
  ["Inter", "sans", "Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Roboto", "sans", "Roboto:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Open Sans", "sans", "Open+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Montserrat", "sans", "Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Poppins", "sans", "Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Lato", "sans", "Lato:ital,wght@0,400;0,700;1,400;1,700"],
  ["Nunito", "sans", "Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Nunito Sans", "sans", "Nunito+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Raleway", "sans", "Raleway:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Work Sans", "sans", "Work+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["DM Sans", "sans", "DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Manrope", "sans", "Manrope:wght@400;500;600;700;800", 1],
  ["Rubik", "sans", "Rubik:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Mulish", "sans", "Mulish:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Source Sans 3", "sans", "Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["PT Sans", "sans", "PT+Sans:ital,wght@0,400;0,700;1,400;1,700", 1],
  ["Noto Sans", "sans", "Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["IBM Plex Sans", "sans", "IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Fira Sans", "sans", "Fira+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Ubuntu", "sans", "Ubuntu:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700", 1],
  ["Exo 2", "sans", "Exo+2:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Jost", "sans", "Jost:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Outfit", "sans", "Outfit:wght@400;500;600;700;800"],
  ["Plus Jakarta Sans", "sans", "Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Urbanist", "sans", "Urbanist:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Lexend", "sans", "Lexend:wght@400;500;600;700;800"],
  ["Sora", "sans", "Sora:wght@400;500;600;700;800"],
  ["Figtree", "sans", "Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Onest", "sans", "Onest:wght@400;500;600;700;800", 1],
  ["Golos Text", "sans", "Golos+Text:wght@400;500;600;700;800", 1],
  ["Geologica", "sans", "Geologica:wght@400;500;600;700;800", 1],
  ["Commissioner", "sans", "Commissioner:wght@400;500;600;700;800", 1],
  ["Kanit", "sans", "Kanit:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Barlow", "sans", "Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Barlow Condensed", "sans", "Barlow+Condensed:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Heebo", "sans", "Heebo:wght@400;500;600;700;800"],
  ["Karla", "sans", "Karla:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Quicksand", "sans", "Quicksand:wght@400;500;600;700"],
  ["Comfortaa", "sans", "Comfortaa:wght@400;500;600;700", 1],
  ["Space Grotesk", "sans", "Space+Grotesk:wght@400;500;600;700"],
  ["Bricolage Grotesque", "sans", "Bricolage+Grotesque:wght@400;500;600;700;800"],
  ["Archivo", "sans", "Archivo:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Red Hat Display", "sans", "Red+Hat+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Albert Sans", "sans", "Albert+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Wix Madefor Display", "sans", "Wix+Madefor+Display:wght@400;500;600;700;800", 1],
  ["Unbounded", "sans", "Unbounded:wght@400;500;600;700;800", 1],
  ["M PLUS Rounded 1c", "sans", "M+PLUS+Rounded+1c:wght@400;500;700;800", 1],
  ["Varela Round", "sans"],
  ["Didact Gothic", "sans", "", 1],
  ["Tenor Sans", "sans", "", 1],
  ["Josefin Sans", "sans", "Josefin+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Cabin", "sans", "Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Titillium Web", "sans", "Titillium+Web:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700"],
  ["Oxygen", "sans", "Oxygen:wght@400;700"],
  ["Arimo", "sans", "Arimo:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Hind", "sans", "Hind:wght@400;500;600;700"],
  ["Inclusive Sans", "sans", "Inclusive+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Instrument Sans", "sans", "Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Schibsted Grotesk", "sans", "Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Hanken Grotesk", "sans", "Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Playfair Display", "serif", "Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Merriweather", "serif", "Merriweather:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Lora", "serif", "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["PT Serif", "serif", "PT+Serif:ital,wght@0,400;0,700;1,400;1,700", 1],
  ["Noto Serif", "serif", "Noto+Serif:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Libre Baskerville", "serif", "Libre+Baskerville:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["EB Garamond", "serif", "EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Cormorant Garamond", "serif", "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Cormorant", "serif", "Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Crimson Text", "serif", "Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700"],
  ["Crimson Pro", "serif", "Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Source Serif 4", "serif", "Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Spectral", "serif", "Spectral:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Alegreya", "serif", "Alegreya:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Bitter", "serif", "Bitter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Roboto Slab", "serif", "Roboto+Slab:wght@400;500;600;700;800", 1],
  ["Zilla Slab", "serif", "Zilla+Slab:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Domine", "serif", "Domine:wght@400;500;600;700"],
  ["Fraunces", "serif", "Fraunces:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["DM Serif Display", "serif", "DM+Serif+Display:ital,wght@0,400;1,400"],
  ["DM Serif Text", "serif", "DM+Serif+Text:ital,wght@0,400;1,400"],
  ["Instrument Serif", "serif", "Instrument+Serif:ital,wght@0,400;1,400"],
  ["Marcellus", "serif"],
  ["Cinzel", "serif", "Cinzel:wght@400;500;600;700;800"],
  ["Bodoni Moda", "serif", "Bodoni+Moda:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800"],
  ["Libre Caslon Text", "serif", "Libre+Caslon+Text:ital,wght@0,400;0,700;1,400"],
  ["Old Standard TT", "serif", "Old+Standard+TT:ital,wght@0,400;0,700;1,400", 1],
  ["Literata", "serif", "Literata:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Gelasio", "serif", "Gelasio:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Vollkorn", "serif", "Vollkorn:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["IBM Plex Serif", "serif", "IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Yeseva One", "serif", "", 1],
  ["Abril Fatface", "serif"],
  ["Gloock", "serif"],
  ["Young Serif", "serif"],
  ["Forum", "serif", "", 1],
  ["Ledger", "serif", "", 1],
  ["Noticia Text", "serif", "Noticia+Text:ital,wght@0,400;0,700;1,400;1,700"],
  ["Tinos", "serif", "Tinos:ital,wght@0,400;0,700;1,400;1,700", 1],
  ["Oswald", "display", "Oswald:wght@400;500;600;700", 1],
  ["Anton", "display"],
  ["Bebas Neue", "display"],
  ["League Gothic", "display"],
  ["Archivo Black", "display"],
  ["Alfa Slab One", "display"],
  ["Russo One", "display", "", 1],
  ["Righteous", "display"],
  ["Bungee", "display"],
  ["Black Ops One", "display"],
  ["Syne", "display", "Syne:wght@400;500;600;700;800"],
  ["Antonio", "display", "Antonio:wght@400;500;600;700"],
  ["Fjalla One", "display"],
  ["Teko", "display", "Teko:wght@400;500;600;700"],
  ["Staatliches", "display"],
  ["Passion One", "display", "Passion+One:wght@400;700"],
  ["Ultra", "display"],
  ["Rubik Mono One", "display", "", 1],
  ["Dela Gothic One", "display", "", 1],
  ["Rampart One", "display", "", 1],
  ["Monoton", "display"],
  ["Bungee Shade", "display"],
  ["Climate Crisis", "display", "", 1],
  ["Tilt Warp", "display"],
  ["Rubik Dirt", "display", "", 1],
  ["Press Start 2P", "display", "", 1],
  ["Pixelify Sans", "display", "Pixelify+Sans:wght@400;500;600;700", 1],
  ["Silkscreen", "display", "Silkscreen:wght@400;700"],
  ["Audiowide", "display"],
  ["Chakra Petch", "display", "Chakra+Petch:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700"],
  ["Bowlby One SC", "display"],
  ["Poiret One", "display", "", 1],
  ["Lobster", "display", "", 1],
  ["Fredoka", "display", "Fredoka:wght@400;500;600;700"],
  ["Baloo 2", "display", "Baloo+2:wght@400;500;600;700;800"],
  ["Luckiest Guy", "display"],
  ["Bangers", "display"],
  ["Titan One", "display"],
  ["Lilita One", "display"],
  ["Paytone One", "display"],
  ["Shrikhand", "display"],
  ["Rubik Glitch", "display", "", 1],
  ["Rubik Bubbles", "display", "", 1],
  ["Ruslan Display", "display", "", 1],
  ["Stalinist One", "display", "", 1],
  ["Great Vibes", "script", "", 1],
  ["Pacifico", "script", "", 1],
  ["Dancing Script", "script", "Dancing+Script:wght@400;500;600;700"],
  ["Sacramento", "script"],
  ["Allura", "script"],
  ["Parisienne", "script"],
  ["Alex Brush", "script"],
  ["Kaushan Script", "script"],
  ["Marck Script", "script", "", 1],
  ["Pinyon Script", "script"],
  ["Yellowtail", "script"],
  ["Courgette", "script"],
  ["Bad Script", "script", "", 1],
  ["Caveat", "script", "Caveat:wght@400;500;600;700", 1],
  ["Caveat Brush", "script"],
  ["Amatic SC", "script", "Amatic+SC:wght@400;700", 1],
  ["Shadows Into Light", "script"],
  ["Indie Flower", "script"],
  ["Patrick Hand", "script"],
  ["Kalam", "script", "Kalam:wght@400;700"],
  ["Architects Daughter", "script"],
  ["Gloria Hallelujah", "script"],
  ["Comforter", "script", "", 1],
  ["Comforter Brush", "script", "", 1],
  ["Vujahday Script", "script"],
  ["Birthstone", "script"],
  ["Water Brush", "script"],
  ["Ballet", "script"],
  ["Mea Culpa", "script"],
  ["Seaweed Script", "script"],
  ["Space Mono", "mono", "Space+Mono:ital,wght@0,400;0,700;1,400;1,700"],
  ["JetBrains Mono", "mono", "JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["IBM Plex Mono", "mono", "IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Fira Code", "mono", "Fira+Code:wght@400;500;600;700", 1],
  ["Roboto Mono", "mono", "Roboto+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", 1],
  ["Source Code Pro", "mono", "Source+Code+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", 1],
  ["Courier Prime", "mono", "Courier+Prime:ital,wght@0,400;0,700;1,400;1,700"],
  ["PT Mono", "mono", "", 1],
  ["Ubuntu Mono", "mono", "Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700", 1],
  ["Cutive Mono", "mono"],
]

export const FONT_CATS = ['sans', 'serif', 'display', 'script', 'mono']

const FALLBACK = { sans: 'system-ui, sans-serif', serif: 'Georgia, serif', display: 'system-ui, sans-serif', script: 'cursive', mono: 'ui-monospace, monospace' }

/** @type {{ family: string, cat: string, g: string, cyr: boolean, css: string }[]} */
export const FONTS = ROWS.map(([family, cat, g, cyr]) => ({
  family,
  cat,
  g: g || family.replace(/ /g, '+'),
  cyr: Boolean(cyr),
  css: `'${family}', ${FALLBACK[cat]}`,
}))
const BY_FAMILY = new Map(FONTS.map((f) => [f.family.toLowerCase(), f]))

/** The first family named in a CSS font-family value: "'Playfair Display', serif" → "Playfair Display". */
export const familyOf = (css) => (css ?? '').split(',')[0].replace(/["']/g, '').trim()

/** The catalog entry for a family name or CSS font-family value (null for fonts outside it). */
export const fontOf = (nameOrCss) => BY_FAMILY.get(familyOf(nameOrCss).toLowerCase()) ?? null

/** CSS font-family for a catalog family (with its category's fallback). */
export const fontCss = (family) => fontOf(family)?.css ?? `'${family}', system-ui, sans-serif`

const loaded = new Map() // family → Promise (its stylesheet has loaded or failed)

/** Adds the Google Fonts stylesheet of each catalog font named (CSS values or family names) once. */
export function loadFonts(list) {
  if (typeof document === 'undefined') return
  for (const v of list) {
    const f = v && fontOf(v)
    if (!f || loaded.has(f.family)) continue
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`
    l.dataset.qfont = f.family
    loaded.set(f.family, new Promise((r) => (l.onload = l.onerror = r)))
    document.head.appendChild(l)
  }
}

/** The fonts used by these pages' text elements (CSS values). */
export const fontsOfSlides = (slides) => slides.flatMap((s) => (s.elements ?? []).map((e) => e.font).filter(Boolean))

/** Resolves once the stylesheets of the fonts asked for so far have arrived (for exports). */
export const fontSheetsReady = () => Promise.all(loaded.values())

/* ───── recently used (per browser) ───── */
const RECENT_KEY = 'qalamai.fonts.recent'
export function recentFonts() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]').filter((x) => fontOf(x)).slice(0, 8)
  } catch {
    return []
  }
}
export function rememberFont(family) {
  try {
    const next = [family, ...recentFonts().filter((x) => x !== family)].slice(0, 8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}
