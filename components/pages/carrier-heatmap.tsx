import Link from 'next/link'
import { Modal, ModalStats } from '@/components/modal'
import { tableHref } from '@/components/table/table-types'
import { Legend } from '@/components/ui'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'

/**
 * Rate heatmap — ui-2.html:2377. Fill rate by lane × week, aggregated across the
 * equipment types currently selected. Every cell that passes the fill filter is a
 * link into the reprice dialog, matching the prototype's `priceModal`.
 *
 * All six filters and the open cell live in the URL, so the grid renders on the server.
 */

export interface RateCell {
  laneCode: string
  origin: string
  dest: string
  week: string
  weekIndex: number
  fill: number | null
  left: number
  capacity: number
  sold: number
  rows: number
  passes: boolean
}

export interface HeatFilters {
  corridor: string
  equipment: string
  weekBand: string
  fillBand: string
  pricing: string
  minSlots: string
}

/** ui-2.html:2269 — the fill band a cell must fall in to stay highlighted. */
export function cellPasses(fill: number | null, band: string): boolean {
  if (fill === null) return false
  if (!band || band === '*') return true
  if (band === 'lo') return fill < 60
  if (band === 'mid') return fill >= 60 && fill < 75
  if (band === 'ok') return fill >= 75 && fill <= 90
  return fill > 90
}

/** ui-2.html:463 — red below the midpoint, green above. */
function heatStyle(fill: number): React.CSSProperties {
  const ratio = (fill - 50) / 50
  if (ratio < 0.5) {
    const k = Math.max(0, ratio) / 0.5
    return { background: `rgba(224,36,36,${(0.42 - 0.34 * k).toFixed(2)})`, color: 'var(--text)' }
  }
  const k = (Math.min(1, ratio) - 0.5) / 0.5
  return { background: `rgba(14,159,110,${(0.08 + 0.34 * k).toFixed(2)})`, color: 'var(--text)' }
}

export function RateHeatmap({
  cells, lanes, weeks, filters, totalRows, matchedRows, avgSuggested,
  lang, basePath, searchParams,
}: {
  cells: RateCell[]
  lanes: Array<{ code: string; origin: string; dest: string }>
  weeks: Array<{ week: string; weekIndex: number }>
  filters: HeatFilters
  totalRows: number
  matchedRows: number
  avgSuggested: number
  lang: Lang
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const passing = cells.filter((c) => c.passes)
  const matchLeft = passing.reduce((a, c) => a + c.left, 0)
  const matchCap = passing.reduce((a, c) => a + c.capacity, 0)
  const matchSold = passing.reduce((a, c) => a + c.sold, 0)
  const cellOf = (laneCode: string, week: string) =>
    cells.find((c) => c.laneCode === laneCode && c.week === week) ?? null

  const filterDefs: Array<[keyof HeatFilters, string, string, Array<[string, string]>]> = [
    ['corridor', 'hm.cor', t(lang, 'Hành lang', 'Corridor'), [['1', '01'], ['2', '02'], ['3', '03']]],
    ['equipment', 'hm.eq', t(lang, 'Loại cont', 'Equipment'),
      [["40' HC Dry", "40' HC Dry"], ["20' Dry", "20' Dry"], ["40' Reefer", "40' Reefer"], ['LCL / m³', 'LCL / m³']]],
    ['weekBand', 'hm.wk', t(lang, 'Khoảng tuần', 'Week range'),
      [['a', 'W34–W38'], ['b', 'W39–W42'], ['c', 'W43–W46']]],
    ['fillBand', 'hm.fill', t(lang, 'Mức lấp đầy', 'Fill band'),
      [['lo', '< 60%'], ['mid', '60–75%'], ['ok', '75–90%'], ['hi', '> 90%']]],
    ['pricing', 'hm.mode', t(lang, 'Định giá', 'Pricing'),
      [['1', t(lang, 'Tự động theo chỉ số', 'Index-linked')], ['0', t(lang, 'Thủ công', 'Manual')]]],
    ['minSlots', 'hm.min', t(lang, 'Còn trống tối thiểu', 'Min slots left'),
      [['50', '≥ 50 TEU'], ['150', '≥ 150 TEU'], ['300', '≥ 300 TEU']]],
  ]

  const clearHref = tableHref(basePath, searchParams, Object.fromEntries(
    filterDefs.map(([, param]) => [param, null]),
  ))

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ flex: 'none' }}>
          {t(lang, 'Bản đồ nhiệt: tỷ lệ lấp đầy theo tuyến × tuần', 'Heatmap: fill rate by lane × week')}
        </h3>
        <span className="tag n">
          {num(matchedRows)} / {num(totalRows)} {t(lang, 'dòng bảng cước', 'rate-card rows')}
        </span>
        {filterDefs.map(([key, param, label, options]) => (
          <HeatFilterSelect
            key={param}
            param={param} label={label} options={options}
            value={filters[key]} lang={lang} basePath={basePath} searchParams={searchParams}
          />
        ))}
        <Link className="btn sm" href={clearHref} scroll={false}>{t(lang, 'Xoá lọc', 'Clear')}</Link>
      </div>

      <div className="card-b">
        <div className="grid g4" style={{ gap: 10, marginBottom: 12 }}>
          {([
            [t(lang, 'Ô đạt điều kiện lọc', 'Cells matching filters'), `${num(passing.length)} / ${num(cells.length)}`],
            [t(lang, 'Chỗ còn trống trong các ô đó', 'Unsold capacity in those cells'), `${num(matchLeft)} TEU`],
            [t(lang, 'Lấp đầy bình quân', 'Average fill'), `${matchCap ? Math.round((matchSold / matchCap) * 100) : 0}%`],
            [t(lang, 'Doanh thu tiềm năng', 'Revenue at stake'), `$${num(Math.round((matchLeft * avgSuggested) / 1000))}K`],
          ] as const).map(([label, value]) => (
            <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
              <div className="muted">{label}</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 750 }}>{value}</div>
            </div>
          ))}
        </div>

        {lanes.length && weeks.length ? (
          <div className="scroll-x">
            <table className="heat">
              <thead>
                <tr>
                  <th className="rowh" />
                  {weeks.map((w) => <th key={w.week}>{w.week}</th>)}
                  <th>{t(lang, 'Còn trống', 'Left')}</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((lane) => {
                  const rowLeft = weeks.reduce((a, w) => {
                    const c = cellOf(lane.code, w.week)
                    return a + (c?.passes ? c.left : 0)
                  }, 0)
                  return (
                    <tr key={lane.code}>
                      <th className="rowh">
                        {lane.code}
                        <div className="muted" style={{ fontWeight: 400 }}>{lane.origin} → {lane.dest}</div>
                      </th>
                      {weeks.map((w) => {
                        const c = cellOf(lane.code, w.week)
                        if (!c || c.fill === null) {
                          return <td key={w.week} style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>—</td>
                        }
                        if (!c.passes) {
                          return (
                            <td key={w.week}
                              style={{ background: 'var(--surface-3)', color: 'var(--text-3)', opacity: 0.55 }}
                              title={`${c.fill}%`}>·</td>
                          )
                        }
                        return (
                          <td key={w.week} style={{ ...heatStyle(c.fill), padding: 0 }}>
                            <Link
                              href={tableHref(basePath, searchParams, { hm: `${lane.code}|${w.week}` })}
                              scroll={false}
                              className="heat-cell"
                              title={`${t(lang, 'còn trống', 'unsold')} ${c.left} TEU · ${c.rows} ${t(lang, 'dòng', 'rows')}`}
                            >
                              {c.fill}%
                            </Link>
                          </td>
                        )
                      })}
                      <td style={{ background: 'var(--surface-2)', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                        {num(rowLeft)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 34, color: 'var(--text-3)' }}>
            {t(lang, 'Không có tuyến hoặc tuần nào khớp bộ lọc hiện tại', 'No lane or week matches the current filter')}
          </div>
        )}

        <div className="legend" style={{ marginTop: 11 }}>
          <span><i style={{ background: 'rgba(224,36,36,.4)' }} />&lt;60% {t(lang, 'lấp đầy', 'fill')}</span>
          <span><i style={{ background: 'rgba(224,36,36,.12)' }} />60–75%</span>
          <span><i style={{ background: 'rgba(14,159,110,.2)' }} />75–90%</span>
          <span><i style={{ background: 'rgba(14,159,110,.4)' }} />&gt;90%</span>
          <span><i style={{ background: 'var(--surface-3)' }} />· {t(lang, 'không đạt bộ lọc mức lấp đầy', 'outside the fill band')}</span>
          <span><i style={{ background: 'var(--surface-3)' }} />— {t(lang, 'không có dữ liệu sau khi lọc', 'no data after filtering')}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>
            {t(lang, 'Ô gộp tất cả loại container đang chọn · nhấp để điều chỉnh giá',
              'Cells aggregate the selected equipment types · click to reprice')}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Filter dropdowns are links-in-a-select; a tiny client component keeps them native. */
function HeatFilterSelect({
  param, label, options, value, lang, basePath, searchParams,
}: {
  param: string; label: string; options: Array<[string, string]>; value: string
  lang: Lang; basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  // Rendered as a details/summary menu so it needs no client JavaScript.
  const active = options.find(([v]) => v === value)
  return (
    <details className="hm-filter">
      <summary className="inp hm-filter-btn">
        {label}: {active ? active[1] : t(lang, 'tất cả', 'all')}
      </summary>
      <div className="hm-filter-menu">
        <Link href={tableHref(basePath, searchParams, { [param]: null })} scroll={false}
          className={!value || value === '*' ? 'on' : ''}>
          {t(lang, 'tất cả', 'all')}
        </Link>
        {options.map(([v, l]) => (
          <Link key={v} href={tableHref(basePath, searchParams, { [param]: v })} scroll={false}
            className={value === v ? 'on' : ''}>{l}</Link>
        ))}
      </div>
    </details>
  )
}

export interface RepriceTarget {
  laneCode: string
  week: string
  equipmentLabel: string
  current: number
  index: number
  suggested: number
  capacity: number
  sold: number
  left: number
  fill: number
  daysOut: number
  autoPricing: boolean
}

/** priceModal — ui-2.html:2459. */
export function RepriceModal({
  target: r, lang, basePath, searchParams,
}: {
  target: RepriceTarget; lang: Lang; basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  // The prototype assumes a repriced cell converts 42% of its remaining slots.
  const extra = Math.round(r.left * 0.42)
  const projectedFill = Math.min(100, r.fill + Math.round((extra / r.capacity) * 100))

  return (
    <Modal
      title={`${t(lang, 'Điều chỉnh giá', 'Reprice')} · ${r.laneCode} · ${r.week} · ${r.equipmentLabel}`}
      basePath={basePath} searchParams={searchParams} closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<span className="tag gd">L2 · {t(lang, 'Đề xuất', 'Advisory')}</span>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Lấp đầy hiện tại', 'Current fill'), `${r.fill}%`],
          [t(lang, 'Còn trống', 'Slots left'), `${num(r.left)} TEU`],
          [t(lang, 'Ngày tới cắt máng', 'Days to cut-off'), r.daysOut],
          [t(lang, 'Chỉ số tuyến', 'Lane index'), usd(r.index)],
        ]} />

        <div className="grid g2" style={{ gap: 12 }}>
          <div className="fld">
            <label>{t(lang, 'Giá hiện tại ($/cont)', 'Current rate ($/unit)')}</label>
            <input className="inp num" value={num(r.current)} disabled style={{ background: 'var(--surface-3)' }} />
          </div>
          <div className="fld">
            <label>{t(lang, 'Giá mới', 'New rate')}</label>
            <input className="inp num" defaultValue={num(r.suggested)} />
          </div>
        </div>

        <div className="card" style={{ marginTop: 13 }}>
          <div className="card-b" style={{ padding: 13 }}>
            <b style={{ fontSize: 12.5 }}>{t(lang, 'Mô phỏng tác động', 'Impact simulation')}</b>
            <div className="grid g4" style={{ gap: 10, marginTop: 9 }}>
              {([
                [t(lang, 'Chỗ bán thêm', 'Extra slots'), `+${num(extra)} TEU`, 'var(--up)'],
                [t(lang, 'Doanh thu ròng', 'Net revenue'), `+$${num(Math.round((extra * r.suggested) / 1000))}K`, 'var(--up)'],
                [t(lang, 'Lấp đầy dự kiến', 'Projected fill'), `${projectedFill}%`, 'var(--brand-600)'],
                [t(lang, 'So với chỉ số', 'vs index'), pct(((r.suggested - r.index) / r.index) * 100), 'var(--text-2)'],
              ] as const).map(([label, value, color]) => (
                <div key={label}>
                  <div className="muted">{label}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 750, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex" style={{ marginTop: 12, gap: 8, paddingTop: 11 }}>
          <input type="checkbox" id="auto-index" defaultChecked={r.autoPricing} />
          <label htmlFor="auto-index" style={{ fontSize: 12.5 }}>
            {t(lang,
              'Bật định giá tự động theo chỉ số VLX (giữ biên ±3% quanh chỉ số, tự cập nhật hằng ngày)',
              'Enable index-linked pricing (hold within ±3% of the VLX index, refreshed daily)')}
          </label>
        </div>

        <div className="flex" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Link className="btn" href={tableHref(basePath, searchParams, { hm: null })} scroll={false}>
            {t(lang, 'Huỷ', 'Cancel')}
          </Link>
          <span className="btn p">{t(lang, 'Công bố giá mới', 'Publish new rate')}</span>
        </div>
      </div>
    </Modal>
  )
}
