import Link from 'next/link'
import type { ReactNode } from 'react'
import { tableHref } from '@/components/table/table-types'

/**
 * Detail dialog — ui-2.html:333 (`openModal`/`closeModal`).
 *
 * The prototype swaps innerHTML on a fixed overlay. Here the open record is carried in
 * the URL (`?m=<id>`), so the dialog body is server-rendered with real data and closing
 * is a plain link. No client state, and a modal is directly linkable.
 */
export function Modal({
  title, icon, tags, children, basePath, searchParams, closeLabel,
}: {
  title: string
  icon?: string
  tags?: ReactNode
  children: ReactNode
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
  closeLabel: string
}) {
  const closeHref = tableHref(basePath, searchParams, { m: null })
  return (
    <div className="modal-bg open">
      {/* Clicking the backdrop closes, matching the prototype's overlay behaviour. */}
      <Link href={closeHref} className="modal-backdrop-hit" aria-label={closeLabel} scroll={false} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          {icon ? <span style={{ fontSize: 20 }}>{icon}</span> : null}
          <h3>{title}</h3>
          {tags}
          <Link href={closeHref} className="x" aria-label={closeLabel} scroll={false}>✕</Link>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Reads the currently open record id from the page's search params. */
export function openModalId(searchParams: Record<string, string | string[] | undefined>): string | null {
  const v = searchParams.m
  const id = Array.isArray(v) ? v[0] : v
  return id && id.length > 0 ? id : null
}

/** Link that opens a record's dialog while preserving table state. */
export function modalHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  id: string,
): string {
  return tableHref(basePath, searchParams, { m: id })
}

/** Two-column stat grid used at the top of most dialogs. */
export function ModalStats({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="grid g4" style={{ gap: 10, marginBottom: 14 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 11 }}>
          <div className="muted">{label}</div>
          <div className="num" style={{ fontSize: 16, fontWeight: 750 }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

/** Titled panel inside a dialog, matching the prototype's inner cards. */
export function ModalPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-b" style={{ padding: 13 }}>
        <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

/** Definition row used inside ModalPanel. */
export function ModalRow({ term, children, last }: { term: string; children: ReactNode; last?: boolean }) {
  return (
    <div className="dl" style={last ? { border: 0 } : undefined}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}
