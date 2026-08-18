import { sql } from 'drizzle-orm'
import {
  bigint, boolean, check, date, index, numeric, pgTable, smallint, text,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { members } from './master'
import { carriers, corridors, lanes, statusLabels } from './reference-core'
import {
  disputeIssueTypes, documentTypes, evidenceSources, shipmentStatuses,
} from './reference-lookups'

/**
 * ui-2.html:745 — 146 shipments, the spine of the operations view.
 *
 * `docCount` is prototype data (`ri(4,8)`), NOT a count of `documents` rows.
 * Do not write a verification query asserting they agree — they will not.
 */
export const shipments = pgTable('shipments', {
  id: text('id').primaryKey(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  carrierCode: text('carrier_code').notNull().references(() => carriers.code, { onDelete: 'restrict' }),
  shipperMemberId: text('shipper_member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  qty: smallint('qty').notNull(),
  statusOrdinal: smallint('status_ordinal').notNull()
    .references(() => shipmentStatuses.ordinal, { onDelete: 'restrict' }),
  etd: date('etd').notNull(),
  eta: date('eta').notNull(),
  value: numeric('value', { precision: 16, scale: 2 }).notNull(),
  cargoValue: numeric('cargo_value', { precision: 18, scale: 2 }).notNull(),
  vessel: text('vessel').notNull(),
  riskLevel: smallint('risk_level').notNull(),
  hasEbl: boolean('has_ebl').notNull(),
  hasInsurance: boolean('has_insurance').notNull(),
  hasFinance: boolean('has_finance').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  inDispute: boolean('in_dispute').notNull(),
  docCount: smallint('doc_count').notNull(),
  ...timestamps,
}, (t) => [
  index('shipments_status_idx').on(t.statusOrdinal),
  index('shipments_lane_idx').on(t.laneCode),
  index('shipments_carrier_idx').on(t.carrierCode),
  index('shipments_shipper_idx').on(t.shipperMemberId),
  index('shipments_corridor_idx').on(t.corridorId),
  check('shipments_qty_positive', sql`${t.qty} > 0`),
  check('shipments_eta_after_etd', sql`${t.eta} >= ${t.etd}`),
  check('shipments_risk_range', sql`${t.riskLevel} BETWEEN 0 AND 2`),
])

/** ui-2.html:824 — 168 trade documents. `paperFallback` only ever set on eB/L rows. */
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  docTypeCode: text('doc_type_code').notNull().references(() => documentTypes.code, { onDelete: 'restrict' }),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  shipperMemberId: text('shipper_member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  issuedOn: date('issued_on').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  signatureCount: smallint('signature_count').notNull(),
  isEbl: boolean('is_ebl').notNull(),
  paperFallback: boolean('paper_fallback').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('documents_shipment_idx').on(t.shipmentId),
  index('documents_status_idx').on(t.statusCode),
  index('documents_type_idx').on(t.docTypeCode),
  index('documents_corridor_idx').on(t.corridorId),
  check('documents_fallback_only_ebl', sql`NOT ${t.paperFallback} OR ${t.isEbl}`),
])

/**
 * ui-2.html:867 — 94 disputes across a 3-tier resolution ladder.
 * Tier 1 resolves automatically from evidence; tier 3 goes to arbitration.
 */
export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  issueTypeId: smallint('issue_type_id').notNull().references(() => disputeIssueTypes.id, { onDelete: 'restrict' }),
  evidenceSourceId: smallint('evidence_source_id').notNull().references(() => evidenceSources.id, { onDelete: 'restrict' }),
  value: numeric('value', { precision: 16, scale: 2 }).notNull(),
  tier: smallint('tier').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  days: numeric('days', { precision: 6, scale: 1 }).notNull(),
  claimant: text('claimant').notNull(),
  respondent: text('respondent').notNull(),
  autoResolved: boolean('auto_resolved').notNull(),
  openedOn: date('opened_on').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('disputes_shipment_idx').on(t.shipmentId),
  index('disputes_status_idx').on(t.statusCode),
  index('disputes_corridor_idx').on(t.corridorId),
  check('disputes_tier_range', sql`${t.tier} BETWEEN 1 AND 3`),
])

/**
 * ui-2.html:966 — the VLX price index, 240 daily observations.
 * The prototype stores a bare array; dates are assigned counting back from the
 * 2026-08-15 anchor so the series is orderable in SQL rather than by position.
 */
export const indexPoints = pgTable('index_points', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  observedOn: date('observed_on').notNull().unique(),
  value: numeric('value', { precision: 12, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [index('index_points_date_idx').on(t.observedOn)])

/** ui-2.html:967 — per-lane index level and momentum. */
export const indexLaneStats = pgTable('index_lane_stats', {
  laneCode: text('lane_code').primaryKey().references(() => lanes.code, { onDelete: 'restrict' }),
  level: numeric('level', { precision: 12, scale: 2 }).notNull(),
  d1: numeric('d1', { precision: 7, scale: 2 }).notNull(),
  w1: numeric('w1', { precision: 7, scale: 2 }).notNull(),
  m1: numeric('m1', { precision: 7, scale: 2 }).notNull(),
  ytd: numeric('ytd', { precision: 7, scale: 2 }).notNull(),
  qualityGrade: text('quality_grade').notNull(),
  trades: smallint('trades').notNull(),
  providers: smallint('providers').notNull(),
  ...timestamps,
})

/** ui-2.html:975 — 8 lanes × 40 points of sparkline history. */
export const indexLanePoints = pgTable('index_lane_points', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'cascade' }),
  seq: smallint('seq').notNull(),
  value: numeric('value', { precision: 12, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [index('index_lane_points_lane_seq_idx').on(t.laneCode, t.seq)])
