import { numeric, pgTable, smallint, text } from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { financeStructure } from './enums'
import { modules } from './reference-core'

/**
 * Most of the prototype's enumerations share one shape: a bilingual label plus the
 * `pickw()` weight that drives seed distribution. One factory keeps 13 tables honest.
 * Weights are stored so the seed reads its distribution from the DB instead of
 * hardcoding the same numbers a second time.
 */
const weightedLookup = (tableName: string) =>
  pgTable(tableName, {
    id: smallint('id').primaryKey(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en').notNull(),
    weight: smallint('weight').notNull().default(0),
    ...timestamps,
  })

/** ui-2.html:794 — RFQ contract scopes (framework, spot, trucking, bonded, …). */
export const rfqScopes = weightedLookup('rfq_scopes')

/** ui-2.html:868 — dispute grounds (vessel delay, rolling, damage, surcharge, …). */
export const disputeIssueTypes = weightedLookup('dispute_issue_types')

/** ui-2.html:881 — evidence source backing a dispute (AIS, port TOS, VGM, doc timestamps). */
export const evidenceSources = weightedLookup('evidence_sources')

/** ui-2.html:888 — AML typologies (sanctions match, structuring, unclear UBO, …). */
export const amlAlertTypes = weightedLookup('aml_alert_types')

/** ui-2.html:907 — what an AI agent run was asked to do. */
export const agentActions = weightedLookup('agent_actions')

/** ui-2.html:932 — milestone that releases an escrow payment. */
export const settlementTriggers = weightedLookup('settlement_triggers')

/** ui-2.html:956 — campaign-abuse patterns (duplicate tax ID, circular trades, …). */
export const abuseTypes = weightedLookup('abuse_types')

/** ui-2.html:980 — CDP customer segments (Champions, cross-sell, churn risk, …). */
export const cdpSegments = weightedLookup('cdp_segments')

/** ui-2.html:990 — next-best-action recommendations attached to a CDP account. */
export const cdpNbaActions = weightedLookup('cdp_nba_actions')

/** ui-2.html:2025 — L/C instrument types (irrevocable, UPAS, sight, usance, confirmed). */
export const lcTypes = weightedLookup('lc_types')

/** ui-2.html:4029 — security backing an asset-finance deal. */
export const collateralTypes = weightedLookup('collateral_types')

/** ui-2.html:691 — member categories with their share of the member base. */
export const memberTypes = pgTable('member_types', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  sharePct: smallint('share_pct').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:688 — industry sectors a member trades in. */
export const sectors = pgTable('sectors', {
  id: smallint('id').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:740 — the 8 shipment lifecycle states, ordered booked → delivered. */
export const shipmentStatuses = pgTable('shipment_statuses', {
  ordinal: smallint('ordinal').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:2027 — the 6 L/C processing steps, ordered filed → settled. */
export const lcSteps = pgTable('lc_steps', {
  ordinal: smallint('ordinal').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:825 — trade document types (eB/L, customs declaration, C/O, VGM, …). */
export const documentTypes = pgTable('document_types', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  weight: smallint('weight').notNull(),
  isEbl: smallint('is_ebl').notNull().default(0),
  ...timestamps,
})

/** ui-2.html:837 — financing products a member can apply for, mapped to a module. */
export const financeProducts = pgTable('finance_products', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  moduleCode: text('module_code').references(() => modules.code, { onDelete: 'restrict' }),
  weight: smallint('weight').notNull(),
  ...timestamps,
})

/** ui-2.html:4017 — asset classes a bank will finance, with their deal structure. */
export const assetFinanceTypes = pgTable('asset_finance_types', {
  id: smallint('id').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  structure: financeStructure('structure').notNull(),
  weight: smallint('weight').notNull(),
  ...timestamps,
})

/**
 * ui-2.html:765 (`EQF`) + 2238 (`RC_EQ`) — the same 4 equipment codes in the same order.
 * `ord` is kept because `offers.equipment_ord` is a positional index into that array.
 */
export const equipmentTypes = pgTable('equipment_types', {
  code: text('code').primaryKey(),
  ord: smallint('ord').notNull(),
  teuFactor: numeric('teu_factor', { precision: 6, scale: 3 }).notNull(),
  capacityFactor: numeric('capacity_factor', { precision: 6, scale: 3 }).notNull(),
  weight: smallint('weight').notNull(),
  ...timestamps,
})

/** ui-2.html:782 — how far the carrier hauls: CY/CY, CY/Door, Door/Door. */
export const serviceModes = pgTable('service_modes', {
  code: text('code').primaryKey(),
  weight: smallint('weight').notNull(),
  ...timestamps,
})

/** ui-2.html:1401 — cargo categories offered in the market search form. */
export const commodityTypes = pgTable('commodity_types', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})
