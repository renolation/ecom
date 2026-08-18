import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { BarChart, Donut, LineChart, Sparkline, walk } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import {
  Card, DefinitionList, KpiTile, Legend, Meter, PageHeader, Tag, TierPill,
} from '@/components/ui'
import { tableHref } from '@/components/table/table-types'
import {
  RateHeatmap, RepriceModal, cellPasses,
  type HeatFilters, type RateCell, type RepriceTarget,
} from './carrier-heatmap'
import { db } from '@/lib/db'
import {
  bids, carriers, cdpAccounts, lanes, members, ports, rateCards, rfqs, rfqScopes, voyages,
} from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import {
  carrierOptions, equipmentOptions, laneOptions, statusLabelMap, statusOptions,
} from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** ui-2.html:2296 — where the slots were sold. Fixed shares in the prototype. */
const CHANNEL_MIX: Array<[string, string, number, string]> = [
  ['Đấu thầu / hợp đồng khung', 'Tender / framework', 44, 'var(--brand-500)'],
  ['Spot trên nền tảng', 'On-platform spot', 34, 'var(--violet)'],
  ['Trợ lý chào giá AI', 'AI offering assistant', 13, 'var(--gold-500)'],
  ['Ngoài nền tảng', 'Off-platform', 9, 'var(--text-3)'],
]

/** ui-2.html:2304 — the four things a provider should act on today. */
const CARRIER_ACTIONS: Array<[string, string, string, string, Tone, string]> = [
  ['5 gói thầu chờ chào giá', '5 tenders awaiting bid',
    '1 gói đóng sau 4 giờ', '1 closes in 4 hours', 'd', 'c_bids'],
  ['12 tuyến-tuần lấp đầy dưới 70%', '12 lane-weeks below 70% fill',
    'Trợ lý định giá đã có khuyến nghị', 'The pricing assistant has recommendations', 'gd', 'c_inv'],
  ['3 chuyến sắp cập cảng chưa có giỏ dịch vụ', '3 arriving voyages without a service basket',
    'Chạy trợ lý chào giá theo chuyến', 'Run the voyage offering assistant', 'b', 'c_offer'],
  ['11,4 tỷ chờ đối soát', '11.4bn awaiting reconciliation',
    '18 booking đã giao, chưa xuất hoá đơn', '18 delivered bookings not yet invoiced', 'b', 'c_settle'],
]

/** c_dash — Provider dashboard (ui-2.html:2284). */
export async function CarrierDashboardPage({ lang }: RoutePageProps) {
  const [byLane, topAccounts, labels] = await Promise.all([
    db.select({
      lane: rateCards.laneCode,
      corridorId: lanes.corridorId,
      origin: ports.name,
      transit: lanes.transitDays,
      laneIndex: lanes.indexPrice,
      capacity: sql<number>`sum(${rateCards.capacity})::int`,
      sold: sql<number>`sum(${rateCards.sold})::int`,
      avgPrice: sql<number>`avg(${rateCards.currentPrice})::numeric`,
    })
      .from(rateCards)
      .innerJoin(lanes, eq(lanes.code, rateCards.laneCode))
      .innerJoin(ports, eq(ports.code, lanes.originPortCode))
      .groupBy(rateCards.laneCode, lanes.corridorId, ports.name, lanes.transitDays, lanes.indexPrice, lanes.ord)
      .orderBy(asc(lanes.ord)),
    db.select({
      member: members.name,
      teu: members.teu,
      revenue: cdpAccounts.revenue,
      trend: cdpAccounts.trend,
      churn: cdpAccounts.churnRiskCode,
    })
      .from(cdpAccounts)
      .innerJoin(members, eq(members.id, cdpAccounts.memberId))
      .where(eq(members.typeCode, 'shipper'))
      .orderBy(asc(cdpAccounts.memberId))
      .limit(12),
    statusLabelMap(lang),
  ])

  const totalCap = byLane.reduce((a, r) => a + r.capacity, 0)
  const totalSold = byLane.reduce((a, r) => a + r.sold, 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Tổng quan', 'Carrier · Overview')}
        title={t(lang, 'Bảng điều khiển nhà cung cấp', 'Provider dashboard')}
        sub={t(lang,
          'Hiệu suất bán chỗ, lấp đầy và doanh thu qua nền tảng. Nguồn đơn hàng đã xác minh, chi phí bán hàng thấp hơn và thanh toán nhanh hơn.',
          'Slot sales, utilisation and platform revenue. Verified demand, lower cost of sale and faster payment.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Doanh thu qua nền tảng', 'Revenue via platform')} value="104.2"
          unit={t(lang, 'tỷ đ', 'bn VND')} meta="+22,4% MoM" metaTone="u" spark={walk(80, 20, 0.06, 4)} />
        <KpiTile label={t(lang, 'Tỷ lệ lấp đầy', 'Slot utilisation')} value="87.4" unit="%"
          meta="+6,1 pp" metaTone="u" spark={walk(80, 20, 0.03, 9)} sparkColor="var(--up)" />
        <KpiTile label={t(lang, 'Chỗ đã bán', 'Slots sold')} value={num(totalSold)} unit="TEU"
          meta={t(lang, `trên ${num(totalCap)} chào bán`, `of ${num(totalCap)} offered`)} />
        <KpiTile label={t(lang, 'Tỷ lệ thắng thầu', 'Bid win rate')} value="34" unit="%"
          meta={t(lang, 'trung bình sàn 26%', 'platform avg 26%')} metaTone="u" />
        <KpiTile label={t(lang, 'Kỳ thu tiền (DSO)', 'Days sales outstanding')} value="11.4"
          unit={t(lang, 'ngày', 'days')}
          meta={t(lang, 'trước đây 46 ngày', 'was 46 days')} metaTone="u"
          spark={walk(40, 20, -0.02, 17)} />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Doanh thu & lấp đầy theo tuyến', 'Revenue & utilisation by lane')}
          bodyStyle={{ padding: 0 }}>
          <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, 'Tuyến', 'Lane')}</th>
                  <th className="c">{t(lang, 'Hành lang', 'Corridor')}</th>
                  <th className="r">{t(lang, 'Sức chở', 'Capacity')}</th>
                  <th className="r">{t(lang, 'Đã bán', 'Sold')}</th>
                  <th style={{ width: 130 }}>{t(lang, 'Lấp đầy', 'Fill')}</th>
                  <th className="r">{t(lang, 'Giá TB', 'Avg rate')}</th>
                  <th className="r">{t(lang, 'So chỉ số', 'vs index')}</th>
                  <th className="r">{t(lang, 'Doanh thu', 'Revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {byLane.map((l) => {
                  const avg = Math.round(Number(l.avgPrice))
                  const fill = Math.round((l.sold / l.capacity) * 100)
                  const dev = ((avg - Number(l.laneIndex)) / Number(l.laneIndex)) * 100
                  // USD slot revenue converted at the prototype's 26,500 VND rate, shown in bn.
                  const revenueBn = Math.round((l.sold * avg * 26500) / 1e9 * 10) / 10
                  return (
                    <tr key={l.lane}>
                      <td>
                        <b>{l.lane}</b>
                        <div className="muted">{l.origin} · {l.transit} {t(lang, 'ngày', 'd')}</div>
                      </td>
                      <td className="c"><Tag tone="n">{String(l.corridorId).padStart(2, '0')}</Tag></td>
                      <td className="r num">{num(l.capacity)}</td>
                      <td className="r num">{num(l.sold)}</td>
                      <td>
                        <Meter value={fill} width={66}
                          color={fill > 90 ? 'var(--up)' : fill > 75 ? 'var(--brand-500)' : 'var(--gold-500)'} />
                      </td>
                      <td className="r num">{usd(avg)}</td>
                      <td className="r"><Tag tone={dev > 0 ? 'u' : 'd'}>{pct(dev)}</Tag></td>
                      <td className="r num" style={{ fontWeight: 700 }}>
                        {num(revenueBn, 1)} {t(lang, 'tỷ', 'bn')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Kênh bán', 'Sales channel mix')}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Donut items={CHANNEL_MIX.map(([, , v, c]) => ({ v, c }))} size={148} thickness={22} />
            </div>
            <div style={{ marginTop: 11, fontSize: 12 }}>
              {CHANNEL_MIX.map(([vi, en, v, c]) => (
                <div key={en} className="between" style={{ padding: '3px 0' }}>
                  <span>
                    <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: c, marginRight: 6 }} />
                    {t(lang, vi, en)}
                  </span>
                  <b className="num">{v}%</b>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t(lang, 'Việc cần làm', 'Action queue')} bodyStyle={{ padding: 10 }}>
            {CARRIER_ACTIONS.map(([vi, en, dVi, dEn, toneCode, route]) => (
              <Link key={en} href={`/r/${route}`} className="cq-row">
                <Tag tone={toneCode}>●</Tag>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 12 }}>{t(lang, vi, en)}</b>
                  <div className="muted">{t(lang, dVi, dEn)}</div>
                </div>
                <span className="muted">→</span>
              </Link>
            ))}
          </Card>
        </div>
      </div>

      <div className="grid g2">
        <Card title={t(lang, 'Giá của tôi so với thị trường', 'My rate versus the market')}
          right={<span className="sub">CMT-SIN · 40HC</span>}>
          <LineChart
            series={[
              { data: walk(720, 50, 0.02, 13), color: 'var(--violet)' },
              { data: walk(742, 50, 0.016, 21), color: 'var(--gold-500)', dash: true, dot: false },
              { data: walk(690, 50, 0.024, 31), color: 'var(--text-3)', dot: false },
            ]}
            height={200}
            labels={['W28', 'W30', 'W32', 'W34', 'W36']}
            fmt={(v) => usd(Math.round(v))}
          />
          <Legend items={[
            { color: 'var(--violet)', label: t(lang, 'Giá của tôi', 'My rate') },
            { color: 'var(--gold-500)', label: t(lang, 'Chỉ số VLX', 'VLX Index') },
            { color: 'var(--text-3)', label: t(lang, 'Giá thấp nhất tuyến', 'Lowest on lane') },
          ]} />
        </Card>

        <Card title={t(lang, 'Khách hàng hàng đầu trên nền tảng', 'Top counterparties on the platform')}
          bodyStyle={{ padding: 0 }}>
          <div className="tbl-wrap" style={{ maxHeight: 340 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, 'Chủ hàng', 'Shipper')}</th>
                  <th className="r">TEU YTD</th>
                  <th className="r">{t(lang, 'Doanh thu', 'Revenue')}</th>
                  <th className="c">{t(lang, 'Xu hướng', 'Trend')}</th>
                  <th className="c">{t(lang, 'Rủi ro', 'Risk')}</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((a) => (
                  <tr key={a.member}>
                    <td><b style={{ fontSize: 12 }}>{a.member}</b></td>
                    <td className="r num">{num(a.teu)}</td>
                    <td className="r num">{num(a.revenue)} {t(lang, 'tỷ', 'bn')}</td>
                    <td className="c">
                      <Sparkline
                        values={walk(10, 14, Number(a.trend) > 0 ? 0.14 : 0.16, a.teu / 100)}
                        width={68} height={22}
                        color={Number(a.trend) > 0 ? 'var(--up)' : 'var(--down)'}
                      />
                    </td>
                    <td className="c">
                      <Tag tone={(labels.get(a.churn)?.tone ?? 'n') as Tone}>
                        {labels.get(a.churn)?.label ?? a.churn}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

/** ui-2.html:2450 — non-slot services the provider also lists on the platform. */
const OTHER_SERVICES: Array<[string, string, string, string, string, string, number]> = [
  ['Kho ngoại quan Nam Đình Vũ', 'NDV bonded warehouse', '8,400 m²', '8,400 m²',
    '$4.2/m²/tháng', '$4.2/m²/mo', 86],
  ['Depot & sửa chữa cont Cái Mép', 'Cai Mep depot & box repair', '2,100 TEU', '2,100 TEU',
    '$1.8/TEU/ngày', '$1.8/TEU/day', 72],
  ['Vận tải bộ HCM – Cái Mép', 'Trucking HCM – Cai Mep', '120 chuyến/tuần', '120 trips/wk',
    '$168/chuyến', '$168/trip', 91],
  ['Sà lan Cát Lái – Cái Mép', 'Barge Cat Lai – Cai Mep', '640 TEU/tuần', '640 TEU/wk',
    '$92/TEU', '$92/TEU', 64],
  ['Kho lạnh Long An', 'Long An cold store', '4,200 pallet', '4,200 pallets',
    '$0.42/pallet/ngày', '$0.42/pallet/day', 58],
]

/** c_inv — Capacity & Rates, including the clickable rate heatmap (ui-2.html:2375). */
export async function CapacityRatesPage({ lang, basePath, searchParams }: RoutePageProps) {
  const one = (k: string): string => {
    const v = searchParams[k]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const filters: HeatFilters = {
    corridor: one('hm.cor'), equipment: one('hm.eq'), weekBand: one('hm.wk'),
    fillBand: one('hm.fill'), pricing: one('hm.mode'), minSlots: one('hm.min'),
  }

  const [rows, laneRows, laneOpts, eqOpts] = await Promise.all([
    db.select({
      id: rateCards.id,
      lane: rateCards.laneCode,
      week: rateCards.week,
      weekIndex: rateCards.weekIndex,
      equipment: rateCards.equipmentCode,
      current: rateCards.currentPrice,
      index: rateCards.indexPrice,
      suggested: rateCards.suggestedPrice,
      capacity: rateCards.capacity,
      sold: rateCards.sold,
      remaining: rateCards.remaining,
      fill: rateCards.fillPct,
      auto: rateCards.autoPricing,
      published: rateCards.published,
      daysOut: rateCards.daysOut,
      corridorId: rateCards.corridorId,
    }).from(rateCards).orderBy(asc(rateCards.laneCode), asc(rateCards.weekIndex)),
    db.select({
      code: lanes.code, corridorId: lanes.corridorId, ord: lanes.ord,
      origin: sql<string>`origin.name`, dest: sql<string>`dest.name`,
    })
      .from(lanes)
      .innerJoin(sql`${ports} AS origin`, sql`origin.code = ${lanes.originPortCode}`)
      .innerJoin(sql`${ports} AS dest`, sql`dest.code = ${lanes.destPortCode}`)
      .orderBy(asc(lanes.ord)),
    laneOptions(),
    equipmentOptions(),
  ])

  // Row-level filters (ui-2.html:2257 hmRows) narrow which rate-card rows feed the grid.
  const inWeekBand = (wi: number) =>
    filters.weekBand === 'a' ? wi <= 4
      : filters.weekBand === 'b' ? wi >= 5 && wi <= 8
        : filters.weekBand === 'c' ? wi >= 9 : true
  const matched = rows.filter((r) =>
    (!filters.corridor || String(r.corridorId) === filters.corridor)
    && (!filters.equipment || r.equipment === filters.equipment)
    && (!filters.pricing || String(r.auto ? 1 : 0) === filters.pricing)
    && inWeekBand(r.weekIndex)
    && (!filters.minSlots || r.remaining >= Number(filters.minSlots)))

  const heatLanes = laneRows.filter((l) => !filters.corridor || String(l.corridorId) === filters.corridor)
  const weekList = [...new Map(rows.map((r) => [r.week, r.weekIndex])).entries()]
    .map(([week, weekIndex]) => ({ week, weekIndex }))
    .filter((w) => inWeekBand(w.weekIndex))
    .sort((a, b) => a.weekIndex - b.weekIndex)

  // One cell per lane x week, aggregating the equipment types still in scope.
  const cells: RateCell[] = []
  for (const lane of heatLanes) {
    for (const w of weekList) {
      const group = matched.filter((r) => r.lane === lane.code && r.week === w.week)
      if (!group.length) {
        cells.push({
          laneCode: lane.code, origin: lane.origin, dest: lane.dest, week: w.week,
          weekIndex: w.weekIndex, fill: null, left: 0, capacity: 0, sold: 0, rows: 0, passes: false,
        })
        continue
      }
      const capacity = group.reduce((a, r) => a + r.capacity, 0)
      const sold = group.reduce((a, r) => a + r.sold, 0)
      const fill = Math.round((sold / capacity) * 100)
      cells.push({
        laneCode: lane.code, origin: lane.origin, dest: lane.dest, week: w.week,
        weekIndex: w.weekIndex, fill, left: capacity - sold, capacity, sold,
        rows: group.length, passes: cellPasses(fill, filters.fillBand),
      })
    }
  }

  const avgSuggested = matched.length
    ? matched.reduce((a, r) => a + Number(r.suggested), 0) / matched.length
    : 0

  // An open cell (?hm=LANE|WEEK) becomes the reprice dialog.
  const openCell = one('hm')
  let repriceTarget: RepriceTarget | null = null
  if (openCell) {
    const [laneCode, week] = openCell.split('|')
    const group = matched.filter((r) => r.lane === laneCode && r.week === week)
    if (group.length) {
      const capacity = group.reduce((a, r) => a + r.capacity, 0)
      const sold = group.reduce((a, r) => a + r.sold, 0)
      const avg = (pick: (r: typeof group[number]) => number) =>
        Math.round(group.reduce((a, r) => a + pick(r), 0) / group.length)
      repriceTarget = {
        laneCode, week,
        equipmentLabel: group.length > 1
          ? t(lang, 'Tất cả loại cont đang chọn', 'All selected equipment')
          : group[0].equipment,
        current: avg((r) => Number(r.current)),
        index: avg((r) => Number(r.index)),
        suggested: avg((r) => Number(r.suggested)),
        capacity, sold, left: capacity - sold,
        fill: Math.round((sold / capacity) * 100),
        daysOut: group[0].daysOut,
        autoPricing: group[0].auto,
      }
    }
  }

  const unpublished = rows.filter((r) => !r.published).length
  const autoPriced = rows.filter((r) => r.auto).length
  const totalCapacity = rows.reduce((a, r) => a + r.capacity, 0)
  const unsold = rows.reduce((a, r) => a + r.remaining, 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Năng lực & Niêm yết giá', 'Capacity & Rates')}
        modules={['F04']}
        sub={t(lang,
          'Bản đồ nhiệt mức lấp đầy theo tuyến và tuần. Nhấp vào ô để mở bảng điều chỉnh giá. Giá chưa công bố không xuất hiện trong kết quả tìm kiếm của chủ hàng.',
          'Fill-rate heatmap by lane and week. Click a cell to reprice it. Unpublished rates do not appear in shipper search results.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Dòng bảng cước', 'Rate-card rows')} value={num(rows.length)}
          meta={t(lang, '8 tuyến × 13 tuần × 4 loại cont', '8 lanes × 13 weeks × 4 equipment types')} />
        <KpiTile label={t(lang, 'Sức chở đã công bố', 'Published capacity')} value={num(totalCapacity)} unit="TEU"
          meta={t(lang, '13 tuần tới', 'next 13 weeks')} />
        <KpiTile label={t(lang, 'Chỗ còn trống', 'Unsold capacity')} value={num(unsold)} unit="TEU"
          meta={t(lang, 'doanh thu tiềm năng', 'revenue at risk')} metaTone="gd" />
        <KpiTile label={t(lang, 'Doanh thu / chỗ', 'Revenue per slot')} value="$1,284"
          meta="+3,1%" metaTone="u" />
        <KpiTile label={t(lang, 'Định giá tự động', 'Auto-priced rows')} value={num(autoPriced)}
          meta={t(lang, 'theo chỉ số VLX', 'index-linked')} metaTone="v" />
      </div>

      <RateHeatmap
        cells={cells} lanes={heatLanes} weeks={weekList} filters={filters}
        totalRows={rows.length} matchedRows={matched.length} avgSuggested={avgSuggested}
        lang={lang} basePath={basePath} searchParams={searchParams}
      />

      <DataTable
        id="rc" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Bảng cước đang niêm yết', 'Published rate card')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm tuyến, tuần, loại cont…', 'Search lane, week, equipment…')}
        search={(r) => `${r.lane} ${r.week} ${r.equipment}`}
        rowHref={(r) => tableHref(basePath, searchParams, { hm: `${r.lane}|${r.week}` })}
        filters={[
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
          { key: 'eq', label: t(lang, 'Thiết bị', 'Equipment'), options: eqOpts, match: (r, v) => r.equipment === v },
          {
            key: 'pub', label: t(lang, 'Công bố', 'Published'),
            options: [['1', t(lang, 'Đã công bố', 'Published')], ['0', t(lang, 'Chưa công bố', 'Unpublished')]],
            match: (r, v) => (v === '1' ? r.published : !r.published),
          },
        ]}
        columns={[
          { key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '11%', sortValue: (r) => r.lane, render: (r) => <b style={{ fontSize: 12 }}>{r.lane}</b> },
          { key: 'week', header: t(lang, 'Tuần', 'Week'), cls: 'c', width: '8%', sortValue: (r) => r.weekIndex, render: (r) => <span className="num">{r.week}</span> },
          { key: 'eq', header: t(lang, 'Thiết bị', 'Equipment'), width: '13%', sortValue: (r) => r.equipment, render: (r) => r.equipment },
          {
            key: 'price', header: t(lang, 'Giá hiện tại', 'Current'), cls: 'r', width: '13%',
            sortValue: (r) => Number(r.current),
            render: (r) => {
              const delta = ((Number(r.current) - Number(r.index)) / Number(r.index)) * 100
              return (
                <div>
                  <b className="num">{usd(r.current)}</b>
                  <div className="muted num">
                    {t(lang, 'chỉ số', 'index')} {usd(r.index)}{' '}
                    <span style={{ color: delta >= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(delta)}</span>
                  </div>
                </div>
              )
            },
          },
          { key: 'sug', header: t(lang, 'Gợi ý', 'Suggested'), cls: 'r', width: '10%', sortValue: (r) => Number(r.suggested), render: (r) => <span className="num muted">{usd(r.suggested)}</span> },
          {
            key: 'fill', header: t(lang, 'Lấp đầy', 'Fill'), width: '13%', sortValue: (r) => r.fill,
            render: (r) => (
              <div>
                <Meter value={r.fill} width={64} />
                <div className="muted num">{num(r.sold)} / {num(r.capacity)} TEU</div>
              </div>
            ),
          },
          { key: 'left', header: t(lang, 'Còn lại', 'Remaining'), cls: 'r', width: '9%', sortValue: (r) => r.remaining, render: (r) => <span className="num">{num(r.remaining)}</span> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '11%',
            render: (r) => (
              <div className="flex wrap" style={{ gap: 3, justifyContent: 'center' }}>
                {r.published ? <Tag tone="u">{t(lang, 'Công bố', 'Live')}</Tag> : <Tag tone="gd">{t(lang, 'Nháp', 'Draft')}</Tag>}
                {r.auto ? <Tag tone="b">{t(lang, 'Tự động', 'Auto')}</Tag> : null}
              </div>
            ),
          },
        ]}
      />

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card title={t(lang, 'Trợ lý định giá', 'Pricing assistant')}
          right={<TierPill tier={2} lang={lang} />} bodyStyle={{ padding: 11 }}>
          {rows
            .filter((r) => r.fill < 70 && r.remaining >= 12 && r.equipment !== 'LCL / m³' && r.daysOut <= 28)
            .sort((a, b) => (a.fill - b.fill) || (b.remaining - a.remaining))
            .slice(0, 4)
            .map((r) => {
              // ui-2.html:2436 — a cut is modelled as converting 42% of the unsold slots.
              const extra = Math.round(r.remaining * 0.42)
              const revenue = extra * Number(r.suggested)
              return (
                <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 11, marginBottom: 8 }}>
                  <b style={{ fontSize: 12.5 }}>
                    {t(lang, 'Hạ giá', 'Cut')} {r.lane} {r.week} · {r.equipment}{' '}
                    {t(lang, 'xuống', 'to')} {usd(r.suggested)}
                  </b>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {t(lang, 'Lấp đầy đang', 'Fill at')} {r.fill}%, {t(lang, 'còn trống', 'unsold')} {r.remaining} TEU.{' '}
                    {t(lang, 'Mô phỏng: bán thêm', 'Simulation: +')} {extra} TEU,{' '}
                    {t(lang, 'doanh thu ròng', 'net revenue')} +{usd(revenue)}.
                  </div>
                  <div className="flex" style={{ marginTop: 7 }}>
                    <span className="btn xs p">{t(lang, 'Áp dụng', 'Apply')}</span>
                    <span className="btn xs">{t(lang, 'Bỏ qua', 'Dismiss')}</span>
                  </div>
                </div>
              )
            })}
          <div className="note">
            {t(lang,
              'Đây là mức L2 — hệ thống đề xuất, người có thẩm quyền của bạn duyệt trước khi giá có hiệu lực. Nền tảng không áp đặt giá động một chiều.',
              'This is tier L2 — the system advises, your authorised user approves before a rate takes effect. The platform never imposes one-sided dynamic pricing.')}
          </div>
        </Card>

        <Card title={t(lang, 'Dịch vụ khác đang niêm yết', 'Other listed services')} bodyStyle={{ padding: 11 }}>
          {OTHER_SERVICES.map(([nVi, nEn, qVi, qEn, pVi, pEn, util]) => (
            <div key={nEn} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
              <div className="between">
                <div>
                  <b style={{ fontSize: 12 }}>{t(lang, nVi, nEn)}</b>
                  <div className="muted">{t(lang, qVi, qEn)}</div>
                </div>
                <b className="num" style={{ fontSize: 12.5 }}>{t(lang, pVi, pEn)}</b>
              </div>
              <div style={{ marginTop: 4 }}>
                <Meter value={util} width={80} color={util > 80 ? 'var(--up)' : 'var(--gold-500)'} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {repriceTarget ? (
        <RepriceModal target={repriceTarget} lang={lang} basePath={basePath} searchParams={searchParams} />
      ) : null}
    </>
  )
}

/** ui-2.html:2509 — the three proposed options. Guardrail is 8%, hard stop at 12%. */
interface OfferOption {
  on: Record<string, boolean>
  discount: number
  win: number
  color: string
  bg: string
  fg: string
  nameVi: string
  nameEn: string
  subVi: string
  subEn: string
}

const OFFER_OPTIONS: OfferOption[] = [
  {
    on: { port: true, truck: true, wh: true, cold: true, cust: true, ins: true },
    discount: 4, win: 62, color: 'var(--brand-500)', bg: 'var(--brand-100)', fg: 'var(--brand-600)',
    nameVi: 'Phương án A — Tối đa doanh thu', nameEn: 'Option A — Revenue maximising',
    subVi: 'Đầy đủ 6 dịch vụ, chiết khấu 4%', subEn: 'All 6 services, 4% discount',
  },
  {
    on: { port: true, truck: true, wh: false, cold: true, cust: true, ins: false },
    discount: 6, win: 78, color: 'var(--up)', bg: 'var(--up-bg)', fg: 'var(--up)',
    nameVi: 'Phương án B — Cân bằng', nameEn: 'Option B — Balanced',
    subVi: '4 dịch vụ cốt lõi, chiết khấu 6%', subEn: '4 core services, 6% discount',
  },
  {
    on: { port: true, truck: true, wh: false, cold: false, cust: true, ins: false },
    discount: 9, win: 91, color: 'var(--gold-500)', bg: 'var(--gold-100)', fg: '#9A6B08',
    nameVi: 'Phương án C — Giữ khách', nameEn: 'Option C — Retention',
    subVi: '3 dịch vụ, chiết khấu 9% (cần duyệt)', subEn: '3 services, 9% discount (needs approval)',
  },
]

/** ui-2.html:2513 — basket line items priced off the voyage value. */
function offerServices(value: number, reefer: number, lang: Lang) {
  return [
    ['port', t(lang, 'Xếp dỡ cảng', 'Terminal handling'), Math.round(value * 0.62)],
    ['truck', t(lang, 'Vận tải bộ chặng cuối', 'Last-mile trucking'), Math.round(value * 0.14)],
    ['wh', t(lang, 'Lưu kho ngoại quan', 'Bonded warehousing'), Math.round(value * 0.09)],
    ['cold', t(lang, 'Kho lạnh & cắm điện reefer', 'Cold store & reefer plug'), Math.max(1, Math.round(reefer * 0.9))],
    ['cust', t(lang, 'Khai báo hải quan', 'Customs brokerage'), Math.round(value * 0.04)],
    ['ins', t(lang, 'Bảo hiểm hàng hoá', 'Cargo insurance'), Math.max(1, Math.round(value * 0.013))],
  ] as Array<[string, string, number]>
}

/** ui-2.html:2523 — margin erodes 0.6pp per point of discount off a 26.6% base. */
const offerMargin = (discount: number) => Math.round((26.6 - discount * 0.6) * 10) / 10

/** c_offer — Voyage Offering Assistant (ui-2.html:2508). */
export async function VoyageOfferingPage({ lang, basePath, searchParams }: RoutePageProps) {
  const one = (k: string): string => {
    const v = searchParams[k]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const [rows, labels, laneOpts, carrierOpts] = await Promise.all([
    db.select({
      id: voyages.id,
      vessel: voyages.vessel,
      lane: voyages.laneCode,
      carrier: carriers.name,
      carrierCode: voyages.carrierCode,
      customer: members.name,
      eta: voyages.eta,
      teu: voyages.teu,
      reefer: voyages.reeferTeu,
      shareOfWallet: voyages.shareOfWallet,
      basket: voyages.serviceBasket,
      discount: voyages.discountPct,
      value: voyages.value,
      status: voyages.statusCode,
      confidence: voyages.confidence,
      corridorId: voyages.corridorId,
      laneIndex: lanes.indexPrice,
    })
      .from(voyages)
      .innerJoin(carriers, eq(carriers.code, voyages.carrierCode))
      .innerJoin(members, eq(members.id, voyages.customerMemberId))
      .innerJoin(lanes, eq(lanes.code, voyages.laneCode))
      // Insertion order, so the detailed voyage is the prototype's VOYAGES[0].
      .orderBy(asc(voyages.id)),
    statusLabelMap(lang),
    laneOptions(),
    carrierOptions(),
  ])

  const quoted = rows.filter((r) => r.status !== 'draft')
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)

  // The prototype always details VOYAGES[0]; the option is selectable via `?opt=`.
  const v = rows[0]
  const optIndex = Math.min(2, Math.max(0, Number(one('opt')) || 0))
  const opt = OFFER_OPTIONS[optIndex]
  const services = offerServices(Number(v.value), v.reefer, lang)
  const gross = (o: OfferOption) =>
    services.reduce((a, [k, , price]) => a + (o.on[k] ? price : 0), 0)
  const net = (o: OfferOption) => Math.round(gross(o) * (1 - o.discount / 100))

  /** ui-2.html:2556 — the six-agent chain that produced this proposal. */
  const trace: Array<[string, number, string, string, string, number]> = [
    ['Cargo Tracking', 1,
      'Nhận chuyến từ AIS + EDI manifest, xác nhận ETA',
      'Ingested voyage from AIS + EDI manifest, confirmed ETA', '0.4s', 98],
    ['Market Intelligence', 1,
      `So chỉ số tuyến ${usd(v.laneIndex)}, độ sâu nhu cầu tuần ${v.eta}`,
      `Benchmarked lane index ${usd(v.laneIndex)}, demand depth for week ${v.eta}`, '1.1s', 94],
    ['Route Optimization', 2,
      'Đề xuất 3 phương án dịch vụ theo lịch cầu bến và năng lực depot',
      'Proposed 3 service options from berth schedule and depot capacity', '2.3s', 88],
    ['Risk & Compliance', 3,
      'Rà soát KYB và cấm vận đối với khách hàng — sạch',
      'Screened KYB and sanctions for the customer — clear', '0.9s', 99],
    ['Insurance Underwriting', 2,
      'Điểm rủi ro tuyến và hàng lạnh, báo giá bảo hiểm nháp 0,13%',
      'Lane and reefer risk score, draft insurance quote at 0.13%', '1.6s', 86],
    ['Smart Alert & Action', 3,
      'Đề xuất giỏ dịch vụ và mức chiết khấu — chờ người duyệt',
      'Proposed service basket and discount — awaiting human approval', '0.3s', 91],
  ]

  /** ui-2.html:2578 — the log reflects whichever option is applied. */
  const activityLog: Array<[string, string, string, string]> = [
    ['AI Agent chạy chuỗi 6 bước', 'Agent ran 6-step chain', '14:32:08', 'L1'],
    opt.on.cold
      ? ['Người dùng bật dịch vụ kho lạnh', 'User enabled cold store', '14:33:12', 'L3']
      : ['Người dùng bỏ dịch vụ kho lạnh khỏi giỏ', 'User removed cold store from the basket', '14:33:12', 'L3'],
    [`Chiết khấu đặt ở mức ${opt.discount}%`, `Discount set to ${opt.discount}%`, '14:33:48', 'L2'],
    opt.discount > 8
      ? ['Hệ thống cảnh báo vượt hạn mức 8%', 'System flagged the 8% guardrail breach', '14:34:02', 'L2']
      : ['Chiết khấu nằm trong hạn mức 8%', 'Discount within the 8% guardrail', '14:34:02', 'L2'],
    [`Người dùng chọn ${lang === 'vi' ? opt.nameVi : opt.nameEn}`,
      `User selected ${opt.nameEn}`, '14:34:21', 'L3'],
  ]

  const optHref = (i: number) => tableHref(basePath, searchParams, { opt: String(i) })

  /** Basket flags shown per row in the pipeline table. */
  const basketKeys: Array<[string, string, string]> = [
    ['port', 'Cảng', 'Port'], ['truck', 'Xe', 'Truck'], ['wh', 'Kho', 'WH'],
    ['cold', 'Lạnh', 'Cold'], ['cust', 'HQ', 'Customs'], ['ins', 'BH', 'Ins'],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Trợ lý chào giá theo chuyến', 'Voyage Offering Assistant')}
        modules={['F15']}
        sandbox={['SB-06']}
        sub={t(lang,
          'Chuyến được nhận tự động từ AIS và EDI manifest. AI đề xuất phương án và giỏ dịch vụ; bạn tuỳ chỉnh, chiết khấu trong hạn mức và quyết định. Mọi hành động đều được ghi lại.',
          'Voyages arrive automatically from AIS and the EDI manifest. AI proposes options and a service basket; you adjust, discount within guardrails and decide. Every action is logged.')}
        actions={
          <>
            <span className="btn">▶ {t(lang, 'Chạy lại AI Agent', 'Re-run agent')}</span>
            <span className="btn p">{t(lang, 'Tạo báo giá', 'Create quote')}</span>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Chuyến đang xử lý', 'Voyages in pipeline')} value={num(rows.length)}
          meta={t(lang, 'tự động từ AIS + EDI', 'auto from AIS + EDI')} />
        <KpiTile label={t(lang, 'Đã chào giá', 'Quoted')} value={num(quoted.length)}
          meta={t(lang, 'tỷ lệ thắng 66%', '66% win rate')} metaTone="u" />
        <KpiTile label={t(lang, 'Giá trị pipeline', 'Pipeline value')}
          value={`$${num(Math.round(totalValue / 1000))}K`}
          meta={t(lang, '26 tuần tới', 'next 26 weeks')} />
        <KpiTile label={t(lang, 'Dịch vụ / chuyến', 'Services per voyage')} value="3.4"
          meta={t(lang, '+1,2 so với trước', '+1.2 vs before')} metaTone="u" />
        <KpiTile label={t(lang, 'Độ tin cậy đề xuất TB', 'Avg recommendation confidence')} value="88"
          unit="%" meta={<TierPill tier={2} lang={lang} />} />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card
          title={v.vessel}
          right={<><Tag tone="b">{v.customer}</Tag> <Tag tone="n">SoW {v.shareOfWallet}%</Tag></>}
          footer={t(lang,
            'AI đề xuất — bạn quyết định. Đây là mức L2/L3 theo phân tầng tự chủ.',
            'AI advises — you decide. This runs at tiers L2/L3 of the autonomy ladder.')}>
          <div className="grid g4" style={{ gap: 10, marginBottom: 14 }}>
            {([
              [t(lang, 'Hành trình → ETA', 'Route → ETA'), `${v.lane} · ${v.eta}`],
              [t(lang, 'Sản lượng', 'Volume'), `${num(v.teu)} TEU · ${v.reefer} reefer`],
              [t(lang, 'Giá trị chuyến', 'Voyage value'), `$${num(v.value)}K`],
              [t(lang, 'Hành lang', 'Corridor'), String(v.corridorId).padStart(2, '0')],
            ] as Array<[string, string]>).map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
                <div className="muted">{label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>

          <b style={{ fontSize: 12.5 }}>🧠 {t(lang, 'Chuỗi xử lý của AI Agent', 'Agent run trace')}</b>
          <div className="trace" style={{ marginTop: 9 }}>
            {trace.map(([agent, tier, dVi, dEn, elapsed, confidence]) => (
              <div className="trace-step" key={agent}>
                <div className="between">
                  <b>{agent} <span className={`tier l${tier}`}>L{tier}</span></b>
                  <span className="t">{elapsed} · {t(lang, 'tin cậy', 'confidence')} {confidence}%</span>
                </div>
                <p>{t(lang, dVi, dEn)}</p>
              </div>
            ))}
          </div>

          <div className="sep" />
          <b style={{ fontSize: 12.5 }}>🧺 {t(lang, 'Giỏ dịch vụ đề xuất cho chuyến', 'Proposed service basket')}</b>
          <span className="muted" style={{ marginLeft: 7 }}>
            {t(lang, `theo ${opt.nameVi}`, `per ${opt.nameEn}`)}
          </span>
          <div className="grid g3" style={{ gap: 9, marginTop: 9 }}>
            {services.map(([key, label, price]) => {
              const on = opt.on[key]
              return (
                <div key={key} style={{
                  border: `1px solid ${on ? opt.color : 'var(--line)'}`,
                  background: on ? opt.bg : 'transparent',
                  borderRadius: 'var(--r)', padding: 10,
                }}>
                  <div className="flex" style={{ gap: 7 }}>
                    <input type="checkbox" checked={on} disabled readOnly />
                    <b style={{ fontSize: 12 }}>{label}</b>
                  </div>
                  <div className="num" style={{
                    fontSize: 13, fontWeight: 750, marginTop: 3,
                    color: on ? opt.fg : 'var(--text-3)',
                  }}>
                    ${num(price)}K{key === 'ins' ? <span className="muted"> · 0,13%</span> : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                {t(lang, 'Chiết khấu áp dụng', 'Discount applied')} — {opt.discount}%
                {opt.discount > 8 ? <> <Tag tone="d">{t(lang, 'vượt hạn mức', 'above guardrail')}</Tag></> : null}
              </label>
              <div className="bar" style={{ marginTop: 6 }}>
                <i style={{ width: `${(opt.discount / 12) * 100}%`, background: opt.color }} />
              </div>
              <div className="between muted">
                <span>0%</span>
                <span style={{ color: 'var(--gold-500)' }}>{t(lang, 'Hạn mức của bạn: 8%', 'Your guardrail: 8%')}</span>
                <span>12%</span>
              </div>
            </div>
            <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: 11 }}>
              <DefinitionList rows={[
                [t(lang, 'Giá trị giỏ dịch vụ', 'Basket value'), <span className="num">${num(gross(opt))}K</span>],
                [t(lang, 'Sau chiết khấu', 'After discount'), <span className="num">${num(net(opt))}K</span>],
                [<b>{t(lang, 'Biên LN gộp dự kiến', 'Est. gross margin')}</b>,
                  <span className="num" style={{ color: 'var(--up)' }}>{num(offerMargin(opt.discount), 1)}%</span>],
              ]} />
            </div>
          </div>

          <div className="note" style={{ background: 'var(--gold-100)' }}>
            <b>⚠ Guardrail:</b>{' '}
            {t(lang,
              'Chiết khấu trên 8% vượt hạn mức của bạn và cần Giám đốc Thương vụ phê duyệt. Chiết khấu trên 12% bị hệ thống từ chối. Mọi lần vượt hạn mức đều được ghi vào decision trace.',
              'A discount above 8% exceeds your guardrail and requires Commercial Director approval. Above 12% the system refuses. Every breach is written to the decision trace.')}
          </div>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Ba phương án AI đề xuất', 'Three AI-proposed options')}
            right={<span className="sub">{t(lang, 'Nhấp để chọn phương án', 'Click to select an option')}</span>}
            bodyStyle={{ padding: 11 }}>
            {OFFER_OPTIONS.map((o, i) => {
              const on = optIndex === i
              return (
                <Link key={i} href={optHref(i)} scroll={false} style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  border: `${on ? 2 : 1}px solid ${on ? o.color : 'var(--line)'}`,
                  background: on ? o.bg : 'transparent',
                  borderRadius: 'var(--r)', padding: on ? 11 : 12, marginBottom: 8,
                }}>
                  <div className="between">
                    <b style={{ fontSize: 12.5, color: on ? o.fg : 'var(--text)' }}>
                      {on ? '◉ ' : '○ '}{lang === 'vi' ? o.nameVi : o.nameEn}
                    </b>
                    <span>
                      {i === 0 ? <Tag tone="b">{t(lang, 'AI chọn', 'AI pick')}</Tag> : null}
                      {on ? <> <Tag tone="n">{t(lang, 'Đang áp dụng', 'Applied')}</Tag></> : null}
                    </span>
                  </div>
                  <div className="muted" style={{ marginTop: 2 }}>{t(lang, o.subVi, o.subEn)}</div>
                  <div className="grid g3" style={{ gap: 7, marginTop: 7 }}>
                    <div>
                      <div className="muted">{t(lang, 'Sau chiết khấu', 'After discount')}</div>
                      <b className="num">${num(net(o))}K</b>
                    </div>
                    <div>
                      <div className="muted">{t(lang, 'Biên LN', 'Margin')}</div>
                      <b className="num">{num(offerMargin(o.discount), 1)}%</b>
                    </div>
                    <div>
                      <div className="muted">{t(lang, 'Khả năng chốt', 'Win prob.')}</div>
                      <b className="num">{o.win}%</b>
                    </div>
                  </div>
                </Link>
              )
            })}
          </Card>

          <Card title={t(lang, 'Nhật ký hoạt động', 'Activity log')} bodyStyle={{ padding: 10 }}>
            {activityLog.map(([vi, en, at, tier]) => (
              <div key={at} className="between" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                <span style={{ fontSize: 11.5 }}>{t(lang, vi, en)}</span>
                <span className="flex" style={{ gap: 6 }}>
                  <span className={`tier l${tier.charAt(1)}`}>{tier}</span>
                  <span className="muted num">{at}</span>
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <DataTable
        id="voy" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Chuyến & giỏ dịch vụ đề xuất', 'Voyages & proposed service basket')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm chuyến, tàu, khách hàng…', 'Search voyage, vessel, customer…')}
        search={(r) => `${r.id} ${r.vessel} ${r.customer} ${r.lane}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['draft', 'quoted', 'won', 'lost']),
            match: (r, v) => r.status === v,
          },
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
          { key: 'car', label: t(lang, 'Hãng tàu', 'Carrier'), options: carrierOpts, match: (r, v) => r.carrierCode === v },
        ]}
        columns={[
          {
            key: 'id', header: t(lang, 'Chuyến', 'Voyage'), width: '15%', sortValue: (r) => r.id,
            render: (r) => (
              <div>
                <b className="num" style={{ fontSize: 12 }}>{r.id}</b>
                <div className="muted">{r.vessel}</div>
              </div>
            ),
          },
          { key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '9%', sortValue: (r) => r.lane, render: (r) => <b style={{ fontSize: 12 }}>{r.lane}</b> },
          { key: 'cust', header: t(lang, 'Khách hàng', 'Customer'), width: '17%', sortValue: (r) => r.customer, render: (r) => <span style={{ fontSize: 12 }}>{r.customer}</span> },
          {
            key: 'teu', header: 'TEU', cls: 'r', width: '9%', sortValue: (r) => r.teu,
            render: (r) => (
              <div>
                <b className="num">{num(r.teu)}</b>
                {r.reefer > 0 ? <div className="muted num">{num(r.reefer)} reefer</div> : null}
              </div>
            ),
          },
          {
            key: 'basket', header: t(lang, 'Giỏ dịch vụ', 'Service basket'), width: '18%',
            render: (r) => {
              const b = r.basket as Record<string, unknown>
              return (
                <div className="flex wrap" style={{ gap: 3 }}>
                  {basketKeys.filter(([k]) => Boolean(b?.[k])).map(([k, vi, en]) => (
                    <Tag key={k} tone="b">{lang === 'vi' ? vi : en}</Tag>
                  ))}
                </div>
              )
            },
          },
          {
            key: 'sow', header: t(lang, 'Share of wallet', 'Wallet share'), width: '11%',
            sortValue: (r) => r.shareOfWallet,
            render: (r) => <Meter value={r.shareOfWallet} width={64} />,
          },
          { key: 'disc', header: t(lang, 'Chiết khấu', 'Discount'), cls: 'r', width: '8%', sortValue: (r) => Number(r.discount), render: (r) => <span className="num">{num(r.discount, 1)}%</span> },
          { key: 'value', header: t(lang, 'Giá trị', 'Value'), cls: 'r', width: '9%', sortValue: (r) => Number(r.value), render: (r) => <b className="num">{num(r.value)}k</b> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%', sortValue: (r) => r.status,
            render: (r) => (
              <div>
                <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>
                <div className="muted num" style={{ marginTop: 2 }}>{r.confidence}%</div>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}

/** c_bids — Bid Inbox (ui-2.html:2634). */
export async function BidInboxPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, laneOpts, carrierOpts] = await Promise.all([
    db.select({
      id: bids.id,
      rfq: bids.rfqId,
      carrier: carriers.name,
      carrierCode: bids.carrierCode,
      lane: bids.laneCode,
      price: bids.price,
      transit: bids.transitDays,
      validity: bids.validity,
      score: bids.score,
      allocation: bids.allocation,
      status: bids.statusCode,
      rfqStatus: rfqs.statusCode,
      rfqValue: rfqs.value,
      closesIn: rfqs.closesInDays,
      indexPrice: rfqs.indexPrice,
      scopeVi: rfqScopes.nameVi,
      scopeEn: rfqScopes.nameEn,
      shipper: members.name,
    })
      .from(bids)
      .innerJoin(rfqs, eq(rfqs.id, bids.rfqId))
      .innerJoin(rfqScopes, eq(rfqScopes.id, rfqs.scopeId))
      .innerJoin(members, eq(members.id, rfqs.shipperMemberId))
      .innerJoin(carriers, eq(carriers.code, bids.carrierCode)),
    statusLabelMap(lang),
    laneOptions(),
    carrierOptions(),
  ])

  // Open invitations get a card each (ui-2.html:2655). Win probability and margin are
  // random in the prototype; here they derive from the bid's own score and saving so
  // the figures stay stable across renders.
  const invitations = rows
    .filter((r) => r.rfqStatus === 'open')
    .filter((r, i, arr) => arr.findIndex((x) => x.rfq === r.rfq) === i)
    .sort((a, b) => a.closesIn - b.closesIn)
    .slice(0, 5)

  // Pipeline value sums each open tender once, not once per bid on it.
  const openTenders = rows.filter((r, i, arr) =>
    r.rfqStatus === 'open' && arr.findIndex((x) => x.rfq === r.rfq) === i)
  const pipelineValue = openTenders.reduce((a, r) => a + Number(r.rfqValue), 0)
  const closingSoon = openTenders.filter((r) => r.closesIn <= 2).length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Hộp thầu', 'Bid Inbox')}
        modules={['F04']}
        sub={t(lang,
          'Toàn bộ lời mời thầu đã lọc theo giấy phép và năng lực của bạn, kèm phân tích khả năng thắng và biên lợi nhuận dự kiến.',
          'All tender invitations pre-filtered to your licences and capability, with win-probability and expected margin analysis.')}
        actions={<span className="btn p">{t(lang, 'Chào giá hàng loạt', 'Bulk submit')}</span>}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Lời mời đang mở', 'Open invitations')} value={num(openTenders.length)}
          meta={t(lang, `${closingSoon} đóng trong 48 giờ`, `${closingSoon} close within 48h`)} metaTone="d" />
        <KpiTile label={t(lang, 'Giá trị pipeline', 'Pipeline value')}
          value={num(Math.round(pipelineValue))} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, '12 tháng tới', 'next 12 months')} />
        <KpiTile label={t(lang, 'Tỷ lệ thắng 12T', 'Win rate 12M')} value="34" unit="%"
          meta={t(lang, 'trung bình sàn 26%', 'platform avg 26%')} metaTone="u" />
        <KpiTile label={t(lang, 'Biên LN gộp TB', 'Avg gross margin')} value="18.6" unit="%"
          meta="+1,4 pp" metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian phản hồi TB', 'Avg response time')} value="3.2" unit="h"
          meta={t(lang, 'SLA 4 giờ', 'SLA 4h')} metaTone="u" />
      </div>

      <div className="stack" style={{ marginBottom: 14 }}>
        {invitations.map((q) => {
          const winProb = Math.min(92, Math.max(28, q.score))
          const estMargin = ((Number(q.indexPrice) - Number(q.price)) / Number(q.indexPrice)) * 100
          return (
            <div className="card" key={q.rfq}>
              <div className="card-b">
                <div className="bid-invite">
                  <div>
                    <div className="flex" style={{ gap: 7 }}>
                      <b className="num" style={{ fontSize: 12.5 }}>{q.rfq}</b>
                      <Tag tone={q.closesIn <= 2 ? 'd' : 'b'}>
                        {q.closesIn <= 2 ? t(lang, 'Sắp đóng', 'Closing soon') : t(lang, 'Đang mở', 'Open')}
                      </Tag>
                    </div>
                    <b style={{ fontSize: 13.5, display: 'block', marginTop: 3 }}>{q.shipper}</b>
                    <div className="muted">
                      {lang === 'vi' ? q.scopeVi : q.scopeEn} · {q.lane}
                    </div>
                  </div>
                  <div>
                    <div className="muted">{t(lang, 'Còn lại', 'Time left')}</div>
                    <div className="num" style={{
                      fontSize: 15, fontWeight: 750,
                      color: q.closesIn <= 2 ? 'var(--down)' : 'var(--text)',
                    }}>
                      {q.closesIn} {t(lang, 'ngày', 'days')}
                    </div>
                  </div>
                  <div>
                    <div className="muted">{t(lang, 'Chỉ số / giá chào', 'Index / your bid')}</div>
                    <div className="num" style={{ fontSize: 13 }}>
                      {usd(q.indexPrice)} → <b style={{ color: 'var(--brand-600)' }}>{usd(q.price)}</b>
                    </div>
                  </div>
                  <div>
                    <div className="muted">{t(lang, 'Khả năng thắng', 'Win probability')}</div>
                    <Meter value={winProb} width={66}
                      color={winProb > 60 ? 'var(--up)' : winProb > 45 ? 'var(--gold-500)' : 'var(--down)'} />
                    <div className="muted">
                      {t(lang, 'Biên LN dự kiến', 'Est. margin')} <b>{num(estMargin, 1)}%</b>
                    </div>
                  </div>
                  <div className="flex" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    <span className="btn sm">{t(lang, 'Bỏ qua', 'Decline')}</span>
                    <span className="btn p sm">{t(lang, 'Chào giá', 'Bid')}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <DataTable
        id="bid" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Toàn bộ chào giá của tôi', 'All my bids')} rows={rows} pageSize={16}
        searchPlaceholder={t(lang, 'Tìm mã thầu, chủ hàng, tuyến…', 'Search tender, shipper, lane…')}
        search={(r) => `${r.rfq} ${r.shipper} ${r.lane} ${r.carrier}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Vị thế', 'Position'),
            options: statusOptions(labels, ['lead', 'ok', 'risk']),
            match: (r, v) => r.status === v,
          },
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
          { key: 'car', label: t(lang, 'Hãng tàu', 'Carrier'), options: carrierOpts, match: (r, v) => r.carrierCode === v },
        ]}
        columns={[
          { key: 'rfq', header: t(lang, 'Mã thầu', 'Tender'), width: '14%', sortValue: (r) => r.rfq, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.rfq}</b> },
          {
            key: 'scope', header: t(lang, 'Phạm vi', 'Scope'), width: '19%',
            sortValue: (r) => (lang === 'vi' ? r.scopeVi : r.scopeEn),
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.scopeVi : r.scopeEn}</span>
                <div className="muted">{r.shipper}</div>
              </div>
            ),
          },
          { key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '9%', sortValue: (r) => r.lane, render: (r) => <b style={{ fontSize: 12 }}>{r.lane}</b> },
          { key: 'carrier', header: t(lang, 'Hãng tàu', 'Carrier'), width: '14%', sortValue: (r) => r.carrier, render: (r) => <span style={{ fontSize: 12 }}>{r.carrier}</span> },
          {
            key: 'price', header: t(lang, 'Giá chào', 'Bid price'), cls: 'r', width: '12%',
            sortValue: (r) => Number(r.price),
            render: (r) => {
              const delta = ((Number(r.price) - Number(r.indexPrice)) / Number(r.indexPrice)) * 100
              return (
                <div>
                  <b className="num">{usd(r.price)}</b>
                  <div className="muted num" style={{ color: delta <= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(delta)}</div>
                </div>
              )
            },
          },
          { key: 'transit', header: t(lang, 'Hành trình', 'Transit'), cls: 'c', width: '8%', sortValue: (r) => r.transit, render: (r) => <><b className="num">{r.transit}</b> <span className="muted">{t(lang, 'ngày', 'd')}</span></> },
          { key: 'score', header: t(lang, 'Điểm', 'Score'), width: '11%', sortValue: (r) => r.score, render: (r) => <Meter value={r.score} width={58} /> },
          { key: 'alloc', header: t(lang, 'Phân bổ', 'Allocation'), cls: 'c', width: '7%', sortValue: (r) => r.allocation, render: (r) => r.allocation === '—' ? <span className="muted">—</span> : <Tag tone="u">{r.allocation}</Tag> },
          {
            key: 'st', header: t(lang, 'Vị thế', 'Position'), cls: 'c', width: '9%', sortValue: (r) => r.status,
            render: (r) => <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>,
          },
        ]}
      />
    </>
  )
}
