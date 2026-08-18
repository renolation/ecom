'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

/** Search box — debounced, writes `${id}.q` into the URL and resets to page 0. */
export function TableSearch({ id, placeholder, initial }: { id: string; placeholder: string; initial: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = useState(initial)
  const [, startTransition] = useTransition()

  // Keep in sync when navigation changes the query from elsewhere (e.g. a filter).
  useEffect(() => { setValue(initial) }, [initial])

  useEffect(() => {
    if (value === initial) return
    const timer = setTimeout(() => {
      const sp = new URLSearchParams(params.toString())
      if (value) sp.set(`${id}.q`, value)
      else sp.delete(`${id}.q`)
      sp.delete(`${id}.page`)
      startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(timer)
  }, [value, initial, id, params, pathname, router])

  return (
    <input
      className="inp"
      style={{ width: 'auto', minWidth: 170, height: 29, marginLeft: 'auto' }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}

/** Filter dropdown — writes `${id}.f.${filterKey}` and resets to page 0. */
export function TableFilter({
  id, filterKey, label, options, value, allLabel,
}: {
  id: string
  filterKey: string
  label: string
  options: Array<[string, string]>
  value: string
  allLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  return (
    <select
      className="inp"
      style={{ width: 'auto', height: 29, fontSize: 12 }}
      value={value || '*'}
      onChange={(e) => {
        const sp = new URLSearchParams(params.toString())
        const next = e.target.value
        if (next === '*') sp.delete(`${id}.f.${filterKey}`)
        else sp.set(`${id}.f.${filterKey}`, next)
        sp.delete(`${id}.page`)
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
      }}
    >
      <option value="*">{label}: {allLabel}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}
