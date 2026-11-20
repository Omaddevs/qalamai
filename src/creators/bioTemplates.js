// Link-in-Bio templates (v2 model, shared/bio2.js). Original designs: every element is editable
// in the studio — colours, fonts, shapes, background image, decorations.
import { STYLE_DEFAULT } from '../../shared/bio2.js'

let n = 0
const id = () => `t${(++n).toString(36)}`
const L = (title, url, extra = {}) => ({ id: id(), title, url, enabled: true, highlight: false, ...extra })
const D = (kind, x, y, size, extra = {}) => ({ id: id(), kind, x, y, size, rotate: 0, opacity: 1, layer: 'back', color: '#f472b6', color2: '#ffffff', ...extra })

/** Merge a partial style over the defaults (one level deep, like fullStyle). */
const st = (s) => Object.fromEntries(Object.entries(STYLE_DEFAULT).map(([k, def]) => [k, Array.isArray(def) ? (s[k] ?? def) : def && typeof def === 'object' ? { ...def, ...(s[k] ?? {}) } : (s[k] ?? def)]))

const page = (data, style) => ({ v: 2, name: '', role: '', headline: '', brand: '', bio: '', avatar: null, links: [], socials: {}, stats: [], cta: null, footer: '', ...data, style: st(style) })

export const BIO_TEMPLATES = [
  /* 1 — deep emerald, tall condensed headline, oval portrait, mint pills */
  {
    id: 'bio-emerald',
    name: 'Zumrad',
    data: page(
      {
        brand: 'The Em',
        headline: 'Sizning havolangiz\nyaxşiroğiga loyiq',
        name: 'Emma Rahimova',
        links: [L('Dizayner işi', 'behance.net'), L('Mobil uçun tayyor', 'qalam.ai'), L('Portfolio şabloni', 'qalam.ai'), L('Jasur brendlar uçun', 't.me/emma')],
        socials: { instagram: '@emma', tiktok: '@emma', youtube: '@emma', x: '@emma' },
      },
      {
        page: { bg: '#062f2a', padTop: 40 },
        order: ['brand', 'avatar', 'headline', 'socials', 'buttons', 'name', 'stats', 'cta', 'footer'],
        font: { heading: 'league', body: 'inter' },
        brand: { color: '#57c99a', size: 34, upper: true, menu: true },
        avatar: { shape: 'oval', size: 168, border: '#062f2a', borderWidth: 0, shadow: false, phBg: '#2c6b57', phColor: '#57c99a' },
        headline: { color: '#57c99a', size: 58, upper: true, lineHeight: 0.92 },
        name: { color: '#57c99a', size: 16, weight: 500 },
        socials: { style: 'circle', bg: '#ffffff', color: '#111111', size: 40 },
        buttons: { shape: 'pill', fill: 'solid', bg: '#57c99a', color: '#ffffff', border: '#57c99a', shadow: 'none', height: 52, size: 17, weight: 700, icon: false, arrow: 'none', width: 66, gap: 16 },
        footer: { color: '#57c99a99' },
      },
    ),
  },

  /* 2 — fitness coach: dark gym green, ring avatar with badge, icon cards, newsletter */
  {
    id: 'bio-coach',
    name: 'Murabbiy',
    data: page(
      {
        name: 'Fit bilan Sabina',
        role: 'Sog‘lom turmuş murabbiyi',
        bio: 'Kuçli tana, sog‘lom fikr va yaxşi hayot tarzini qurişga yordam beraman.',
        links: [
          L('Onlayn murabbiylik', 't.me/sabina', { sub: '1:1 mashğulot va şaxsiy reja', icon: 'barbell', bg: '#5aa832' }),
          L('Mashğulot dasturlari', 'qalam.ai', { sub: 'Uy va zal uçun', icon: 'person' }),
          L('Ovqatlaniş rejasi', 'qalam.ai', { sub: 'Sog‘lom retseptlar', icon: 'leaf' }),
          L('Bepul materiallar', 'qalam.ai', { sub: 'Qöllanma va çek-listlar', icon: 'gift' }),
          L('Tavsiyalarim', 'qalam.ai', { sub: 'Özim işlatadigan mahsulotlar', icon: 'heart' }),
        ],
        socials: { instagram: '@sabina.fit', tiktok: '@sabina.fit', youtube: '@sabinafit', email: 'sabina@mail.uz' },
        cta: { title: 'Yangiliklarga obuna', text: 'Har hafta maslahat va motivatsiya', button: 'Obuna', url: 't.me/sabina', placeholder: 'Email manzilingiz' },
      },
      {
        page: { bg: '#1b2a14', bg2: '#070a06', angle: 180, padTop: 44 },
        font: { heading: 'dm', body: 'dm' },
        avatar: { shape: 'circle', size: 128, border: '#6abf3c', borderWidth: 4, phBg: '#2f4a22', phColor: '#9be26e' },
        name: { color: '#ffffff', size: 28, weight: 700, badge: true, badgeColor: '#6abf3c' },
        role: { color: '#7cd14a', size: 16, weight: 600 },
        bio: { color: '#e5e7eb', size: 15.5 },
        socials: { style: 'circle', bg: '#ffffff14', color: '#ffffff', size: 46 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#15210f', color: '#ffffff', border: '#ffffff1f', borderWidth: 1, shadow: 'none', height: 66, size: 16, weight: 600, align: 'left', icon: true, iconBg: '#ffffff12', arrow: 'caret' },
        cta: { bg: '#ffffff0d', color: '#ffffff', btnBg: '#4f9a2a', btnColor: '#ffffff', input: true },
        footer: { color: '#ffffff80' },
        deco: [D('blob', 50, 0, 120, { color: '#6abf3c22', opacity: 1 })],
      },
    ),
  },

  /* 3 — beauty studio: warm cream, monogram, neumorphic cards with round icons */
  {
    id: 'bio-studio',
    name: 'Studio',
    data: page(
      {
        brand: 'Studio',
        name: 'Sevara Bekova',
        role: 'Nail dizayner',
        bio: 'Gözalligingizga nafislik, eʼtibor va özingizga işonç bağişlaydigan muolajalar.',
        links: [
          L('Yoziliş', 't.me/sevara', { sub: 'Konsultatsiya va qulay vaqtni tanlang', icon: 'calendar' }),
          L('Xizmatlar', 'qalam.ai', { sub: 'Studiyamizdagi muolajalar', icon: 'file' }),
          L('Natijalar', 'instagram.com', { sub: 'Işlarimiz va mijozlar fikri', icon: 'images' }),
          L('Manzil', 'maps.google.com', { sub: 'Şinam va zamonaviy studiya', icon: 'pin' }),
          L('Biz bilan boğlaniş', 'wa.me/998901234567', { sub: 'WhatsApp orqali savol bering', icon: 'whatsapp' }),
        ],
        socials: { instagram: '@sevara.nails', whatsapp: '+998 90 123 45 67', website: 'qalam.ai' },
        footer: '2026 Sevara Bekova Nail Studio',
      },
      {
        page: { bg: '#f6efe9', bg2: '#efe5dc', angle: 180, padTop: 40 },
        order: ['avatar', 'brand', 'name', 'role', 'bio', 'socials', 'buttons', 'stats', 'cta', 'footer'],
        font: { heading: 'marcellus', body: 'dm' },
        brand: { color: '#7a5a3a', size: 13, upper: true, align: 'center', font: 'dm' },
        avatar: { shape: 'portrait', size: 190, border: '#ffffff', borderWidth: 0, shadow: true, phBg: '#e3d3c4', phColor: '#f8f1ea' },
        name: { color: '#6e4f33', size: 34, weight: 400 },
        role: { color: '#6e4f33', size: 12.5, weight: 600, upper: true, spacing: 0.4 },
        bio: { color: '#5b4636', size: 14.5 },
        socials: { style: 'square', bg: '#fffaf6', color: '#5b4636', size: 40 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#f8f2ed', color: '#4a3424', border: '#ffffff', borderWidth: 1, shadow: 'soft', shadowColor: '#b49478', height: 84, size: 17, weight: 400, upper: true, align: 'left', icon: true, iconBg: '#fffaf6', arrow: 'circle', font: 'marcellus' },
        footer: { color: '#6e4f33' },
        deco: [D('flower', 92, 4, 16, { color: '#e8d3bf', color2: '#cfae8c', opacity: 0.9 }), D('flower', 86, 9, 9, { color: '#eedccb', color2: '#cfae8c', opacity: 0.8 })],
      },
    ),
  },

  /* 4 — bold artist: forest green, huge pink headline, wavy portrait overlapping it */
  {
    id: 'bio-artist',
    name: 'Rassom',
    data: page(
      {
        brand: 'Kamola Lutfullayeva',
        headline: 'Nail\nartist',
        links: [L('Yoziliş', 't.me/kamola', { bg: '#f6b8a8', color: '#1d3b2c' }), L('Xizmatlar va narxlar', 'qalam.ai'), L('Dizaynlar galereyasi', 'instagram.com'), L('Studiyani topiş', 'maps.google.com')],
        socials: { instagram: '@kamola', tiktok: '@kamola', youtube: '@kamola', pinterest: 'kamola' },
      },
      {
        page: { bg: '#1d3b2c', padTop: 36 },
        order: ['brand', 'headline', 'avatar', 'name', 'role', 'bio', 'buttons', 'socials', 'stats', 'cta', 'footer'],
        font: { heading: 'anton', body: 'dm' },
        brand: { color: '#f6b8a8', size: 22, upper: false, align: 'center', font: 'cormorant' },
        headline: { color: '#f6b8a8', size: 112, upper: true, lineHeight: 0.86, overlap: 46 },
        avatar: { shape: 'wavy', size: 150, border: '#f6b8a8', borderWidth: 0, shadow: false, backdrop: '#f6b8a8', backdropSize: 1.08, phBg: '#f2a594', phColor: '#ffe3da' },
        buttons: { shape: 'square', fill: 'outline', bg: '#f6b8a8', color: '#1d3b2c', border: '#f6b8a8', borderWidth: 2, shadow: 'none', height: 52, size: 15, weight: 700, icon: false, arrow: 'none', gap: 14 },
        socials: { style: 'plain', color: '#f6b8a8', size: 40 },
        footer: { color: '#f6b8a899' },
      },
    ),
  },

  /* 5 — retro desktop: soft sky, pixel windows, pixel heart and cursor */
  {
    id: 'bio-retro',
    name: 'Retro',
    data: page(
      {
        name: 'Rayhona Karimova',
        role: 'Yozuvçi',
        bio: 'Fikrlarni hikoyaga, tuyğularni sözga aylantiraman.',
        links: [L('Yozganlarimni öqiş', 'qalam.ai'), L('Sönggi hikoyalar', 'qalam.ai'), L('Nashr etilgan kitoblar', 'asaxiy.uz'), L('Men haqimda', 'qalam.ai')],
        socials: { whatsapp: '+998 90 123 45 67', instagram: '@rayhona', email: 'rayhona@mail.uz', linkedin: 'rayhona' },
      },
      {
        page: { bg: '#a9bfdc', bg2: '#e9eef5', angle: 180, pattern: 'dots', patternColor: '#ffffff40', padTop: 40 },
        order: ['avatar', 'name', 'role', 'bio', 'buttons', 'socials', 'stats', 'cta', 'footer'],
        font: { heading: 'pixel', body: 'pixel' },
        avatar: { shape: 'window', size: 230, title: 'Rayhona shu yerda!', titleBg: '#f39ac7', titleColor: '#1f1f1f', shadow: false, phBg: '#d8cfc7', phColor: '#f5efe9' },
        name: { color: '#1f1f1f', size: 34, weight: 700, upper: true },
        role: { color: '#1f1f1f', size: 15, weight: 600 },
        bio: { color: '#1f1f1f', size: 15 },
        buttons: { shape: 'square', fill: 'glass', bg: '#1f1f1f', color: '#1f1f1f', border: '#1f1f1f', borderWidth: 2, shadow: 'none', height: 46, size: 16, weight: 600, icon: false, arrow: 'none', width: 86 },
        socials: { style: 'plain', color: '#1f1f1f', size: 40 },
        footer: { color: '#1f1f1fa0' },
        deco: [
          D('pixelheart', 84, 7, 16, { color: '#f39ac7', layer: 'front' }),
          D('cursor', 88, 27, 11, { color: '#1f1f1f', color2: '#f39ac7', layer: 'front', rotate: -10 }),
          D('sparkle', 10, 38, 9, { color: '#f39ac7', color2: '#ffffff' }),
        ],
      },
    ),
  },
  /* 6 — ad agency: light page, 2-column dark cards, closing CTA card, numbers */
  {
    id: 'bio-agency',
    name: 'Agentlik',
    data: page(
      {
        name: 'Daily-Ads',
        headline: 'Aqlli öşing.\nYaxşiroq reklama qiling.',
        bio: 'Real natija beradigan sunʼiy intellekt asosidagi reklama yeçimlari.',
        links: [
          L('Instagram', 'instagram.com', { sub: 'Sahna ortidagi lavhalar', icon: 'instagram' }),
          L('YouTube', 'youtube.com', { sub: 'Darslar va keyslar', icon: 'youtube', bg: '#0e7fa8' }),
          L('TikTok', 'tiktok.com', { sub: 'Qisqa maslahatlar', icon: 'tiktok', bg: '#0e7fa8' }),
          L('LinkedIn', 'linkedin.com', { sub: 'Kasbiy kuzatuvlar', icon: 'linkedin' }),
          L('Saytimiz', 'qalam.ai', { sub: 'Xizmatlar bilan tanişing', icon: 'globe' }),
          L('Qönğiroq band qiliş', 't.me/dailyads', { sub: 'Bepul strategiya suhbati', icon: 'calendar', bg: '#0e7fa8' }),
        ],
        stats: [{ id: 's1', value: '500+', label: 'Mijozlar', icon: 'users' }, { id: 's2', value: '2M+', label: 'Byudjet', icon: 'chart' }, { id: 's3', value: '98%', label: 'Natija', icon: 'trophy' }],
        cta: { title: 'Reklamangizni östirişga tayyormisiz?', text: 'Keling, birga ajoyib narsa quramiz.', button: 'Boşlaş →', url: 't.me/dailyads' },
      },
      {
        page: { bg: '#f1f3f6', padTop: 40 },
        order: ['avatar', 'name', 'headline', 'bio', 'buttons', 'cta', 'stats', 'footer'],
        font: { heading: 'poppins', body: 'poppins' },
        avatar: { shape: 'rounded', size: 96, border: '#ffffff', borderWidth: 0, shadow: true, phBg: '#0e2a3d', phColor: '#ff6a1a' },
        name: { color: '#0e2a3d', size: 34, weight: 800, upper: true },
        headline: { color: '#ff6a1a', size: 22, upper: false, lineHeight: 1.15, font: 'poppins' },
        bio: { color: '#334155', size: 14.5 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#0d2536', color: '#ffffff', border: '#0d2536', borderWidth: 0, shadow: 'soft', shadowColor: '#0d2536', height: 92, size: 15, weight: 700, align: 'left', icon: true, iconBg: '#ffffff1f', arrow: 'circle', columns: 2, gap: 12 },
        cta: { bg: '#0d2536', color: '#ffffff', btnBg: '#ff6a1a', btnColor: '#ffffff', input: false },
        stats: { bg: 'transparent', color: '#0e2a3d', muted: '#64748b' },
        footer: { color: '#64748b' },
        deco: [D('arrowcurve', 88, 16, 20, { color: '#ff6a1a', rotate: -10 })],
      },
    ),
  },

  /* 7 — SaaS orange: white page, orange icon buttons, numbers box, socials at the end */
  {
    id: 'bio-orange',
    name: 'Apelsin',
    data: page(
      {
        name: 'Daily-Ads',
        bio: 'Sotadigan reklama kreativlari —\nsunʼiy intellekt yordamida.',
        links: [
          L('Bepul sinab köriş', 'qalam.ai', { sub: 'Bir necça soniyada reklama yarating', icon: 'rocket' }),
          L('Reklama namunalari', 'qalam.ai', { sub: 'Eng yaxşilaridan ilhom oling', icon: 'sparkle' }),
          L('Blog va maqolalar', 'qalam.ai', { sub: 'Maslahat va ösiş strategiyalari', icon: 'book' }),
          L('Video darslar', 'youtube.com', { sub: 'Qanday kengaytiriş mumkin', icon: 'play' }),
          L('Hamjamiyatga qöşiling', 't.me/dailyads', { sub: '10 000+ marketolog bilan', icon: 'users' }),
        ],
        stats: [{ id: 's1', value: '10K+', label: 'Marketolog', icon: 'chart' }, { id: 's2', value: '2M+', label: 'Reklama', icon: 'trophy' }, { id: 's3', value: '4.9/5', label: 'Reyting', icon: 'star' }],
        socials: { x: '@dailyads', linkedin: 'dailyads', instagram: '@dailyads', youtube: '@dailyads', tiktok: '@dailyads' },
        footer: '© 2026 Daily-Ads',
      },
      {
        page: { bg: '#f7f8fb', padTop: 44 },
        order: ['avatar', 'name', 'bio', 'buttons', 'stats', 'socials', 'footer'],
        font: { heading: 'poppins', body: 'poppins' },
        avatar: { shape: 'circle', size: 112, border: '#ffffff', borderWidth: 6, shadow: true, phBg: '#ffffff', phColor: '#f26b2a' },
        name: { color: '#1f2430', size: 30, weight: 700 },
        bio: { color: '#3c4352', size: 16 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#f26b2a', color: '#ffffff', border: '#f26b2a', borderWidth: 0, shadow: 'soft', shadowColor: '#f26b2a', height: 70, size: 17, weight: 600, align: 'left', icon: true, iconBg: 'transparent', arrow: 'caret' },
        stats: { bg: '#e9edf5', color: '#1f2430', muted: '#4b5563' },
        socials: { style: 'circle', bg: '#ffffff', color: '#1f2430', size: 42 },
        footer: { color: '#6b7280' },
        deco: [D('ring', -4, 30, 22, { color: '#f26b2a', rotate: 20, layer: 'back' }), D('cursor', 92, 82, 20, { color: '#f26b2a', color2: '#ffffff', rotate: -20, layer: 'front' }), D('circle', 104, 40, 30, { color: '#f26b2a', opacity: 0.9 })],
      },
    ),
  },

  /* 8 — creative pastel: mint page, rounded portrait with stickers, numbered colour-icon rows */
  {
    id: 'bio-pastel',
    name: 'Pastel',
    data: page(
      {
        name: 'Kamila Lutfiyeva',
        bio: 'Texnologiya va ijodni birlaştirib, innovatsion raqamli tajribalar yarataman.',
        links: [
          L('Yozing!', 'wa.me/998901234567', { icon: 'whatsapp' }),
          L('Kundalik hayot', 'instagram.com', { icon: 'instagram' }),
          L('Karyera yöli', 'linkedin.com', { icon: 'linkedin' }),
          L('Ilhom taxtasi', 'pinterest.com', { icon: 'pinterest' }),
        ],
      },
      {
        page: { bg: '#e6ecdf', padTop: 36 },
        order: ['avatar', 'name', 'bio', 'buttons', 'socials', 'footer'],
        font: { heading: 'quicksand', body: 'quicksand' },
        avatar: { shape: 'rounded', size: 170, border: '#e6ecdf', borderWidth: 0, shadow: false, phBg: '#d9a4b8', phColor: '#f7dfe8' },
        name: { color: '#1f2a1d', size: 30, weight: 500 },
        bio: { color: '#8a9486', size: 14.5 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#cfd8c6', color: '#1f2a1d', border: '#cfd8c6', borderWidth: 0, shadow: 'none', height: 52, size: 15, weight: 600, align: 'left', icon: true, iconBg: '#1f2a1d', iconBrand: true, arrow: 'none', numbered: true, gap: 10 },
        footer: { color: '#8a9486' },
        deco: [
          D('burst', 72, 6, 22, { color: '#e3262e', color2: '#e3262e', rotate: 12, layer: 'front' }),
          D('flower', 26, 22, 20, { color: '#2b2bd1', color2: '#ffffff', layer: 'front' }),
        ],
      },
    ),
  },

  /* 9 — corporate photo: full-bleed image with navy fade, logo circle, white/gold buttons */
  {
    id: 'bio-corporate',
    name: 'Korporativ',
    data: page(
      {
        brand: 'Fauget',
        links: [
          L('Biz haqimizda', 'qalam.ai', { icon: 'user' }),
          L('Portfolio', 'qalam.ai', { icon: 'grid' }),
          L('Veb-sayt', 'qalam.ai', { icon: 'globe' }),
          L('Ijtimoiy tarmoqlar', 'instagram.com', { icon: 'instagram' }),
        ],
        footer: 'Toşkent ş., Amir Temur köç., 1',
      },
      {
        page: { bg: '#8a96a8', bg2: '#16284a', angle: 180, overlay: '#16284a', overlayOpacity: 0, padTop: 56 },
        order: ['avatar', 'brand', 'buttons', 'footer'],
        font: { heading: 'poppins', body: 'poppins' },
        avatar: { shape: 'circle', size: 104, border: '#16284a', borderWidth: 0, shadow: true, phBg: '#16284a', phColor: '#e2b33c' },
        brand: { color: '#ffffff', size: 18, upper: false, align: 'center' },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#ffffff', bg2: '#e2b33c', color: '#16284a', border: '#ffffff', borderWidth: 0, shadow: 'soft', height: 46, size: 14.5, weight: 600, align: 'left', icon: true, iconBg: 'transparent', arrow: 'arrow', width: 80, gap: 14 },
        footer: { color: '#ffffffcc' },
      },
    ),
  },

  /* 10 — skincare arch: dark warm page, cream arch card, thin outline buttons */
  {
    id: 'bio-arch',
    name: 'Arka',
    data: page(
      {
        name: 'Sevinç Qodirova',
        bio: 'Teri parvarişi, halol taqrizlar va har kungi yorqinlik.',
        links: [L('Yorqinlik sirlari', 'qalam.ai'), L('Parvariş kundaligim', 'qalam.ai'), L('Gözallik eslatmalari', 'qalam.ai'), L('Hamkorlik', 't.me/sevinch')],
        socials: { instagram: '@sevinch', tiktok: '@sevinch', youtube: '@sevinch' },
      },
      {
        page: { bg: '#3a2418', bg2: '#140c08', angle: 160, padTop: 28 },
        card: { on: true, bg: '#f2ead9', border: 'transparent', radius: 18, arch: true, shadow: true, margin: 18 },
        order: ['avatar', 'name', 'bio', 'socials', 'buttons', 'footer'],
        font: { heading: 'cormorant', body: 'dm' },
        avatar: { shape: 'circle', size: 104, border: '#f2ead9', borderWidth: 0, shadow: false, phBg: '#9c6b49', phColor: '#e7c9a9' },
        name: { color: '#3a3226', size: 36, weight: 500 },
        bio: { color: '#4b4234', size: 14.5 },
        socials: { style: 'plain', color: '#6d7a5b', size: 40 },
        buttons: { shape: 'square', fill: 'outline', bg: '#8a7f6a', color: '#3a3226', border: '#8a7f6a', borderWidth: 1, shadow: 'none', height: 54, size: 14, weight: 400, icon: false, arrow: 'none', gap: 14 },
        footer: { color: '#8a7f6a' },
      },
    ),
  },

  /* 11 — creator minimal: white page, soft grey shapes, rounded card of grey buttons */
  {
    id: 'bio-minimal',
    name: 'Minimal',
    data: page(
      {
        name: 'Salom, men Esther',
        role: 'Ijodkor · Dizayner · Mutaxassis',
        bio: 'Ğoyalar, işlar va ijod jarayoni ortidagi hikoyalar.',
        links: [L('Men bilan yaqindan taniş', 'qalam.ai'), L('Portfolioni köriş', 'behance.net'), L('Xizmatlarim', 'qalam.ai'), L('Hamkorlik uçun yozing', 't.me/esther')],
        socials: { instagram: '@esther', whatsapp: '+998 90 123 45 67' },
      },
      {
        page: { bg: '#ffffff', padTop: 40 },
        order: ['avatar', 'name', 'role', 'bio', 'socials', 'buttons', 'footer'],
        font: { heading: 'dm', body: 'dm' },
        avatar: { shape: 'circle', size: 120, border: '#ffffff', borderWidth: 5, shadow: true, align: 'left', phBg: '#d6d2cc', phColor: '#f2efeb' },
        name: { color: '#1f1f1f', size: 24, weight: 600, align: 'left' },
        role: { color: '#9a9a9a', size: 13, weight: 400, align: 'left' },
        bio: { color: '#333333', size: 14, align: 'left' },
        socials: { style: 'plain', color: '#1f1f1f', size: 40, align: 'left' },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#d9d9d9', color: '#2a2a2a', border: '#6b6b6b', borderWidth: 1, shadow: 'none', height: 44, size: 14, weight: 500, icon: false, arrow: 'none', width: 88, gap: 12 },
        footer: { color: '#9a9a9a' },
        deco: [
          D('blob', 92, 4, 70, { color: '#e3dfda', layer: 'back' }),
          D('blob', 4, 96, 60, { color: '#ece9e5', layer: 'back', rotate: 40 }),
          D('leaf', 92, 92, 26, { color: '#5f8a3a', color2: '#3e6324', layer: 'front', rotate: -20 }),
        ],
      },
    ),
  },
  /* 12 — floral stylist: wildflower paper, script name, outlined pills, first one filled */
  {
    id: 'bio-floral',
    name: 'Gulzor',
    data: page(
      {
        name: 'Emma Bekova',
        role: 'Stilist',
        links: [L('Men haqimda', 'qalam.ai', { bg: '#cdb6aa' }), L('Portfolio', 'behance.net'), L('Veb-sayt', 'qalam.ai'), L('Fikrlar', 'qalam.ai'), L('Aloqa', 't.me/emma')],
        socials: { whatsapp: '+998 90 123 45 67', facebook: 'emma', email: 'emma@mail.uz' },
      },
      {
        page: { bg: '#efebe5', pattern: 'paper', patternColor: '#d9cfc31a', padTop: 40 },
        order: ['avatar', 'name', 'role', 'socials', 'buttons', 'footer'],
        font: { heading: 'greatvibes', body: 'montserrat' },
        avatar: { shape: 'circle', size: 110, border: '#ffffff', borderWidth: 0, shadow: false, phBg: '#b9998a', phColor: '#ead9cf' },
        name: { color: '#4b3a33', size: 52, weight: 400 },
        role: { color: '#4b3a33', size: 13, weight: 500, upper: true, spacing: 0.1 },
        socials: { style: 'plain', color: '#4b3a33', size: 34 },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#ffffff', color: '#4b3a33', border: '#4b3a33', borderWidth: 1, shadow: 'none', height: 40, size: 14, weight: 500, upper: true, icon: false, arrow: 'none', gap: 10 },
        footer: { color: '#8a7a70' },
        deco: [
          D('flower', 12, 10, 14, { color: '#f2c7d3', color2: '#e8a64a', opacity: 0.85 }), D('flower', 86, 16, 11, { color: '#d9c8ef', color2: '#e8a64a', opacity: 0.85 }),
          D('leaf', 8, 30, 12, { color: '#a9b98f', color2: '#7f9268', rotate: 30, opacity: 0.8 }), D('leaf', 92, 46, 12, { color: '#a9b98f', color2: '#7f9268', rotate: -40, opacity: 0.8 }),
          D('flower', 90, 78, 13, { color: '#f2c7d3', color2: '#e8a64a', opacity: 0.85 }), D('flower', 10, 88, 12, { color: '#fbe3a6', color2: '#e8a64a', opacity: 0.85 }),
          D('leaf', 20, 70, 10, { color: '#a9b98f', color2: '#7f9268', rotate: 60, opacity: 0.7 }),
        ],
      },
    ),
  },

  /* 13 — highlights: white page in a pink frame, script heading, pink/teal pills, daisies */
  {
    id: 'bio-highlights',
    name: 'Davralar',
    data: page(
      {
        headline: 'Eng sara\nlavhalar…',
        links: [L('Sönggi videom', 'youtube.com'), L('Sönggi blogim', 'qalam.ai'), L('Podkastim', 'spotify.com'), L('Obuna böling', 't.me/channel'), L('Kuzatib boring', 'instagram.com')],
        name: '@meningsaytim',
      },
      {
        page: { bg: '#ffffff', frame: '#f06bb0', frameWidth: 4, padTop: 50 },
        order: ['headline', 'buttons', 'avatar', 'name', 'footer'],
        font: { heading: 'greatvibes', body: 'montserrat' },
        headline: { color: '#1f1f1f', size: 52, upper: false, lineHeight: 1, align: 'left', font: 'greatvibes' },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#f06bb0', bg2: '#8fe0e0', color: '#1f1f1f', border: '#f06bb0', borderWidth: 0, shadow: 'none', height: 50, size: 17, weight: 800, icon: false, arrow: 'none', width: 84, gap: 12 },
        avatar: { shape: 'circle', size: 110, border: '#8fe0e0', borderWidth: 5, shadow: false, backdrop: '#f06bb0', backdropSize: 1.02, phBg: '#f06bb0', phColor: '#ffd6ea' },
        name: { color: '#1f1f1f', size: 13, weight: 500 },
        footer: { color: '#9a9a9a' },
        deco: [
          D('daisy', 86, 8, 22, { color: '#efe9da', color2: '#f4c430', layer: 'front' }), D('daisy', 92, 24, 16, { color: '#efe9da', color2: '#f4c430', layer: 'front' }),
          D('daisy', 88, 42, 20, { color: '#efe9da', color2: '#f4c430', layer: 'front' }), D('daisy', 92, 60, 14, { color: '#efe9da', color2: '#f4c430', layer: 'front' }),
          D('leaf', 88, 30, 10, { color: '#7fae5c', color2: '#5a8a3a', rotate: -30 }), D('leaf', 90, 70, 10, { color: '#7fae5c', color2: '#5a8a3a', rotate: 30 }),
        ],
      },
    ),
  },

  /* 14 — sticker creator: linen page, giant blue name, lime panel, 3D blue buttons, stars & smiley */
  {
    id: 'bio-sticker',
    name: 'Stiker',
    data: page(
      {
        headline: 'Amina\nFayzullayeva',
        role: 'Illyustrator va kontent kreator',
        links: [L('Men haqimda', 'qalam.ai'), L('Portfoliom', 'behance.net'), L('Xizmatlarim', 'qalam.ai'), L('Hamkorlik qilaylik', 't.me/amina')],
        socials: { whatsapp: '+998 90 123 45 67', instagram: '@amina', email: 'amina@mail.uz', linkedin: 'amina' },
      },
      {
        page: { bg: '#ece8de', pattern: 'linen', patternColor: '#cfc8b80f', padTop: 36 },
        order: ['avatar', 'headline', 'role', 'buttons', 'socials', 'footer'],
        font: { heading: 'archivo', body: 'montserrat' },
        avatar: { shape: 'square', size: 150, border: '#a8c64a', borderWidth: 10, shadow: true, align: 'left', phBg: '#86a7d6', phColor: '#dbe7f6' },
        headline: { color: '#4a7fd0', size: 37, upper: true, lineHeight: 0.92, italic: true, border: 'transparent' },
        role: { color: '#1f1f1f', size: 14, weight: 800, upper: true },
        buttons: { shape: 'rounded', fill: 'solid', bg: '#5d93df', color: '#ffffff', border: '#1f1f1f', borderWidth: 2, shadow: 'hard', shadowColor: '#1f1f1f', height: 46, size: 15, weight: 600, icon: false, arrow: 'none', width: 86, gap: 12 },
        socials: { style: 'plain', color: '#1f1f1f', size: 38 },
        card: { on: false },
        footer: { color: '#6b6b6b' },
        deco: [
          D('smiley', 84, 12, 30, { color: '#4a7fd0', color2: '#ece8de' }), D('star4', 50, 6, 10, { color: '#a8c64a' }),
          D('star5', 8, 46, 12, { color: '#a8c64a', rotate: -15 }), D('star4', 92, 56, 9, { color: '#4a7fd0' }),
          D('star5', 90, 92, 18, { color: '#4a7fd0', rotate: 20 }), D('blob', 50, 74, 96, { color: '#a8c64a', opacity: 1 }),
        ],
      },
    ),
  },

  /* 15 — bold creative: lilac page, magenta disc behind the portrait, purple banner title */
  {
    id: 'bio-creative',
    name: 'G‘oya',
    data: page(
      {
        headline: 'Ijodiy ğoyalarni\nhayotga tadbiq qilaman',
        links: [L('Işlarimni köring', 'behance.net'), L('Hamkorlik qilaylik', 't.me/kamila'), L('Xizmatlarim', 'qalam.ai')],
        name: 'Kamila Lutfiyeva',
        socials: { tiktok: '@kamila', instagram: '@kamila' },
      },
      {
        page: { bg: '#fbf1fb', padTop: 30 },
        order: ['avatar', 'headline', 'buttons', 'name', 'socials', 'footer'],
        font: { heading: 'anton', body: 'dm' },
        avatar: { shape: 'arch', size: 170, border: '#fbf1fb', borderWidth: 0, shadow: false, backdrop: '#e55be5', backdropSize: 1.25, phBg: '#efe7ef', phColor: '#ffffff' },
        headline: { color: '#ffffff', size: 28, upper: true, lineHeight: 1.05, bg: '#7b4fe0', border: '#5532b8' },
        buttons: { shape: 'square', fill: 'outline', bg: '#7b4fe0', color: '#7b4fe0', border: '#7b4fe0', borderWidth: 2, shadow: 'none', height: 42, size: 15, weight: 500, icon: false, arrow: 'none', width: 66, gap: 14 },
        name: { color: '#e55be5', size: 26, weight: 400, upper: true, font: 'anton' },
        socials: { style: 'plain', color: '#7b4fe0', size: 34, align: 'right' },
        footer: { color: '#9b8aa8' },
        deco: [D('asterisk', 12, 10, 12, { color: '#7b4fe0' }), D('ring', 104, 88, 30, { color: '#7b4fe0', opacity: 0.9 }), D('arrowcurve', 22, 92, 40, { color: '#7b4fe0', rotate: 10 })],
      },
    ),
  },
]
