import { asc, eq } from 'drizzle-orm'
import { DataTable } from '@/components/table/data-table'
import { KpiTile, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import { bids, carriers, lanes, offers, ports, rfqs, members, rfqScopes } from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import {
  carrierOptions, equipmentOptions, laneOptions, statusLabelMap, statusOptions,
} from '@/lib/queries/lookups'
import type { RoutePageProps } from './page-props'
import type { Tone } from '@/lib/queries/home-types'

/** s_market — Search & Book (ui-2.html:1447). */
export async function MarketPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, laneOpts, carrierOpts, eqOpts] = await Promise.all([
    db.select({
      id: offers.id,
      lane: offers.laneCode,
      carrier: carriers.name,
      carrierCode: offers.carrierCode,
      equipment: offers.equipmentCode,
      price: offers.price,
      base: offers.base,
      thc: offers.thc,
      bunker: offers.bunker,
      docFee: offers.docFee,
      transit: offers.transitDays,
      isDirect: offers.isDirect,
      transhipment: offers.transhipmentPort,
      departOn: offers.departOn,
      slotsLeft: offers.slotsLeft,
      freeDays: offers.freeDays,
      validity: offers.validityDays,
      serviceMode: offers.serviceMode,
      weekly: offers.weeklyFrequency,
      reliability: offers.reliability,
      rating: offers.rating,
      co2: offers.co2,
      hasFinance: offers.hasFinance,
      hasInsurance: offers.hasInsurance,
      hasEbl: offers.hasEbl,
      acceptsDg: offers.acceptsDg,
      origin: ports.name,
    })
      .from(offers)
      .innerJoin(carriers, eq(carriers.code, offers.carrierCode))
      .innerJoin(lanes, eq(lanes.code, offers.laneCode))
      .innerJoin(ports, eq(ports.code, lanes.originPortCode)),
    statusLabelMap(lang),
    laneOptions(),
    carrierOptions(),
    equipmentOptions(),
  ])

  const cheapest = rows.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b))
  const direct = rows.filter((r) => r.isDirect).length
  const withFinance = rows.filter((r) => r.hasFinance).length
  const avgTransit = rows.reduce((a, r) => a + r.transit, 0) / rows.length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Giao dịch', 'Shipper · Trading')}
        title={t(lang, 'Tìm giá & Đặt chỗ', 'Search & Book')}
        modules={['F04']}
        sandbox={['SB-01']}
        sub={t(lang,
          'Báo giá còn hiệu lực từ các hãng tàu đã xác minh. Giá đã tách sẵn cước gốc, THC, phụ phí nhiên liệu và phí chứng từ.',
          'Live quotes from verified carriers. Every price is broken out into base freight, THC, bunker and documentation.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Báo giá đang mở', 'Live quotes')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Giá thấp nhất', 'Lowest price')} value={usd(cheapest.price)}
          meta={cheapest.lane} />
        <KpiTile label={t(lang, 'Tuyến đi thẳng', 'Direct sailings')} value={num(direct)}
          meta={t(lang, `${num(rows.length - direct)} có trung chuyển`, `${num(rows.length - direct)} via transhipment`)} />
        <KpiTile label={t(lang, 'Thời gian vận chuyển TB', 'Average transit')} value={num(avgTransit, 1)}
          unit={t(lang, 'ngày', 'days')} />
        <KpiTile label={t(lang, 'Có kèm tài trợ', 'With financing')} value={num(withFinance)}
          meta={t(lang, 'trả chậm cước', 'deferred freight')} metaTone="u" />
      </div>

      <DataTable
        id="mk"
        lang={lang}
        basePath={basePath}
        searchParams={searchParams}
        title={t(lang, 'Báo giá theo tuyến', 'Quotes by lane')}
        rows={rows}
        pageSize={14}
        searchPlaceholder={t(lang, 'Tìm tuyến, hãng tàu, tàu…', 'Search lane, carrier, vessel…')}
        search={(r) => `${r.lane} ${r.carrier} ${r.equipment} ${r.transhipment ?? ''}`}
        filters={[
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
          { key: 'car', label: t(lang, 'Hãng tàu', 'Carrier'), options: carrierOpts, match: (r, v) => r.carrierCode === v },
          { key: 'eq', label: t(lang, 'Thiết bị', 'Equipment'), options: eqOpts, match: (r, v) => r.equipment === v },
          {
            key: 'dir',
            label: t(lang, 'Hành trình', 'Routing'),
            options: [['1', t(lang, 'Đi thẳng', 'Direct')], ['0', t(lang, 'Trung chuyển', 'Transhipment')]],
            match: (r, v) => (v === '1' ? r.isDirect : !r.isDirect),
          },
        ]}
        columns={[
          {
            key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '13%',
            sortValue: (r) => r.lane,
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{r.lane}</b>
                <div className="muted">{r.isDirect
                  ? t(lang, 'Đi thẳng', 'Direct')
                  : `${t(lang, 'Qua', 'via')} ${r.transhipment}`}</div>
              </div>
            ),
          },
          {
            key: 'carrier', header: t(lang, 'Hãng tàu', 'Carrier'), width: '15%',
            sortValue: (r) => r.carrier,
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{r.carrier}</b>
                <div className="muted">{r.serviceMode} · {r.weekly}×{t(lang, '/tuần', '/wk')}</div>
              </div>
            ),
          },
          { key: 'eq', header: t(lang, 'Thiết bị', 'Equipment'), width: '10%', sortValue: (r) => r.equipment, render: (r) => r.equipment },
          {
            key: 'price', header: t(lang, 'Giá tất cả', 'All-in'), cls: 'r', width: '11%',
            sortValue: (r) => Number(r.price),
            render: (r) => (
              <div>
                <b className="num" style={{ fontSize: 13 }}>{usd(r.price)}</b>
                <div className="muted num">
                  {t(lang, 'gốc', 'base')} {usd(r.base)} · THC {usd(r.thc)}
                </div>
              </div>
            ),
          },
          {
            key: 'transit', header: t(lang, 'Hành trình', 'Transit'), cls: 'c', width: '9%',
            sortValue: (r) => r.transit,
            render: (r) => <><b className="num">{r.transit}</b> <span className="muted">{t(lang, 'ngày', 'd')}</span></>,
          },
          { key: 'dep', header: t(lang, 'Khởi hành', 'Departs'), cls: 'c', width: '9%', sortValue: (r) => r.departOn, render: (r) => <span className="num">{r.departOn}</span> },
          {
            key: 'free', header: t(lang, 'Miễn lưu', 'Free time'), cls: 'c', width: '8%',
            sortValue: (r) => r.freeDays,
            render: (r) => <><b className="num">{r.freeDays}</b> <span className="muted">{t(lang, 'ngày', 'd')}</span></>,
          },
          {
            key: 'rating', header: t(lang, 'Tin cậy', 'Reliability'), cls: 'c', width: '9%',
            sortValue: (r) => r.reliability,
            render: (r) => (
              <div>
                <b className="num">{r.reliability}%</b>
                <div className="muted">★ {Number(r.rating).toFixed(1)}</div>
              </div>
            ),
          },
          {
            key: 'flags', header: t(lang, 'Kèm theo', 'Included'), width: '10%',
            render: (r) => (
              <div className="flex wrap" style={{ gap: 3 }}>
                {r.hasFinance ? <Tag tone="u">{t(lang, 'Tài trợ', 'Finance')}</Tag> : null}
                {r.hasInsurance ? <Tag tone="b">{t(lang, 'BH', 'Ins')}</Tag> : null}
                {r.hasEbl ? <Tag tone="v">eB/L</Tag> : null}
                {r.acceptsDg ? <Tag tone="gd">DG</Tag> : null}
              </div>
            ),
          },
          {
            key: 'slots', header: t(lang, 'Chỗ còn', 'Slots'), cls: 'r', width: '6%',
            sortValue: (r) => r.slotsLeft,
            render: (r) => <span className="num">{r.slotsLeft}</span>,
          },
        ]}
      />
    </>
  )
}

/** s_rfq — RFQ / Tenders (ui-2.html:1620). */
export async function RfqPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, laneOpts] = await Promise.all([
    db.select({
      id: rfqs.id,
      lane: rfqs.laneCode,
      scopeVi: rfqScopes.nameVi,
      scopeEn: rfqScopes.nameEn,
      shipper: members.name,
      volume: rfqs.volume,
      bidCount: rfqs.bidCount,
      invited: rfqs.invited,
      status: rfqs.statusCode,
      closesIn: rfqs.closesInDays,
      indexPrice: rfqs.indexPrice,
      bestPrice: rfqs.bestPrice,
      saving: rfqs.savingPct,
      value: rfqs.value,
    })
      .from(rfqs)
      .innerJoin(rfqScopes, eq(rfqScopes.id, rfqs.scopeId))
      .innerJoin(members, eq(members.id, rfqs.shipperMemberId))
      .orderBy(asc(rfqs.closesInDays)),
    statusLabelMap(lang),
    laneOptions(),
  ])

  const open = rows.filter((r) => r.status === 'open')
  const awarded = rows.filter((r) => r.status === 'awarded')
  const avgSaving = awarded.reduce((a, r) => a + Number(r.saving), 0) / (awarded.length || 1)
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Giao dịch', 'Shipper · Trading')}
        title={t(lang, 'RFQ / Đấu thầu', 'RFQ / Tenders')}
        modules={['F04']}
        sandbox={['SB-01']}
        sub={t(lang,
          'Gói thầu khối lượng gửi tới nhiều hãng tàu cùng lúc. Hệ thống chấm điểm theo giá, thời gian và độ tin cậy; quyết định trao thầu thuộc về bạn.',
          'Volume tenders sent to several carriers at once. The platform scores price, transit and reliability; the award decision stays yours.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Đang mở', 'Open')} value={num(open.length)}
          meta={t(lang, `${open.filter((r) => r.closesIn <= 3).length} đóng trong 3 ngày`, `${open.filter((r) => r.closesIn <= 3).length} close within 3 days`)}
          metaTone="gd" />
        <KpiTile label={t(lang, 'Đã trao thầu', 'Awarded')} value={num(awarded.length)} metaTone="u"
          meta={t(lang, 'chốt giá kỳ tới', 'rates locked')} />
        <KpiTile label={t(lang, 'Tiết kiệm bình quân', 'Average saving')} value={num(avgSaving, 1)} unit="%"
          meta={t(lang, 'so với chỉ số tuyến', 'against the lane index')} metaTone="u" />
        <KpiTile label={t(lang, 'Tổng giá trị', 'Total value')} value={num(totalValue)}
          unit={t(lang, 'nghìn $', 'k$')} />
      </div>

      <DataTable
        id="rfq"
        lang={lang}
        basePath={basePath}
        searchParams={searchParams}
        title={t(lang, 'Gói thầu', 'Tenders')}
        rows={rows}
        searchPlaceholder={t(lang, 'Tìm mã thầu, tuyến, chủ hàng…', 'Search reference, lane, shipper…')}
        search={(r) => `${r.id} ${r.lane} ${r.shipper} ${r.scopeVi} ${r.scopeEn}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['open', 'eval', 'awarded', 'cancel']),
            match: (r, v) => r.status === v,
          },
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã thầu', 'Reference'), width: '14%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          {
            key: 'scope', header: t(lang, 'Phạm vi', 'Scope'), width: '20%',
            sortValue: (r) => (lang === 'vi' ? r.scopeVi : r.scopeEn),
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{lang === 'vi' ? r.scopeVi : r.scopeEn}</b>
                <div className="muted">{r.lane} · {num(r.volume)} TEU</div>
              </div>
            ),
          },
          { key: 'shipper', header: t(lang, 'Chủ hàng', 'Shipper'), width: '17%', sortValue: (r) => r.shipper, render: (r) => <span style={{ fontSize: 12 }}>{r.shipper}</span> },
          {
            key: 'bids', header: t(lang, 'Chào giá', 'Bids'), cls: 'c', width: '9%',
            sortValue: (r) => r.bidCount,
            render: (r) => <><b className="num">{r.bidCount}</b> <span className="muted">/ {r.invited}</span></>,
          },
          {
            key: 'best', header: t(lang, 'Giá tốt nhất', 'Best price'), cls: 'r', width: '13%',
            sortValue: (r) => Number(r.bestPrice),
            render: (r) => (
              <div>
                <b className="num" style={{ fontSize: 12.5 }}>{usd(r.bestPrice)}</b>
                <div className="muted num">{t(lang, 'chỉ số', 'index')} {usd(r.indexPrice)}</div>
              </div>
            ),
          },
          {
            key: 'saving', header: t(lang, 'Tiết kiệm', 'Saving'), cls: 'r', width: '9%',
            sortValue: (r) => Number(r.saving),
            render: (r) => <Tag tone="u">{pct(r.saving)}</Tag>,
          },
          {
            key: 'close', header: t(lang, 'Đóng thầu', 'Closes'), cls: 'c', width: '9%',
            sortValue: (r) => r.closesIn,
            render: (r) => r.closesIn > 0
              ? <span className={r.closesIn <= 3 ? 'num' : 'num muted'}>{r.closesIn} {t(lang, 'ngày', 'd')}</span>
              : <span className="muted">—</span>,
          },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%',
            sortValue: (r) => r.status,
            render: (r) => {
              const s = labels.get(r.status)
              return <Tag tone={(s?.tone ?? 'n') as Tone}>{s?.label ?? r.status}</Tag>
            },
          },
        ]}
      />
    </>
  )
}
