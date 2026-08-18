import type { ReactNode } from 'react'
import { Sparkline } from '@/components/charts'
import { t, type Lang } from '@/lib/i18n'
import type { Tone } from '@/lib/queries/home-types'

/** Page header — the prototype's `ph()` (ui-2.html:1152). */
export function PageHeader({
  crumb, title, sub, modules, sandbox, actions,
}: {
  crumb: string
  title: string
  sub?: string
  modules?: string[]
  sandbox?: string[]
  actions?: ReactNode
}) {
  return (
    <div className="ph">
      <div>
        <div className="ph-crumb">{crumb}</div>
        <h1 className="ph-title">
          {title}
          {modules?.map((m) => <span key={m} className="mod">{m}</span>)}
          {sandbox?.map((s) => <span key={s} className="mod sb">{s}</span>)}
        </h1>
        {sub ? <p className="ph-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="flex ph-actions">{actions}</div> : null}
    </div>
  )
}

/** KPI tile — the prototype's `kpi()` (ui-2.html:1156). */
export function KpiTile({
  label, value, unit, meta, metaTone, bar, spark, sparkColor,
}: {
  label: string
  value: string
  unit?: string
  meta?: ReactNode
  metaTone?: Tone
  bar?: number
  spark?: number[]
  sparkColor?: string
}) {
  return (
    <div className="kpi">
      <div className="kpi-l">{label}</div>
      <div className="kpi-v">{value}{unit ? <small>{unit}</small> : null}</div>
      <div className="kpi-m">
        {bar !== undefined ? (
          <div className="bar" style={{ width: 96 }}>
            <i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
          </div>
        ) : null}
        {meta ? (metaTone ? <span className={`tag ${metaTone}`}>{meta}</span> : <span>{meta}</span>) : null}
      </div>
      {spark ? (
        <div className="kpi-spark">
          <Sparkline values={spark} width={110} height={36} color={sparkColor} fill />
        </div>
      ) : null}
    </div>
  )
}

export function Card({
  title, children, right, footer, bodyStyle,
}: {
  title?: string
  children: ReactNode
  right?: ReactNode
  footer?: ReactNode
  bodyStyle?: React.CSSProperties
}) {
  return (
    <div className="card">
      {title ? (
        <div className="card-h">
          <h3>{title}</h3>
          {right}
        </div>
      ) : null}
      <div className="card-b" style={bodyStyle}>{children}</div>
      {footer ? <div className="card-f">{footer}</div> : null}
    </div>
  )
}

/** Coloured status chip. Tone maps to the prototype's tag classes. */
export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

/** Inline bar + percentage, the prototype's `cBar()` (ui-2.html:1090). */
export function Meter({ value, color, width = 62 }: { value: number; color?: string; width?: number }) {
  return (
    <div className="meter">
      <div className="bar" style={{ width }}>
        <i style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <b>{Math.round(value)}%</b>
    </div>
  )
}

/** Avatar + name, the prototype's `cOrg()` (ui-2.html:1089). */
export function OrgCell({ name }: { name: string }) {
  return (
    <div className="flex" style={{ gap: 8 }}>
      <div className="avat" style={{ background: colorFor(name), width: 28, height: 28 }}>{initials(name)}</div>
      <b style={{ fontSize: 12.5 }}>{name}</b>
    </div>
  )
}

/** Data-boundary notice — the prototype's `boundary()` (ui-2.html:1162). */
export function BoundaryNote({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <div className="boundary">
      <span className="ic">🔒</span>
      <div><b>{t(lang, 'Ranh giới dữ liệu', 'Data boundary')}</b>{children}</div>
    </div>
  )
}

export function DefinitionList({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl>
      {rows.map(([term, val], i) => (
        <div className="dl" key={i} style={i === rows.length - 1 ? { border: 0 } : undefined}>
          <dt>{term}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><i style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  )
}

/** ui-2.html:1099 — stable colour per organisation name. */
export function colorFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff
  return ['#0089A0', '#6D5BD0', '#E8A317', '#0E9F6E', '#E02424', '#123356', '#11698F', '#8A6410'][h % 8]
}

/** ui-2.html:1098 — two-letter initials, accent-aware. */
export function initials(s: string): string {
  const words = s.replace(/[^A-Za-zÀ-ỹ ]/g, '').trim().split(/\s+/)
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase().slice(0, 2)
}

/** Autonomy tier chip — ui-2.html:1153. L2 and L3 always require a human. */
export function TierPill({ tier, lang }: { tier: 1 | 2 | 3; lang: Lang }) {
  const label = {
    1: `L1 · ${t(lang, 'Tự động', 'Automated')}`,
    2: `L2 · ${t(lang, 'Đề xuất', 'Advisory')}`,
    3: `L3 · ${t(lang, 'Không tự quyết', 'Human-only')}`,
  }[tier]
  return <span className={`tier l${tier}`}>{label}</span>
}
