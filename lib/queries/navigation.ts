import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  amlAlerts, fleetAssets, members, navGroups, navItems, personas, rfqs,
} from '@/db/schema'
import type { Lang } from '@/lib/i18n'
import { pick } from '@/lib/i18n'

export interface NavItemView {
  route: string
  icon: string
  label: string
  moduleCode: string | null
  isAi: boolean
  isNew: boolean
  badge: number | null
}

export interface NavGroupView {
  name: string
  items: NavItemView[]
}

export interface PersonaView {
  code: string
  icon: string
  name: string
  org: string
  initials: string
  homeRoute: string
}

export async function listPersonas(lang: Lang): Promise<PersonaView[]> {
  const rows = await db.select().from(personas).orderBy(asc(personas.ord))
  return rows.map((p) => ({
    code: p.code,
    icon: p.icon,
    name: pick(lang, p.nameVi, p.nameEn),
    org: pick(lang, p.orgVi, p.orgEn),
    initials: p.initials,
    homeRoute: p.homeRoute,
  }))
}

/**
 * The five badge counts the sidebar renders (ui-2.html:495/512/514/525/526).
 * Each is a single indexed query; they run together on every navigation.
 */
export async function badgeCounts(): Promise<Record<string, number>> {
  const count = sql<number>`count(*)::int`
  const [rfqClosing, rfqOpen, fleetAttention, kybPending, amlHigh] = await Promise.all([
    db.select({ count }).from(rfqs)
      .where(and(eq(rfqs.statusCode, 'open'), sql`${rfqs.closesInDays} <= 3`)),
    db.select({ count }).from(rfqs).where(eq(rfqs.statusCode, 'open')),
    db.select({ count }).from(fleetAssets)
      .where(or(lt(fleetAssets.certDays, 45), lt(fleetAssets.maintDueDays, 21))),
    db.select({ count }).from(members).where(sql`${members.kybStatusCode} <> 'done'`),
    db.select({ count }).from(amlAlerts)
      .where(and(eq(amlAlerts.severityCode, 'high'), inArray(amlAlerts.statusCode, ['open', 'review']))),
  ])
  return {
    rfq_closing: rfqClosing[0]?.count ?? 0,
    rfq_open: rfqOpen[0]?.count ?? 0,
    fleet_attention: fleetAttention[0]?.count ?? 0,
    kyb_pending: kybPending[0]?.count ?? 0,
    aml_high: amlHigh[0]?.count ?? 0,
  }
}

/** Sidebar for one persona, assembled from the DB rather than hardcoded. */
export async function navigationFor(personaCode: string, lang: Lang): Promise<NavGroupView[]> {
  const [rows, badges] = await Promise.all([
    db
      .select({
        groupId: navGroups.id,
        groupOrd: navGroups.ord,
        groupVi: navGroups.nameVi,
        groupEn: navGroups.nameEn,
        itemOrd: navItems.ord,
        route: navItems.route,
        icon: navItems.icon,
        labelVi: navItems.labelVi,
        labelEn: navItems.labelEn,
        moduleCode: navItems.moduleCode,
        isAi: navItems.isAi,
        isNew: navItems.isNew,
        badgeKey: navItems.badgeKey,
      })
      .from(navGroups)
      .innerJoin(navItems, eq(navItems.groupId, navGroups.id))
      .where(eq(navGroups.personaCode, personaCode))
      .orderBy(asc(navGroups.ord), asc(navItems.ord)),
    badgeCounts(),
  ])

  const groups = new Map<number, NavGroupView>()
  for (const r of rows) {
    if (!groups.has(r.groupId)) {
      groups.set(r.groupId, { name: pick(lang, r.groupVi, r.groupEn), items: [] })
    }
    groups.get(r.groupId)!.items.push({
      route: r.route,
      icon: r.icon,
      label: pick(lang, r.labelVi, r.labelEn),
      moduleCode: r.moduleCode,
      isAi: r.isAi,
      isNew: r.isNew,
      badge: r.badgeKey ? badges[r.badgeKey] ?? null : null,
    })
  }
  return [...groups.values()]
}
