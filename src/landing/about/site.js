// Public site content (news, team, partners) from /api/v1/site, with a short in-memory cache so moving
// between the "Haqimizda" pages doesn't refetch what was just shown.
import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../../api.js'
import { getLang } from '../../i18n/index.js'
import { pickText } from '../../../shared/siteContent.js'

const TTL = 60_000
const cache = new Map()

export async function siteGet(path) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL) return hit.data
  const res = await fetch(apiUrl(`/api/v1/site${path}`), { headers: { 'x-lang': getLang() } })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? 'HTTP')
    err.status = res.status
    throw err
  }
  cache.set(path, { data: body, at: Date.now() })
  return body
}

/** { data, error, reload } for one path; data stays null until it loads. */
export function useSite(path) {
  const [state, setState] = useState(() => {
    const hit = cache.get(path)
    return { data: hit?.data ?? null, error: null }
  })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    siteGet(path).then(
      (data) => live && setState({ data, error: null }),
      (error) => live && setState((s) => ({ data: s.data, error })),
    )
    return () => {
      live = false
    }
  }, [path, tick])
  const reload = useCallback(() => {
    cache.delete(path)
    setState((s) => ({ ...s, error: null }))
    setTick((x) => x + 1)
  }, [path])
  return { ...state, reload }
}

/** Texts of an item in the interface language (with the same fallbacks as the UI). */
export const textOf = (item) => pickText(item?.i18n, getLang())
