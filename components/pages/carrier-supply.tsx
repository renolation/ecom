import { asc, eq, sql } from 'drizzle-orm'
import { BarChart, LineChart, heatStyle } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  bids, carriers, equipmentTypes, lanes, members, rateCards, rfqs, rfqScopes, voyages,
} from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import {
  carrierOptions, equipmentOptions, laneOptions, statusLabelMap, statusOptions,
} from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** c_dash — Carrier dashboard (ui-2.html:2284). */
export async function CarrierDashboardPage({ lang }: RoutePageProps) {
  const [byLane, byWeek, byEquipment, statusSplit] = await Promise.all([
    db.select({
      lane: rateCards.laneCode,
      capacity: sql<number>`sum(${rateCards.capacity})::int`,
      sold: sql<number>`sum(${rateCards.sold})::int`,
      revenue: sql<number>`sum(${rateCards.sold} * ${rateCards.currentPrice})::numeric`,
    }).from(rateCards).groupBy(rateCards.laneCode).orderBy(asc(rateCards.laneCode)),
    db.select({
      week: rateCards.week,
      weekIndex: rateCards.weekIndex,
      fill: sql<number>`avg(${rateCards.fillPct})::numeric`,
    }).from(rateCards).groupBy(rateCards.week, rateCards.weekIndex).orderBy(asc(rateCards.weekIndex)),
    db.select({
      equipment: rateCards.equipmentCode,
      sold: sql<number>`sum(${rateCards.sold})::int`,
    }).from(rateCards).groupBy(rateCards.equipmentCode),
    db.select({
      status: voyages.statusCode,
      n: sql<number>`count(*)::int`,
    }).from(voyages).groupBy(voyages.statusCode),
  ])

  const labels = await statusLabelMap(lang)
  const totalCap = byLane.reduce((a, r) => a + r.capacity, 0)
  const totalSold = byLane.reduce((a, r) => a + r.sold, 0)
  const totalRevenue = byLane.reduce((a, r) => a + Number(r.revenue), 0)
  const won = statusSplit.find((s) => s.status === 'won')?.n ?? 0
  const quoted = statusSplit.reduce((a, s) => a + s.n, 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Bắt đầu', 'Carrier · Start here')}
        title={t(lang, 'Bảng điều khiển', 'Dashboard')}
        sub={t(lang,
          'Năng lực, mức lấp đầy và doanh thu theo tuyến và theo tuần khai thác.',
          'Capacity, fill rate and revenue by lane and by operating week.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Năng lực niêm yết', 'Listed capacity')} value={num(totalCap)} unit="TEU" />
        <KpiTile label={t(lang, 'Đã bán', 'Sold')} value={num(totalSold)} unit="TEU"
          bar={(totalSold / totalCap) * 100} />
        <KpiTile label={t(lang, 'Lấp đầy', 'Fill rate')} value={num((totalSold / totalCap) * 100, 1)} unit="%" />
        <KpiTile label={t(lang, 'Doanh thu niêm yết', 'Listed revenue')} value={usd(totalRevenue)} />
        <KpiTile label={t(lang, 'Tỷ lệ thắng chào giá', 'Offer win rate')}
          value={num((won / (quoted || 1)) * 100, 1)} unit="%"
          meta={t(lang, `${num(won)} chuyến đã chốt`, `${num(won)} voyages won`)} metaTone="u" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Mức lấp đầy theo tuần', 'Fill rate by week')}>
          <LineChart
            series={[{ data: byWeek.map((w) => Number(w.fill)), color: 'var(--brand-500)', fill: true }]}
            labels={byWeek.map((w) => w.week)}
            fmt={(v) => `${Math.round(v)}%`}
            height={230}
          />
        </Card>
        <Card title={t(lang, 'Đã bán theo thiết bị', 'Sold by equipment')}>
          <BarChart
            items={byEquipment.map((e, i) => ({
              l: e.equipment.replace(/ .*/, ''),
              v: e.sold,
              c: ['var(--brand-500)', 'var(--brand-400)', 'var(--violet)', 'var(--gold-500)'][i % 4],
            }))}
            height={230}
            valueLabel={(v) => num(v)}
          />
        </Card>
      </div>

      <Card title={t(lang, 'Hiệu quả theo tuyến', 'Performance by lane')}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(lang, 'Tuyến', 'Lane')}</th>
              <th className="r">{t(lang, 'Năng lực', 'Capacity')}</th>
              <th className="r">{t(lang, 'Đã bán', 'Sold')}</th>
              <th>{t(lang, 'Lấp đầy', 'Fill')}</th>
              <th className="r">{t(lang, 'Doanh thu', 'Revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {byLane.map((r) => (
              <tr key={r.lane}>
                <td><b style={{ fontSize: 12 }}>{r.lane}</b></td>
                <td className="r num">{num(r.capacity)}</td>
                <td className="r num">{num(r.sold)}</td>
                <td><Meter value={(r.sold / r.capacity) * 100} width={80} /></td>
                <td className="r num"><b>{usd(r.revenue)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** c_inv — Capacity & Rates, including the rate heatmap (ui-2.html:2375). */
export async function CapacityRatesPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, laneOpts, eqOpts, weeks] = await Promise.all([
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
    }).from(rateCards).orderBy(asc(rateCards.laneCode), asc(rateCards.weekIndex)),
    laneOptions(),
    equipmentOptions(),
    db.selectDistinct({ week: rateCards.week, weekIndex: rateCards.weekIndex })
      .from(rateCards).orderBy(asc(rateCards.weekIndex)),
  ])

  // Heatmap: one row per lane, one column per week, averaged across equipment types.
  const heatLanes = [...new Set(rows.map((r) => r.lane))]
  const cell = new Map<string, number>()
  for (const r of rows) {
    const key = `${r.lane}|${r.weekIndex}`
    const prev = cell.get(key)
    cell.set(key, prev === undefined ? r.fill : (prev + r.fill) / 2)
  }

  const unpublished = rows.filter((r) => !r.published).length
  const autoPriced = rows.filter((r) => r.auto).length
  const belowIndex = rows.filter((r) => Number(r.current) < Number(r.index)).length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Cung ứng', 'Carrier · Supply')}
        title={t(lang, 'Năng lực & Niêm yết giá', 'Capacity & Rates')}
        modules={['F04']}
        sub={t(lang,
          'Bản đồ nhiệt mức lấp đầy theo tuyến và tuần. Giá chưa công bố không xuất hiện trong kết quả tìm kiếm của chủ hàng.',
          'Fill-rate heatmap by lane and week. Unpublished rates do not appear in shipper search results.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Ô giá', 'Rate cells')} value={num(rows.length)}
          meta={t(lang, '8 tuyến × 13 tuần × 4 thiết bị', '8 lanes × 13 weeks × 4 equipment')} />
        <KpiTile label={t(lang, 'Chưa công bố', 'Unpublished')} value={num(unpublished)}
          meta={t(lang, 'mất hiển thị', 'not visible')} metaTone="gd" />
        <KpiTile label={t(lang, 'Định giá tự động', 'Auto-priced')} value={num(autoPriced)}
          bar={(autoPriced / rows.length) * 100} />
        <KpiTile label={t(lang, 'Dưới chỉ số tuyến', 'Below lane index')} value={num(belowIndex)}
          meta={t(lang, 'đang giảm giá', 'discounting')} metaTone="d" />
      </div>

      <Card title={t(lang, 'Bản đồ nhiệt mức lấp đầy', 'Fill-rate heatmap')} bodyStyle={{ padding: 12 }}>
        <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
          <table className="tbl" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ width: 96 }}>{t(lang, 'Tuyến', 'Lane')}</th>
                {weeks.map((w) => <th key={w.week} className="c">{w.week}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatLanes.map((lane) => (
                <tr key={lane}>
                  <td><b style={{ fontSize: 11.5 }}>{lane}</b></td>
                  {weeks.map((w) => {
                    const v = cell.get(`${lane}|${w.weekIndex}`)
                    return (
                      <td key={w.week} className="c num" style={v === undefined ? undefined : heatStyle(v, 40, 100)}>
                        {v === undefined ? '—' : Math.round(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend items={[
          { color: 'rgba(224,36,36,.42)', label: t(lang, 'Lấp đầy thấp', 'Low fill') },
          { color: 'rgba(14,159,110,.42)', label: t(lang, 'Lấp đầy cao', 'High fill') },
        ]} />
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="rc" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Biểu giá theo tuần', 'Weekly rate card')} rows={rows}
          searchPlaceholder={t(lang, 'Tìm tuyến, tuần, thiết bị…', 'Search lane, week, equipment…')}
          search={(r) => `${r.lane} ${r.week} ${r.equipment}`}
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
                      {t(lang, 'chỉ số', 'index')} {usd(r.index)} <span style={{ color: delta >= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(delta)}</span>
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
      </div>
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
