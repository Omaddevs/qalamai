// The AI deck's slide checks (deck.js) and picture fallbacks (service.js): pure functions, no model calls.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { SYSTEM, cleanSlide, localize } from '../src/modules/ai/deck.js'
import { withoutPicture } from '../src/modules/ai/service.js'
import { CHART_KINDS, SLIDE_ICONS } from '../../shared/slideIcons.js'

describe('cleanSlide: professional layouts', () => {
  test('the prompt offers every layout type, icon and chart kind', () => {
    for (const type of ['statement', 'bignum', 'summary', 'kpi', 'timeline', 'roadmap', 'swot', 'matrix', 'pyramid', 'funnel', 'table', 'problem', 'features', 'chart', 'photo', 'chapter']) {
      assert.ok(SYSTEM.includes(`"type":"${type}"`), type)
    }
    assert.ok(SYSTEM.includes(SLIDE_ICONS.join(', ')))
    for (const k of CHART_KINDS) assert.ok(SYSTEM.includes(`"${k}"`), k)
  })

  test('kpi keeps an optional change only where given', () => {
    const s = cleanSlide({ type: 'kpi', title: 'K', kpis: [{ label: 'Revenue', value: '$2M', delta: '+5%' }, { label: 'Users', value: '10k' }] })
    assert.deepEqual(s.kpis, [{ label: 'Revenue', value: '$2M', delta: '+5%' }, { label: 'Users', value: '10k' }])
  })

  test('a chart without numbers is not drawn as a chart', () => {
    assert.equal(cleanSlide({ type: 'chart', kind: 'line', title: 'T', bars: [{ label: 'a', value: 'many' }, { label: 'b', value: '3' }] }).type, 'content')
    const ok = cleanSlide({ type: 'chart', kind: 'nope', title: 'T', bars: [{ label: 'a', value: '1' }, { label: 'b', value: '3' }] })
    assert.equal(ok.type, 'chart')
    assert.equal(ok.kind, 'bar')
  })

  test('table rows are fitted to the header', () => {
    const s = cleanSlide({ type: 'table', title: 'T', head: ['a', 'b', 'c'], rows: [['1', '2'], ['3', '4', '5', '6'], 'junk'], hi: 7 })
    assert.deepEqual(s.rows, [['1', '2', '—'], ['3', '4', '5']])
    assert.equal(s.hi, undefined)
  })

  test('swot needs all four quadrants', () => {
    assert.equal(cleanSlide({ type: 'swot', title: 'S', quads: [{ title: 'S', items: ['a'] }, { title: 'W', items: ['b'] }, { title: 'O', items: ['c'] }] }).type, 'content')
    const q = (t) => ({ title: t, items: ['x'] })
    assert.equal(cleanSlide({ type: 'swot', title: 'S', quads: [q('S'), q('W'), q('O'), q('T')] }).type, 'swot')
  })

  test('features: unknown icons get one no other card uses', () => {
    const s = cleanSlide({ type: 'features', title: 'F', image: { q: 'tablet app' }, features: [{ icon: 'shield', title: 'a', text: 'b' }, { icon: '??', title: 'c', text: 'd' }, { title: 'e', text: 'f' }] })
    const icons = s.features.map((f) => f.icon)
    assert.equal(icons[0], 'shield')
    assert.equal(new Set(icons).size, 3)
    assert.ok(icons.every((i) => SLIDE_ICONS.includes(i)))
    assert.equal(s._img.q, 'tablet app')
  })

  test('chapter moves the plan number to the numeral', () => {
    const s = cleanSlide({ type: 'chapter', title: '2. Sabablar', text: 'x' })
    assert.equal(s.title, 'Sabablar')
    assert.equal(s.num, 2)
  })

  test('the Uzbek alphabet leaves ids alone', () => {
    const s = localize('uz')({ type: 'features', title: 'Çiziq', features: [{ icon: 'shield', title: "Sho'r choy" }], kind: 'line' })
    assert.equal(s.features[0].icon, 'shield')
    assert.equal(s.kind, 'line')
    assert.equal(s.features[0].title, 'Şör çoy')
  })
})

describe('withoutPicture', () => {
  test('picture pages fall back to layouts without a frame', () => {
    assert.equal(withoutPicture({ type: 'photo', title: 'T', text: 'x' }).type, 'statement')
    assert.deepEqual(withoutPicture({ type: 'chapter', title: 'T', text: 'x', num: 3 }), { type: 'section', title: 'T', subtitle: 'x', num: 3 })
    assert.deepEqual(withoutPicture({ type: 'features', title: 'T', features: [{ icon: 'gear', title: 'a', text: 'b' }] }).cards, [{ title: 'a', text: 'b' }])
    assert.deepEqual(withoutPicture({ type: 'media', title: 'T', text: 'A. B.', bullets: ['c'] }).bullets, ['A.', 'B.', 'c'])
  })
})
