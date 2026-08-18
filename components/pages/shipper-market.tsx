import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { DataTable } from '@/components/table/data-table'
import { tableHref } from '@/components/table/table-types'
import { Meter, KpiTile, PageHeader, Tag, colorFor, initials } from '@/components/ui'
import { Modal, ModalPanel, ModalRow, ModalStats, modalHref, openModalId } from '@/components/modal'
import { db } from '@/lib/db'
import { carriers, lanes, offers, ports } from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import type { RoutePageProps } from './page-props'
import { MarketSearchForm, LaneShortcut } from './market-search'
import { NEED_KEYS, type MarketCriteria } from './market-criteria'

/**
 * s_market — Search & Book (ui-2.html:1447).
 *
 * The prototype is search-first: a requirement form, bundled-need chips, and an empty
 * state until `mkRun()` fires. Only then does it score the lane's offers on seven
 * criteria and rank them. That shape is reproduced here with the criteria carried in
 * the URL (`mk.*`), so a search is server-rendered and shareable.
 */

/** ui-2.html:1401 — commodity list. `dg` and `reefer` also drive the offer filter. */
const COMMODITIES: Array<[string, string, string]> = [
  ['general', 'Hàng bách hoá', 'General cargo'],
  ['garment', 'Dệt may & giày dép', 'Garment & footwear'],
  ['electro', 'Điện tử & linh kiện', 'Electronics & components'],
  ['agri', 'Nông sản & thuỷ sản', 'Agriculture & seafood'],
  ['furniture', 'Đồ gỗ & nội thất', 'Furniture & wood'],
  ['chem', 'Hoá chất (không nguy hiểm)', 'Chemicals (non-DG)'],
  ['dg', 'Hàng nguy hiểm (DG)', 'Dangerous goods (DG)'],
  ['reefer', 'Hàng lạnh', 'Temperature-controlled'],
]

/**
 * ui-2.html:1459 — the origin picker names the terminal alongside the port. Terminals
 * are presentation-only in the prototype and have no table of their own, so the suffix
 * is kept here rather than invented as a column.
 */
const ORIGIN_TERMINAL: Record<string, string> = {
  'Cái Mép': 'Cái Mép (VNCMT) — Gemalink',
  'TP.HCM': 'TP.HCM / Cát Lái (VNSGN)',
  'Hải Phòng': 'Hải Phòng (VNHPH) — Nam Đình Vũ',
}

const EQUIPMENT = ["40' HC Dry", "20' Dry", "40' Reefer", 'LCL / m³']

const NEED_LABEL: Record<string, [string, string, string]> = {
  dir: ['⚡', 'Chỉ tàu thẳng', 'Direct only'],
  fin: ['💳', 'Cần tài trợ', 'Financing'],
  ins: ['🛡️', 'Bảo hiểm', 'Insurance'],
  ebl: ['📄', 'Cần eB/L', 'eB/L'],
  co2: ['🌱', 'CO₂ thấp hơn trung bình tuyến', 'Below lane average CO₂'],
  bundle: ['📦', 'Kèm kho & vận tải bộ', 'With warehouse & trucking'],
}

const NEED_TAG: Record<string, [string, string]> = {
  dir: ['tàu thẳng', 'direct'],
  fin: ['tài trợ', 'financing'],
  ins: ['bảo hiểm', 'insurance'],
  ebl: ['eB/L', 'eB/L'],
  co2: ['CO₂ thấp', 'low CO₂'],
  bundle: ['kèm kho & xe', 'warehouse & trucking'],
}

type SP = Record<string, string | string[] | undefined>

function one(sp: SP, key: string, fallback: string): string {
  const v = sp[key]
  const s = Array.isArray(v) ? v[0] : v
  return s === undefined || s === '' ? fallback : s
}

/** ui-2.html:1398 — `MK`, including the two needs that start switched on. */
function readCriteria(sp: SP): MarketCriteria {
  const needs: Record<string, boolean> = {}
  for (const k of NEED_KEYS) {
    const raw = sp[`mk.n.${k}`]
    const s = Array.isArray(raw) ? raw[0] : raw
    needs[k] = s === undefined ? k === 'fin' || k === 'ins' : s === '1'
  }
  return {
    origin: one(sp, 'mk.o', 'Cái Mép'),
    dest: one(sp, 'mk.d', 'Singapore'),
    equipment: one(sp, 'mk.eq', "40' HC Dry"),
    qty: one(sp, 'mk.qty', '25'),
    weight: one(sp, 'mk.wt', '18.5'),
    commodity: one(sp, 'mk.comm', 'general'),
    service: one(sp, 'mk.svc', '*'),
    ready: one(sp, 'mk.ready', '2026-08-20'),
    arriveBy: one(sp, 'mk.arr', ''),
    incoterm: one(sp, 'mk.inco', 'FOB'),
    needs,
  }
}

type OfferRow = Awaited<ReturnType<typeof loadOffers>>[number]

// Lanes carry an origin and a destination port, so `ports` is joined twice.
const destPorts = alias(ports, 'dest_ports')

async function loadOffers() {
  return db.select({
    id: offers.id,
    lane: offers.laneCode,
    laneOrd: lanes.ord,
    laneTransit: lanes.transitDays,
    laneIndex: lanes.indexPrice,
    laneChange: lanes.changePct,
    origin: ports.name,
    dest: destPorts.name,
    carrier: carriers.name,
    carrierCode: offers.carrierCode,
    carrierColor: carriers.color,
    vessel: offers.vessel,
    equipment: offers.equipmentCode,
    equipmentFactor: offers.equipmentFactor,
    price: offers.price,
    base: offers.base,
    thc: offers.thc,
    bunker: offers.bunker,
    docFee: offers.docFee,
    transit: offers.transitDays,
    isDirect: offers.isDirect,
    transhipment: offers.transhipmentPort,
    departOn: offers.departOn,
    departOffset: offers.departOffset,
    cutoffDays: offers.cutoffDays,
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
  })
    .from(offers)
    .innerJoin(carriers, eq(carriers.code, offers.carrierCode))
    .innerJoin(lanes, eq(lanes.code, offers.laneCode))
    .innerJoin(ports, eq(ports.code, lanes.originPortCode))
    .innerJoin(destPorts, eq(destPorts.code, lanes.destPortCode))
}

/** ui-2.html:1437 — 7-criteria match score, weights 25/20/15/10/10/10/10. */
function score(o: OfferRow, pool: OfferRow[], qty: number, commodity: string): number {
  let lo = Infinity
  let hi = 0
  for (const q of pool) {
    lo = Math.min(lo, Number(q.price))
    hi = Math.max(hi, Number(q.price))
  }
  const px = Number(o.price)
  const priceScore = hi > lo ? 1 - (px - lo) / (hi - lo) : 1
  const ef = Number(o.equipmentFactor)
  return Math.round(
    25 * priceScore
    + 20 * (o.reliability / 100)
    + 15 * Math.min(1, o.slotsLeft / (qty * 3))
    + 10 * (o.isDirect ? 1 : 0.6)
    + 10 * (o.acceptsDg || commodity !== 'dg' ? 1 : 0.5)
    + 10 * (1 - Math.min(1, o.co2 / (o.laneTransit * 31 * ef)))
    + 10 * (Number(o.rating) / 5),
  )
}

function Avatar({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <div className="avat" style={{ background: color || colorFor(name), width: size, height: size }}>
      {initials(name)}
    </div>
  )
}

export async function MarketPage({ lang, basePath, searchParams }: RoutePageProps) {
  const sp = searchParams
  const mk = readCriteria(sp)
  const qty = Math.max(1, Number(mk.qty) || 1)
  const ran = one(sp, 'mk.run', '') === '1'
  const sortBy = one(sp, 'mk.sort', 'sc')

  const rows = await loadOffers()

  const origins = [...new Set(rows.map((r) => r.origin))]
    .map((o) => [o, ORIGIN_TERMINAL[o] ?? o] as [string, string])
  const destinations = [...new Set(rows.map((r) => r.dest))]
  const services = [...new Set(rows.map((r) => r.serviceMode))].sort()
  // ui-2.html:1502 — the shortcuts are the first five lanes in declaration order.
  const quickLanes = [...new Map(rows.map((r) => [r.lane, r])).values()]
    .sort((a, b) => a.laneOrd - b.laneOrd)
    .slice(0, 5)

  const labels = {
    origin: t(lang, 'Cảng đi', 'Origin'),
    dest: t(lang, 'Cảng đến', 'Destination'),
    equipment: t(lang, 'Loại cont', 'Equipment'),
    qty: t(lang, 'Số lượng', 'Qty'),
    weight: t(lang, 'Trọng lượng (tấn/cont)', 'Weight (t/unit)'),
    commodity: t(lang, 'Loại hàng', 'Commodity'),
    service: t(lang, 'Phạm vi dịch vụ', 'Service scope'),
    any: t(lang, 'Bất kỳ', 'Any'),
    ready: t(lang, 'Ngày hàng sẵn sàng', 'Cargo ready'),
    arriveBy: t(lang, 'Cần đến trước ngày', 'Must arrive by'),
    incoterm: 'Incoterm',
    clear: t(lang, 'Xoá điều kiện', 'Clear'),
    search: t(lang, 'Tìm giá', 'Search'),
    needs: `${t(lang, 'Nhu cầu kèm theo', 'Bundled needs')}:`,
    needHint: t(lang,
      'Điều kiện được áp ngay vào kết quả — bỏ một điều kiện sẽ mở rộng danh sách.',
      'Conditions apply straight to the results — dropping one widens the list.'),
    ...Object.fromEntries(NEED_KEYS.map((k) => {
      const [icon, vi, en] = NEED_LABEL[k]
      return [`need_${k}`, `${icon} ${t(lang, vi, en)}`]
    })),
  }

  const header = (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Giao dịch', 'Shipper · Trading')}
        title={t(lang, 'Tìm giá & Đặt chỗ', 'Search & Book')}
        modules={['F04']}
        sandbox={['SB-01']}
        sub={t(lang,
          'Một RFQ chuẩn hoá — nhiều báo giá đã tách phụ phí. Điểm ghép lệnh theo 7 tiêu chí, người mua được điều chỉnh trọng số theo ưu tiên của mình.',
          'One standardised RFQ — many quotes with surcharges itemised. Matching scored on 7 criteria; buyers can reweight to their own priorities.')}
        actions={
          <>
            <Link className="btn" href={modalHref(basePath, sp, 'weights')} scroll={false}>
              ⚖️ {t(lang, 'Trọng số ghép lệnh', 'Matching weights')}
            </Link>
            <Link className="btn" href="?p=s_rfq">
              📑 {t(lang, 'Chuyển thành gói thầu', 'Escalate to tender')}
            </Link>
          </>
        }
      />
      <MarketSearchForm
        criteria={mk}
        origins={origins}
        destinations={destinations}
        equipment={EQUIPMENT}
        commodities={COMMODITIES.map((c) => [c[0], t(lang, c[1], c[2])] as [string, string])}
        services={services}
        labels={labels}
      />
    </>
  )

  if (!ran) {
    return (
      <>
        {header}
        <div className="card">
          <div className="card-b" style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🔎</div>
            <b style={{ fontSize: 15 }}>
              {t(lang, 'Nhập nhu cầu và nhấn “Tìm giá”', 'Enter your requirement and press “Search”')}
            </b>
            <div className="muted" style={{ maxWidth: 620, margin: '8px auto 0', lineHeight: 1.6 }}>
              {t(lang,
                `Nền tảng gửi RFQ chuẩn hoá tới toàn bộ nhà cung cấp đủ điều kiện trên tuyến, thu báo giá đã tách phụ phí và xếp hạng theo bảy tiêu chí. Kho báo giá hiện có ${num(rows.length)} chào giá đang hiệu lực trên ${destinations.length} tuyến.`,
                `The platform sends a standardised RFQ to every eligible provider on the lane, collects quotes with surcharges itemised and ranks them on seven criteria. The live pool currently holds ${num(rows.length)} quotes across ${destinations.length} lanes.`)}
            </div>
            <div className="flex" style={{ justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {quickLanes.map((row) => (
                <LaneShortcut key={row.lane} origin={row.origin} dest={row.dest}
                  label={`${row.origin} → ${row.dest}`} />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  const lanePool = rows.filter(
    (r) => r.origin === mk.origin && r.dest === mk.dest && r.equipment === mk.equipment,
  )
  const laneCode = lanePool[0]?.lane
  const commodityLabel = COMMODITIES.find((c) => c[0] === mk.commodity)
  const activeNeeds = NEED_KEYS.filter((k) => mk.needs[k])

  const summary = (
    <div className="card" style={{ marginBottom: 14, background: 'var(--surface-2)' }}>
      <div className="card-b" style={{ padding: '12px 16px' }}>
        <div className="between wrap" style={{ gap: 12 }}>
          <div className="flex wrap" style={{ gap: 8, alignItems: 'center' }}>
            <Tag tone="b">RFQ-{9000 + qty}</Tag>
            <b style={{ fontSize: 13.5 }}>{mk.origin} → {mk.dest}</b>
            <Tag tone="n">{qty} × {mk.equipment}</Tag>
            <Tag tone="n">{mk.weight} {t(lang, 'tấn/cont', 't/unit')}</Tag>
            {commodityLabel ? <Tag tone="n">{t(lang, commodityLabel[1], commodityLabel[2])}</Tag> : null}
            <Tag tone="n">{mk.incoterm}</Tag>
            {mk.service !== '*' ? <Tag tone="n">{mk.service}</Tag> : null}
            <Tag tone="n">{t(lang, 'sẵn sàng', 'ready')} {mk.ready}</Tag>
            {mk.arriveBy ? <Tag tone="gd">{t(lang, 'đến trước', 'arrive by')} {mk.arriveBy}</Tag> : null}
            {activeNeeds.map((k) => (
              <Tag key={k} tone="b">{t(lang, NEED_TAG[k][0], NEED_TAG[k][1])}</Tag>
            ))}
          </div>
          <div className="muted">
            {t(lang, `${num(rows.length)} chào giá đang hiệu lực`, `${num(rows.length)} live quotes`)}
          </div>
        </div>
      </div>
    </div>
  )

  if (!laneCode) {
    return (
      <>
        {header}
        {summary}
        <div className="card">
          <div className="card-b" style={{ padding: 34, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>🚧</div>
            <b style={{ fontSize: 14 }}>{t(lang, 'Nền tảng chưa mở tuyến này', 'This lane is not open yet')}</b>
            <div className="muted" style={{ marginTop: 6 }}>
              {t(lang,
                `Tuyến ${mk.origin} → ${mk.dest} chưa nằm trong ba hành lang thí điểm.`,
                `Lane ${mk.origin} → ${mk.dest} is not in the three pilot corridors.`)}
            </div>
          </div>
        </div>
      </>
    )
  }

  const lane = lanePool[0]
  const laneAvgCo2 = lanePool.reduce((a, r) => a + r.co2, 0) / lanePool.length

  /** ui-2.html:1419 — every condition is a hard filter; dropping one widens the list. */
  const hits = lanePool
    .filter((o) => {
      if (o.slotsLeft < qty) return false
      if (mk.needs.dir && !o.isDirect) return false
      if (mk.needs.fin && !o.hasFinance) return false
      if (mk.needs.ins && !o.hasInsurance) return false
      if (mk.needs.ebl && !o.hasEbl) return false
      if (mk.needs.co2 && o.co2 > laneAvgCo2) return false
      if (mk.commodity === 'dg' && !o.acceptsDg) return false
      if (mk.commodity === 'reefer' && !mk.equipment.includes('Reefer')) return false
      if (mk.service !== '*' && o.serviceMode !== mk.service) return false
      return true
    })
    .map((o) => ({ o, sc: score(o, lanePool, qty, mk.commodity) }))

  const prices = lanePool.map((o) => Number(o.price)).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]
  const providers = new Set(lanePool.map((o) => o.carrierCode)).size
  const refIndex = Math.round(Number(lane.laneIndex) * Number(lane.equipmentFactor))

  const laneKpis = (
    <div className="grid g5" style={{ marginBottom: 14 }}>
      <KpiTile
        label={`${t(lang, 'Chỉ số tuyến VLX', 'VLX lane index')} · ${lane.lane}`}
        value={usd(refIndex)}
        meta={`${pct(lane.laneChange)} ${t(lang, '30 ngày', '30 days')}`}
        metaTone={Number(lane.laneChange) > 0 ? 'd' : 'u'}
      />
      <KpiTile
        label={t(lang, 'Báo giá khớp yêu cầu', 'Quotes matching')}
        value={num(hits.length)}
        meta={t(lang, `trên ${lanePool.length} chào giá tuyến`, `of ${lanePool.length} on this lane`)}
        metaTone={hits.length >= 3 ? 'u' : 'd'}
      />
      <KpiTile
        label={t(lang, 'Nhà cung cấp trên tuyến', 'Providers on lane')}
        value={num(providers)}
        meta={providers >= 3
          ? t(lang, 'đủ điều kiện cam kết SLA', 'SLA-eligible')
          : t(lang, 'thiếu cung', 'thin supply')}
        metaTone={providers >= 3 ? 'u' : 'd'}
      />
      <KpiTile
        label={t(lang, 'Khoảng giá tuyến', 'Price range')}
        value={usd(prices[0])}
        meta={`${t(lang, 'trung vị', 'median')} ${usd(median)} · ${t(lang, 'cao nhất', 'max')} ${usd(prices[prices.length - 1])}`}
      />
      <KpiTile
        label={t(lang, 'Thời gian vận chuyển', 'Transit time')}
        value={num(lane.laneTransit)}
        unit={t(lang, 'ngày', 'days')}
        meta={t(lang, 'tàu thẳng · trung bình tuyến', 'direct · lane average')}
      />
    </div>
  )

  if (!hits.length) {
    return (
      <>
        {header}
        {summary}
        {laneKpis}
        <div className="card">
          <div className="card-b" style={{ padding: 34, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>🫙</div>
            <b style={{ fontSize: 14 }}>
              {t(lang, 'Không có báo giá nào khớp toàn bộ điều kiện', 'No quote matches every condition')}
            </b>
            <div className="muted" style={{ maxWidth: 560, margin: '7px auto 0', lineHeight: 1.6 }}>
              {t(lang,
                `Tuyến ${lane.lane} hiện có ${lanePool.length} chào giá cho ${mk.equipment}, nhưng không chào giá nào đáp ứng đủ số lượng ${qty} cont và các nhu cầu kèm theo. Hãy nới một điều kiện hoặc giảm số lượng.`,
                `Lane ${lane.lane} has ${lanePool.length} quotes for ${mk.equipment}, but none covers ${qty} units together with the bundled needs. Relax one condition or reduce the quantity.`)}
            </div>
            <div className="flex" style={{ justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {activeNeeds.map((k) => (
                <Link key={k} className="btn sm" scroll={false}
                  href={tableHref(basePath, sp, { [`mk.n.${k}`]: '0' })}>
                  ✕ {t(lang, 'Bỏ điều kiện', 'Drop')} {t(lang, NEED_TAG[k][0], NEED_TAG[k][1])}
                </Link>
              ))}
              <Link className="btn sm" scroll={false}
                href={tableHref(basePath, sp, { 'mk.qty': String(Math.max(1, Math.round(qty / 2))) })}>
                {t(lang, `Giảm còn ${Math.max(1, Math.round(qty / 2))} cont`,
                  `Reduce to ${Math.max(1, Math.round(qty / 2))} units`)}
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  const by = <T,>(f: (w: { o: OfferRow; sc: number }) => T) =>
    hits.slice().sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0))[0]
  const cheapest = by((w) => Number(w.o.price))
  const fastest = by((w) => w.o.transit)
  const greenest = by((w) => w.o.co2)
  const bestMatch = hits.slice().sort((a, b) => b.sc - a.sc)[0]

  const highlights: Array<[string, typeof cheapest, string, string, string]> = [
    [t(lang, 'Rẻ nhất', 'Cheapest'), cheapest, usd(cheapest.o.price), 'var(--up)',
      median - Number(cheapest.o.price) >= 0
        ? t(lang, `tiết kiệm ${usd((median - Number(cheapest.o.price)) * qty)} so trung vị tuyến`,
          `saves ${usd((median - Number(cheapest.o.price)) * qty)} vs lane median`)
        : t(lang, `cao hơn trung vị tuyến ${usd((Number(cheapest.o.price) - median) * qty)}`,
          `${usd((Number(cheapest.o.price) - median) * qty)} above lane median`)],
    [t(lang, 'Nhanh nhất', 'Fastest'), fastest, `${fastest.o.transit} ${t(lang, 'ngày', 'days')}`,
      'var(--brand-500)',
      fastest.o.isDirect ? t(lang, 'tàu thẳng', 'direct') : `${t(lang, 'qua', 'via')} ${fastest.o.transhipment}`],
    [t(lang, 'Xanh nhất', 'Greenest'), greenest, `${num(greenest.o.co2)} kg`, 'var(--up)',
      t(lang, 'CO₂e mỗi cont', 'CO₂e per unit')],
    [t(lang, 'Điểm ghép cao nhất', 'Best match'), bestMatch, `${bestMatch.sc}/100`, 'var(--gold-500)',
      t(lang, 'cân bằng giá, lịch và độ tin cậy', 'balances price, schedule, reliability')],
  ]

  const sorters: Record<string, (a: typeof hits[number], b: typeof hits[number]) => number> = {
    px: (a, b) => Number(a.o.price) - Number(b.o.price),
    tt: (a, b) => a.o.transit - b.o.transit,
    rel: (a, b) => b.o.reliability - a.o.reliability,
    co2: (a, b) => a.o.co2 - b.o.co2,
    sc: (a, b) => b.sc - a.sc,
  }
  const list = hits.slice().sort(sorters[sortBy] ?? sorters.sc)

  const openId = openModalId(sp)
  const opened = openId === 'weights' ? null : list.find((w) => String(w.o.id) === openId)

  const eta = (o: OfferRow) => {
    const d = new Date(o.departOn)
    d.setUTCDate(d.getUTCDate() + o.transit)
    return d.toISOString().slice(0, 10)
  }

  return (
    <>
      {header}
      {summary}
      {laneKpis}

      <div className="grid g4" style={{ marginBottom: 14 }}>
        {highlights.map(([title, w, value, color, meta]) => (
          <Link key={title} className="card" style={{ cursor: 'pointer' }} scroll={false}
            href={modalHref(basePath, sp, String(w.o.id))}>
            <div className="card-b" style={{ padding: 12 }}>
              <div className="muted" style={{ fontWeight: 700 }}>{title}</div>
              <div className="num" style={{ fontSize: 19, fontWeight: 780, color, margin: '2px 0 4px' }}>{value}</div>
              <div className="flex" style={{ gap: 7 }}>
                <Avatar name={w.o.carrier} color={w.o.carrierColor} size={22} />
                <b style={{ fontSize: 11.5 }}>{w.o.carrier}</b>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>{meta}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="between wrap" style={{ marginBottom: 10, gap: 10 }}>
        <b style={{ fontSize: 13.5 }}>
          {t(lang, `${hits.length} báo giá khả dụng cho yêu cầu này`, `${hits.length} live quotes for this requirement`)}
        </b>
        <div className="seg">
          {([
            ['sc', t(lang, 'Điểm ghép cao nhất', 'Best match')],
            ['px', t(lang, 'Giá thấp nhất', 'Cheapest')],
            ['tt', t(lang, 'Nhanh nhất', 'Fastest')],
            ['rel', t(lang, 'Tin cậy nhất', 'Most reliable')],
            ['co2', t(lang, 'Xanh nhất', 'Greenest')],
          ] as Array<[string, string]>).map(([k, label]) => (
            <Link key={k} className={sortBy === k ? 'on' : ''} scroll={false}
              href={tableHref(basePath, sp, { 'mk.sort': k })}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 10, marginBottom: 14 }}>
        {list.slice(0, 8).map((w, rank) => {
          const o = w.o
          const best = rank === 0
          const late = mk.arriveBy !== '' && eta(o) > mk.arriveBy
          const why: string[] = []
          if (Number(o.price) <= median) why.push(t(lang, 'giá dưới trung vị tuyến', 'below lane median'))
          if (o.reliability >= 93) why.push(t(lang, `đúng lịch ${o.reliability}%`, `on-time ${o.reliability}%`))
          if (o.isDirect) why.push(t(lang, 'tàu thẳng', 'direct sailing'))
          if (o.slotsLeft >= qty * 2) why.push(t(lang, 'còn nhiều chỗ', 'ample capacity'))
          if (o.freeDays >= 14) why.push(t(lang, `miễn lưu bãi ${o.freeDays} ngày`, `free time ${o.freeDays} days`))
          const deviation = (Number(o.price) - refIndex) / refIndex * 100

          return (
            <Link key={o.id} className={`ratecard ${best ? 'best' : ''}`} scroll={false}
              href={modalHref(basePath, sp, String(o.id))}>
              <div className="mk-rate">
                <div className="flex" style={{ gap: 10 }}>
                  <Avatar name={o.carrier} color={o.carrierColor} size={36} />
                  <div>
                    <b style={{ fontSize: 13 }}>{o.carrier}</b>
                    <div className="muted">{o.vessel}</div>
                    <div className="muted">{o.lane} · {o.equipment} · {o.serviceMode}</div>
                    <div className="flex wrap" style={{ gap: 3, marginTop: 3 }}>
                      {best ? <Tag tone="gd">★ {t(lang, 'Đề xuất', 'Recommended')}</Tag> : null}
                      <Tag tone="n">★ {num(o.rating, 1)}</Tag>
                    </div>
                  </div>
                </div>

                <div className="flex" style={{ gap: 12 }}>
                  <div>
                    <div className="muted">ETD</div>
                    <b className="num">{o.departOn}</b>
                    <div className="muted">{t(lang, 'cắt máng', 'cut-off')} -{o.cutoffDays}d</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', minWidth: 110 }}>
                    <div className="mk-leg">
                      <span className="a" />
                      {o.transhipment ? <span className="t" /> : null}
                      <span className="b" />
                    </div>
                    <div className="muted" style={{ marginTop: -8 }}>
                      {o.transit} {t(lang, 'ngày', 'days')} · {o.isDirect
                        ? t(lang, 'Tàu thẳng', 'Direct')
                        : `${t(lang, 'qua', 'via')} ${o.transhipment}`}
                    </div>
                    <div className="muted">{o.weekly} {t(lang, 'chuyến/tuần', 'sailings/wk')}</div>
                  </div>
                  <div>
                    <div className="muted">ETA</div>
                    <b className="num">{eta(o)}</b>
                    {mk.arriveBy
                      ? <div><Tag tone={late ? 'd' : 'u'}>{late
                        ? t(lang, 'trễ hạn', 'after cut')
                        : t(lang, 'kịp hạn', 'in time')}</Tag></div>
                      : null}
                  </div>
                </div>

                <div>
                  <Meter value={o.reliability} color={o.reliability >= 93 ? 'var(--up)' : 'var(--gold-500)'} width={58} />
                  <div className="muted">{t(lang, 'Đúng lịch 12T', 'On-time 12M')}</div>
                  <div style={{ marginTop: 4 }}><Tag tone="n">🌱 {num(o.co2)} kg CO₂e</Tag></div>
                </div>

                <div>
                  <div className="muted">{t(lang, 'Điểm ghép lệnh', 'Match score')}</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 750, color: 'var(--brand-600)' }}>
                    {w.sc}<span className="muted">/100</span>
                  </div>
                  <div className="muted">{t(lang, 'Còn', 'Left')} <b>{o.slotsLeft}</b> TEU</div>
                  <div className="muted">{t(lang, 'miễn phí lưu', 'free time')} {o.freeDays}d</div>
                </div>

                <div className="flex wrap" style={{ gap: 4 }}>
                  {o.hasFinance ? <Tag tone="u">💳 {t(lang, 'Trả chậm 60N', '60-day terms')}</Tag> : null}
                  {o.hasInsurance ? <Tag tone="b">🛡️ {t(lang, 'Có bảo hiểm', 'Insurance')}</Tag> : null}
                  {o.hasEbl ? <Tag tone="v">📄 eB/L</Tag> : null}
                  {o.acceptsDg ? <Tag tone="n">☣ DG</Tag> : null}
                  {o.slotsLeft < qty * 1.4 ? <Tag tone="d">{t(lang, 'Sắp hết chỗ', 'Low capacity')}</Tag> : null}
                  <div className="muted" style={{ width: '100%', marginTop: 3, lineHeight: 1.45 }}>
                    {t(lang, 'Vì sao gợi ý: ', 'Why: ')}{why.slice(0, 3).join(' · ')}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="muted">{t(lang, 'Tổng giá / cont', 'All-in / unit')}</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 780, letterSpacing: '-.03em' }}>
                    {usd(o.price)}
                  </div>
                  <div className="muted">
                    <Tag tone={Number(o.price) <= refIndex ? 'u' : 'gd'}>
                      {pct(deviation)} {t(lang, 'so chỉ số', 'vs index')}
                    </Tag>
                  </div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {qty} cont: <b className="num">{usd(Number(o.price) * qty)}</b>
                  </div>
                  <div className="muted">
                    {t(lang, 'cơ bản', 'base')} {usd(o.base)} · THC {usd(o.thc)} · BAF {usd(o.bunker)} · {t(lang, 'c/từ', 'doc')} {usd(o.docFee)}
                  </div>
                  <div className="btn p sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}>
                    {t(lang, 'Đặt chỗ', 'Book')}
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {t(lang, `giữ giá ${o.validity} ngày`, `held ${o.validity} days`)}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <DataTable
        id="mkt"
        lang={lang}
        basePath={basePath}
        searchParams={sp}
        title={t(lang, 'Toàn bộ báo giá khớp yêu cầu', 'All matching quotes')}
        rows={list}
        pageSize={12}
        searchPlaceholder={t(lang, 'Tìm hãng tàu, tàu, phạm vi dịch vụ…', 'Search carrier, vessel, service scope…')}
        search={(w) => `${w.o.carrier} ${w.o.lane} ${w.o.vessel} ${w.o.equipment} ${w.o.serviceMode} ${w.o.transhipment ?? ''}`}
        filters={[
          {
            key: 'dir',
            label: t(lang, 'Hành trình', 'Routing'),
            options: [['1', t(lang, 'Đi thẳng', 'Direct')], ['0', t(lang, 'Trung chuyển', 'Transhipment')]],
            match: (w, v) => (v === '1' ? w.o.isDirect : !w.o.isDirect),
          },
          {
            key: 'svc',
            label: t(lang, 'Phạm vi', 'Scope'),
            options: services.map((s) => [s, s] as [string, string]),
            match: (w, v) => w.o.serviceMode === v,
          },
        ]}
        columns={[
          {
            key: 'carrier', header: t(lang, 'Hãng tàu', 'Carrier'), width: '22%',
            sortValue: (w) => w.o.carrier,
            render: (w) => (
              <div>
                <b style={{ fontSize: 12 }}>{w.o.carrier}</b>
                <div className="muted">{w.o.vessel} · {w.o.serviceMode}</div>
              </div>
            ),
          },
          {
            key: 'sc', header: t(lang, 'Điểm ghép', 'Match'), cls: 'c', width: '10%',
            sortValue: (w) => w.sc,
            render: (w) => <b className="num">{w.sc}</b>,
          },
          {
            key: 'px', header: t(lang, 'Giá tất cả', 'All-in'), cls: 'r', width: '14%',
            sortValue: (w) => Number(w.o.price),
            render: (w) => (
              <div>
                <b className="num">{usd(w.o.price)}</b>
                <div className="muted num">{qty} cont: {usd(Number(w.o.price) * qty)}</div>
              </div>
            ),
          },
          {
            key: 'tt', header: t(lang, 'Hành trình', 'Transit'), cls: 'c', width: '12%',
            sortValue: (w) => w.o.transit,
            render: (w) => (
              <div>
                <b className="num">{w.o.transit}</b> <span className="muted">{t(lang, 'ngày', 'd')}</span>
                <div className="muted">{w.o.isDirect ? t(lang, 'thẳng', 'direct') : w.o.transhipment}</div>
              </div>
            ),
          },
          {
            key: 'etd', header: 'ETD / ETA', cls: 'c', width: '13%',
            sortValue: (w) => w.o.departOn,
            render: (w) => (
              <div>
                <span className="num">{w.o.departOn}</span>
                <div className="muted num">{eta(w.o)}</div>
              </div>
            ),
          },
          {
            key: 'rel', header: t(lang, 'Tin cậy', 'Reliability'), cls: 'c', width: '11%',
            sortValue: (w) => w.o.reliability,
            render: (w) => (
              <div>
                <b className="num">{w.o.reliability}%</b>
                <div className="muted">🌱 {num(w.o.co2)} kg</div>
              </div>
            ),
          },
          {
            key: 'left', header: t(lang, 'Chỗ còn', 'Slots'), cls: 'r', width: '8%',
            sortValue: (w) => w.o.slotsLeft,
            render: (w) => <span className="num">{w.o.slotsLeft}</span>,
          },
        ]}
      />

      {openId === 'weights' ? (
        <Modal
          title={t(lang, 'Trọng số ghép lệnh', 'Matching weights')}
          icon="⚖️"
          basePath={basePath}
          searchParams={sp}
          closeLabel={t(lang, 'Đóng', 'Close')}
        >
          <div className="modal-b">
            <ModalPanel title={t(lang, 'Bảy tiêu chí xếp hạng', 'Seven ranking criteria')}>
              {([
                [t(lang, 'Giá so với khoảng giá tuyến', 'Price within lane range'), 25],
                [t(lang, 'Độ tin cậy đúng lịch', 'Schedule reliability'), 20],
                [t(lang, 'Sức chứa còn lại so với nhu cầu', 'Capacity vs requirement'), 15],
                [t(lang, 'Tàu thẳng', 'Direct sailing'), 10],
                [t(lang, 'Phù hợp loại hàng', 'Commodity fit'), 10],
                [t(lang, 'Cường độ phát thải CO₂', 'CO₂ intensity'), 10],
                [t(lang, 'Đánh giá nhà cung cấp', 'Provider rating'), 10],
              ] as Array<[string, number]>).map(([label, weight], i, all) => (
                <ModalRow key={label} term={label} last={i === all.length - 1}>
                  <b className="num">{weight}</b> <span className="muted">/ 100</span>
                </ModalRow>
              ))}
            </ModalPanel>
          </div>
        </Modal>
      ) : null}

      {opened ? (
        <Modal
          title={t(lang, 'Đặt chỗ', 'Book slot')}
          icon="🚢"
          tags={<Tag tone="b">{opened.o.lane}</Tag>}
          basePath={basePath}
          searchParams={sp}
          closeLabel={t(lang, 'Đóng', 'Close')}
        >
          <div className="modal-b">
            <ModalStats items={[
              [t(lang, 'Tổng giá / cont', 'All-in / unit'), usd(opened.o.price)],
              [t(lang, `Tổng ${qty} cont`, `Total ${qty} units`), usd(Number(opened.o.price) * qty)],
              [t(lang, 'Điểm ghép lệnh', 'Match score'), `${opened.sc}/100`],
              [t(lang, 'Hành trình', 'Transit'), `${opened.o.transit} ${t(lang, 'ngày', 'days')}`],
            ]} />
            <ModalPanel title={t(lang, 'Cấu thành giá', 'Price breakdown')}>
              <ModalRow term={t(lang, 'Cước cơ bản', 'Base freight')}>{usd(opened.o.base)}</ModalRow>
              <ModalRow term="THC">{usd(opened.o.thc)}</ModalRow>
              <ModalRow term={t(lang, 'Phụ phí nhiên liệu (BAF)', 'Bunker (BAF)')}>{usd(opened.o.bunker)}</ModalRow>
              <ModalRow term={t(lang, 'Phí chứng từ', 'Documentation')} last>{usd(opened.o.docFee)}</ModalRow>
            </ModalPanel>
            <ModalPanel title={t(lang, 'Lịch trình & điều kiện', 'Schedule & terms')}>
              <ModalRow term={t(lang, 'Hãng tàu / tàu', 'Carrier / vessel')}>
                {opened.o.carrier} · {opened.o.vessel}
              </ModalRow>
              <ModalRow term="ETD / ETA">{opened.o.departOn} → {eta(opened.o)}</ModalRow>
              <ModalRow term={t(lang, 'Cắt máng', 'Cut-off')}>-{opened.o.cutoffDays}d</ModalRow>
              <ModalRow term={t(lang, 'Phạm vi dịch vụ', 'Service scope')}>{opened.o.serviceMode}</ModalRow>
              <ModalRow term={t(lang, 'Miễn lưu bãi', 'Free time')}>{opened.o.freeDays}d</ModalRow>
              <ModalRow term={t(lang, 'Chỗ còn lại', 'Slots left')}>{opened.o.slotsLeft} TEU</ModalRow>
              <ModalRow term={t(lang, 'Hiệu lực giá', 'Rate validity')} last>
                {t(lang, `${opened.o.validity} ngày`, `${opened.o.validity} days`)}
              </ModalRow>
            </ModalPanel>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
