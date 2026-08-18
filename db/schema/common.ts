import { timestamp } from 'drizzle-orm/pg-core'

/**
 * Every table carries these. The prototype has no audit trail of its own —
 * these are added so rows have provenance once the app starts writing.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/**
 * The prototype anchors every relative date to `new Date(2026,7,15)` (ui-2.html:662).
 * Seed and verification both resolve day-offsets against this constant.
 */
export const DATE_ANCHOR = '2026-08-15'
