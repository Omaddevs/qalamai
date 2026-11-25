// What every "Nima yaratamiz?" type produces. Structures follow common Uzbek academic and
// business practice (referat/kurs ishi guides, school lesson-plan samples, business-plan
// guides) — see the note on each blueprint. Every builder is pure and cheap, so the hero can
// re-run it on each keystroke for the live preview and the result is exactly what gets created.
//
//   format 'slides' | 'card' → { slides }                     → slide editor
//   format 'doc'             → { name, pages: [html], estPages } → Fayl muharriri (A4)
//
// Every text comes from src/i18n/msg/bp.js, so a document is generated in the interface language
// (titul, headings, hints, examples; ministry/city/phone/currency follow that language's country).
// There is no AI backend yet: documents carry the full structure, topic-aware opening lines and
// grey "✎" hints telling the author what to write where.
import { authorLine, uniOf } from './profile.js'
import { getLang, t } from './i18n/index.js'

/* ───────────── helpers ───────────── */

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const line = (n = 14) => '_'.repeat(n)
const year = () => new Date().getFullYear()
/** Uzbek number words ("ikki bölim") — only the Uzbek texts spell numbers out. */
const NUM_UZ = ['nol', 'bir', 'ikki', 'uç', 'tört', 'beş', 'olti', 'yetti', 'sakkiz', 'töqqiz', 'ön']
const numWord = (n) => (getLang().startsWith('uz') ? NUM_UZ[n] ?? String(n) : String(n))
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  ky: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  tg: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
  'uz-cyrl': ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
}
const monthName = (i) => (MONTHS[getLang()] ?? MONTHS.uz)[i]

/** Text from src/i18n/msg/bp.js. */
const L = (key, vars) => t(`bp.${key}`, vars)
/** "|"-separated list from src/i18n/msg/bp.js. */
const LL = (key, vars) => L(key, vars).split('|')
const country = () => L('localExp')
const cur = () => L('cur')

const h1 = (s) => `<h1>${s}</h1>`
const h2 = (s) => `<h2>${s}</h2>`
const p = (s) => `<p>${s}</p>`
const lead = (b, s = '') => `<p><b>${b}</b> ${s}</p>`
const hint = (s) => `<p class="hint">✎ ${s}</p>`
const ihint = (s) => `<span class="hint">✎ ${s}</span>`
const ul = (xs) => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`
const ol = (xs) => `<ol>${xs.map((x) => `<li>${x}</li>`).join('')}</ol>`
const table = (head, rows, cls = '') =>
  `<table${cls ? ` class="${cls}"` : ''}>${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`

const title = (s, subtitle) => ({ type: 'title', title: s, subtitle, elements: [] })
const content = (s, bullets) => ({ type: 'content', title: s, bullets, elements: [] })
/** content() from a "Title|bullet|bullet…" list. */
const contentL = (key, vars) => {
  const [head, ...bullets] = LL(key, vars)
  return content(head, bullets)
}

/** Academic title page: ministry → university → faculty · type · topic · author · city–year. */
function titul(type, topic, pr, role) {
  const u = uniOf(pr)
  const has = (k) => String(pr[k] ?? '').trim()
  const fac = L('t.faculty', { name: has('faculty') ? esc(pr.faculty.trim()) : line(16) })
  const dir = has('direction') ? `<p class="t-fac">${L('t.direction', { name: esc(pr.direction.trim()) })}</p>` : ''
  const subj = has('subject') ? `<p class="t-subj">${L('t.subject', { name: esc(pr.subject.trim()) })}</p>` : ''
  const who = L('t.student', { course: esc(pr.course || '__'), group: has('group') ? esc(pr.group.trim()) : '____' })
  return `<div class="titul">
<div class="t-top"><p>${L('ministry')}</p><p>${
    u.name.trim() ? esc(u.name.trim().toUpperCase()) : line(34)
  }</p><p class="t-fac">${fac}</p>${dir}</div>
<div class="t-mid"><p class="t-type">${type}</p>${subj}<p class="t-topic">${L('t.topic', { topic: esc(cap(topic)) })}</p></div>
<div class="t-who"><p><b>${L('t.done')}</b> ${who}<br>${has('fullName') ? esc(pr.fullName.trim()) : line(20)}</p><p><b>${role}:</b><br>${
    has('supervisor') ? esc(pr.supervisor.trim()) : line(20)
  }</p></div>
<p class="t-city">${esc(has('city') ? pr.city.trim() : L('city'))} — ${esc(pr.year || year())}</p>
</div>`
}

/** Table of contents with estimated page numbers. rows: [label, page, level] */
const toc = (rows) =>
  `<table class="toc"><tbody>${rows
    .map(([label, page, level]) => `<tr><td${level === 2 ? ' class="l2"' : ''}>${level === 2 ? label : `<b>${label}</b>`}</td><td class="pg">${page}</td></tr>`)
    .join('')}</tbody></table>`

const refSamples = (normKey) => [L(normKey), ...LL('refSamples', { year: year() })]

/* ───────────── Prezentatsiya ─────────────
 * Title → agenda (7+ slides) → why it matters → one idea per slide → takeaways → Q&A.
 * (10/20/30 guidance, "one idea per slide", agenda of 4–6 items, closing call to action.) */
const MAIN_COUNT = 15

function presentation(topic, { count }, pr) {
  const agenda = count >= 7
  const n = Math.min(MAIN_COUNT, Math.max(1, count - 4 - (agenda ? 1 : 0)))
  const main = Array.from({ length: n }, (_, i) => LL(`p.main.${i}`, { country: country() }))
  const slides = [title(cap(topic), authorLine(pr) ?? L('p.subtitle', { year: year() }))]
  if (agenda) slides.push(content(L('p.agenda'), [L('intro'), ...main.slice(0, 3).map(([h]) => h), L('conclusion')]))
  slides.push(contentL('p.why'))
  main.forEach(([h, ...b]) => slides.push(content(h, b)))
  slides.push(contentL('p.summary'))
  const [thanks, questions] = LL('p.thanks')
  slides.push(title(thanks, questions))
  return { slides }
}

/* ───────────── AI taqdimot sahifasi (reja + slayd soni) ─────────────
 * Title → plan (the N plan items) → each plan item gets its share of the content slides →
 * conclusion → thanks. So the smallest deck for N plan items is N + 4 slides. */
export const PLAN_FIXED = 4
export const PLAN_MAX = 15

/** Content slides per plan item, e.g. 4 plan items in 10 slides → [2, 2, 1, 1]. */
export function planSplit(plans, slides) {
  const content = Math.max(plans, slides - PLAN_FIXED)
  return Array.from({ length: plans }, (_, i) => Math.floor(content / plans) + (i < content % plans ? 1 : 0))
}

export function planDeck(topic, { plans, slides: count }, pr) {
  const pool = Array.from({ length: PLAN_MAX }, (_, i) => LL(`p.main.${i}`, { country: country() }))
  const heads = pool.slice(0, plans)
  const out = [title(cap(topic), authorLine(pr) ?? L('p.subtitle', { year: year() })), content(L('p.agenda'), heads.map(([h]) => h))]
  // extra slides of a plan item borrow the pool items that are not plan items themselves
  let spare = plans
  planSplit(plans, count).forEach((n, i) => {
    const [h, ...b] = heads[i]
    out.push(content(`${i + 1}. ${h}`, b))
    for (let k = 1; k < n; k++) {
      const [eh, ...eb] = pool[spare++ % PLAN_MAX]
      out.push(content(eh, eb))
    }
  })
  out.push(contentL('p.summary'))
  const [thanks, questions] = LL('p.thanks')
  out.push(title(thanks, questions))
  return { slides: out }
}

/* ───────────── Hisobot ─────────────
 * Executive summary → KPIs (plan vs fact) → analysis → risks → next-period targets → actions. */
export const PERIODS = ['Oylik', 'Çoraklik', 'Yillik']
const periodLabel = (id) => L(`r.period.${id}`)

function report(topic, { count, period }) {
  const d = new Date()
  const y = year()
  const when =
    period === 'Oylik'
      ? L('r.whenMonth', { year: y, month: monthName(d.getMonth()) })
      : period === 'Yillik'
        ? L('year', { y })
        : L('r.whenQuarter', { year: y, q: ROMAN[Math.floor(d.getMonth() / 3) + 1] })
  const next = L(`r.next.${PERIODS.includes(period) ? period : 'Çoraklik'}`)
  // most important first, then restore the logical order
  const pick = [0, 1, 4, 5, 2, 3, 6, 7, 8, 9].slice(0, Math.max(2, count - 2)).sort((a, b) => a - b)
  return {
    slides: [
      title(cap(topic), L('r.sub', { period: periodLabel(period), when })),
      ...pick.map((i) => contentL(`r.pool.${i}`, { next })),
      contentL('r.final'),
    ],
  }
}

/* ───────────── Portfolio ─────────────
 * Cover → about → skills → best work as case studies (problem → process → result) → proof → contact. */
function portfolio(topic, { count }, pr) {
  const name = String(pr.fullName ?? '').trim()
  const slides = [
    title(cap(topic), name ? L('pf.sub', { name, year: year() }) : L('pf.subNo', { year: year() })),
    contentL('pf.about'),
    contentL('pf.skills'),
  ]
  for (let i = 1; i <= count; i++) slides.push(contentL('pf.project', { n: i }))
  slides.push(
    contentL('pf.exp'),
    contentL('pf.reviews'),
    title(L('pf.contact'), [String(pr.phone ?? '').trim() || L('phone'), 'Telegram', 'e-mail'].join(' · ')),
  )
  return { slides }
}

/* ───────────── Taklifnoma ─────────────
 * Two-sided card: front (names + occasion) and the invitation text with date, time, venue, RSVP.
 * Keys are stable ids stored in options; texts come from bp.ev* in the dictionary. */
const EVENT_KEYS = {
  'Nikoh töyi': ['wedding', 'family'],
  'Fotiha töyi': ['fotiha', 'family'],
  'Beşik töyi': ['beshik', 'family'],
  'Sunnat töyi': ['sunnat', 'family'],
  'Tuğilgan kun': ['birthday', ''],
  Yubiley: ['jubilee', 'family'],
  'Bitiruv keçasi': ['graduation', 'grads'],
  'Korporativ tadbir': ['corporate', 'org'],
}
export const EVENTS = Object.keys(EVENT_KEYS)
const eventLabel = (id) => L(`ev.${(EVENT_KEYS[id] ?? EVENT_KEYS['Nikoh töyi'])[0]}`)

function invitation(topic, { event }, pr) {
  const id = EVENT_KEYS[event] ? event : 'Nikoh töyi'
  const [key, hostKey] = EVENT_KEYS[id]
  const host = hostKey ? L(`evHost.${hostKey}`) : ''
  return {
    slides: [
      title(cap(topic), `${eventLabel(id)} · ${year()}`),
      content(L('inv.dear'), [
        L(`evText.${key}`),
        L('inv.date'),
        L('inv.place'),
        L('inv.regards', { host }).replace(/\s+/g, ' ').trim(),
        L('inv.rsvp', { phone: String(pr.phone ?? '').trim() || L('phone') }),
      ]),
    ],
  }
}

/* ───────────── Referat ─────────────
 * Titul → Reja → Kirish (dolzarblik, maqsad, vazifalar, tuzilish) → 2–4 boʻlim → Xulosa →
 * Foydalanilgan adabiyotlar. A4, Times New Roman 14, 1.5 interval. */
function referat(topic, { count }, pr) {
  const T = esc(cap(topic))
  const n = count <= 6 ? 2 : count <= 12 ? 3 : 4
  const all = [0, 1, 2, 3].map((i) => LL(`ref.sec.${i}`, { T, country: country() }))
  const [altTitle, altTip] = LL('ref.sec2alt', { T })
  const sections = n === 2 ? [all[0], [altTitle, all[2][1], altTip]] : all.slice(0, n)
  const per = Math.max(1, Math.round((count - 5) / n))
  const pages = [
    titul(L('t.referat'), topic, pr, L('t.accepted')),
    h1(L('H.plan')) + ol([L('intro'), ...sections.map(([s]) => s), L('conclusion'), L('refs')]),
    h1(L('H.intro')) +
      lead(L('relevance'), L('relevanceText', { T })) +
      hint(L('ref.relHint')) +
      lead(L('ref.goal'), L('ref.goalText', { T })) +
      lead(L('ref.tasksLead')) +
      ul(LL('ref.tasks')) +
      lead(L('ref.structLead'), L('ref.struct', { n, nw: numWord(n) })),
    sections.map(([s, first, tip], i) => h2(`${i + 1}. ${s}`) + p(first) + hint(`${tip} ${L('volume', { n: per })}`)).join(''),
    h1(L('H.concl')) +
      p(L('ref.conclText', { T })) +
      ol(sections.map((_, i) => ihint(L('ref.conclItem', { i: i + 1 })))) +
      hint(L('ref.conclHint')),
    h1(L('H.refs')) + hint(L('ref.refsHint')) + ol(refSamples('ref.normDoc')),
  ]
  return { name: L('ref.name', { topic: cap(topic) }), pages, estPages: count }
}

/* ───────────── Kurs ishi ─────────────
 * Titul → Mundarija (bet raqamlari bilan) → Kirish (dolzarblik, oʻrganilganlik darajasi, maqsad,
 * vazifalar, obyekt, predmet, metodlar, ahamiyat, tuzilish) → 2–3 bob × 2 paragraf (+ bob xulosasi)
 * → Xulosa va takliflar → Adabiyotlar (15+, alifbo tartibida) → Ilovalar. */
function kursIshi(topic, { count, chapters }, pr) {
  const T = esc(cap(topic))
  const C = chapters
  const v = { T, country: country() }
  const para = (k) => LL(`ki.p.${k}`, v)
  const plan =
    C === 3
      ? [
          [L('ki.ch.theory', v), [para('concepts'), para('study')]],
          [L('ki.ch.state', v), [para('current'), para('problems')]],
          [L('ki.ch.improve', v), [para('foreign'), para('proposals')]],
        ]
      : [
          [L('ki.ch.theoryMeth', v), [para('concepts'), para('study')]],
          [L('ki.ch.practice', v), [para('current2'), para('foreign2')]],
        ]

  // page plan: titul 1, contents 2, introduction from 3; tail = conclusion 2 + references 2 pages
  const intro = count >= 30 ? 3 : 2
  const body = Math.max(C * 4, count - 2 - intro - 4)
  const perPara = body / (C * 2)
  const chapterTitle = (c, s) => L('ki.chapter', { r: ROMAN[c + 1], t: s })
  const rows = [[L('H.intro'), 3, 1]]
  let pg = 3 + intro
  plan.forEach(([s, paras], c) => {
    rows.push([chapterTitle(c, s), Math.round(pg), 1])
    paras.forEach(([pt], i) => {
      rows.push([`${c + 1}.${i + 1}. ${pt}`, Math.round(pg), 2])
      pg += perPara
    })
  })
  pg = Math.round(pg)
  rows.push([L('H.conclProp'), pg, 1], [L('H.refsList'), pg + 2, 1], [L('H.appx'), pg + 4, 1])

  const [t1, t2, t3] = LL('ki.tasks')
  const tasks = [t1, t2, ...(C === 3 ? [L('ki.taskForeign')] : []), t3]

  const pages = [
    titul(L('t.kurs'), topic, pr, L('t.supervisor')),
    h1(L('H.toc')) + toc(rows),
    h1(L('H.intro')) +
      lead(L('relevance'), L('relevanceText', { T })) +
      hint(L('ki.relHint')) +
      lead(L('ki.studied'), ihint(L('ki.studiedHint'))) +
      lead(L('ki.goal'), L('ki.goalText', { T })) +
      lead(L('ki.tasksLead')) +
      ul(tasks) +
      lead(L('ki.object'), ihint(L('ki.objectHint'))) +
      lead(L('ki.subject'), ihint(L('ki.subjectHint'))) +
      lead(L('ki.methods'), L('ki.methodsText')) +
      lead(L('ki.value'), ihint(L('ki.valueHint'))) +
      lead(L('ki.structLead'), L('ki.struct', { n: C, nw: numWord(C), count })),
    ...plan.map(
      ([s, paras], c) =>
        h1(chapterTitle(c, s)) +
        paras.map(([pt, first, tip], i) => h2(`${c + 1}.${i + 1}. ${pt}`) + p(first) + hint(`${tip} ${L('volume', { n: Math.max(2, Math.round(perPara)) })}`)).join('') +
        lead(L('ki.chapterSum', { r: ROMAN[c + 1] }), ihint(L('ki.chapterSumHint'))),
    ),
    h1(L('H.conclProp')) +
      p(L('ki.conclText', { T })) +
      ol(plan.map((_, c) => ihint(L('ki.conclItem', { r: ROMAN[c + 1] })))) +
      lead(L('ki.props')) +
      ul(LL('ki.propItems').map(ihint)) +
      h1(L('H.refsList')) +
      hint(L('ki.refsHint')) +
      ol(refSamples('ki.normDoc')) +
      h1(L('H.appx')) +
      hint(L('ki.appxHint')),
  ]
  return { name: L('ki.name', { topic: cap(topic) }), pages, estPages: count }
}

/* ───────────── Dars ishlanma ─────────────
 * Header (fan, sinf, mavzu, oʻqituvchi) → maqsad: taʼlimiy · tarbiyaviy · rivojlantiruvchi →
 * kompetensiyalar → dars turi, metodlar, jihozlar → texnologik xarita (bosqich, faoliyat, daqiqa)
 * → uyga vazifa, baholash. 45 daqiqa: 5 + 10 + 15 + 10 + 5. */
const STAGES = {
  45: [5, 10, 15, 10, 5],
  80: [5, 15, 30, 20, 10],
}
const gradeLabel = (v) => (v === 'OTM' ? L('d.uni') : L('d.gradeN', { n: v }))

function darsIshlanma(topic, { grade, minutes }, pr) {
  const T = esc(cap(topic))
  const otm = grade === 'OTM'
  const who = otm ? L('d.studentUni') : L('d.student')
  const whom = otm ? L('d.studentsUni') : L('d.students')
  const m = STAGES[minutes] ?? STAGES[45]
  const teacher = String(pr.fullName ?? '').trim()
  const steps = [0, 1, 2, 3, 4].map((i) => LL(`d.step.${i}`, { T, whom }))
  const pages = [
    h1(L('d.title')) +
      table(null, [
        [`<b>${L('d.subject')}</b>`, ihint(L('d.subjectHint'))],
        [`<b>${L('d.grade')}</b>`, otm ? L('d.uniCourse') : gradeLabel(grade)],
        [`<b>${L('d.topic')}</b>`, `«${T}»`],
        [`<b>${L('d.teacher')}</b>`, teacher ? esc(teacher) : line(20)],
        [`<b>${L('d.date')}</b>`, `__.__.${year()}`],
        [`<b>${L('d.duration')}</b>`, L('d.minutes', { n: minutes })],
      ], 'info') +
      h2(L('d.goals')) +
      lead(L('d.goalEdu'), L('d.goalEduText', { whom, T })) +
      lead(L('d.goalUp'), L('d.goalUpText', { whom })) +
      lead(L('d.goalDev'), L('d.goalDevText')) +
      h2(L('d.comp')) +
      lead(L('d.compCore'), L('d.compCoreText')) +
      lead(L('d.compSubj'), ihint(L('d.compSubjHint'))) +
      lead(L('d.type'), L('d.typeText')) +
      lead(L('d.methods'), L('d.methodsText')) +
      lead(L('d.equip'), L('d.equipText')),
    h2(L('d.flow')) +
      table(['№', L('d.colStage'), L('d.colTeacher'), L('d.colStudent', { who }), L('d.colTime')], steps.map(([s, a, b], i) => [i + 1, `<b>${s}</b>`, a, b, `${m[i]}&nbsp;${L('d.min')}`]), 'plan') +
      lead(L('d.homework'), ihint(L('d.homeworkHint'))) +
      lead(L('d.criteria')) +
      ul(LL('d.criteriaItems')) +
      p(`<b>${L('d.teacher')}:</b> ${teacher ? esc(teacher) : line(20)} ${line(10)} ${L('d.sign')}`),
  ]
  return { name: L('d.name', { topic: cap(topic) }), pages, estPages: 2 }
}

/* ───────────── Biznes reja ─────────────
 * Rezyume → mahsulot va biznes modeli → bozor va raqobat (SWOT) → mijozlar → marketing va sotuv →
 * operatsion reja → xodimlar → moliyaviy reja (investitsiya + N yillik prognoz, ehtiyotkor
 * ssenariy) → xatarlar → yoʻl xaritasi. */
function biznesReja(topic, { years }, pr) {
  const T = esc(cap(topic))
  const has = (k) => String(pr[k] ?? '').trim()
  const y0 = year()
  const SECTIONS = LL('b.sections')
  const cols = Array.from({ length: years }, (_, i) => L('year', { y: y0 + i }))
  const money = (label) => [label, ...cols.map(() => '')]
  const sec = (i, html) => h2(`${i + 1}. ${SECTIONS[i]}`) + html
  const total = `<b>${L('b.total')}</b>`
  const [sw1, sw2, sw3, sw4] = LL('b.swotHead')
  const [inv1, inv2, inv3, inv4, inv5] = LL('b.investRows')
  const [fRev, fCost, fTax, fNet] = LL('b.forecastRows')
  const road = LL('b.road')
  const month = (m) => L('b.month', { m })
  const pages = [
    `<div class="titul biz">
<div class="t-top"><p>${has('company') ? esc(pr.company.trim()) : L('b.company', { name: line(14) })}</p></div>
<div class="t-mid"><p class="t-type">${L('b.title')}</p><p class="t-topic">${L('b.project', { T })}</p></div>
<div class="t-who"><p><b>${L('b.founder')}</b><br>${has('fullName') ? esc(pr.fullName.trim()) : line(20)}</p><p><b>${L('b.contact')}</b> ${
      has('phone') ? esc(pr.phone.trim()) : L('phone')
    }</p><p><b>${L('b.horizon')}</b> ${L('b.years', { n: years })}</p></div>
<p class="t-city">${esc(has('city') ? pr.city.trim() : L('city'))} — ${y0}</p>
</div>`,
    h1(L('H.toc')) + ol(SECTIONS),
    sec(
      0,
      p(L('b.summaryText', { T })) +
        table(null, [
          [`<b>${L('b.essence')}</b>`, ihint(L('b.sentences'))],
          [`<b>${L('b.funds')}</b>`, `${line(10)} ${cur()}`],
          [`<b>${L('b.source')}</b>`, L('b.sourceText')],
          [`<b>${L('b.payback')}</b>`, L('b.months')],
          [`<b>${L('b.jobs')}</b>`, L('b.count')],
        ], 'info') +
        hint(L('b.summaryHint')),
    ) +
      sec(1, ul(LL('b.product').map(ihint))),
    sec(
      2,
      ul(LL('b.market').map(ihint)) +
        lead(L('b.swot')) +
        table([sw1, sw2], [[ihint('…'), ihint('…')]], 'swot') +
        table([sw3, sw4], [[ihint('…'), ihint('…')]], 'swot'),
    ) +
      sec(3, ul(LL('b.customers').map(ihint))) +
      sec(4, ul(LL('b.marketing', { blank: line(8), cur: cur() }).map(ihint))) +
      sec(5, ul(LL('b.ops').map(ihint))),
    sec(6, table(LL('b.staffHead', { cur: cur() }), [[L('b.manager'), '1', '', ''], ['', '', '', ''], ['', '', '', ''], [total, '', '', '']])) +
      sec(
        7,
        lead(L('b.invest')) +
          table(LL('b.investHead', { cur: cur() }), [[inv1, ''], [inv2, ''], [inv3, ''], [inv4, ''], [inv5, ''], [total, '']]) +
          lead(L('b.forecast')) +
          table([L('b.indicator'), ...cols], [money(fRev), money(fCost), money(fTax), money(`<b>${fNet}</b>`)]) +
          hint(L('b.forecastHint')),
      ) +
      sec(8, table(LL('b.riskHead'), LL('b.risks').map((r) => [r, '', '', '']))) +
      sec(
        9,
        table(LL('b.roadHead'), [
          [road[0], month(1), ''],
          [road[1], month('1–2'), ''],
          [road[2], month(2), ''],
          [road[3], month(3), ''],
          [road[4], month('4–12'), ''],
        ]),
      ),
  ]
  return { name: L('b.name', { topic: cap(topic) }), pages, estPages: 10 }
}

/* ───────────── registry (keyed by CREATE ids) ─────────────
 * Display texts are getters so they follow the interface language. */

const stepper = (key, options, unitKey) => ({ key, kind: 'stepper', options, get unit() { return L(`unit.${unitKey}`) } })
const choice = (key, options, format = (v) => v) => ({ key, kind: 'choice', options, format })
/** Adds label / placeholder / examples getters (spreading would freeze them in one language). */
const withTexts = (bp, prefix, label = 'topicLabel') =>
  Object.defineProperties(bp, {
    label: { get: () => L(label), enumerable: true },
    placeholder: { get: () => L(`${prefix}.ph`), enumerable: true },
    examples: { get: () => LL(`${prefix}.ex`), enumerable: true },
  })

export const BLUEPRINTS = {
  Prezentatsiya: withTexts(
    {
      format: 'slides',
      controls: [stepper('count', [5, 6, 8, 10, 12, 15, 20], 'slide')],
      defaults: { count: 10 },
      outline: (o) => L('ui.presentation.outline', { agenda: o.count >= 7 ? L('ui.agendaArrow') : '', n: Math.max(1, o.count - 4 - (o.count >= 7 ? 1 : 0)) }),
      build: presentation,
    },
    'ui.presentation',
  ),
  Referat: withTexts(
    {
      format: 'doc',
      controls: [stepper('count', [5, 8, 10, 12, 15, 20], 'page')],
      defaults: { count: 10 },
      outline: (o) => L('ui.referat.outline', { n: o.count <= 6 ? 2 : o.count <= 12 ? 3 : 4 }),
      meta: (o) => L('ui.referat.meta', { n: o.count }),
      build: referat,
    },
    'ui.referat',
  ),
  'Kurs işi': withTexts(
    {
      format: 'doc',
      controls: [stepper('count', [20, 25, 30, 35, 40], 'page'), choice('chapters', [2, 3], (v) => L('ui.kurs.chapters', { n: v }))],
      defaults: { count: 30, chapters: 2 },
      outline: (o) => L('ui.kurs.outline', { ch: L('ui.kurs.chapters', { n: o.chapters }) }),
      meta: (o) => `A4 · ${L('ui.kurs.chapters', { n: o.chapters })} · ${L('pages', { n: o.count })}`,
      build: kursIshi,
    },
    'ui.kurs',
  ),
  'Dars işlanma': withTexts(
    {
      format: 'doc',
      controls: [
        choice('grade', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'OTM'], gradeLabel),
        choice('minutes', [45, 80], (v) => L('d.minutes', { n: v })),
      ],
      defaults: { grade: '5', minutes: 45 },
      outline: () => L('ui.dars.outline'),
      meta: (o) => L('ui.dars.meta', { grade: gradeLabel(o.grade), minutes: L('d.minutes', { n: o.minutes }) }),
      build: darsIshlanma,
    },
    'ui.dars', 'ui.dars.label',
  ),
  'Biznes reja': withTexts(
    {
      format: 'doc',
      controls: [choice('years', [1, 3, 5], (v) => L('b.yearsForecast', { n: v }))],
      defaults: { years: 3 },
      outline: () => L('ui.biz.outline'),
      meta: (o) => L('ui.biz.meta', { f: L('b.yearsForecast', { n: o.years }) }),
      build: biznesReja,
    },
    'ui.biz', 'ui.biz.label',
  ),
  Hisobot: withTexts(
    {
      format: 'slides',
      controls: [stepper('count', [6, 8, 10, 12], 'slide'), choice('period', PERIODS, periodLabel)],
      defaults: { count: 8, period: 'Çoraklik' },
      outline: () => L('ui.report.outline'),
      build: report,
    },
    'ui.report', 'ui.report.label',
  ),
  Taklifnoma: withTexts(
    {
      format: 'card',
      controls: [choice('event', EVENTS, eventLabel)],
      defaults: { event: 'Nikoh töyi' },
      outline: () => L('ui.invite.outline'),
      build: invitation,
    },
    'ui.invite', 'ui.invite.label',
  ),
  Portfolio: withTexts(
    {
      format: 'slides',
      controls: [stepper('count', [2, 3, 4, 5, 6, 8], 'project')],
      defaults: { count: 4 },
      outline: (o) => L('ui.portfolio.outline', { n: o.count }),
      build: portfolio,
    },
    'ui.portfolio', 'ui.portfolio.label',
  ),
}

export const blueprintOf = (id) => BLUEPRINTS[id] ?? BLUEPRINTS.Prezentatsiya

/** Page break used between document pages (editor shows a divider; print/Word start a new page). */
export const PAGE_BREAK = '<hr class="pb">'
export const docHtml = (pages) => pages.join(PAGE_BREAK)
