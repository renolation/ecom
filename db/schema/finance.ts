import { sql } from 'drizzle-orm'
import {
  boolean, check, date, index, numeric, pgTable, smallint, text,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'
import { ifrs9Stage } from './enums'
import { members } from './master'
import { corridors, lanes, statusLabels } from './reference-core'
import { shipments } from './operations'
import {
  assetFinanceTypes, collateralTypes, financeProducts, lcSteps, lcTypes, settlementTriggers,
} from './reference-lookups'

/**
 * `bank` is deliberately plain text across this module, not an FK to `members`.
 * The prototype treats issuing banks as external counterparties drawn from a fixed
 * list (HDBank, MBBank, SHB, TPBank, Sovico Finance); several do also appear as
 * member rows, but the picks are independent and would not reliably resolve.
 */

/** ui-2.html:2023 — 104 digital letters of credit. */
export const lettersOfCredit = pgTable('letters_of_credit', {
  id: text('id').primaryKey(),
  lcTypeId: smallint('lc_type_id').notNull().references(() => lcTypes.id, { onDelete: 'restrict' }),
  applicantMemberId: text('applicant_member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  beneficiary: text('beneficiary').notNull(),
  bank: text('bank').notNull(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  laneCode: text('lane_code').notNull().references(() => lanes.code, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  stepOrdinal: smallint('step_ordinal').notNull().references(() => lcSteps.ordinal, { onDelete: 'restrict' }),
  discrepancies: smallint('discrepancies').notNull(),
  openedOn: date('opened_on').notNull(),
  expiresOn: date('expires_on').notNull(),
  turnaroundHours: numeric('turnaround_hours', { precision: 6, scale: 1 }).notNull(),
  docCount: smallint('doc_count').notNull(),
  autoChecked: boolean('auto_checked').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('lcs_applicant_idx').on(t.applicantMemberId),
  index('lcs_shipment_idx').on(t.shipmentId),
  index('lcs_step_idx').on(t.stepOrdinal),
  index('lcs_corridor_idx').on(t.corridorId),
])

/** ui-2.html:841 — 118 credit applications through the decision engine. */
export const financeApplications = pgTable('finance_applications', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  productCode: text('product_code').notNull().references(() => financeProducts.code, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  score: smallint('score').notNull(),
  decisionCode: text('decision_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
  pd: numeric('pd', { precision: 6, scale: 2 }).notNull(),
  turnaroundHours: numeric('turnaround_hours', { precision: 6, scale: 1 }).notNull(),
  autoDecided: boolean('auto_decided').notNull(),
  appliedOn: date('applied_on').notNull(),
  bank: text('bank').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('finapps_member_idx').on(t.memberId),
  index('finapps_decision_idx').on(t.decisionCode),
  index('finapps_corridor_idx').on(t.corridorId),
])

/** ui-2.html:855 — 104 credit exposures with IFRS-9 staging. One row per member. */
export const creditExposures = pgTable('credit_exposures', {
  memberId: text('member_id').primaryKey().references(() => members.id, { onDelete: 'restrict' }),
  exposure: numeric('exposure', { precision: 16, scale: 2 }).notNull(),
  ifrs9StageCode: ifrs9Stage('ifrs9_stage').notNull(),
  collateral: numeric('collateral', { precision: 16, scale: 2 }).notNull(),
  ecl: numeric('ecl', { precision: 16, scale: 4 }).notNull(),
  daysPastDue: smallint('days_past_due').notNull(),
  ...timestamps,
}, (t) => [index('exposures_stage_idx').on(t.ifrs9StageCode)])

/** ui-2.html:927 — 124 milestone settlements. The platform holds no funds. */
export const settlements = pgTable('settlements', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  counterparty: text('counterparty').notNull(),
  carrier: text('carrier').notNull(),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  triggerId: smallint('trigger_id').notNull().references(() => settlementTriggers.id, { onDelete: 'restrict' }),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  isMatched: boolean('is_matched').notNull(),
  settledOn: date('settled_on').notNull(),
  paymentRef: text('payment_ref').notNull(),
  bank: text('bank').notNull(),
  earlyPayment: boolean('early_payment').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ...timestamps,
}, (t) => [
  index('settlements_status_idx').on(t.statusCode),
  index('settlements_shipment_idx').on(t.shipmentId),
  index('settlements_corridor_idx').on(t.corridorId),
])

/** ui-2.html:4016 — 98 ship / equipment / project finance deals. */
export const assetFinanceDeals = pgTable('asset_finance_deals', {
  id: text('id').primaryKey(),
  assetFinanceTypeId: smallint('asset_finance_type_id').notNull()
    .references(() => assetFinanceTypes.id, { onDelete: 'restrict' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
  ltv: smallint('ltv').notNull(),
  termYears: smallint('term_years').notNull(),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  irr: numeric('irr', { precision: 5, scale: 2 }).notNull(),
  dscr: numeric('dscr', { precision: 5, scale: 2 }).notNull(),
  collateralTypeId: smallint('collateral_type_id').notNull()
    .references(() => collateralTypes.id, { onDelete: 'restrict' }),
  esgGrade: text('esg_grade').notNull(),
  originatedOn: date('originated_on').notNull(),
  bank: text('bank').notNull(),
  ...timestamps,
}, (t) => [
  index('asset_finance_member_idx').on(t.memberId),
  index('asset_finance_status_idx').on(t.statusCode),
  check('asset_finance_ltv_range', sql`${t.ltv} BETWEEN 0 AND 100`),
])
