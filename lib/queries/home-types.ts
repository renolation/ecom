export type Tone = 'b' | 'u' | 'd' | 'gd' | 'v' | 'n'

export interface Kpi {
  label: string
  value: string
  unit?: string
  meta?: string
  metaTone?: Tone
  /** Progress bar 0–100, rendered instead of a meta tag when present. */
  bar?: number
  /** Values for the faint sparkline the prototype draws behind some tiles. */
  spark?: number[]
  sparkColor?: string
}

export interface TodoItem {
  icon: string
  title: string
  detail: string
  route: string
  tone: Tone
  badge: string
}

export interface Shortcut {
  icon: string
  label: string
  route: string
}

export interface HomeView {
  heroTitle: string
  heroSub: string
  heroTags: string[]
  kpis: Kpi[]
  todos: TodoItem[]
  shortcuts: Shortcut[]
  /** Optional right-hand panel: a titled list of label/value/delta rows. */
  panel?: {
    title: string
    rows: Array<{
      title: string
      sub: string
      value: string
      delta?: string
      deltaTone?: Tone
      /** Fill meter shown in place of the value — the carrier home lists lane fill. */
      meter?: { value: number; color: string }
    }>
    footerLabel: string
    footerRoute: string
  }
}
