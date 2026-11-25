// A small, forgiving XML reader for Office files (DOMParser doesn't exist in web workers).
// Elements keep their qualified name ("a:t"), attributes and children; text is decoded.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m),
  )

class El {
  constructor(name, attrs, parent) {
    this.name = name
    this.attrs = attrs
    this.parent = parent
    this.children = []
    this.text = ''
  }

  /** First direct child named `name` (or any of several names, "a|b"). */
  child(name) {
    if (!name.includes('|')) return this.children.find((c) => c.name === name) ?? null
    const names = name.split('|')
    return this.children.find((c) => names.includes(c.name)) ?? null
  }

  all(name) {
    return this.children.filter((c) => c.name === name)
  }

  /** Follow a path of direct children: el.at('p:spPr', 'a:xfrm', 'a:off'). */
  at(...path) {
    let el = this
    for (const p of path) {
      el = el?.child(p)
      if (!el) return null
    }
    return el
  }

  /** Every descendant named `name`, in document order. */
  find(name, out = []) {
    for (const c of this.children) {
      if (c.name === name) out.push(c)
      c.find(name, out)
    }
    return out
  }

  attr(name, fallback = null) {
    return this.attrs[name] ?? fallback
  }

  num(name, fallback = null) {
    const v = this.attrs[name]
    return v == null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v)
  }
}

export function parseXml(src) {
  const root = new El('#root', {}, null)
  let cur = root
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|([^<]+)/g
  let m
  while ((m = re.exec(src))) {
    if (m[2]) {
      if (m[1]) {
        // closing tag: climb to the matching element (tolerates mismatches)
        let el = cur
        while (el !== root && el.name !== m[2]) el = el.parent
        if (el !== root) cur = el.parent
        continue
      }
      const attrs = {}
      for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3])
      const el = new El(m[2], attrs, cur)
      cur.children.push(el)
      if (!m[4]) cur = el
    } else if (m[5] != null) cur.text += m[5]
    else if (m[6] != null) cur.text += decode(m[6])
  }
  return root.children.find((c) => c instanceof El) ?? root
}
