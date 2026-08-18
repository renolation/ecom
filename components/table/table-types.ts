import type { ReactNode } from 'react'

/**
 * Mirrors the prototype's `dataTable()` contract (ui-2.html:1024) — search, filter,
 * sort, paginate — but the state lives in the URL so the table renders on the server.
 */
export interface Column<T> {
  /** Stable key; also the sort key when `sortValue` is supplied. */
  key: string
  header: string
  /** 'r' right-aligns, 'c' centres — same classes as the prototype's table CSS. */
  cls?: 'r' | 'c'
  width?: string
  render: (row: T, index: number) => ReactNode
  /** Supplying this makes the column sortable. */
  sortValue?: (row: T) => string | number
}

export interface Filter<T> {
  key: string
  label: string
  options: Array<[value: string, label: string]>
  match: (row: T, value: string) => boolean
}

export interface TableState {
  q: string
  sort: string | null
  dir: 1 | -1
  page: number
  filters: Record<string, string>
}

/** Reads one table's state out of the page's search params. */
export function readTableState(
  id: string,
  searchParams: Record<string, string | string[] | undefined>,
): TableState {
  const get = (suffix: string): string => {
    const v = searchParams[`${id}.${suffix}`]
    return Array.isArray(v) ? v[0] ?? '' : v ?? ''
  }
  const filters: Record<string, string> = {}
  const prefix = `${id}.f.`
  for (const [k, v] of Object.entries(searchParams)) {
    if (k.startsWith(prefix)) filters[k.slice(prefix.length)] = Array.isArray(v) ? v[0] ?? '' : v ?? ''
  }
  const page = Number.parseInt(get('page'), 10)
  return {
    q: get('q'),
    sort: get('sort') || null,
    dir: get('dir') === '-1' ? -1 : 1,
    page: Number.isFinite(page) && page > 0 ? page : 0,
    filters,
  }
}

/** Applies filter → search → sort → paginate, in the prototype's order. */
export function applyTableState<T>(
  rows: T[],
  state: TableState,
  cfg: { columns: Column<T>[]; filters?: Filter<T>[]; search?: (row: T) => string; pageSize: number },
): { page: T[]; total: number; pages: number; pageIndex: number; from: number } {
  let out = rows

  for (const f of cfg.filters ?? []) {
    const v = state.filters[f.key]
    if (!v || v === '*') continue
    out = out.filter((r) => f.match(r, v))
  }

  if (state.q && cfg.search) {
    const q = state.q.toLowerCase()
    out = out.filter((r) => cfg.search!(r).toLowerCase().includes(q))
  }

  if (state.sort) {
    const col = cfg.columns.find((c) => c.key === state.sort)
    if (col?.sortValue) {
      out = [...out].sort((a, b) => {
        const x = col.sortValue!(a)
        const y = col.sortValue!(b)
        if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * state.dir
        return (Number(x) - Number(y)) * state.dir
      })
    }
  }

  const total = out.length
  const pages = Math.max(1, Math.ceil(total / cfg.pageSize))
  const pageIndex = Math.min(state.page, pages - 1)
  const from = pageIndex * cfg.pageSize
  return { page: out.slice(from, from + cfg.pageSize), total, pages, pageIndex, from }
}

/** Builds a URL preserving every other param — used by sort headers and the pager. */
export function tableHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  changes: Record<string, string | null>,
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    const val = Array.isArray(v) ? v[0] : v
    if (val !== undefined && val !== '') sp.set(k, val)
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k)
    else sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
