'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { NEED_KEYS, type MarketCriteria } from './market-criteria'

/**
 * Search form for s_market — ui-2.html:1397 (`MK` state) and 1459 (the form markup).
 *
 * The prototype keeps this in a module-level object and re-renders on every change.
 * Here the criteria live in the URL so results stay server-rendered and a search is
 * shareable; only the controls themselves need to be client-side.
 */

export function MarketSearchForm({
  criteria, origins, destinations, equipment, commodities, services, labels,
}: {
  criteria: MarketCriteria
  origins: Array<[string, string]>
  destinations: string[]
  equipment: string[]
  commodities: Array<[string, string]>
  services: string[]
  labels: Record<string, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const push = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const field = (key: string, label: string, node: React.ReactNode) => (
    <div className="fld" key={key}>
      <label>{label}</label>
      {node}
    </div>
  )

  const select = (key: string, value: string, options: Array<[string, string]>) => (
    <select className="inp" value={value} onChange={(e) => push({ [key]: e.target.value })}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-b">
        <div className="mk-grid">
          {field('o', labels.origin, select('mk.o', criteria.origin, origins))}
          {field('d', labels.dest, select('mk.d', criteria.dest, destinations.map((d) => [d, d])))}
          {field('eq', labels.equipment, select('mk.eq', criteria.equipment, equipment.map((e) => [e, e])))}
          {field('qty', labels.qty, (
            <input className="inp num" type="number" min={1} value={criteria.qty}
              onChange={(e) => push({ 'mk.qty': e.target.value })} />
          ))}
          {field('wt', labels.weight, (
            <input className="inp num" type="number" step="0.1" value={criteria.weight}
              onChange={(e) => push({ 'mk.wt': e.target.value })} />
          ))}
          {field('comm', labels.commodity, select('mk.comm', criteria.commodity, commodities))}
          {field('svc', labels.service, select('mk.svc', criteria.service,
            [['*', labels.any], ...services.map((s) => [s, s] as [string, string])]))}
        </div>

        <div className="mk-grid mk-grid-2">
          {field('ready', labels.ready, (
            <input className="inp" type="date" value={criteria.ready}
              onChange={(e) => push({ 'mk.ready': e.target.value })} />
          ))}
          {field('arr', labels.arriveBy, (
            <input className="inp" type="date" value={criteria.arriveBy}
              onChange={(e) => push({ 'mk.arr': e.target.value })} />
          ))}
          {field('inco', labels.incoterm, select('mk.inco', criteria.incoterm,
            ['FOB', 'CIF', 'EXW', 'DAP', 'DDP'].map((i) => [i, i])))}
          <div className="mk-actions">
            <button type="button" className="btn"
              onClick={() => {
                const sp = new URLSearchParams(params.toString())
                for (const k of [...sp.keys()]) if (k.startsWith('mk.')) sp.delete(k)
                router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
              }}>
              {labels.clear}
            </button>
            <button type="button" className="btn p" onClick={() => push({ 'mk.run': '1' })}>
              🔍 {labels.search}
            </button>
          </div>
        </div>

        <div className="mk-needs">
          <span className="muted" style={{ fontWeight: 700 }}>{labels.needs}</span>
          {NEED_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`btn xs ${criteria.needs[k] ? 'p' : ''}`}
              onClick={() => push({ [`mk.n.${k}`]: criteria.needs[k] ? null : '1' })}
            >
              {labels[`need_${k}`]}
            </button>
          ))}
          <span className="muted" style={{ marginLeft: 'auto' }}>{labels.needHint}</span>
        </div>
      </div>
    </div>
  )
}

/** Quick-start lane buttons shown in the empty state (ui-2.html:1502). */
export function LaneShortcut({
  origin, dest, label,
}: {
  origin: string; dest: string; label: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <button type="button" className="btn sm" onClick={() => {
      const sp = new URLSearchParams(params.toString())
      sp.set('mk.o', origin)
      sp.set('mk.d', dest)
      sp.set('mk.run', '1')
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    }}>{label}</button>
  )
}
