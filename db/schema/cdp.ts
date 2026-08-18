import {
  bigint, boolean, index, jsonb, numeric, pgTable, smallint, text,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { members } from './master'
import { statusLabels } from './reference-core'
import { cdpNbaActions, cdpSegments } from './reference-lookups'

/**
 * ui-2.html:979 — 128 unified customer records for the CDP 360 module.
 * `services` is jsonb ({port,truck,wh,cold,air}) — a coverage checklist read as a unit.
 */
export const cdpAccounts = pgTable('cdp_accounts', {
  memberId: text('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  segmentId: smallint('segment_id').notNull().references(() => cdpSegments.id, { onDelete: 'restrict' }),
  shareOfWallet: smallint('share_of_wallet').notNull(),
  revenue: numeric('revenue', { precision: 16, scale: 2 }).notNull(),
  trend: smallint('trend').notNull(),
  churnRiskCode: text('churn_risk_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  sourceCount: smallint('source_count').notNull(),
  confidence: smallint('confidence').notNull(),
  isMerged: boolean('is_merged').notNull(),
  services: jsonb('services').notNull(),
  nbaActionId: smallint('nba_action_id').notNull().references(() => cdpNbaActions.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('cdp_segment_idx').on(t.segmentId),
  index('cdp_churn_idx').on(t.churnRiskCode),
])

/**
 * ui-2.html:995 — identity-resolution queue: 8 golden records awaiting a merge decision.
 * Tax IDs are stored masked exactly as the prototype masks them (`2300xxxxxx`).
 * There is no reason to hold real tax IDs in a demo database.
 */
export const cdpMergeQueue = pgTable('cdp_merge_queue', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  goldenName: text('golden_name').notNull(),
  confidence: smallint('confidence').notNull(),
  taxIdMasked: text('tax_id_masked').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:995 — the source records feeding each golden record (19 rows in total). */
export const cdpMergeRecords = pgTable('cdp_merge_records', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  queueId: bigint('queue_id', { mode: 'number' }).notNull()
    .references(() => cdpMergeQueue.id, { onDelete: 'cascade' }),
  sourceRecord: text('source_record').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
}, (t) => [index('cdp_merge_records_queue_idx').on(t.queueId, t.ord)])
