import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { BarChart, Donut, LineChart, Sparkline, walk } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, PageHeader, Tag } from '@/components/ui'
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
        <KpiTile label={t(lang, 'Chưa công bố', 'Unpublished')} value={num(unpublished)}
          meta={t(lang, 'mất hiển thị', 'not visible')} metaTone="gd" />
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

      {repriceTarget ? (
        <RepriceModal target={repriceTarget} lang={lang} basePath={basePath} searchParams={searchParams} />
      ) : null}
    </>
  )
}

/** c_offer — Voyage Offering Assistant (ui-2.html:2508). */
export async function VoyageOfferingPage({ lang, basePath, searchParams }: RoutePageProps) {
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
    })
      .from(voyages)
      .innerJoin(carriers, eq(carriers.code, voyages.carrierCode))
      .innerJoin(members, eq(members.id, voyages.customerMemberId))
      .orderBy(asc(voyages.eta)),
    statusLabelMap(lang),
    laneOptions(),
    carrierOptions(),
  ])

  const won = rows.filter((r) => r.status === 'won')
  const quoted = rows.filter((r) => r.status === 'quoted')
  const avgSow = rows.reduce((a, r) => a + r.shareOfWallet, 0) / rows.length
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)
  const avgConfidence = rows.reduce((a, r) => a + r.confidence, 0) / rows.length

  const basketKeys: Array<[string, string, string]> = [
    ['port', 'Xếp dỡ cảng', 'Terminal'],
    ['truck', 'Vận tải bộ', 'Trucking'],
    ['wh', 'Kho', 'Warehouse'],
    ['cold', 'Chuỗi lạnh', 'Cold chain'],
    ['cust', 'Hải quan', 'Customs'],
    ['ins', 'Bảo hiểm', 'Insurance'],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Trợ lý chào giá theo chuyến', 'Voyage Offering Assistant')}
        modules={['F15']}
        sub={t(lang,
          'Agent đề xuất giỏ dịch vụ và mức chiết khấu cho từng chuyến. Đề xuất là gợi ý — hãng tàu quyết định giá chào cuối cùng.',
          'The agent proposes a service basket and discount per voyage. Proposals are advisory — the carrier decides the final offer.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Chuyến trong danh mục', 'Voyages in pipeline')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Đã chốt', 'Won')} value={num(won.length)}
          meta={t(lang, `${num(quoted.length)} đang chào`, `${num(quoted.length)} quoted`)} metaTone="u" />
        <KpiTile label={t(lang, 'Share of wallet TB', 'Average share of wallet')} value={num(avgSow, 1)} unit="%"
          bar={avgSow} />
        <KpiTile label={t(lang, 'Tổng giá trị', 'Total value')} value={num(totalValue)}
          unit={t(lang, 'nghìn $', 'k$')} />
        <KpiTile label={t(lang, 'Độ tin cậy đề xuất', 'Proposal confidence')} value={num(avgConfidence, 1)} unit="%"
          meta={t(lang, 'agent tầng 2 · người duyệt', 'tier-2 agent · human approves')} metaTone="b" />
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

  const leading = rows.filter((r) => r.status === 'lead')
  const onOpen = rows.filter((r) => r.rfqStatus === 'open')
  const allocated = rows.filter((r) => r.allocation !== '—')
  const avgScore = rows.reduce((a, r) => a + r.score, 0) / rows.length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Hộp thầu', 'Bid Inbox')}
        modules={['F04']}
        sub={t(lang,
          'Mọi chào giá đã gửi, kèm điểm chấm và phần khối lượng được phân bổ. Chủ hàng quyết định trao thầu.',
          'Every bid submitted, with its score and allocated share. The shipper decides the award.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng chào giá', 'Total bids')} value={num(rows.length)}
          meta={t(lang, `${num(onOpen.length)} trên thầu đang mở`, `${num(onOpen.length)} on open tenders`)} />
        <KpiTile label={t(lang, 'Đang dẫn đầu', 'Leading')} value={num(leading.length)} metaTone="u"
          meta={t(lang, 'giá tốt nhất hiện tại', 'best price so far')} />
        <KpiTile label={t(lang, 'Được phân bổ', 'Allocated')} value={num(allocated.length)}
          meta={t(lang, 'có phần khối lượng', 'received volume')} metaTone="b" />
        <KpiTile label={t(lang, 'Điểm chấm bình quân', 'Average score')} value={num(avgScore, 1)}
          bar={avgScore} />
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
        title={t(lang, 'Chào giá đã gửi', 'Submitted bids')} rows={rows} pageSize={16}
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
