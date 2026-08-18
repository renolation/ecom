/**
 * SVG chart kit ported from ui-2.html:400–465.
 * Geometry and styling follow the prototype exactly so the ported pages look identical.
 * All are pure functions of their inputs — safe to render on the server.
 */

export function Sparkline({
  values, width = 120, height = 34, color = 'var(--brand-500)', fill = false,
}: {
  values: number[]; width?: number; height?: number; color?: string; fill?: boolean
}) {
  if (values.length < 2) return null
  const mn = Math.min(...values)
  const mx = Math.max(...values)
  const rg = mx - mn || 1
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 2 - ((v - mn) / rg) * (height - 6),
  ] as const)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill ? <path d={`${d}L${width} ${height}L0 ${height}Z`} fill={color} opacity=".13" /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export interface Series {
  data: number[]
  color: string
  fill?: boolean
  dash?: boolean
  dot?: boolean
}

export function LineChart({
  series, width = 640, height = 210, min, max, labels, fmt,
}: {
  series: Series[]; width?: number; height?: number; min?: number; max?: number
  labels?: string[]; fmt?: (v: number) => string
}) {
  const pl = 42, pb = 22, pt = 10, pr = 8
  const all = series.flatMap((s) => s.data)
  let lo = min ?? Math.min(...all)
  let hi = max ?? Math.max(...all)
  const pad = (hi - lo) * 0.12 || 1
  lo -= pad; hi += pad
  const rg = hi - lo
  const iw = width - pl - pr
  const ih = height - pt - pb

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = pt + (ih * i) / 4
        const val = hi - (rg * i) / 4
        return (
          <g key={i}>
            <line x1={pl} y1={y.toFixed(1)} x2={width - pr} y2={y.toFixed(1)} stroke="var(--line)" strokeWidth="1" />
            <text x={pl - 7} y={(y + 3.5).toFixed(1)} textAnchor="end" fontSize="9.5" fill="var(--text-3)" fontFamily="var(--mono)">
              {fmt ? fmt(val) : Math.round(val)}
            </text>
          </g>
        )
      })}
      {labels?.map((lb, i) => {
        const step = Math.ceil(labels.length / 8)
        if (i % step) return null
        const x = pl + (iw * i) / (labels.length - 1)
        return (
          <text key={lb + i} x={x.toFixed(1)} y={height - 6} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">
            {lb}
          </text>
        )
      })}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => [
          pl + (iw * i) / (s.data.length - 1),
          pt + ih - ((v - lo) / rg) * ih,
        ] as const)
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
        const last = pts[pts.length - 1]
        return (
          <g key={si}>
            {s.fill ? <path d={`${d}L${width - pr} ${pt + ih}L${pl} ${pt + ih}Z`} fill={s.color} opacity=".11" /> : null}
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.dash ? 1.6 : 2.2}
              strokeDasharray={s.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {s.dot !== false ? (
              <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3.6" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function BarChart({
  items, width = 640, height = 210, padLeft = 46, fmt, valueLabel,
}: {
  items: Array<{ l: string; v: number; c?: string }>
  width?: number; height?: number; padLeft?: number
  fmt?: (v: number) => string; valueLabel?: (v: number) => string
}) {
  const pb = 26, pt = 10, pr = 8
  const mx = Math.max(...items.map((i) => i.v)) * 1.14 || 1
  const iw = width - padLeft - pr
  const ih = height - pt - pb
  const bw = (iw / items.length) * 0.58

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 1, 2, 3].map((i) => {
        const y = pt + (ih * i) / 3
        const val = mx - (mx * i) / 3
        return (
          <g key={i}>
            <line x1={padLeft} y1={y} x2={width - pr} y2={y} stroke="var(--line)" />
            <text x={padLeft - 7} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-3)">
              {fmt ? fmt(val) : Math.round(val)}
            </text>
          </g>
        )
      })}
      {items.map((it, i) => {
        const x = padLeft + (iw * (i + 0.5)) / items.length - bw / 2
        const bh = (it.v / mx) * ih
        const y = pt + ih - bh
        return (
          <g key={it.l + i}>
            <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)}
              height={Math.max(bh, 1).toFixed(1)} rx="4" fill={it.c ?? 'var(--brand-500)'} />
            <text x={(x + bw / 2).toFixed(1)} y={height - 8} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">{it.l}</text>
            {valueLabel ? (
              <text x={(x + bw / 2).toFixed(1)} y={(y - 4).toFixed(1)} textAnchor="middle"
                fontSize="9.5" fontWeight="700" fill="var(--text-2)">{valueLabel(it.v)}</text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function Donut({
  items, size = 140, thickness = 18,
}: {
  items: Array<{ v: number; c: string }>; size?: number; thickness?: number
}) {
  const r = size / 2 - thickness / 2
  const cx = size / 2
  const cy = size / 2
  const total = items.reduce((a, b) => a + b.v, 0) || 1
  let acc = -90
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items.map((it, i) => {
        const ang = (it.v / total) * 360
        const end = acc + ang
        const x1 = cx + r * Math.cos((acc * Math.PI) / 180)
        const y1 = cy + r * Math.sin((acc * Math.PI) / 180)
        const x2 = cx + r * Math.cos((end * Math.PI) / 180)
        const y2 = cy + r * Math.sin((end * Math.PI) / 180)
        acc = end
        return (
          <path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${ang > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
            fill="none" stroke={it.c} strokeWidth={thickness} />
        )
      })}
    </svg>
  )
}

export function Gauge({ value, label, size = 130 }: { value: number; label: string; size?: number }) {
  const r = size / 2 - 11
  const cx = size / 2
  const cy = size / 2
  const C = Math.PI * r
  const col = value >= 75 ? 'var(--up)' : value >= 50 ? 'var(--gold-500)' : 'var(--down)'
  const arc = `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
      <path d={arc} fill="none" stroke="var(--surface-3)" strokeWidth="11" strokeLinecap="round" />
      <path d={arc} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${((C * value) / 100).toFixed(1)} ${C.toFixed(1)}`} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="750" fill="var(--text)">
        {Math.round(value)}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="9" fill="var(--text-3)">{label}</text>
    </svg>
  )
}

/** Red→green cell shading for the rate heatmap (ui-2.html:463). */
export function heatStyle(v: number, mn: number, mx: number): React.CSSProperties {
  const t = (v - mn) / (mx - mn || 1)
  if (t < 0.5) {
    const k = t / 0.5
    return { background: `rgba(224,36,36,${(0.42 - 0.34 * k).toFixed(2)})`, color: 'var(--text)' }
  }
  const k2 = (t - 0.5) / 0.5
  return { background: `rgba(14,159,110,${(0.08 + 0.34 * k2).toFixed(2)})`, color: 'var(--text)' }
}

/**
 * Deterministic pseudo-series used only for decorative sparklines (ui-2.html:465).
 * Seeded by a caller-supplied number so server and client agree.
 */
export function walk(start: number, steps: number, vol: number, seed: number): number[] {
  const rnd = (s: number) => {
    const x = Math.sin(s) * 10000
    return x - Math.floor(x)
  }
  const out = [start]
  for (let i = 1; i < steps; i++) out.push(Math.max(1, out[i - 1] * (1 + (rnd(seed + i) - 0.47) * vol)))
  return out
}
