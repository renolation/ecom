import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { BarChart, Gauge } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import {
  BoundaryNote, Card, DefinitionList, KpiTile, Meter, PageHeader, Tag, TierPill,
} from '@/components/ui'
import { db } from '@/lib/db'
import {
  carriers, consentGrants, consentPurposes, documents, documentTypes, lettersOfCredit,
  lcSteps, lcTypes, members, settlements, settlementTriggers, shipments, shipmentStatuses,
} from '@/db/schema'
import { monthLabels, num, t, usd, type Lang } from '@/lib/i18n'
import { carrierOptions, laneOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import { modalHref, openModalId } from '@/components/modal'
import { ACTION_MODAL, EblEndorseModal, LcApplyModal } from './action-modals'
import { ShipmentModal } from './record-modals'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** s_ship — Shipments & Control Tower (ui-2.html:1752). */
export async function ShipmentsPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, statuses, laneOpts, carrierOpts] = await Promise.all([
    db.select({
      id: shipments.id,
      lane: shipments.laneCode,
      carrier: carriers.name,
      carrierCode: shipments.carrierCode,
      shipper: members.name,
      qty: shipments.qty,
      status: shipments.statusOrdinal,
      statusVi: shipmentStatuses.nameVi,
      statusEn: shipmentStatuses.nameEn,
      etd: shipments.etd,
      eta: shipments.eta,
      value: shipments.value,
      cargoValue: shipments.cargoValue,
      corridorId: shipments.corridorId,
      vessel: shipments.vessel,
      risk: shipments.riskLevel,
      hasEbl: shipments.hasEbl,
      hasInsurance: shipments.hasInsurance,
      hasFinance: shipments.hasFinance,
      inDispute: shipments.inDispute,
      docCount: shipments.docCount,
    })
      .from(shipments)
      .innerJoin(carriers, eq(carriers.code, shipments.carrierCode))
      .innerJoin(members, eq(members.id, shipments.shipperMemberId))
      .innerJoin(shipmentStatuses, eq(shipmentStatuses.ordinal, shipments.statusOrdinal))
      .orderBy(asc(shipments.etd)),
    db.select().from(shipmentStatuses).orderBy(asc(shipmentStatuses.ordinal)),
    laneOptions(),
    carrierOptions(),
  ])

  const openId = openModalId(searchParams)
  const openShipment = openId ? rows.find((r) => r.id === openId) ?? null : null

  const active = rows.filter((r) => r.status < 7)
  const atRisk = rows.filter((r) => r.risk === 2 && r.status < 7)
  const inTransit = rows.filter((r) => r.status === 4)
  const disputed = rows.filter((r) => r.inDispute)
  const totalTeu = rows.reduce((a, r) => a + r.qty, 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Vận hành', 'Shipper · Operations')}
        title={t(lang, 'Lô hàng & Control Tower', 'Shipments & Control Tower')}
        modules={['F14']}
        sandbox={['SB-06']}
        sub={t(lang,
          'Mọi lô hàng trên một dòng thời gian: đặt chỗ, hạ bãi, xếp tàu, trên biển, cập cảng, thông quan, giao hàng.',
          'Every shipment on one timeline: booked, gated in, loaded, in transit, arrived, cleared, delivered.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Đang chạy', 'Active')} value={num(active.length)}
          meta={t(lang, `${num(rows.length)} tổng cộng`, `${num(rows.length)} total`)} />
        <KpiTile label={t(lang, 'Đang trên biển', 'In transit')} value={num(inTransit.length)} />
        <KpiTile label={t(lang, 'Rủi ro cao', 'High risk')} value={num(atRisk.length)}
          meta={t(lang, 'ảnh hưởng giao hàng', 'delivery at risk')} metaTone="d" />
        <KpiTile label={t(lang, 'Có tranh chấp', 'In dispute')} value={num(disputed.length)}
          meta={t(lang, 'escrow đang giữ', 'escrow holding')} metaTone="gd" />
        <KpiTile label={t(lang, 'Tổng khối lượng', 'Total volume')} value={num(totalTeu)} unit="TEU" />
      </div>

      <DataTable
        id="ship" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Lô hàng', 'Shipments')} rows={rows}
        rowHref={(r) => modalHref(basePath, searchParams, r.id)}
        searchPlaceholder={t(lang, 'Tìm mã lô, tàu, tuyến…', 'Search reference, vessel, lane…')}
        search={(r) => `${r.id} ${r.vessel} ${r.lane} ${r.carrier} ${r.shipper}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statuses.map((s) => [String(s.ordinal), lang === 'vi' ? s.nameVi : s.nameEn]),
            match: (r, v) => String(r.status) === v,
          },
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
          { key: 'car', label: t(lang, 'Hãng tàu', 'Carrier'), options: carrierOpts, match: (r, v) => r.carrierCode === v },
          {
            key: 'risk', label: t(lang, 'Rủi ro', 'Risk'),
            options: [['2', t(lang, 'Cao', 'High')], ['1', t(lang, 'Trung bình', 'Medium')], ['0', t(lang, 'Thấp', 'Low')]],
            match: (r, v) => String(r.risk) === v,
          },
        ]}
        columns={[
          {
            key: 'id', header: t(lang, 'Mã lô', 'Reference'), width: '15%', sortValue: (r) => r.id,
            render: (r) => (
              <div>
                <b className="num" style={{ fontSize: 12 }}>{r.id}</b>
                <div className="muted">{r.vessel}</div>
              </div>
            ),
          },
          {
            key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '12%', sortValue: (r) => r.lane,
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{r.lane}</b>
                <div className="muted">{r.carrier}</div>
              </div>
            ),
          },
          { key: 'shipper', header: t(lang, 'Chủ hàng', 'Shipper'), width: '16%', sortValue: (r) => r.shipper, render: (r) => <span style={{ fontSize: 12 }}>{r.shipper}</span> },
          { key: 'qty', header: 'TEU', cls: 'r', width: '7%', sortValue: (r) => r.qty, render: (r) => <span className="num">{r.qty}</span> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), width: '13%', sortValue: (r) => r.status,
            render: (r) => (
              <div>
                <Tag tone={r.status >= 7 ? 'u' : r.status >= 4 ? 'b' : 'n'}>
                  {lang === 'vi' ? r.statusVi : r.statusEn}
                </Tag>
                <div style={{ marginTop: 4 }}>
                  <Meter value={((r.status + 1) / 8) * 100} width={54} />
                </div>
              </div>
            ),
          },
          {
            key: 'etd', header: 'ETD / ETA', cls: 'c', width: '13%', sortValue: (r) => r.etd,
            render: (r) => (
              <div className="num" style={{ fontSize: 11.5 }}>
                {r.etd}<div className="muted">{r.eta}</div>
              </div>
            ),
          },
          { key: 'value', header: t(lang, 'Giá trị cước', 'Freight value'), cls: 'r', width: '11%', sortValue: (r) => Number(r.value), render: (r) => <b className="num">{usd(r.value)}</b> },
          {
            key: 'flags', header: t(lang, 'Kèm theo', 'Attached'), width: '13%',
            render: (r) => (
              <div className="flex wrap" style={{ gap: 3 }}>
                {r.hasEbl ? <Tag tone="v">eB/L</Tag> : null}
                {r.hasInsurance ? <Tag tone="b">{t(lang, 'BH', 'Ins')}</Tag> : null}
                {r.hasFinance ? <Tag tone="u">{t(lang, 'Tài trợ', 'Fin')}</Tag> : null}
                {r.inDispute ? <Tag tone="d">{t(lang, 'Tranh chấp', 'Dispute')}</Tag> : null}
                {r.risk === 2 ? <Tag tone="d">{t(lang, 'Trễ', 'Late')}</Tag> : null}
              </div>
            ),
          },
        ]}
      />

      {openShipment ? (
        <ShipmentModal
          lang={lang} basePath={basePath} searchParams={searchParams}
          shipment={{
            id: openShipment.id, laneCode: openShipment.lane, carrier: openShipment.carrier,
            shipper: openShipment.shipper, qty: openShipment.qty,
            statusName: lang === 'vi' ? openShipment.statusVi : openShipment.statusEn,
            statusOrdinal: openShipment.status, etd: openShipment.etd, eta: openShipment.eta,
            value: Number(openShipment.value), cargoValue: Number(openShipment.cargoValue),
            vessel: openShipment.vessel, risk: openShipment.risk,
            hasEbl: openShipment.hasEbl, hasInsurance: openShipment.hasInsurance,
            hasFinance: openShipment.hasFinance, inDispute: openShipment.inDispute,
            docCount: openShipment.docCount, corridorId: openShipment.corridorId,
          }}
        />
      ) : null}
    </>
  )
}

/** s_docs — Documents & eB/L (ui-2.html:1841). */
export async function DocumentsPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, types] = await Promise.all([
    db.select({
      id: documents.id,
      typeVi: documentTypes.nameVi,
      typeEn: documentTypes.nameEn,
      typeCode: documents.docTypeCode,
      shipment: documents.shipmentId,
      shipper: members.name,
      issuedOn: documents.issuedOn,
      status: documents.statusCode,
      signatures: documents.signatureCount,
      isEbl: documents.isEbl,
      paperFallback: documents.paperFallback,
    })
      .from(documents)
      .innerJoin(documentTypes, eq(documentTypes.code, documents.docTypeCode))
      .innerJoin(members, eq(members.id, documents.shipperMemberId))
      .orderBy(asc(documents.issuedOn)),
    statusLabelMap(lang),
    db.select().from(documentTypes),
  ])

  const ebl = rows.filter((r) => r.isEbl)
  const fallback = rows.filter((r) => r.paperFallback)
  const endorsed = rows.filter((r) => r.status === 'endorsed')
  const docOpenId = openModalId(searchParams)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Vận hành', 'Shipper · Operations')}
        title={t(lang, 'Chứng từ & eB/L', 'Documents & eB/L')}
        modules={['F02']}
        sandbox={['SB-02']}
        actions={
          <Link className="btn p" scroll={false}
            href={modalHref(basePath, searchParams, ACTION_MODAL.ebl)}>
            {t(lang, 'Chuyển nhượng eB/L', 'Endorse eB/L')}
          </Link>
        }
        sub={t(lang,
          'Vận đơn điện tử theo nguyên tắc quyền kiểm soát duy nhất: mỗi thời điểm chỉ một bên nắm quyền, mọi lần ký hậu đều có dấu vết.',
          'Electronic bills of lading under single-control: exactly one party holds the record at a time and every endorsement is auditable.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng chứng từ', 'Total documents')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Vận đơn điện tử', 'Electronic B/L')} value={num(ebl.length)}
          meta={t(lang, `${num(endorsed.length)} đã ký hậu`, `${num(endorsed.length)} endorsed`)} metaTone="v" />
        <KpiTile label={t(lang, 'Phải dùng bản giấy', 'Paper fallback')} value={num(fallback.length)}
          meta={t(lang, 'khi đối tác chưa hỗ trợ', 'counterparty not yet enabled')} metaTone="gd" />
        <KpiTile label={t(lang, 'Chờ xác nhận', 'Awaiting confirmation')}
          value={num(rows.filter((r) => r.status === 'submitted').length)} metaTone="b"
          meta={t(lang, 'chặn phát hành B/L', 'blocks B/L issuance')} />
      </div>

      <DataTable
        id="doc" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Kho chứng từ', 'Document vault')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm số chứng từ, lô hàng…', 'Search document, shipment…')}
        search={(r) => `${r.id} ${r.shipment} ${r.shipper} ${r.typeVi} ${r.typeEn}`}
        filters={[
          {
            key: 'ty', label: t(lang, 'Loại', 'Type'),
            options: types.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => r.typeCode === v,
          },
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['issued', 'endorsed', 'cleared', 'submitted', 'amended']),
            match: (r, v) => r.status === v,
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Số chứng từ', 'Document'), width: '17%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          {
            key: 'ty', header: t(lang, 'Loại', 'Type'), width: '20%',
            sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
            render: (r) => (
              <div className="flex" style={{ gap: 6 }}>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>
                {r.isEbl ? <Tag tone="v">eB/L</Tag> : null}
              </div>
            ),
          },
          { key: 'ship', header: t(lang, 'Lô hàng', 'Shipment'), width: '17%', sortValue: (r) => r.shipment, render: (r) => <span className="num" style={{ fontSize: 11.5 }}>{r.shipment}</span> },
          { key: 'shipper', header: t(lang, 'Chủ hàng', 'Shipper'), width: '18%', sortValue: (r) => r.shipper, render: (r) => <span style={{ fontSize: 12 }}>{r.shipper}</span> },
          { key: 'date', header: t(lang, 'Ngày phát hành', 'Issued'), cls: 'c', width: '11%', sortValue: (r) => r.issuedOn, render: (r) => <span className="num">{r.issuedOn}</span> },
          { key: 'sig', header: t(lang, 'Chữ ký', 'Signatures'), cls: 'c', width: '8%', sortValue: (r) => r.signatures, render: (r) => <span className="num">{r.signatures}</span> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%', sortValue: (r) => r.status,
            render: (r) => (
              <div>
                <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>
                {r.paperFallback ? <div style={{ marginTop: 3 }}><Tag tone="gd">{t(lang, 'Bản giấy', 'Paper')}</Tag></div> : null}
              </div>
            ),
          },
        ]}
      />
      {docOpenId === ACTION_MODAL.ebl ? (
        <EblEndorseModal
          documents={ebl.slice(0, 8).map((d) => `${d.id} · ${d.shipment}`)}
          lang={lang} basePath={basePath} searchParams={searchParams}
        />
      ) : null}
    </>
  )
}

/** ui-2.html:1980 — twelve months of freight spend, in bn VND. */
const FREIGHT_SPEND = [6.2, 6.8, 7.1, 8.4, 9.2, 8.6, 10.1, 11.2, 10.4, 11.8, 12.6, 13.4]

/** ui-2.html:2006 — products a licensed institution offers this member. */
const WALLET_PRODUCTS: Array<[string, string, string, string, string, string, string, string, string]> = [
  ['💳', 'Trả chậm cước vận chuyển', 'Freight payment terms',
    'Hãng tàu được trả ngay, bạn trả sau 60–90 ngày', 'Carrier paid now, you settle in 60–90 days',
    '6,8% p.a.', '6.8% p.a.', 'var(--brand-600)', 'F06'],
  ['📄', 'Chiết khấu khoản phải thu', 'Receivable discounting',
    'Bán khoản phải thu đã xác thực, nhận tiền trong 4 giờ', 'Sell verified receivables, funded within 4 hours',
    '0,42%/tháng', '0.42%/mo', 'var(--up)', 'F06'],
  ['📦', 'Tài trợ hàng tồn trên đường', 'Inventory-in-transit',
    'Thế chấp bằng eB/L, tối đa 80% giá trị lô hàng', 'Secured by eB/L, up to 80% of cargo value',
    '7,9% p.a.', '7.9% p.a.', 'var(--gold-500)', 'F06'],
  ['🧾', 'Thư tín dụng số', 'Digital L/C',
    'Mở, phát hành và xuất trình chứng từ trên nền tảng', 'Apply, issue and present documents on-platform',
    'Theo biểu phí NH', 'Per bank tariff', 'var(--violet)', 'F05'],
  ['🛡️', 'Bảo hiểm hàng hoá nhúng', 'Embedded cargo insurance',
    'Một ô tích khi đặt chỗ, hồ sơ bồi thường tự dựng', 'One checkbox at booking, claim pack auto-built',
    '0,11%', '0.11%', 'var(--brand-500)', 'F10'],
  ['⏱️', 'Bảo hiểm trễ hàng theo tham số', 'Parametric delay cover',
    'Chi trả khi vượt ngưỡng cam kết — có người duyệt', 'Pays out beyond agreed threshold — human-approved',
    '0,22%', '0.22%', 'var(--violet)', 'F10'],
]

/** s_fin — Wallet, Escrow & Financing (ui-2.html:2001). */
export async function WalletPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels] = await Promise.all([
    db.select({
      id: settlements.id,
      shipment: settlements.shipmentId,
      counterparty: settlements.counterparty,
      carrier: settlements.carrier,
      amount: settlements.amount,
      triggerVi: settlementTriggers.nameVi,
      triggerEn: settlementTriggers.nameEn,
      status: settlements.statusCode,
      matched: settlements.isMatched,
      settledOn: settlements.settledOn,
      paymentRef: settlements.paymentRef,
      bank: settlements.bank,
      early: settlements.earlyPayment,
    })
      .from(settlements)
      .innerJoin(settlementTriggers, eq(settlementTriggers.id, settlements.triggerId))
      .orderBy(asc(settlements.settledOn)),
    statusLabelMap(lang),
  ])

  const paid = rows.filter((r) => r.status === 'paid')
  const pending = rows.filter((r) => r.status === 'pending')
  const exceptions = rows.filter((r) => r.status === 'exception' || r.status === 'dispute')

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Tài chính', 'Shipper · Finance')}
        title={t(lang, 'Ví, Escrow & Tài trợ', 'Wallet, Escrow & Financing')}
        modules={['F06']}
        sandbox={['SB-04 · SB-07']}
        sub={t(lang,
          'Toàn bộ dòng tiền logistics gắn với mã giao dịch. Tiền do ngân hàng giữ và chi trả; nền tảng tạo mã tham chiếu, gắn mốc và đối soát.',
          'All logistics cash flow tied to the transaction ID. Banks hold and move the money; the platform creates references, attaches milestones and reconciles.')}
        actions={
          <>
            <span className="btn">{t(lang, 'Nạp tiền', 'Top up')}</span>
            <span className="btn p">{t(lang, 'Đề nghị tăng hạn mức', 'Request a limit increase')}</span>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Số dư khả dụng', 'Available balance')} value="12.4"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, 'TK HDBank · VLX-88214', 'HDBank a/c · VLX-88214')} metaTone="n" />
        <KpiTile label={t(lang, 'Đang giữ escrow', 'Held in escrow')} value="5.6"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, 'trên 12 booking', 'across 12 bookings')} />
        <KpiTile label={t(lang, 'Hạn mức tín dụng', 'Credit limit')} value="40.0"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          bar={38} meta={t(lang, 'đã dùng 38%', '38% drawn')} />
        <KpiTile label={t(lang, 'Chi phí vốn bình quân', 'Blended cost of funds')} value="6.8"
          unit="% p.a." meta={t(lang, '−2,4 pp so vay thường', '−2.4 pp vs standard loan')} metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian pre-check', 'Pre-check TAT')} value="11.4" unit="h"
          meta={t(lang, 'ngưỡng KPI ≤24 giờ', 'KPI ≤24h')} metaTone="u" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Dòng tiền logistics 12 tháng', 'Logistics cash flow — 12 months')}>
          <BarChart
            items={monthLabels(lang).map((m, i) => ({
              l: m, v: FREIGHT_SPEND[i],
              c: i > 9 ? 'var(--brand-400)' : 'var(--brand-500)',
            }))}
            height={210}
            fmt={(v) => `${v.toFixed(0)} ${t(lang, 'tỷ', 'bn')}`}
            valueLabel={(v) => (v > 11 ? v.toFixed(1) : '')}
          />
        </Card>

        <Card title={t(lang, 'Hạn mức & điều kiện', 'Limit & terms')}
          right={<Tag tone="u">HDBank</Tag>}>
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <Gauge value={78} label={t(lang, 'Điểm tín nhiệm', 'Credit score')} size={170} />
          </div>
          <DefinitionList rows={[
            [t(lang, 'Xếp hạng nội bộ', 'Internal rating'),
              <Tag tone="u">A− {t(lang, 'Ổn định', 'Stable')}</Tag>],
            [t(lang, 'Hạn mức được duyệt', 'Approved limit'),
              <span className="num">40,0 {t(lang, 'tỷ đ', 'bn')}</span>],
            [t(lang, 'Kỳ hạn trả chậm', 'Payment terms'), `60 ${t(lang, 'ngày', 'days')}`],
            [t(lang, 'Lãi suất', 'Rate'), <span className="num">6,8% p.a.</span>],
            [t(lang, 'Tài sản bảo đảm', 'Collateral'),
              t(lang, 'Khoản phải thu + eB/L', 'Receivables + eB/L')],
          ]} />
          <div className="note" style={{ background: 'var(--up-bg)' }}>
            <b style={{ color: 'var(--up)' }}>
              ↑ {t(lang, 'Đủ điều kiện nâng hạn mức', 'Eligible for an increase')}
            </b><br />
            {t(lang,
              '24 tháng thanh toán đúng hạn 100% và khối lượng tăng 34% → có thể nâng lên 64 tỷ đồng với lãi suất 6,2%. Quyết định thuộc HDBank.',
              '24 months of 100% on-time payments and 34% volume growth → eligible for 64bn VND at 6.2%. The decision rests with HDBank.')}
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
      <DataTable
        id="esc" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Escrow & quyết toán theo mốc', 'Escrow & milestone settlement')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm mã, lô hàng, đối tác…', 'Search reference, shipment, counterparty…')}
        search={(r) => `${r.id} ${r.shipment} ${r.counterparty} ${r.carrier} ${r.paymentRef}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['paid', 'pending', 'exception', 'dispute']),
            match: (r, v) => r.status === v,
          },
          {
            key: 'bank', label: t(lang, 'Ngân hàng', 'Bank'),
            options: [...new Set(rows.map((r) => r.bank))].map((b) => [b, b] as [string, string]),
            match: (r, v) => r.bank === v,
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã quyết toán', 'Settlement'), width: '14%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          { key: 'ship', header: t(lang, 'Lô hàng', 'Shipment'), width: '15%', sortValue: (r) => r.shipment, render: (r) => <span className="num" style={{ fontSize: 11.5 }}>{r.shipment}</span> },
          { key: 'cp', header: t(lang, 'Đối tác', 'Counterparty'), width: '18%', sortValue: (r) => r.counterparty, render: (r) => <span style={{ fontSize: 12 }}>{r.counterparty}</span> },
          {
            key: 'trig', header: t(lang, 'Mốc giải ngân', 'Release trigger'), width: '16%',
            sortValue: (r) => (lang === 'vi' ? r.triggerVi : r.triggerEn),
            render: (r) => <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.triggerVi : r.triggerEn}</span>,
          },
          { key: 'amt', header: t(lang, 'Số tiền', 'Amount'), cls: 'r', width: '11%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{usd(r.amount)}</b> },
          { key: 'bank', header: t(lang, 'Ngân hàng', 'Bank'), cls: 'c', width: '9%', sortValue: (r) => r.bank, render: (r) => <span style={{ fontSize: 11.5 }}>{r.bank}</span> },
          { key: 'date', header: t(lang, 'Ngày', 'Date'), cls: 'c', width: '9%', sortValue: (r) => r.settledOn, render: (r) => <span className="num">{r.settledOn}</span> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '8%', sortValue: (r) => r.status,
            render: (r) => <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>,
          },
        ]}
      />
        <Card title={t(lang, 'Sản phẩm khả dụng cho bạn', 'Products available to you')}
          right={
            <span className="sub">
              {t(lang, 'Do tổ chức được cấp phép cung cấp', 'Provided by licensed institutions')}
            </span>
          }
          bodyStyle={{ padding: 11 }}>
          {WALLET_PRODUCTS.map(([icon, vi, en, dVi, dEn, rVi, rEn, color, mod]) => (
            <div key={en} style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: 10,
              border: '1px solid var(--line)', borderRadius: 'var(--r)', marginBottom: 7,
            }}>
              <div style={{ fontSize: 18 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 12.5 }}>{t(lang, vi, en)}</b>
                <span className="mod">{mod}</span>
                <div className="muted">{t(lang, dVi, dEn)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontWeight: 750, color, fontSize: 12.5 }}>
                  {t(lang, rVi, rEn)}
                </div>
                <span className="btn xs" style={{ marginTop: 4 }}>{t(lang, 'Đăng ký', 'Apply')}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}


/** ui-2.html:2075 — the automated examination result for the detailed L/C. */
const LC_EXAMINATION: Array<[string, string, boolean, number, string, string]> = [
  ['eB/L', 'eB/L', true, 98,
    'Khớp cảng đi/đến, ngày xếp hàng trong hạn', 'Ports and shipped-on-board date within terms'],
  ['Hoá đơn thương mại', 'Commercial invoice', true, 96,
    'Khớp giá trị và mô tả hàng hoá', 'Value and goods description match'],
  ['Packing list', 'Packing list', true, 94,
    'Khớp số lượng và trọng lượng', 'Quantity and weight match'],
  ['C/O Form B', 'C/O Form B', false, 82,
    'Ngày phát hành sau ngày xếp hàng 1 ngày — cần ngân hàng xem xét',
    'Issued one day after shipment — requires bank review'],
  ['Chứng nhận bảo hiểm', 'Insurance certificate', true, 97,
    'Giá trị bảo hiểm ≥110% hoá đơn theo yêu cầu', 'Insured value ≥110% of invoice as required'],
  ['Phiếu kiểm định', 'Inspection certificate', false, 74,
    'Thiếu chữ ký của đơn vị kiểm định thứ ba', 'Missing third-party inspector signature'],
]

/** ui-2.html:2085 — why the digital flow beats the paper one. */
const LC_FASTER: Array<[string, string, string, string]> = [
  ['Chứng từ đã có sẵn trên nền tảng', 'Documents already on-platform',
    'eB/L, hoá đơn, packing list được tạo từ cùng một hồ sơ giao dịch — không nhập lại',
    'The eB/L, invoice and packing list come from the same transaction record — no re-keying'],
  ['Kiểm tra tính đầy đủ ngay khi tạo', 'Completeness checked at creation',
    'Sai lệch được phát hiện trước khi xuất trình, không phải sau 5 ngày làm việc',
    'Discrepancies surface before presentation, not after five banking days'],
  ['Dữ liệu vận chuyển đã được xác minh', 'Shipping data already verified',
    'Ngày xếp hàng lấy từ TOS cảng và AIS, không phải từ tờ khai tự khai',
    'Shipped-on-board dates come from port TOS and AIS, not from self-declaration'],
  ['Quyền kiểm soát eB/L chuyển ngay', 'eB/L control transfers instantly',
    'Không chờ chuyển phát vận đơn giấy giữa các ngân hàng',
    'No courier of paper bills between banks'],
]

/** s_lc — Digital L/C (ui-2.html:2043). */
export async function LetterOfCreditPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, steps, types] = await Promise.all([
    db.select({
      id: lettersOfCredit.id,
      typeVi: lcTypes.nameVi,
      typeEn: lcTypes.nameEn,
      typeId: lettersOfCredit.lcTypeId,
      applicant: members.name,
      beneficiary: lettersOfCredit.beneficiary,
      bank: lettersOfCredit.bank,
      shipment: lettersOfCredit.shipmentId,
      amount: lettersOfCredit.amount,
      step: lettersOfCredit.stepOrdinal,
      stepVi: lcSteps.nameVi,
      stepEn: lcSteps.nameEn,
      discrepancies: lettersOfCredit.discrepancies,
      openedOn: lettersOfCredit.openedOn,
      expiresOn: lettersOfCredit.expiresOn,
      turnaround: lettersOfCredit.turnaroundHours,
      autoChecked: lettersOfCredit.autoChecked,
      lane: lettersOfCredit.laneCode,
      docCount: lettersOfCredit.docCount,
    })
      .from(lettersOfCredit)
      .innerJoin(lcTypes, eq(lcTypes.id, lettersOfCredit.lcTypeId))
      .innerJoin(lcSteps, eq(lcSteps.ordinal, lettersOfCredit.stepOrdinal))
      .innerJoin(members, eq(members.id, lettersOfCredit.applicantMemberId))
      // Insertion order, so the detailed L/C matches the prototype's LCS[0] pick.
      .orderBy(asc(lettersOfCredit.id)),
    db.select().from(lcSteps).orderBy(asc(lcSteps.ordinal)),
    db.select().from(lcTypes).orderBy(asc(lcTypes.id)),
  ])

  const settled = rows.filter((r) => r.step === 5)
  const examining = rows.filter((r) => r.step === 4)
  const withDiscrepancies = rows.filter((r) => r.discrepancies > 0)
  const outstanding = rows.filter((r) => r.step < 5)
  const outstandingValue = outstanding.reduce((a, r) => a + Number(r.amount), 0)

  // The prototype details the first L/C sitting at the examination step.
  const detail = rows.find((r) => r.step === 4) ?? rows[0]
  const stepLabels: Array<[string, string]> = [
    ['Lập hồ sơ', 'Apply'], ['Phát hành', 'Issue'], ['Thông báo', 'Advise'],
    ['Xuất trình', 'Present'], ['Kiểm tra', 'Examine'], ['Thanh toán', 'Settle'],
  ]

  // ui-2.html:2081 — the chart uses abbreviated type labels, in lookup order.
  const shortLabels = lang === 'vi'
    ? ['KHN', 'UPAS', 'Trả ngay', 'Trả chậm', 'X.nhận']
    : ['Irrev.', 'UPAS', 'Sight', 'Usance', 'Conf.']
  const byType = types.map((ty, i) => ({
    l: shortLabels[i] ?? (lang === 'vi' ? ty.nameVi : ty.nameEn),
    v: rows.filter((r) => r.typeId === ty.id).length,
    c: 'var(--brand-500)',
  }))

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Tài chính', 'Shipper · Finance')}
        title={t(lang, 'Thư tín dụng số', 'Digital L/C')}
        modules={['F05']}
        sandbox={['SB-03']}
        sub={t(lang,
          'Mở, theo dõi và xuất trình chứng từ L/C ngay trên hồ sơ giao dịch. Nền tảng kiểm tra tính đầy đủ và gợi ý sai lệch; ngân hàng phát hành và quyết định thanh toán.',
          'Apply, track and present L/C documents against the same transaction record. The platform checks completeness and flags discrepancies; the bank issues and decides payment.')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Mẫu hồ sơ', 'Template')}</span>
            <Link className="btn p" scroll={false}
              href={modalHref(basePath, searchParams, ACTION_MODAL.lc)}>
              + {t(lang, 'Mở L/C mới', 'New L/C')}
            </Link>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'L/C đang lưu hành', 'L/C outstanding')} value={num(outstanding.length)}
          meta={t(lang, `trên ${rows.length} luỹ kế`, `of ${rows.length} cumulative`)} />
        <KpiTile label={t(lang, 'Giá trị đang lưu hành', 'Outstanding value')}
          value={`${usd(Math.round(outstandingValue / 1000))}K`}
          meta={t(lang, `${num(withDiscrepancies.length)} bộ có sai lệch`, `${num(withDiscrepancies.length)} with discrepancies`)}
          metaTone="gd" />
        <KpiTile label={t(lang, 'Thời gian phát hành', 'Issuance TAT')} value="18.4" unit="h"
          meta={t(lang, 'trước đây 4,2 ngày', 'was 4.2 days')} metaTone="u" />
        <KpiTile label={t(lang, 'Tỷ lệ sai lệch chứng từ', 'Discrepancy rate')} value="6.4" unit="%"
          meta={t(lang, 'ngành thường 48%', 'industry ~48%')} metaTone="u" />
        <KpiTile label={t(lang, 'Kiểm tra tự động', 'Auto-checked')} value="72" unit="%"
          meta={t(lang, 'AI · mức L2 có người duyệt', 'AI · L2 with approval')} metaTone="v" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card
          title={`${detail.id} · ${lang === 'vi' ? detail.typeVi : detail.typeEn}`}
          right={
            <>
              <Tag tone="b">{detail.bank}</Tag>
              {detail.discrepancies
                ? <Tag tone="d">{detail.discrepancies} {t(lang, 'sai lệch', 'discrepancies')}</Tag>
                : <Tag tone="u">{t(lang, 'Không sai lệch', 'No discrepancy')}</Tag>}
            </>
          }
          footer={t(lang,
            'Ngân hàng đang kiểm tra — hạn trả lời theo UCP 600: 5 ngày làm việc',
            'Bank examining — UCP 600 response deadline: 5 banking days')}>
          <div className="stepper" style={{ marginBottom: 16 }}>
            {stepLabels.map(([vi, en], i) => (
              <div key={en} className={`step ${i < detail.step ? 'done' : i === detail.step ? 'on' : ''}`}>
                <i>{i < detail.step ? '✓' : i + 1}</i>
                <span>{t(lang, vi, en)}</span>
              </div>
            ))}
          </div>

          <div className="grid g2" style={{ gap: 12 }}>
            <DefinitionList rows={[
              [t(lang, 'Người thụ hưởng', 'Beneficiary'), detail.beneficiary],
              [t(lang, 'Ngân hàng phát hành', 'Issuing bank'), detail.bank],
              [t(lang, 'Giá trị', 'Value'),
                <span className="num" style={{ fontSize: 15 }}>{usd(detail.amount)}</span>],
            ]} />
            <DefinitionList rows={[
              [t(lang, 'Lô hàng gắn kèm', 'Linked shipment'),
                <span className="num" style={{ fontSize: 11.5 }}>{detail.shipment}</span>],
              [t(lang, 'Tuyến', 'Lane'), detail.lane],
              [t(lang, 'Ngày mở / hết hạn', 'Opened / expiry'),
                <span className="num">{detail.openedOn} → {detail.expiresOn}</span>],
              [t(lang, 'Bộ chứng từ', 'Document set'),
                <span className="num">{detail.docCount} {t(lang, 'loại', 'types')}</span>],
            ]} />
          </div>

          <div className="sep" />
          <b style={{ fontSize: 12.5 }}>
            {t(lang, 'Kiểm tra chứng từ tự động', 'Automated document examination')}{' '}
            <TierPill tier={2} lang={lang} />
          </b>
          <div className="tbl-wrap" style={{ maxHeight: 'none', marginTop: 8 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, 'Chứng từ', 'Document')}</th>
                  <th className="c">{t(lang, 'Đối chiếu điều kiện L/C', 'Against L/C terms')}</th>
                  <th className="c">{t(lang, 'Tin cậy', 'Confidence')}</th>
                  <th>{t(lang, 'Ghi chú', 'Note')}</th>
                </tr>
              </thead>
              <tbody>
                {LC_EXAMINATION.map(([nVi, nEn, compliant, confidence, noteVi, noteEn]) => (
                  <tr key={nEn}>
                    <td><b style={{ fontSize: 12 }}>{t(lang, nVi, nEn)}</b></td>
                    <td className="c">
                      <Tag tone={compliant ? 'u' : 'gd'}>
                        {compliant ? t(lang, 'Phù hợp', 'Compliant') : t(lang, 'Cần xem xét', 'Needs review')}
                      </Tag>
                    </td>
                    <td className="c num">{confidence}%</td>
                    <td style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{t(lang, noteVi, noteEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note">
            <b>{t(lang, 'Ranh giới quyết định', 'Decision boundary')}:</b>{' '}
            {t(lang,
              'AI chỉ đánh dấu và giải thích. Việc chấp nhận hay từ chối bộ chứng từ, và quyết định thanh toán, thuộc về chuyên viên ngân hàng phát hành. Mọi lần ghi đè đều được lưu vào decision trace.',
              'AI only flags and explains. Accepting or refusing the document set, and the payment decision, rest with the issuing bank’s officer. Every override is written to the decision trace.')}
          </div>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Phân bố theo loại L/C', 'Mix by L/C type')}>
            <BarChart items={byType} height={170} valueLabel={(v) => num(v)} />
          </Card>

          <Card title={t(lang, 'Vì sao L/C số nhanh hơn', 'Why digital L/C is faster')}
            bodyStyle={{ padding: 11 }}>
            {LC_FASTER.map(([vi, en, dVi, dEn]) => (
              <div key={en} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <b style={{ fontSize: 12, color: 'var(--up)' }}>✓ {t(lang, vi, en)}</b>
                <div className="muted" style={{ marginTop: 2 }}>{t(lang, dVi, dEn)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <DataTable
        id="lc" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Danh sách thư tín dụng', 'Letter of credit register')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm mã L/C, bên thụ hưởng…', 'Search L/C, beneficiary…')}
        search={(r) => `${r.id} ${r.applicant} ${r.beneficiary} ${r.bank} ${r.shipment}`}
        filters={[
          {
            key: 'step', label: t(lang, 'Bước', 'Step'),
            options: steps.map((s) => [String(s.ordinal), lang === 'vi' ? s.nameVi : s.nameEn]),
            match: (r, v) => String(r.step) === v,
          },
          {
            key: 'ty', label: t(lang, 'Loại', 'Type'),
            options: types.map((x) => [String(x.id), lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => String(r.typeId) === v,
          },
        ]}
        columns={[
          { key: 'id', header: 'L/C', width: '13%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          {
            key: 'ty', header: t(lang, 'Loại', 'Type'), width: '14%',
            sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
            render: (r) => <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>,
          },
          {
            key: 'parties', header: t(lang, 'Bên mở → thụ hưởng', 'Applicant → beneficiary'), width: '22%',
            sortValue: (r) => r.applicant,
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{r.applicant}</b>
                <div className="muted">→ {r.beneficiary}</div>
              </div>
            ),
          },
          { key: 'bank', header: t(lang, 'Ngân hàng', 'Bank'), cls: 'c', width: '9%', sortValue: (r) => r.bank, render: (r) => <span style={{ fontSize: 11.5 }}>{r.bank}</span> },
          { key: 'amt', header: t(lang, 'Số tiền', 'Amount'), cls: 'r', width: '11%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{usd(r.amount)}</b> },
          {
            key: 'step', header: t(lang, 'Bước xử lý', 'Stage'), width: '15%', sortValue: (r) => r.step,
            render: (r) => (
              <div>
                <Tag tone={r.step === 5 ? 'u' : r.step >= 3 ? 'gd' : 'b'}>
                  {lang === 'vi' ? r.stepVi : r.stepEn}
                </Tag>
                <div style={{ marginTop: 4 }}><Meter value={((r.step + 1) / 6) * 100} width={54} /></div>
              </div>
            ),
          },
          {
            key: 'disc', header: t(lang, 'Sai lệch', 'Discrepancies'), cls: 'c', width: '9%',
            sortValue: (r) => r.discrepancies,
            render: (r) => r.discrepancies > 0
              ? <Tag tone="d">{r.discrepancies}</Tag>
              : <span className="muted">—</span>,
          },
          { key: 'exp', header: t(lang, 'Hết hạn', 'Expires'), cls: 'c', width: '10%', sortValue: (r) => r.expiresOn, render: (r) => <span className="num">{r.expiresOn}</span> },
        ]}
      />
      {openModalId(searchParams) === ACTION_MODAL.lc ? (
        <LcApplyModal
          shipments={[...new Set(rows.map((r) => r.shipment))].slice(0, 6)}
          lang={lang} basePath={basePath} searchParams={searchParams}
        />
      ) : null}
    </>
  )
}

/** s_consent — Consent & Data Portability (ui-2.html:2180). */
export async function ConsentPage({ lang }: RoutePageProps) {
  const rows = await db.select({
    id: consentPurposes.id,
    purposeVi: consentPurposes.purposeVi,
    purposeEn: consentPurposes.purposeEn,
    counterparty: consentPurposes.counterparty,
    scopeVi: consentPurposes.dataScopeVi,
    scopeEn: consentPurposes.dataScopeEn,
    basisVi: consentPurposes.legalBasisVi,
    basisEn: consentPurposes.legalBasisEn,
    retention: consentPurposes.retentionMonths,
    revocable: consentPurposes.revocable,
    granted: consentGrants.granted,
  })
    .from(consentPurposes)
    .leftJoin(consentGrants, eq(consentGrants.purposeId, consentPurposes.id))
    .orderBy(asc(consentPurposes.ord))

  const granted = rows.filter((r) => r.granted)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Dữ liệu của tôi', 'Shipper · My data')}
        title={t(lang, 'Đồng ý & Quyền mang dữ liệu đi', 'Consent & Data Portability')}
        modules={['F11']}
        sub={t(lang,
          'Dữ liệu giao dịch thuộc quyền kiểm soát của bạn. Mỗi mục đích gắn với một cơ sở xử lý, thời hạn lưu giữ, phạm vi chia sẻ và cơ chế thu hồi.',
          'Your transaction data stays under your control. Each purpose is tied to a processing basis, retention period, sharing scope and a revocation mechanism.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Mục đích đã cấp quyền', 'Purposes granted')} value={num(granted.length)}
          meta={t(lang, `trên ${num(rows.length)} mục đích`, `of ${num(rows.length)}`)} />
        <KpiTile label={t(lang, 'Có thể thu hồi', 'Revocable')}
          value={num(rows.filter((r) => r.revocable).length)} metaTone="u"
          meta={t(lang, 'bất cứ lúc nào', 'at any time')} />
        <KpiTile label={t(lang, 'Bắt buộc theo hợp đồng', 'Contractually required')}
          value={num(rows.filter((r) => !r.revocable).length)} metaTone="n"
          meta={t(lang, 'không thể thu hồi riêng lẻ', 'cannot be revoked alone')} />
        <KpiTile label={t(lang, 'Lưu giữ tối đa', 'Longest retention')}
          value={num(Math.max(...rows.map((r) => r.retention ?? 0)))}
          unit={t(lang, 'tháng', 'months')} />
      </div>

      <BoundaryNote lang={lang}>
        {t(lang,
          ' — nền tảng chỉ chia sẻ đúng phạm vi bạn đã cấp cho từng mục đích. Không có mục đích nào cho phép bên thứ ba xem dữ liệu giao dịch của bạn trừ khi bạn bật riêng.',
          ' — the platform shares only the scope you granted for each purpose. No purpose exposes your transaction data to a third party unless you enable it explicitly.')}
      </BoundaryNote>

      <div className="stack" style={{ marginTop: 14 }}>
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="between" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="flex" style={{ gap: 8, marginBottom: 4 }}>
                  <b style={{ fontSize: 13 }}>{lang === 'vi' ? r.purposeVi : r.purposeEn}</b>
                  <Tag tone={r.granted ? 'u' : 'n'}>
                    {r.granted ? t(lang, 'Đã cấp quyền', 'Granted') : t(lang, 'Chưa cấp', 'Not granted')}
                  </Tag>
                  {r.revocable ? <Tag tone="b">{t(lang, 'Có thể thu hồi', 'Revocable')}</Tag> : null}
                </div>
                <div className="muted" style={{ marginBottom: 6 }}>{r.counterparty}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <b>{t(lang, 'Dữ liệu chia sẻ', 'Data shared')}:</b> {lang === 'vi' ? r.scopeVi : r.scopeEn}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  <b>{t(lang, 'Cơ sở xử lý', 'Processing basis')}:</b> {lang === 'vi' ? r.basisVi : r.basisEn}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div className="muted">{t(lang, 'Thời hạn lưu giữ', 'Retention')}</div>
                <b className="num" style={{ fontSize: 15 }}>
                  {r.retention ? `${r.retention} ${t(lang, 'tháng', 'mo')}` : '—'}
                </b>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
