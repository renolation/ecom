import Link from 'next/link'
import type { ReactNode } from 'react'
import { num, t, type Lang } from '@/lib/i18n'
import { TableFilter, TableSearch } from './table-controls'
import {
  applyTableState, readTableState, tableHref,
  type Column, type Filter,
} from './table-types'

/**
 * Server-rendered table with search, filter, sort and pagination.
 * State is carried in the URL (`${id}.q`, `${id}.sort`, `${id}.dir`, `${id}.page`,
 * `${id}.f.${key}`), so a link is enough to change it and no data ships to the client.
 */
export function DataTable<T>({
  id, title, rows, columns, filters, search, pageSize = 14, lang,
  basePath, searchParams, actions, searchPlaceholder, empty, rowHref,
}: {
  id: string
  title: string
  rows: T[]
  columns: Column<T>[]
  filters?: Filter<T>[]
  search?: (row: T) => string
  pageSize?: number
  lang: Lang
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
  actions?: ReactNode
  searchPlaceholder?: string
  empty?: string
  /** When set, the whole row links to this href — the prototype's `onRow`. */
  rowHref?: (row: T) => string
}) {
  const state = readTableState(id, searchParams)
  const { page, total, pages, pageIndex, from } = applyTableState(rows, state, {
    columns, filters, search, pageSize,
  })

  const pagerStart = Math.max(0, Math.min(pageIndex - 2, pages - 5))
  const pagerEnd = Math.min(pagerStart + 5, pages)

  return (
    <div className="card">
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ flex: 'none' }}>{title}</h3>
        <span className="tag n">{num(total)} {t(lang, 'bản ghi', 'records')}</span>
        {filters?.map((f) => (
          <TableFilter
            key={f.key}
            id={id}
            filterKey={f.key}
            label={f.label}
            options={f.options}
            value={state.filters[f.key] ?? '*'}
            allLabel={t(lang, 'tất cả', 'all')}
          />
        ))}
        {search ? (
          <TableSearch
            id={id}
            initial={state.q}
            placeholder={searchPlaceholder ?? t(lang, 'Tìm kiếm…', 'Search…')}
          />
        ) : null}
        {actions}
      </div>

      <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = Boolean(c.sortValue)
                const active = state.sort === c.key
                const header = (
                  <>
                    {c.header}
                    {sortable ? (
                      <span style={{ opacity: active ? 1 : 0.28, marginLeft: 3 }}>
                        {active ? (state.dir > 0 ? '▲' : '▼') : '⇅'}
                      </span>
                    ) : null}
                  </>
                )
                return (
                  <th key={c.key} className={c.cls} style={{ width: c.width }}>
                    {sortable ? (
                      <Link
                        href={tableHref(basePath, searchParams, {
                          [`${id}.sort`]: c.key,
                          [`${id}.dir`]: active && state.dir === 1 ? '-1' : '1',
                          [`${id}.page`]: null,
                        })}
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        scroll={false}
                      >
                        {header}
                      </Link>
                    ) : header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {page.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 26, color: 'var(--text-3)' }}>
                  {empty ?? t(lang, 'Không có bản ghi phù hợp', 'No matching records')}
                </td>
              </tr>
            ) : page.map((row, i) => {
              const href = rowHref?.(row)
              return (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={from + i} className={href ? 'row-link' : undefined}>
                  {columns.map((c, ci) => (
                    <td key={c.key} className={c.cls}>
                      {/* One overlay link per row: it sits in the first cell and covers
                          the row, so the whole row is clickable without nesting anchors. */}
                      {href && ci === 0 ? (
                        <Link href={href} className="row-link-hit" aria-label={t(lang, 'Mở chi tiết', 'Open details')} scroll={false} />
                      ) : null}
                      {c.render(row, from + i)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card-f between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span>
          {total
            ? <>{t(lang, 'Hiển thị', 'Showing')} <b>{num(from + 1)}–{num(Math.min(from + pageSize, total))}</b> / {num(total)}</>
            : t(lang, 'Không có bản ghi', 'No records')}
        </span>
        <div className="flex" style={{ gap: 4 }}>
          <PagerLink
            disabled={pageIndex === 0}
            href={tableHref(basePath, searchParams, { [`${id}.page`]: String(pageIndex - 1) })}
          >‹</PagerLink>
          {Array.from({ length: pagerEnd - pagerStart }, (_, k) => pagerStart + k).map((p) => (
            <Link
              key={p}
              className={`btn xs ${p === pageIndex ? 'p' : ''}`}
              href={tableHref(basePath, searchParams, { [`${id}.page`]: String(p) })}
              scroll={false}
            >{p + 1}</Link>
          ))}
          {pages > pagerEnd ? <span className="muted">… {pages}</span> : null}
          <PagerLink
            disabled={pageIndex >= pages - 1}
            href={tableHref(basePath, searchParams, { [`${id}.page`]: String(pageIndex + 1) })}
          >›</PagerLink>
        </div>
      </div>
    </div>
  )
}

function PagerLink({ disabled, href, children }: { disabled: boolean; href: string; children: ReactNode }) {
  if (disabled) return <span className="btn xs" style={{ opacity: 0.4, pointerEvents: 'none' }}>{children}</span>
  return <Link className="btn xs" href={href} scroll={false}>{children}</Link>
}
