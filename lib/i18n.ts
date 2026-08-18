export type Lang = 'vi' | 'en'

export const DEFAULT_LANG: Lang = 'vi'

export function isLang(v: string | undefined): v is Lang {
  return v === 'vi' || v === 'en'
}

/** Picks the vi or en side of a reference row's label pair. */
export function pick(lang: Lang, vi: string | null, en: string | null): string {
  return (lang === 'vi' ? vi : en) ?? vi ?? en ?? ''
}

/**
 * Money and volumes use en-US grouping in both languages — the prototype's choice,
 * following international shipping and finance convention (ui-2.html:656).
 */
export function num(v: number | string, decimals = 0): string {
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function usd(v: number | string, decimals = 0): string {
  return `$${num(v, decimals)}`
}

export function pct(v: number | string, decimals = 1): string {
  const n = Number(v)
  return `${n > 0 ? '+' : ''}${num(n, decimals)}%`
}

/** Bilingual inline string, for the handful of labels the DB does not carry. */
export function t(lang: Lang, vi: string, en: string): string {
  return lang === 'vi' ? vi : en
}

/** ui-2.html:645 — month axis labels for the twelve-month charts. */
export function monthLabels(lang: Lang): string[] {
  return lang === 'vi'
    ? ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
}
