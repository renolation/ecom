import { sql } from 'drizzle-orm'
import {
  boolean, char, check, date, index, integer, numeric, pgTable, smallint, text,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { gradeLetter, insuranceCover, memberTier, supplySource } from './enums'
import { carriers, corridors, lanes, statusLabels } from './reference-core'
import {
  assetTypes, fleetStatuses, lifecycleStages, ownershipTypes, productGroups, productIndustries,
  productStatuses,
} from './reference-governance'
import { memberTypes, sectors } from './reference-lookups'

/**
 * ui-2.html:709 — 128 member organisations (shippers, forwarders, carriers, ports,
 * banks, tech providers). Money columns are million VND, matching the `tr` suffix
 * the prototype renders (ui-2.html:3324/3348/3752).
 */
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  typeCode: text('type_code').notNull().references(() => memberTypes.code, { onDelete: 'restrict' }),
  sectorId: smallint('sector_id').notNull().references(() => sectors.id, { onDelete: 'restrict' }),
  countryCode: char('country_code', { length: 2 }).notNull(),
  rating: text('rating').notNull(),
  score: smallint('score').notNull(),
  creditLimitMVnd: numeric('credit_limit_m_vnd', { precision: 16, scale: 2 }).notNull(),
  utilisationPct: smallint('utilisation_pct').notNull(),
  teu: integer('teu').notNull(),
  gmvMVnd: numeric('gmv_m_vnd', { precision: 16, scale: 2 }).notNull(),
  kybStatusCode: text('kyb_status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  riskLevelCode: text('risk_level_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  complianceStatusCode: text('compliance_status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  tier: memberTier('tier').notNull(),
  joinedOn: date('joined_on').notNull(),
  waitDays: smallint('wait_days').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  active30d: boolean('active_30d').notNull(),
  repeat90d: boolean('repeat_90d').notNull(),
  ...timestamps,
}, (t) => [
  index('members_kyb_idx').on(t.kybStatusCode),
  index('members_type_idx').on(t.typeCode),
  index('members_corridor_idx').on(t.corridorId),
  check('members_score_range', sql`${t.score} BETWEEN 0 AND 100`),
  check('members_util_range', sql`${t.utilisationPct} BETWEEN 0 AND 100`),
])

/**
 * ui-2.html:2774 — 100 transport assets across 8 classes.
 * Ships carry flag/class/IMO/CII; land equipment does not.
 * opex / revenue / asset_value are billion VND, as the prototype renders them.
 */
export const fleetAssets = pgTable('fleet_assets', {
  id: text('id').primaryKey(),
  assetTypeCode: text('asset_type_code').notNull().references(() => assetTypes.code, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  isShip: boolean('is_ship').notNull(),
  capacity: integer('capacity').notNull(),
  capacityUnit: text('capacity_unit').notNull(),
  builtYear: smallint('built_year').notNull(),
  age: smallint('age').generatedAlwaysAs(sql`2026 - built_year`),
  flag: text('flag').notNull(),
  classSociety: text('class_society').notNull(),
  statusCode: text('status_code').notNull().references(() => fleetStatuses.code, { onDelete: 'restrict' }),
  ownershipCode: text('ownership_code').notNull().references(() => ownershipTypes.code, { onDelete: 'restrict' }),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  utilisationPct: smallint('utilisation_pct').notNull(),
  position: text('position').notNull(),
  speedKnots: numeric('speed_knots', { precision: 5, scale: 1 }).notNull(),
  fuel: numeric('fuel', { precision: 7, scale: 1 }).notNull(),
  co2: integer('co2').notNull(),
  ciiGrade: text('cii_grade').notNull(),
  insuranceType: insuranceCover('insurance_type').notNull(),
  certDays: smallint('cert_days').notNull(),
  maintOn: date('maint_on').notNull(),
  maintDueDays: smallint('maint_due_days').notNull(),
  opex: numeric('opex', { precision: 12, scale: 2 }).notNull(),
  revenue: numeric('revenue', { precision: 12, scale: 2 }).notNull(),
  assetValue: numeric('asset_value', { precision: 12, scale: 2 }).notNull(),
  isFinanced: boolean('is_financed').notNull(),
  dscr: numeric('dscr', { precision: 5, scale: 2 }).notNull(),
  crew: smallint('crew').notNull(),
  imo: text('imo').notNull(),
  ...timestamps,
}, (t) => [
  // Nav badge 3: certificates expiring <45d OR maintenance due <21d.
  index('fleet_attention_idx').on(t.certDays, t.maintDueDays),
  index('fleet_status_idx').on(t.statusCode),
  index('fleet_corridor_idx').on(t.corridorId),
])

/**
 * ui-2.html:3032 — 139 catalogue entries: 103 in-house (`SP-`) + 36 partner-provided (`LK-`).
 *
 * IMPORTANT — `cost` means two different things depending on `source`:
 *   source='in'  → true cost of delivery;  price × (0.62 + R×0.24)
 *   source='out' → the partner's take;     price × (0.905 + R×0.07)
 *                  the residual is platform commission, not profit on delivery.
 * Never average or sum `margin_pct` across both without grouping by `source`.
 *
 * A product is anchored to EITHER a lane (ocean/feeder) OR a site (everything else).
 */
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  groupCode: text('group_code').notNull().references(() => productGroups.code, { onDelete: 'restrict' }),
  industryCode: text('industry_code').notNull().references(() => productIndustries.code, { onDelete: 'restrict' }),
  source: supplySource('source').notNull(),
  partnerName: text('partner_name'),
  baseNameVi: text('base_name_vi').notNull(),
  baseNameEn: text('base_name_en').notNull(),
  variantVi: text('variant_vi').notNull(),
  variantEn: text('variant_en').notNull(),
  laneCode: text('lane_code').references(() => lanes.code, { onDelete: 'restrict' }),
  siteVi: text('site_vi'),
  siteEn: text('site_en'),
  unitVi: text('unit_vi').notNull(),
  unitEn: text('unit_en').notNull(),
  periodsPerYear: smallint('periods_per_year').notNull(),
  price: numeric('price', { precision: 14, scale: 2 }).notNull(),
  cost: numeric('cost', { precision: 14, scale: 2 }).notNull(),
  marginPct: numeric('margin_pct', { precision: 6, scale: 2 }).notNull(),
  indexRef: numeric('index_ref', { precision: 14, scale: 2 }).notNull(),
  capacity: integer('capacity').notNull(),
  sold: integer('sold').notNull(),
  fillPct: smallint('fill_pct').notNull(),
  customers: smallint('customers').notNull(),
  revenue: numeric('revenue', { precision: 16, scale: 2 }).notNull(),
  net: numeric('net', { precision: 16, scale: 2 })
    .generatedAlwaysAs(sql`round(revenue * margin_pct / 100, 2)`),
  trend: smallint('trend').notNull(),
  lifecycleCode: text('lifecycle_code').notNull().references(() => lifecycleStages.code, { onDelete: 'restrict' }),
  attachRate: smallint('attach_rate').notNull(),
  sla: smallint('sla').notNull(),
  slaHit: smallint('sla_hit').notNull(),
  rating: numeric('rating', { precision: 3, scale: 1 }).notNull(),
  // product_statuses, not status_labels — `live` means something different here.
  statusCode: text('status_code').notNull().references(() => productStatuses.code, { onDelete: 'restrict' }),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  isBundle: boolean('is_bundle').notNull(),
  ...timestamps,
}, (t) => [
  index('products_group_idx').on(t.groupCode),
  index('products_industry_idx').on(t.industryCode),
  index('products_status_idx').on(t.statusCode),
  index('products_corridor_idx').on(t.corridorId),
  check('products_lane_xor_site', sql`(${t.laneCode} IS NULL) <> (${t.siteVi} IS NULL)`),
  check('products_partner_matches_source', sql`(${t.source} = 'out') = (${t.partnerName} IS NOT NULL)`),
  check('products_sold_within_capacity', sql`${t.sold} <= ${t.capacity}`),
  check('products_cost_below_price', sql`${t.cost} < ${t.price}`),
])

/** Referenced by fleet CO2/CII reporting; kept as a named export for query typing. */
export type FleetGrade = (typeof gradeLetter.enumValues)[number]
export type CarrierCode = typeof carriers.$inferSelect.code
