// Resume / CV model: templates, heading translations and a prefilled starting point.
import { loadProfile, uniOf } from '../profile.js'

export const CV_TEMPLATES = {
  zamonaviy: { name: 'Zamonaviy', layout: 'sidebar', accent: '#0f766e', font: 'inter' },
  klassik: { name: 'Klassik', layout: 'classic', accent: '#1f2937', font: 'serif' },
  minimal: { name: 'Minimal', layout: 'minimal', accent: '#2563eb', font: 'inter' },
  ijodiy: { name: 'Ijodiy', layout: 'creative', accent: '#7c3aed', font: 'grotesk' },
  talaba: { name: 'Talaba', layout: 'student', accent: '#0369a1', font: 'inter' },
}

export const CV_ACCENTS = ['#0f766e', '#14b8a6', '#2563eb', '#4f46e5', '#7c3aed', '#be185d', '#dc2626', '#ea580c', '#a16207', '#1f2937']

export const CV_FONTS = {
  inter: { label: 'Inter', head: "'Inter', sans-serif", body: "'Inter', sans-serif" },
  grotesk: { label: 'Grotesk', head: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif" },
  serif: { label: 'Serif', head: "'Noto Serif', Georgia, serif", body: "'Noto Serif', Georgia, serif" },
  elegant: { label: 'Elegant', head: "'Playfair Display', Georgia, serif", body: "'Inter', sans-serif" },
}

export const LABELS = {
  uz: {
    profile: 'Profil', experience: 'Iş tajribasi', education: 'Taʼlim', skills: 'Könikmalar', languages: 'Tillar',
    certificates: 'Sertifikatlar', projects: 'Loyihalar', contact: 'Aloqa', hobbies: 'Qiziqişlar', present: 'hozirgacha',
  },
  ru: {
    profile: 'О себе', experience: 'Опыт работы', education: 'Образование', skills: 'Навыки', languages: 'Языки',
    certificates: 'Сертификаты', projects: 'Проекты', contact: 'Контакты', hobbies: 'Интересы', present: 'по настоящее время',
  },
  en: {
    profile: 'Profile', experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages',
    certificates: 'Certificates', projects: 'Projects', contact: 'Contact', hobbies: 'Interests', present: 'Present',
  },
}
export const LANG_NAMES = { uz: 'Özbekça', ru: 'Русский', en: 'English' }
export const LANG_LEVELS = ['Ona tili', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']
export const NATIVE = { uz: 'Ona tili', ru: 'Родной', en: 'Native' }

export const SUMMARY_IDEAS = [
  'Natijaga yönaltirilgan mutaxassis: murakkab vazifalarni aniq rejalaştiraman, jamoa bilan samarali işlayman va yangi texnologiyalarni tez özlaştiraman.',
  'Talaba sifatida nazariy bilimlarimni amaliy loyihalarda mustahkamlaganman. Masʼuliyatli, taşabbuskor va örganişga doim tayyorman.',
  '5 yildan ortiq tajribaga ega mutaxassis. Mijozlar bilan işlaş, jarayonlarni optimallaştiriş va natijalarni ölçaş böyiça kuçli tajribam bor.',
]

let n = 0
export const rid = () => `r${Date.now().toString(36)}${(n++).toString(36)}`

/** A complete-looking first draft: the user's profile where we have it, examples elsewhere. */
export function newCv(templateId = 'zamonaviy') {
  const p = loadProfile()
  const t = CV_TEMPLATES[templateId] ?? CV_TEMPLATES.zamonaviy
  const uni = uniOf(p)
  const student = templateId === 'talaba'
  return {
    template: templateId,
    accent: t.accent,
    font: t.font,
    lang: 'uz',
    density: 'normal',
    showPhoto: true,
    photo: null,
    name: p.fullName.trim() || 'Aziza Karimova',
    role: student ? `${p.direction || 'Kompyuter injiniringi'} yönalişi talabasi` : 'Frontend dasturçi',
    summary: student ? SUMMARY_IDEAS[1] : SUMMARY_IDEAS[0],
    contacts: {
      phone: p.phone || '+998 90 123 45 67',
      email: 'aziza.karimova@mail.uz',
      city: p.city || 'Toşkent',
      telegram: '@aziza_dev',
      linkedin: 'linkedin.com/in/aziza',
      website: '',
    },
    experience: student
      ? [{ id: rid(), role: 'Amaliyotçi dasturçi', org: 'IT Park rezidenti', city: 'Toşkent', start: '2025-06', end: '2025-09', current: false, desc: 'Içki CRM tizimi uçun React komponentlari yozdim.\nAPI integratsiyasi va testlar.' }]
      : [
          { id: rid(), role: 'Frontend dasturçi', org: 'Uzum Market', city: 'Toşkent', start: '2023-03', end: '', current: true, desc: 'Tölov sahifasini qayta loyihalab, konversiyani 18% oşirdim.\nDizayn tizimi va komponentlar kutubxonasini yaratdim.' },
          { id: rid(), role: 'Junior dasturçi', org: 'EPAM Systems', city: 'Toşkent', start: '2021-09', end: '2023-02', current: false, desc: 'Xalqaro mijozlar uçun veb-ilovalar işlab çiqişda iştirok etdim.' },
        ],
    education: [
      {
        id: rid(),
        degree: p.direction ? `Bakalavr — ${p.direction}` : 'Bakalavr — Dasturiy injiniring',
        org: uni.name || 'Toşkent axborot texnologiyalari universiteti',
        start: student ? String(Number(p.year || new Date().getFullYear()) - Number(p.course || 2)) : '2017',
        end: student ? '' : '2021',
        desc: p.faculty ? `${p.faculty} fakulteti` : '',
      },
    ],
    skills: ['JavaScript', 'React', 'TypeScript', 'Figma', 'Jamoada işlaş'].map((name, i) => ({ id: rid(), name, level: 5 - (i % 3) })),
    languages: [
      { id: rid(), name: 'Özbek', level: 'Ona tili' },
      { id: rid(), name: 'Rus', level: 'C1' },
      { id: rid(), name: 'Ingliz', level: 'B2' },
    ],
    certificates: student ? [{ id: rid(), name: 'IELTS 7.0', org: 'British Council', year: '2025' }] : [{ id: rid(), name: 'Meta Front-End Developer', org: 'Coursera', year: '2022' }],
    projects: student ? [{ id: rid(), name: 'Kurs işi: Talabalar davomat tizimi', desc: 'QR-kod orqali davomat; React + Node.js', link: '' }] : [],
    hobbies: student ? 'Robototexnika, şaxmat, volontyorlik' : '',
  }
}

const MONTHS = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** "2023-03" → "mar 2023"; "2021" stays as is. */
export function fmtDate(v, lang) {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})$/.exec(v)
  return m ? `${MONTHS[lang][Number(m[2]) - 1]} ${m[1]}` : v
}

export const period = (it, lang) => {
  const a = fmtDate(it.start, lang)
  const b = it.current ? LABELS[lang].present : fmtDate(it.end, lang)
  return a && b ? `${a} — ${b}` : a || b
}
