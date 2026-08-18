import { sql } from 'drizzle-orm'
import {
  boolean, check, date, index, integer, numeric, pgTable, smallint, text, time, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { DATE_ANCHOR, timestamps } from './common'
import { members } from './master'
import { aiAgents, statusLabels } from './reference-core'
import { campaigns, consentPurposes } from './reference-governance'
import { abuseTypes, agentActions, amlAlertTypes } from './reference-lookups'
import { shipments } from './operations'

/** ui-2.html:887 — 112 AML alerts. Tier 3 throughout: an officer decides, never the agent. */
export const amlAlerts = pgTable('aml_alerts', {
  id: text('id').primaryKey(),
  alertTypeId: smallint('alert_type_id').notNull().references(() => amlAlertTypes.id, { onDelete: 'restrict' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  severityCode: text('severity_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  raisedOn: date('raised_on').notNull(),
  score: smallint('score').notNull(),
  agentFlagged: boolean('agent_flagged').notNull(),
  tier: smallint('tier').notNull(),
  value: numeric('value', { precision: 16, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  // Nav badge 5: high severity AND status in (open, review).
  index('aml_severity_status_idx').on(t.severityCode, t.statusCode),
  index('aml_member_idx').on(t.memberId),
  check('aml_tier_range', sql`${t.tier} BETWEEN 1 AND 3`),
])

/** ui-2.html:955 — 36 campaign-abuse flags (duplicate UBO, circular trades, clawbacks). */
export const abuseFlags = pgTable('abuse_flags', {
  id: text('id').primaryKey(),
  abuseTypeId: smallint('abuse_type_id').notNull().references(() => abuseTypes.id, { onDelete: 'restrict' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  campaignId: smallint('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  flaggedOn: date('flagged_on').notNull(),
  ...timestamps,
}, (t) => [
  index('abuse_member_idx').on(t.memberId),
  index('abuse_campaign_idx').on(t.campaignId),
])

/**
 * ui-2.html:906 — 126 AI agent runs with their human-oversight outcome.
 *
 * The prototype records only a wall-clock time with no date. `runOn` defaults to the
 * 2026-08-15 anchor so the pair is queryable as a timestamp — that default is an
 * addition of this schema, not something the source provides.
 */
export const agentRuns = pgTable('agent_runs', {
  id: text('id').primaryKey(),
  agentId: smallint('agent_id').notNull().references(() => aiAgents.id, { onDelete: 'restrict' }),
  actionId: smallint('action_id').notNull().references(() => agentActions.id, { onDelete: 'restrict' }),
  tier: smallint('tier').notNull(),
  outcomeCode: text('outcome_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  confidence: smallint('confidence').notNull(),
  durationMs: integer('duration_ms').notNull(),
  runOn: date('run_on').notNull().default(DATE_ANCHOR),
  runAt: time('run_at').notNull(),
  approver: text('approver').notNull(),
  model: text('model').notNull(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('agent_runs_agent_idx').on(t.agentId),
  index('agent_runs_outcome_idx').on(t.outcomeCode),
  index('agent_runs_shipment_idx').on(t.shipmentId),
  check('agent_runs_tier_range', sql`${t.tier} BETWEEN 1 AND 3`),
  check('agent_runs_confidence_range', sql`${t.confidence} BETWEEN 0 AND 100`),
])

/**
 * ui-2.html:2153 — which purposes a member has granted.
 * The prototype only models the demo shipper's grants; seeded for that member.
 */
export const consentGrants = pgTable('consent_grants', {
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  purposeId: smallint('purpose_id').notNull().references(() => consentPurposes.id, { onDelete: 'restrict' }),
  granted: boolean('granted').notNull(),
  revocable: boolean('revocable').notNull(),
  ...timestamps,
}, (t) => [uniqueIndex('consent_grants_uq').on(t.memberId, t.purposeId)])
