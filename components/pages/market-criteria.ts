/**
 * Search criteria shared by the s_market server page and its client-side form.
 *
 * These live outside `market-search.tsx` on purpose: values exported from a
 * `'use client'` module reach a server component as client references, not as the
 * values themselves, so a plain array would not be iterable there.
 */
export interface MarketCriteria {
  origin: string
  dest: string
  equipment: string
  qty: string
  weight: string
  commodity: string
  service: string
  ready: string
  arriveBy: string
  incoterm: string
  needs: Record<string, boolean>
}

/** ui-2.html:1400 — the six bundled-need chips, in display order. */
export const NEED_KEYS = ['dir', 'fin', 'ins', 'ebl', 'co2', 'bundle'] as const
