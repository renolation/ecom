import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * pgEnum is used ONLY for closed value sets that carry no bilingual label.
 * Anything with a vi/en label lives in a reference table instead (see reference.ts),
 * so labels are never duplicated across rows.
 */

/** members.tier — ui-2.html:729 */
export const memberTier = pgEnum('member_tier', ['direct', 'clearing', 'broker', 'data'])

/** licence_matrix.licence_needed — n = no, p = partial (only when acting as agent) */
export const licenceNeeded = pgEnum('licence_needed', ['n', 'p', 'y'])

/** decision_rights cells — y = decides, n = does not, p = partial */
export const decisionRight = pgEnum('decision_right', ['y', 'n', 'p'])

/** credit_exposures.ifrs9_stage — ui-2.html:858 */
export const ifrs9Stage = pgEnum('ifrs9_stage', ['s1', 's2', 's3'])

/** ESG / CII / credit letter grades */
export const gradeLetter = pgEnum('grade_letter', ['A', 'B', 'C', 'D', 'E'])

/** products / product_groups / product_industries source: in-house vs partner-provided */
export const supplySource = pgEnum('supply_source', ['in', 'out'])

/** asset_finance_types.structure — ui-2.html:4017 */
export const financeStructure = pgEnum('finance_structure', ['term', 'lease', 'proj'])

/** fleet_assets.insurance_type — ui-2.html:2809 */
export const insuranceCover = pgEnum('insurance_cover', ['hm', 'pi', 'cargo', 'none'])
