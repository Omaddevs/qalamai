// Visitor details from what the browser sends anyway: device / browser / OS from the
// User-Agent, the kind of traffic from the referrer, and the country from the time zone.
// Nothing here needs a GeoIP database, and no IP address is stored for page views.

export const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http/i

/** @returns {{ device: 'mobile'|'tablet'|'desktop', browser: string, os: string }} */
export function parseUa(ua = '') {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'tablet' : /Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(ua) ? 'mobile' : 'desktop'
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /YaBrowser/.test(ua)
        ? 'Yandex'
        : /SamsungBrowser/.test(ua)
          ? 'Samsung'
          : /Telegram/i.test(ua)
            ? 'Telegram'
            : /Instagram/.test(ua)
              ? 'Instagram'
              : /FBAN|FBAV/.test(ua)
                ? 'Facebook'
                : /Firefox|FxiOS/.test(ua)
                  ? 'Firefox'
                  : /Chrome|CriOS/.test(ua)
                    ? 'Chrome'
                    : /Safari/.test(ua)
                      ? 'Safari'
                      : 'Boşqa'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Boşqa'
  return { device, browser, os }
}

const SEARCH = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)yandex\.|(^|\.)ya\.ru$/, 'Yandex'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yahoo\./, 'Yahoo'],
  [/(^|\.)baidu\.com$/, 'Baidu'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'],
  [/(^|\.)mail\.ru$/, 'Mail.ru'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, 'ChatGPT'],
]
const SOCIAL = /(^|\.)(t\.me|telegram\.(org|me)|web\.telegram\.org|instagram\.com|facebook\.com|fb\.com|l\.facebook\.com|m\.facebook\.com|twitter\.com|x\.com|t\.co|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|vk\.com|ok\.ru|tiktok\.com|reddit\.com|threads\.net|pinterest\.com|whatsapp\.com|wa\.me)$/

/**
 * @param {string} referrer document.referrer
 * @param {string} ownHost the site's host — moves inside the site are not a source
 * @returns {{ source: string, referrer: string|null, searchEngine: string|null, searchTerm: string|null }}
 */
export function classifyReferrer(referrer, ownHost) {
  let url = null
  try {
    url = referrer ? new URL(referrer) : null
  } catch {
    url = null
  }
  const host = url?.hostname.replace(/^www\./, '').toLowerCase() ?? null
  if (!host || host === ownHost.replace(/^www\./, '')) return { source: 'direct', referrer: null, searchEngine: null, searchTerm: null }
  const engine = SEARCH.find(([re]) => re.test(host))?.[1] ?? null
  if (engine) {
    const term = url.searchParams.get('q') || url.searchParams.get('text') || url.searchParams.get('p') || null
    return { source: 'search', referrer: host, searchEngine: engine, searchTerm: term ? term.trim().slice(0, 120).toLowerCase() : null }
  }
  return { source: SOCIAL.test(host) ? 'social' : 'referral', referrer: host, searchEngine: null, searchTerm: null }
}

// IANA time zone → country (ISO 3166-1 alpha-2). Covers the zones browsers actually report.
const TZ = `
Asia/Tashkent,Asia/Samarkand:UZ|Asia/Almaty,Asia/Qyzylorda,Asia/Aqtobe,Asia/Aqtau,Asia/Atyrau,Asia/Oral,Asia/Qostanay:KZ|Asia/Bishkek:KG|Asia/Dushanbe:TJ|Asia/Ashgabat:TM
Europe/Moscow,Europe/Kaliningrad,Europe/Samara,Europe/Volgograd,Europe/Saratov,Europe/Ulyanovsk,Europe/Astrakhan,Europe/Kirov,Asia/Yekaterinburg,Asia/Omsk,Asia/Novosibirsk,Asia/Barnaul,Asia/Tomsk,Asia/Novokuznetsk,Asia/Krasnoyarsk,Asia/Irkutsk,Asia/Chita,Asia/Yakutsk,Asia/Khandyga,Asia/Vladivostok,Asia/Ust-Nera,Asia/Magadan,Asia/Sakhalin,Asia/Srednekolymsk,Asia/Kamchatka,Asia/Anadyr:RU
Europe/Kiev,Europe/Kyiv,Europe/Uzhgorod,Europe/Zaporozhye,Europe/Simferopol:UA|Europe/Minsk:BY|Asia/Baku:AZ|Asia/Tbilisi:GE|Asia/Yerevan:AM|Europe/Chisinau:MD
Europe/Istanbul,Asia/Istanbul:TR|Asia/Dubai:AE|Asia/Riyadh:SA|Asia/Qatar:QA|Asia/Kuwait:KW|Asia/Bahrain:BH|Asia/Muscat:OM|Asia/Tehran:IR|Asia/Baghdad:IQ|Asia/Jerusalem,Asia/Tel_Aviv:IL|Asia/Amman:JO|Asia/Beirut:LB|Asia/Damascus:SY|Asia/Kabul:AF|Asia/Karachi:PK|Asia/Aden:YE
Asia/Kolkata,Asia/Calcutta:IN|Asia/Dhaka:BD|Asia/Kathmandu:NP|Asia/Colombo:LK|Asia/Shanghai,Asia/Urumqi,Asia/Chongqing,Asia/Harbin:CN|Asia/Hong_Kong:HK|Asia/Taipei:TW|Asia/Tokyo:JP|Asia/Seoul:KR|Asia/Pyongyang:KP|Asia/Ulaanbaatar:MN
Asia/Singapore:SG|Asia/Kuala_Lumpur:MY|Asia/Jakarta,Asia/Makassar,Asia/Jayapura:ID|Asia/Bangkok:TH|Asia/Ho_Chi_Minh,Asia/Saigon:VN|Asia/Manila:PH|Asia/Yangon:MM|Asia/Phnom_Penh:KH
Europe/London,Europe/Belfast:GB|Europe/Dublin:IE|Europe/Paris:FR|Europe/Berlin,Europe/Busingen:DE|Europe/Amsterdam:NL|Europe/Brussels:BE|Europe/Luxembourg:LU|Europe/Zurich:CH|Europe/Vienna:AT|Europe/Rome:IT|Europe/Madrid,Atlantic/Canary:ES|Europe/Lisbon:PT
Europe/Stockholm:SE|Europe/Oslo:NO|Europe/Copenhagen:DK|Europe/Helsinki:FI|Atlantic/Reykjavik:IS|Europe/Warsaw:PL|Europe/Prague:CZ|Europe/Bratislava:SK|Europe/Budapest:HU|Europe/Bucharest:RO|Europe/Sofia:BG|Europe/Athens:GR|Europe/Belgrade:RS|Europe/Zagreb:HR|Europe/Ljubljana:SI|Europe/Sarajevo:BA|Europe/Skopje:MK|Europe/Tirane:AL|Europe/Riga:LV|Europe/Vilnius:LT|Europe/Tallinn:EE|Asia/Nicosia,Europe/Nicosia:CY|Europe/Malta:MT
America/New_York,America/Chicago,America/Denver,America/Los_Angeles,America/Phoenix,America/Anchorage,America/Detroit,America/Boise,America/Indiana/Indianapolis,America/Kentucky/Louisville,Pacific/Honolulu:US
America/Toronto,America/Vancouver,America/Edmonton,America/Winnipeg,America/Halifax,America/St_Johns,America/Regina:CA|America/Mexico_City,America/Tijuana,America/Monterrey,America/Cancun:MX|America/Sao_Paulo,America/Manaus,America/Fortaleza,America/Recife,America/Bahia:BR|America/Argentina/Buenos_Aires,America/Buenos_Aires:AR|America/Santiago:CL|America/Bogota:CO|America/Lima:PE|America/Caracas:VE
Africa/Cairo:EG|Africa/Casablanca:MA|Africa/Algiers:DZ|Africa/Tunis:TN|Africa/Lagos:NG|Africa/Nairobi:KE|Africa/Johannesburg:ZA|Africa/Addis_Ababa:ET|Africa/Accra:GH
Australia/Sydney,Australia/Melbourne,Australia/Brisbane,Australia/Perth,Australia/Adelaide,Australia/Hobart,Australia/Darwin:AU|Pacific/Auckland:NZ`

const TZ_COUNTRY = new Map()
for (const group of TZ.trim().split(/[|\n]/)) {
  const [zones, cc] = group.split(':')
  for (const z of zones.split(',')) TZ_COUNTRY.set(z.trim(), cc)
}

/** Country from the browser's time zone; falls back to a region in the language tag (ru-RU → RU). */
export function countryOf(timezone, lang) {
  const byTz = timezone ? TZ_COUNTRY.get(timezone) : null
  if (byTz) return byTz
  const region = /^[a-z]{2,3}[-_]([A-Z]{2})$/.exec(lang ?? '')?.[1]
  return region ?? null
}

/** Client IP as seen behind the proxy. */
export const clientIp = (req) => req.ip ?? null
