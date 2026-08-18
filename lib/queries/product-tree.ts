import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  lifecycleStages, productGroups, productIndustries, productStatuses, products,
} from '@/db/schema'
import type { Lang } from '@/lib/i18n'
import { pick } from '@/lib/i18n'

/**
 * The four-level catalogue tree — ui-2.html:3119 (`prodNodes`).
 *
 *   L1 service industry -> L2 service group -> L3 product line -> L4 listed product
 *
 * Level 3 has no table of its own: the prototype derives it by grouping products on
 * their base name, and so does this.
 */

export interface ProductRow {
  id: string
  groupCode: string
  groupName: string
  groupIcon: string
  industryCode: string
  source: 'in' | 'out'
  partnerName: string | null
  baseName: string
  variant: string
  laneCode: string | null
  siteName: string | null
  unit: string
  price: number
  cost: number
  margin: number
  indexRef: number
  capacity: number
  sold: number
  fill: number
  customers: number
  revenue: number
  net: number
  attachRate: number
  sla: number
  slaHit: number
  rating: number
  isBundle: boolean
  corridorId: number
  lifecycleCode: string
  lifecycleName: string
  lifecycleTone: string
  statusCode: string
  statusName: string
  statusTone: string
  /** Full display name, as the prototype's `p.name` getter builds it. */
  name: string
}

export interface TreeNode {
  key: string
  level: 1 | 2 | 3 | 4
  name: string
  icon: string
  source: 'in' | 'out'
  partnerName: string | null
  children: TreeNode[]
  /** Every product beneath this node, for aggregation. */
  leaves: ProductRow[]
  leaf?: ProductRow
}

export interface TreeAgg {
  count: number
  revenue: number
  net: number
  margin: number
  fill: number
  customers: number
}

/** ui-2.html:3143 — margin and fill average, revenue and customers sum. */
export function aggregate(leaves: ProductRow[]): TreeAgg {
  const n = leaves.length || 1
  return {
    count: leaves.length,
    revenue: leaves.reduce((a, x) => a + x.revenue, 0),
    net: leaves.reduce((a, x) => a + x.net, 0),
    margin: Math.round((leaves.reduce((a, x) => a + x.margin, 0) / n) * 10) / 10,
    fill: Math.round(leaves.reduce((a, x) => a + x.fill, 0) / n),
    customers: leaves.reduce((a, x) => a + x.customers, 0),
  }
}

export async function loadProducts(lang: Lang): Promise<ProductRow[]> {
  const rows = await db.select({
    id: products.id,
    groupCode: products.groupCode,
    groupVi: productGroups.nameVi,
    groupEn: productGroups.nameEn,
    groupIcon: productGroups.icon,
    industryCode: products.industryCode,
    source: products.source,
    partnerName: products.partnerName,
    baseVi: products.baseNameVi,
    baseEn: products.baseNameEn,
    variantVi: products.variantVi,
    variantEn: products.variantEn,
    laneCode: products.laneCode,
    siteVi: products.siteVi,
    siteEn: products.siteEn,
    unitVi: products.unitVi,
    unitEn: products.unitEn,
    price: products.price,
    cost: products.cost,
    margin: products.marginPct,
    indexRef: products.indexRef,
    capacity: products.capacity,
    sold: products.sold,
    fill: products.fillPct,
    customers: products.customers,
    revenue: products.revenue,
    net: products.net,
    attachRate: products.attachRate,
    sla: products.sla,
    slaHit: products.slaHit,
    rating: products.rating,
    isBundle: products.isBundle,
    corridorId: products.corridorId,
    lifecycleCode: products.lifecycleCode,
    lifeVi: lifecycleStages.nameVi,
    lifeEn: lifecycleStages.nameEn,
    statusCode: products.statusCode,
    statusVi: productStatuses.nameVi,
    statusEn: productStatuses.nameEn,
    statusTone: productStatuses.tone,
  })
    .from(products)
    .innerJoin(productGroups, eq(productGroups.code, products.groupCode))
    .innerJoin(lifecycleStages, eq(lifecycleStages.code, products.lifecycleCode))
    .innerJoin(productStatuses, eq(productStatuses.code, products.statusCode))
    .orderBy(asc(products.id))

  // Lifecycle tones follow the prototype's LIFECYCLE map (ui-2.html:3031).
  const lifeTone: Record<string, string> = { new: 'b', growth: 'u', mature: 'n', decline: 'd' }

  return rows.map((r): ProductRow => {
    const baseName = pick(lang, r.baseVi, r.baseEn)
    const variant = pick(lang, r.variantVi, r.variantEn)
    const siteName = r.siteVi ? pick(lang, r.siteVi, r.siteEn) : null
    return {
      id: r.id,
      groupCode: r.groupCode,
      groupName: pick(lang, r.groupVi, r.groupEn),
      groupIcon: r.groupIcon,
      industryCode: r.industryCode,
      source: r.source,
      partnerName: r.partnerName,
      baseName,
      variant,
      laneCode: r.laneCode,
      siteName,
      unit: pick(lang, r.unitVi, r.unitEn),
      price: Number(r.price),
      cost: Number(r.cost),
      margin: Number(r.margin),
      indexRef: Number(r.indexRef),
      capacity: r.capacity,
      sold: r.sold,
      fill: r.fill,
      customers: r.customers,
      revenue: Number(r.revenue),
      net: Number(r.net ?? 0),
      attachRate: r.attachRate,
      sla: r.sla,
      slaHit: r.slaHit,
      rating: Number(r.rating),
      isBundle: r.isBundle,
      corridorId: r.corridorId,
      lifecycleCode: r.lifecycleCode,
      lifecycleName: pick(lang, r.lifeVi, r.lifeEn),
      lifecycleTone: lifeTone[r.lifecycleCode] ?? 'n',
      statusCode: r.statusCode,
      statusName: pick(lang, r.statusVi, r.statusEn),
      statusTone: r.statusTone,
      name: `${baseName}${r.laneCode ? ` ${r.laneCode}` : siteName ? ` ${siteName}` : ''} · ${variant}`,
    }
  })
}

/** Builds the tree, filtered by supply source ('*' | 'in' | 'out'). */
export async function buildTree(lang: Lang, sourceFilter: string): Promise<{
  nodes: TreeNode[]
  all: ProductRow[]
}> {
  const [all, industries, groups] = await Promise.all([
    loadProducts(lang),
    db.select().from(productIndustries).orderBy(asc(productIndustries.ord)),
    db.select().from(productGroups).orderBy(asc(productGroups.ord)),
  ])

  const pool = sourceFilter === '*' || !sourceFilter
    ? all
    : all.filter((p) => p.source === sourceFilter)

  const nodes: TreeNode[] = []
  for (const ind of industries) {
    const indGroups = groups.filter((g) => g.industryCode === ind.code)
    const n1: TreeNode = {
      key: `L1|${ind.code}`,
      level: 1,
      name: pick(lang, ind.nameVi, ind.nameEn),
      icon: ind.icon,
      source: ind.source,
      partnerName: null,
      children: [],
      leaves: [],
    }

    for (const g of indGroups) {
      const groupProducts = pool.filter((p) => p.groupCode === g.code)
      if (groupProducts.length === 0) continue

      const n2: TreeNode = {
        key: `L2|${g.code}`,
        level: 2,
        name: pick(lang, g.nameVi, g.nameEn),
        icon: g.icon,
        source: g.source,
        partnerName: null,
        children: [],
        leaves: groupProducts,
      }

      // Level 3 is the product line: products sharing a base name.
      const lines = new Map<string, TreeNode>()
      for (const p of groupProducts) {
        let line = lines.get(p.baseName)
        if (!line) {
          line = {
            key: `L3|${g.code}|${p.baseName}`,
            level: 3,
            name: p.baseName,
            icon: g.icon,
            source: p.source,
            partnerName: p.partnerName,
            children: [],
            leaves: [],
          }
          lines.set(p.baseName, line)
          n2.children.push(line)
        }
        line.leaves.push(p)
        line.children.push({
          key: `L4|${p.id}`,
          level: 4,
          name: `${p.variant}${p.laneCode ? `  ·  ${p.laneCode}` : p.siteName ? `  ·  ${p.siteName}` : ''}`,
          icon: g.icon,
          source: p.source,
          partnerName: p.partnerName,
          children: [],
          leaves: [p],
          leaf: p,
        })
      }

      n1.children.push(n2)
      n1.leaves = n1.leaves.concat(groupProducts)
    }

    if (n1.children.length) nodes.push(n1)
  }

  return { nodes, all }
}

/** Depth-first lookup by node key — ui-2.html:3149 (`trFind`). */
export function findNode(key: string, nodes: TreeNode[]): TreeNode | null {
  for (const n of nodes) {
    if (n.key === key) return n
    const hit = findNode(key, n.children)
    if (hit) return hit
  }
  return null
}

/** Keys to open for "expand to level N" — ui-2.html `trAll`. */
export function keysToDepth(nodes: TreeNode[], depth: number, acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.level < depth) {
      acc.push(n.key)
      keysToDepth(n.children, depth, acc)
    }
  }
  return acc
}
