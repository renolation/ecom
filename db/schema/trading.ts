import { sql } from 'drizzle-orm'
import {
  bigint, boolean, check, date, index, integer, jsonb, numeric, pgTable, smallint, text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { members } from './master'
import { carriers, corridors, lanes, statusLabels } from './reference-core'
import { equipmentTypes, rfqScopes, serviceModes } from './reference-lookups'

/**
 * ui-2.html:767 — 320 spot offers powering the market search page.
 * Grew from 108 rows / 18 fields when ui-2.html added a real search-and-match engine.
 *
 * `doc_fee` is a RESIDUAL, not a percentage (ui-2.html:773):
 *   doc = price - base - thc - round(price * 0.062)
 * so the four components sum exactly to `price`.
 */
export const offers = pgTable('offers', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  carrierCode: text('carrier_code').notNull().references(() => carriers.code, { onDelete: 'restrict' }),
  vessel: text('vessel').notNull(),

  equipmentCode: text('equipment_code').notNull().references(() => equipmentTypes.code, { onDelete: 'restrict' }),
  equipmentOrd: smallint('equipment_ord').notNull(),
  equipmentFactor: numeric('equipment_factor', { precision: 6, scale: 3 }).notNull(),

  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  base: numeric('base', { precision: 12, scale: 2 }).notNull(),
  thc: numeric('thc', { precision: 12, scale: 2 }).notNull(),
  bunker: numeric('bunker', { precision: 12, scale: 2 }).notNull(),
  docFee: numeric('doc_fee', { precision: 12, scale: 2 }).notNull(),
  deviationPct: numeric('deviation_pct', { precision: 7, scale: 3 }).notNull(),

  transitDays: smallint('transit_days').notNull(),
  isDirect: boolean('is_direct').notNull(),
  transhipmentPort: text('transhipment_port'),
  departOn: date('depart_on').notNull(),
  departOffset: smallint('depart_offset').notNull(),

  slotsLeft: smallint('slots_left').notNull(),
  freeDays: smallint('free_days').notNull(),
  cutoffDays: smallint('cutoff_days').notNull(),
  validityDays: smallint('validity_days').notNull(),
  serviceMode: text('service_mode').notNull().references(() => serviceModes.code, { onDelete: 'restrict' }),
  weeklyFrequency: smallint('weekly_frequency').notNull(),

  reliability: smallint('reliability').notNull(),
  rating: numeric('rating', { precision: 3, scale: 1 }).notNull(),
  co2: integer('co2').notNull(),
  hasFinance: boolean('has_finance').notNull(),
  hasInsurance: boolean('has_insurance').notNull(),
  hasEbl: boolean('has_ebl').notNull(),
  acceptsDg: boolean('accepts_dg').notNull(),
  ...timestamps,
}, (t) => [
  index('offers_lane_idx').on(t.laneCode),
  index('offers_carrier_idx').on(t.carrierCode),
  index('offers_equipment_idx').on(t.equipmentCode),
  // A direct sailing has no transhipment port and vice versa (ui-2.html:779).
  check('offers_direct_xor_transhipment', sql`${t.isDirect} = (${t.transhipmentPort} IS NULL)`),
  // ui-2.html:781 clamps reliability into this band.
  check('offers_reliability_range', sql`${t.reliability} BETWEEN 70 AND 99`),
])

/** ui-2.html:792 — 106 tenders. `bidCount` is prototype data, not an aggregate of `bids`. */
export const rfqs = pgTable('rfqs', {
  id: text('id').primaryKey(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  scopeId: smallint('scope_id').notNull().references(() => rfqScopes.id, { onDelete: 'restrict' }),
  shipperMemberId: text('shipper_member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  volume: integer('volume').notNull(),
  bidCount: smallint('bid_count').notNull(),
  invited: smallint('invited').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  closesInDays: smallint('closes_in_days').notNull(),
  indexPrice: numeric('index_price', { precision: 12, scale: 2 }).notNull(),
  bestPrice: numeric('best_price', { precision: 12, scale: 2 }).notNull(),
  savingPct: numeric('saving_pct', { precision: 6, scale: 2 }).notNull(),
  value: numeric('value', { precision: 16, scale: 2 }).notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  // Nav badges 1 and 2 both read this: badge 1 adds closesInDays, badge 2 does not.
  index('rfqs_status_closing_idx').on(t.statusCode, t.closesInDays),
  index('rfqs_lane_idx').on(t.laneCode),
  index('rfqs_shipper_idx').on(t.shipperMemberId),
  index('rfqs_corridor_idx').on(t.corridorId),
])

/** ui-2.html:808 — 671 bids across the open tenders, ≤8 per RFQ. */
export const bids = pgTable('bids', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  rfqId: text('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  carrierCode: text('carrier_code').notNull().references(() => carriers.code, { onDelete: 'restrict' }),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  transitDays: smallint('transit_days').notNull(),
  validity: smallint('validity').notNull(),
  score: smallint('score').notNull(),
  allocation: text('allocation').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('bids_rfq_idx').on(t.rfqId),
  index('bids_carrier_idx').on(t.carrierCode),
  check('bids_score_range', sql`${t.score} BETWEEN 0 AND 100`),
])

/**
 * ui-2.html:2239 — 416 cells: 8 lanes × 13 weeks × 4 equipment types.
 * `week` keeps the prototype's W34…W46 label; `weekIndex` gives SQL an order.
 */
export const rateCards = pgTable('rate_cards', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  week: text('week').notNull(),
  weekIndex: smallint('week_index').notNull(),
  equipmentCode: text('equipment_code').notNull().references(() => equipmentTypes.code, { onDelete: 'restrict' }),
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }).notNull(),
  indexPrice: numeric('index_price', { precision: 12, scale: 2 }).notNull(),
  suggestedPrice: numeric('suggested_price', { precision: 12, scale: 2 }).notNull(),
  capacity: integer('capacity').notNull(),
  sold: integer('sold').notNull(),
  remaining: integer('remaining').notNull(),
  fillPct: smallint('fill_pct').notNull(),
  autoPricing: boolean('auto_pricing').notNull(),
  published: boolean('published').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  daysOut: smallint('days_out').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('rate_cards_grid_uq').on(t.laneCode, t.week, t.equipmentCode),
  // Heatmap scan order (ui-2.html:2257 hmRows).
  index('rate_cards_heatmap_idx').on(t.laneCode, t.weekIndex, t.equipmentCode),
  index('rate_cards_corridor_idx').on(t.corridorId),
  check('rate_cards_sold_within_capacity', sql`${t.sold} <= ${t.capacity}`),
  check('rate_cards_remaining_identity', sql`${t.remaining} = ${t.capacity} - ${t.sold}`),
  check('rate_cards_fill_range', sql`${t.fillPct} BETWEEN 0 AND 100`),
])

/**
 * ui-2.html:2493 — 104 voyages for the carrier offering assistant.
 * `serviceBasket` stays jsonb: the assistant reads {port,truck,wh,cold,cust,ins} as a unit.
 */
export const voyages = pgTable('voyages', {
  id: text('id').primaryKey(),
  vessel: text('vessel').notNull(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  carrierCode: text('carrier_code').notNull().references(() => carriers.code, { onDelete: 'restrict' }),
  customerMemberId: text('customer_member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  eta: date('eta').notNull(),
  teu: integer('teu').notNull(),
  reeferTeu: integer('reefer_teu').notNull(),
  shareOfWallet: smallint('share_of_wallet').notNull(),
  serviceBasket: jsonb('service_basket').notNull(),
  discountPct: numeric('discount_pct', { precision: 5, scale: 1 }).notNull(),
  value: numeric('value', { precision: 16, scale: 2 }).notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  confidence: smallint('confidence').notNull(),
  ...timestamps,
}, (t) => [
  index('voyages_lane_idx').on(t.laneCode),
  index('voyages_carrier_idx').on(t.carrierCode),
  index('voyages_status_idx').on(t.statusCode),
])
