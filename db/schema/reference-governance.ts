import { boolean, numeric, pgTable, smallint, text } from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { decisionRight, licenceNeeded, supplySource } from './enums'
import { statusLabels } from './reference-core'

/** ui-2.html:3009 — level 1 of the product taxonomy: 4 service industries. */
export const productIndustries = pgTable('product_industries', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  icon: text('icon').notNull(),
  source: supplySource('source').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/**
 * ui-2.html:3015 — level 2: 12 service groups (8 in-house + 4 partner-provided).
 * `source` mirrors the parent industry: `in` = the platform delivers it,
 * `out` = a licensed partner delivers it and the platform only distributes.
 */
export const productGroups = pgTable('product_groups', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  icon: text('icon').notNull(),
  industryCode: text('industry_code').notNull()
    .references(() => productIndustries.code, { onDelete: 'restrict' }),
  source: supplySource('source').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/**
 * ui-2.html:3104 (`PR_ST`) — listing state of a catalogue entry.
 *
 * Deliberately NOT folded into `status_labels`: the code `live` means "Đang mở /
 * Open" in the shared dictionary but "Đang niêm yết / Listed" here. Same code,
 * different meaning by domain, so one dictionary cannot serve both.
 */
export const productStatuses = pgTable('product_statuses', {
  code: text('code').primaryKey(),
  tone: text('tone').notNull(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:3031 — where a product sits in its commercial life. */
export const lifecycleStages = pgTable('lifecycle_stages', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:2759 — the 8 transport asset classes and how many the fleet seeds. */
export const assetTypes = pgTable('asset_types', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  icon: text('icon').notNull(),
  seedCount: smallint('seed_count').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:2825 — operational state of a fleet asset. */
export const fleetStatuses = pgTable('fleet_statuses', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:2827 — owned / finance lease / time charter. */
export const ownershipTypes = pgTable('ownership_types', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:942 — the 10 growth campaigns. Budget in billion VND, as displayed. */
export const campaigns = pgTable('campaigns', {
  id: smallint('id').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  targetVi: text('target_vi').notNull(),
  targetEn: text('target_en').notNull(),
  budget: numeric('budget', { precision: 10, scale: 2 }).notNull(),
  used: numeric('used', { precision: 10, scale: 2 }).notNull(),
  activated: smallint('activated').notNull(),
  repeatRate: smallint('repeat_rate').notNull(),
  cpa: numeric('cpa', { precision: 10, scale: 2 }).notNull(),
  statusCode: text('status_code').notNull()
    .references(() => statusLabels.code, { onDelete: 'restrict' }),
  ruleVi: text('rule_vi').notNull(),
  ruleEn: text('rule_en').notNull(),
  ...timestamps,
})

/**
 * ui-2.html:2153 — the purposes a member's data may be processed for.
 * Reference data: the grant itself lives in `consent_grants`.
 */
export const consentPurposes = pgTable('consent_purposes', {
  id: smallint('id').primaryKey(),
  purposeVi: text('purpose_vi').notNull(),
  purposeEn: text('purpose_en').notNull(),
  counterparty: text('counterparty').notNull(),
  dataScopeVi: text('data_scope_vi').notNull(),
  dataScopeEn: text('data_scope_en').notNull(),
  legalBasisVi: text('legal_basis_vi').notNull(),
  legalBasisEn: text('legal_basis_en').notNull(),
  retentionMonths: smallint('retention_months'),
  revocable: boolean('revocable').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/**
 * ui-2.html:4556 — who is licensed for what. The platform is a technology,
 * distribution and data layer; it performs no licensed activity it does not hold.
 */
export const licenceMatrix = pgTable('licence_matrix', {
  id: smallint('id').primaryKey(),
  serviceVi: text('service_vi').notNull(),
  serviceEn: text('service_en').notNull(),
  responsibleVi: text('responsible_vi').notNull(),
  responsibleEn: text('responsible_en').notNull(),
  platformRoleVi: text('platform_role_vi').notNull(),
  platformRoleEn: text('platform_role_en').notNull(),
  licenceNeededFlag: licenceNeeded('licence_needed').notNull(),
  moduleCodes: text('module_codes'),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:4583 — which party decides each matter. */
export const decisionRights = pgTable('decision_rights', {
  id: smallint('id').primaryKey(),
  matterVi: text('matter_vi').notNull(),
  matterEn: text('matter_en').notNull(),
  platform: decisionRight('platform').notNull(),
  provider: decisionRight('provider').notNull(),
  bank: decisionRight('bank').notNull(),
  insurer: decisionRight('insurer').notNull(),
  regulator: decisionRight('regulator').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})
