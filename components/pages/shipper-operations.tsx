import { asc, eq } from 'drizzle-orm'
import { DataTable } from '@/components/table/data-table'
import { BoundaryNote, Card, KpiTile, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  carriers, consentGrants, consentPurposes, documents, documentTypes, lettersOfCredit,
  lcSteps, lcTypes, members, settlements, settlementTriggers, shipments, shipmentStatuses,
} from '@/db/schema'
import { num, t, usd, type Lang } from '@/lib/i18n'
import { carrierOptions, laneOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
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

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Vận hành', 'Shipper · Operations')}
        title={t(lang, 'Chứng từ & eB/L', 'Documents & eB/L')}
        modules={['F02']}
        sandbox={['SB-02']}
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
    </>
  )
}

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
  const totalPaid = paid.reduce((a, r) => a + Number(r.amount), 0)
  const held = pending.reduce((a, r) => a + Number(r.amount), 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Tài chính', 'Shipper · Finance')}
        title={t(lang, 'Ví, Escrow & Tài trợ', 'Wallet, Escrow & Financing')}
        modules={['F06']}
        sandbox={['SB-04', 'SB-07']}
        sub={t(lang,
          'Nền tảng không giữ tiền. Ngân hàng giữ và chi trả; nền tảng tạo mã tham chiếu, gắn mốc giải ngân và đối soát.',
          'The platform holds no funds. Banks hold and move the money; the platform issues references, attaches milestones and reconciles.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Đã thanh toán', 'Settled')} value={usd(totalPaid)}
          meta={t(lang, `${num(paid.length)} khoản`, `${num(paid.length)} items`)} metaTone="u" />
        <KpiTile label={t(lang, 'Đang giữ escrow', 'Held in escrow')} value={usd(held)}
          meta={t(lang, `${num(pending.length)} chờ mốc`, `${num(pending.length)} awaiting trigger`)} metaTone="b" />
        <KpiTile label={t(lang, 'Sai lệch / tranh chấp', 'Exceptions / disputes')} value={num(exceptions.length)}
          meta={t(lang, 'chờ đối soát', 'pending reconciliation')} metaTone="d" />
        <KpiTile label={t(lang, 'Khớp tự động', 'Auto-matched')}
          value={num((rows.filter((r) => r.matched).length / rows.length) * 100, 1)} unit="%"
          bar={(rows.filter((r) => r.matched).length / rows.length) * 100} />
        <KpiTile label={t(lang, 'Thanh toán sớm', 'Early payment')}
          value={num(rows.filter((r) => r.early).length)}
          meta={t(lang, 'có chiết khấu', 'discount taken')} metaTone="u" />
      </div>

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
    </>
  )
}

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
    })
      .from(lettersOfCredit)
      .innerJoin(lcTypes, eq(lcTypes.id, lettersOfCredit.lcTypeId))
      .innerJoin(lcSteps, eq(lcSteps.ordinal, lettersOfCredit.stepOrdinal))
      .innerJoin(members, eq(members.id, lettersOfCredit.applicantMemberId))
      .orderBy(asc(lettersOfCredit.openedOn)),
    db.select().from(lcSteps).orderBy(asc(lcSteps.ordinal)),
    db.select().from(lcTypes).orderBy(asc(lcTypes.id)),
  ])

  const settled = rows.filter((r) => r.step === 5)
  const examining = rows.filter((r) => r.step === 4)
  const withDiscrepancies = rows.filter((r) => r.discrepancies > 0)
  const avgTat = rows.reduce((a, r) => a + Number(r.turnaround), 0) / rows.length
  const totalAmount = rows.reduce((a, r) => a + Number(r.amount), 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Tài chính', 'Shipper · Finance')}
        title={t(lang, 'Thư tín dụng số', 'Digital L/C')}
        modules={['F05']}
        sandbox={['SB-03']}
        sub={t(lang,
          'Mở, theo dõi và xuất trình chứng từ L/C trên cùng hồ sơ giao dịch. Nền tảng kiểm tra tính đầy đủ và gợi ý sai lệch; ngân hàng phát hành và quyết định thanh toán.',
          'Apply, track and present L/C documents against the same transaction record. The platform checks completeness and flags discrepancies; the bank issues and decides payment.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng L/C', 'Total L/C')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Tổng giá trị', 'Total value')} value={usd(totalAmount)} />
        <KpiTile label={t(lang, 'Đang kiểm tra chứng từ', 'Under examination')} value={num(examining.length)}
          meta={t(lang, 'ngân hàng đang xét', 'with the bank')} metaTone="gd" />
        <KpiTile label={t(lang, 'Có sai lệch', 'With discrepancies')} value={num(withDiscrepancies.length)}
          meta={t(lang, 'cần bổ sung', 'amendment needed')} metaTone="d" />
        <KpiTile label={t(lang, 'Thời gian xử lý TB', 'Average turnaround')} value={num(avgTat, 1)} unit="h"
          meta={t(lang, `${num(settled.length)} đã thanh toán`, `${num(settled.length)} settled`)} metaTone="u" />
      </div>

      <DataTable
        id="lc" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Thư tín dụng', 'Letters of credit')} rows={rows}
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
