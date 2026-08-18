import Link from 'next/link'
import { Meter } from '@/components/ui'
import { modalHref } from '@/components/modal'
import { tableHref } from '@/components/table/table-types'
import { num, t, type Lang } from '@/lib/i18n'
import { aggregate, type TreeNode } from '@/lib/queries/product-tree'

/** ui-2.html:3157 — the IN-HOUSE / PARTNER chip. */
export function SourceTag({ source, lang }: { source: 'in' | 'out'; lang: Lang }) {
  return (
    <span className={`tr-src ${source}`}>
      {source === 'out' ? t(lang, 'LIÊN KẾT', 'PARTNER') : t(lang, 'NỘI BỘ', 'IN-HOUSE')}
    </span>
  )
}

/** Margin colour follows the prototype: partner rows are always gold. */
function marginColor(source: 'in' | 'out', margin: number): string {
  if (source === 'out') return 'var(--gold-500)'
  return margin > 32 ? 'var(--up)' : margin > 20 ? 'var(--brand-500)' : 'var(--gold-500)'
}

/**
 * Renders the visible rows of the tree — ui-2.html:3158 (`trRows`).
 *
 * Expansion and selection live in the URL (`tr.open`, `tr.sel`), so every row is a
 * link and the whole tree stays server-rendered. Level-4 rows open the product dialog.
 */
export function ProductTreeRows({
  nodes, open, selected, lang, basePath, searchParams,
}: {
  nodes: TreeNode[]
  open: Set<string>
  selected: string | null
  lang: Lang
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const rows: React.ReactNode[] = []

  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      const agg = aggregate(node.leaves)
      const isLeaf = node.level === 4
      const isOpen = open.has(node.key)
      const isOn = selected === node.key

      // Toggling a branch rewrites `tr.open`; selecting also sets `tr.sel`.
      const nextOpen = new Set(open)
      if (isOpen) nextOpen.delete(node.key)
      else nextOpen.add(node.key)

      const href = isLeaf
        ? modalHref(basePath, searchParams, node.leaf!.id)
        : tableHref(basePath, searchParams, {
          'tr.open': [...nextOpen].join('~') || null,
          'tr.sel': node.key,
        })

      rows.push(
        <Link
          key={node.key}
          href={href}
          scroll={false}
          className={`tr-r l${node.level}${isOn ? ' on' : ''}`}
        >
          <div className="tr-nw" style={{ paddingLeft: (node.level - 1) * 17 }}>
            <span className="tr-tw">{isLeaf ? '·' : isOpen ? '▾' : '▸'}</span>
            {isLeaf ? null : <span className="ic">{node.icon}</span>}
            <span className="nm">{node.name}</span>
            {node.level <= 2 ? <SourceTag source={node.source} lang={lang} /> : null}
            {node.partnerName && node.level === 3
              ? <span className="tr-src out">{node.partnerName.toUpperCase()}</span>
              : null}
            {isLeaf && node.leaf!.statusCode !== 'live'
              ? <span className={`tag ${node.leaf!.statusTone}`}>{node.leaf!.statusName}</span>
              : null}
          </div>
          <div className="c num">
            {isLeaf
              ? <><span className="muted">$</span>{num(node.leaf!.price)}</>
              : <><b>{agg.count}</b> <span className="muted">SP</span></>}
          </div>
          <div className="c num hid">{num(agg.customers)}</div>
          <div className="c num" style={node.level <= 2 ? { fontWeight: 700 } : undefined}>
            ${num(agg.revenue)}K
          </div>
          <div className="c hid">
            <div className="meter" style={{ justifyContent: 'flex-end' }}>
              <Meter value={Math.round(agg.margin)} color={marginColor(node.source, agg.margin)} width={52} />
            </div>
          </div>
          <div className="c num hid">{agg.fill}%</div>
        </Link>,
      )

      if (isOpen && node.children.length) walk(node.children)
    }
  }

  walk(nodes)
  return <>{rows}</>
}
