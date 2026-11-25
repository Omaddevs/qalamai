// Documents (referat, kurs işi …) written by the AI into the structure the app builds itself.
// prepareDoc marks every piece still to be written — the grey "✎" hints, empty table cells, a sample
// list that follows a hint — and describes it for the AI; fillPiece puts the AI's text in its place.
// The title page and the table of contents are never touched.

const HEAD = /^H[1-3]$/
const SKIP = '.titul, .toc'
const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const hintText = (el) => text(el).replace(/^✎\s*/, '')
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const parse = (html) => new DOMParser().parseFromString(`<div id="qai">${html}</div>`, 'text/html').getElementById('qai')

/** A list right after a hint that holds sample items (not hints of its own). */
const sampleList = (el) => {
  const next = el.nextElementSibling
  return next && /^(OL|UL)$/.test(next.tagName) && !next.querySelector('.hint') ? next : null
}

/** The column heading over a table cell, if the table has one. */
function columnOf(td) {
  const table = td.closest('table')
  const idx = [...td.parentElement.children].indexOf(td)
  const head = table?.querySelector('thead tr')
  return text(head?.children[idx]) || ''
}

/**
 * Marks what the AI should write. Returns the marked pages and the task list for /ai/fill.
 * @param {string[]} pages
 */
export function prepareDoc(pages) {
  const tasks = []
  let heading = ''
  const add = (el, page, task) => {
    const id = tasks.length
    el.setAttribute('data-ai', String(id))
    tasks.push({ id, page, h: heading.slice(0, 200), ...task })
  }
  const marked = pages.map((html, page) => {
    const root = parse(html)
    for (const el of root.querySelectorAll('*')) {
      if (el.closest(SKIP)) continue
      if (HEAD.test(el.tagName)) {
        heading = text(el)
        continue
      }
      if (el.matches('p.hint')) {
        const list = sampleList(el)
        if (list) {
          list.setAttribute('data-ai-list', String(tasks.length))
          add(el, page, { t: 'list', hint: hintText(el).slice(0, 600), items: [...list.children].map(text).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 300)) })
        } else add(el, page, { t: 'p', hint: hintText(el).slice(0, 600) })
        continue
      }
      if (el.matches('span.hint') && !el.closest('p.hint')) {
        const td = el.closest('td')
        if (td) {
          add(el, page, { t: 'cell', row: text(td.parentElement.firstElementChild).slice(0, 160), col: columnOf(td).slice(0, 120), hint: hintText(el) === '…' ? '' : hintText(el).slice(0, 600) })
        } else {
          const lead = text(el.parentElement?.querySelector(':scope > b'))
          add(el, page, { t: 'inline', hint: hintText(el).slice(0, 600), ...(lead ? { lead: lead.slice(0, 120) } : {}) })
        }
        continue
      }
      // a lesson plan's activity cells hold sample sentences: rewritten for this lesson
      if (el.tagName === 'TD' && el.closest('table.plan tbody') && text(el) && !el.querySelector('b')) {
        const idx = [...el.parentElement.children].indexOf(el)
        if (idx >= 2 && idx < el.parentElement.children.length - 1) {
          add(el, page, { t: 'cell', row: text(el.parentElement.children[1]).slice(0, 160), col: columnOf(el).slice(0, 120), hint: `rewrite for this lesson (2–3 sentences); sample: ${text(el)}`.slice(0, 600) })
          continue
        }
      }
      // an empty cell in a table body (numbers and names of business plans, lesson plans …)
      if (el.tagName === 'TD' && !text(el) && !el.children.length && el.closest('tbody')) {
        add(el, page, { t: 'cell', row: text(el.parentElement.firstElementChild).slice(0, 160), col: columnOf(el).slice(0, 120) })
      }
    }
    return root.innerHTML
  })
  return { pages: marked, tasks }
}

/** Puts one AI piece ({ id, p | items | text }) into the marked pages; returns the new pages array. */
export function fillPiece(pages, task, piece) {
  const root = parse(pages[task.page])
  const el = root.querySelector(`[data-ai="${task.id}"]`)
  if (!el) return pages
  if (piece.items) {
    const list = root.querySelector(`[data-ai-list="${task.id}"]`)
    if (list) {
      list.innerHTML = piece.items.map((x) => `<li>${esc(x)}</li>`).join('')
      list.removeAttribute('data-ai-list')
      el.remove()
    } else el.outerHTML = `<ul>${piece.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
  } else if (piece.p) {
    el.outerHTML = piece.p.map((x) => `<p>${esc(x)}</p>`).join('')
  } else if (piece.text != null) {
    if (el.tagName === 'TD') el.textContent = piece.text
    else el.replaceWith(root.ownerDocument.createTextNode(piece.text))
  }
  const next = [...pages]
  next[task.page] = root.innerHTML
  return next
}

/** The finished pages: marks removed (pieces the AI didn't write keep their grey hint). */
export const cleanPages = (pages) => pages.map((html) => html.replace(/\sdata-ai(?:-list)?="\d+"/g, ''))

/** The headings of the document, for the progress screen. */
export const docHeadings = (pages) =>
  pages.flatMap((html) => [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())).filter(Boolean)
