import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  carriers, corridors, equipmentTypes, lanes, productGroups, statusLabels,
} from '@/db/schema'
import { pick, type Lang } from '@/lib/i18n'

/**
 * Reference data every list page needs for its filter dropdowns and label rendering.
 * Loaded once per request rather than joined into each row.
 */

export type LabelMap = Map<string, { label: string; tone: string }>

export async function statusLabelMap(lang: Lang): Promise<LabelMap> {
  const rows = await db.select().from(statusLabels)
  return new Map(rows.map((r) => [r.code, { label: pick(lang, r.nameVi, r.nameEn), tone: r.tone }]))
}

export async function laneOptions(): Promise<Array<[string, string]>> {
  const rows = await db.select({ code: lanes.code }).from(lanes).orderBy(asc(lanes.ord))
  return rows.map((r) => [r.code, r.code])
}

export async function carrierOptions(): Promise<Array<[string, string]>> {
  const rows = await db.select({ code: carriers.code, name: carriers.name })
    .from(carriers).orderBy(asc(carriers.ord))
  return rows.map((r) => [r.code, r.name])
}

export async function corridorOptions(lang: Lang): Promise<Array<[string, string]>> {
  const rows = await db.select().from(corridors).orderBy(asc(corridors.id))
  return rows.map((r) => [String(r.id), pick(lang, r.nameVi, r.nameEn)])
}

export async function equipmentOptions(): Promise<Array<[string, string]>> {
  const rows = await db.select({ code: equipmentTypes.code })
    .from(equipmentTypes).orderBy(asc(equipmentTypes.ord))
  return rows.map((r) => [r.code, r.code])
}

export async function productGroupOptions(lang: Lang): Promise<Array<[string, string]>> {
  const rows = await db.select().from(productGroups).orderBy(asc(productGroups.ord))
  return rows.map((r) => [r.code, pick(lang, r.nameVi, r.nameEn)])
}

/** Filter options built from a set of status codes, labelled from the dictionary. */
export function statusOptions(labels: LabelMap, codes: string[]): Array<[string, string]> {
  return codes.map((c) => [c, labels.get(c)?.label ?? c])
}
