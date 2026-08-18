import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { BarChart, Donut, Gauge, LineChart, heatStyle, protoRandom, walk } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import {
  BoundaryNote, Card, DefinitionList, KpiTile, Legend, Meter, OrgCell, PageHeader, Tag,
} from '@/components/ui'
import { db } from '@/lib/db'
import {
  assetFinanceDeals, assetFinanceTypes, collateralTypes, creditExposures, financeApplications,
  financeProducts, lanes, members, memberTypes, settlements,
} from '@/db/schema'
import { monthLabels, num, t, usd, type Lang } from '@/lib/i18n'
import { statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import { modalHref, openModalId } from '@/components/modal'
import { CreditModal } from './record-modals'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** Shared: applications joined to their member and product. */
async function loadApplications() {
  return db.select({
    id: financeApplications.id,
    member: members.name,
    memberId: financeApplications.memberId,
    rating: members.rating,
    productCode: financeApplications.productCode,
    productVi: financeProducts.nameVi,
    productEn: financeProducts.nameEn,
    amount: financeApplications.amount,
    score: financeApplications.score,
    decision: financeApplications.decisionCode,
    rate: financeApplications.rate,
    pd: financeApplications.pd,
    turnaround: financeApplications.turnaroundHours,
    autoDecided: financeApplications.autoDecided,
    appliedOn: financeApplications.appliedOn,
    bank: financeApplications.bank,
  })
    .from(financeApplications)
    .innerJoin(members, eq(members.id, financeApplications.memberId))
    .innerJoin(financeProducts, eq(financeProducts.code, financeApplications.productCode))
    .orderBy(asc(financeApplications.appliedOn))
}

/** f_dash — Logistics Financial Center (ui-2.html:4035). */
export async function FinanceDashboardPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [apps, exposures, settlementCount, typeLabels] = await Promise.all([
    loadApplications(),
    db.select({
      memberId: creditExposures.memberId,
      exposure: creditExposures.exposure,
      stage: creditExposures.ifrs9StageCode,
      collateral: creditExposures.collateral,
      ecl: creditExposures.ecl,
      dpd: creditExposures.daysPastDue,
      member: members.name,
      memberType: members.typeCode,
      rating: members.rating,
      score: members.score,
      limit: members.creditLimitMVnd,
      util: members.utilisationPct,
    }).from(creditExposures).innerJoin(members, eq(members.id, creditExposures.memberId)),
    db.select({ n: sql<number>`count(*)::int` }).from(settlements),
    db.select({ code: memberTypes.code, nameVi: memberTypes.nameVi, nameEn: memberTypes.nameEn })
      .from(memberTypes).orderBy(asc(memberTypes.ord)),
  ])

  const approved = apps.filter((a) => a.decision === 'approve')
  const totalExposure = exposures.reduce((a, e) => a + Number(e.exposure), 0)
  const typeName = new Map(typeLabels.map((r) => [r.code, lang === 'vi' ? r.nameVi : r.nameEn]))
  const stagePct = (s: string) =>
    Math.round((exposures.filter((e) => e.stage === s).length / exposures.length) * 1000) / 10

  /** ui-2.html:4053 — twelve months of outstanding, income and fee income. */
  const series = [
    { data: [132, 146, 158, 172, 186, 198, 214, 232, 248, 262, 274, 286], color: 'var(--up)', fill: true },
    { data: [68, 74, 82, 88, 96, 104, 116, 126, 134, 142, 152, 164], color: 'var(--brand-500)' },
    { data: [28, 32, 34, 38, 42, 44, 48, 52, 56, 58, 62, 68], color: 'var(--gold-500)' },
  ]

  /** ui-2.html:4062 — the four structural reasons the book prices below an SME loan. */
  const whyLower: Array<[string, string]> = [
    [t(lang, 'Dòng tiền quan sát được', 'Observable cash flow'),
      t(lang, 'Ngân hàng thấy booking, chứng từ và mốc giao hàng theo thời gian thực — không phụ thuộc báo cáo tài chính quá khứ.',
        'The bank sees bookings, documents and delivery milestones in real time rather than relying on historical statements.')],
    [t(lang, 'Thu nợ tại nguồn', 'Repayment at source'),
      t(lang, 'Tiền chảy qua escrow của ngân hàng; nợ được thu trước khi tiền về người vay.',
        'Money moves through the bank’s escrow; the loan is repaid before cash reaches the borrower.')],
    [t(lang, 'Tài sản bảo đảm tự thanh khoản', 'Self-liquidating collateral'),
      t(lang, 'eB/L kiểm soát quyền định đoạt hàng hoá — xử lý tài sản không cần kiện tụng kéo dài.',
        'The eB/L controls title to the cargo, so enforcement does not need lengthy litigation.')],
    [t(lang, 'Chế tài từ nền tảng', 'Platform sanction'),
      t(lang, 'Vi phạm dẫn tới đình chỉ quyền giao dịch — chi phí vỡ nợ cao hơn nhiều so với một khoản vay đơn lẻ.',
        'A breach suspends trading rights, making default far costlier than on a standalone loan.')],
  ]

  /** ui-2.html:4074 — portfolio mix in bn VND. */
  const mix: Array<[string, number, string]> = [
    [t(lang, 'Trả chậm cước vận chuyển', 'Freight payment terms'), 120, 'var(--brand-500)'],
    [t(lang, 'Chiết khấu khoản phải thu', 'Receivable discounting'), 69, 'var(--up)'],
    [t(lang, 'Tài trợ tàu & thiết bị', 'Ship & equipment finance'), 51, 'var(--gold-500)'],
    [t(lang, 'Vốn lưu động nhà cung cấp', 'Supplier working capital'), 32, 'var(--violet)'],
    [t(lang, 'Thư tín dụng số', 'Digital L/C'), 14, 'var(--text-3)'],
  ]

  /** ui-2.html:4090 — what the programme gets out of this book. */
  const vifcRole: Array<[string, string]> = [
    [t(lang, 'Thu hút dòng vốn quốc tế', 'Attract international capital'),
      t(lang, 'Chỉ số và sổ giao dịch minh bạch cho phép quỹ nước ngoài mua rủi ro logistics Việt Nam.',
        'Transparent indices and order books let offshore funds buy Vietnamese logistics risk.')],
    [t(lang, 'Sản phẩm tài chính mới', 'New financial instruments'),
      t(lang, 'Chứng khoán hoá khoản phải thu, quỹ tàu, trái phiếu xanh gắn hiệu quả vận tải.',
        'Receivables securitisation, ship funds and green bonds linked to transport efficiency.')],
    [t(lang, 'Định giá VND cho cước quốc tế', 'VND pricing of international freight'),
      t(lang, 'Giảm phụ thuộc USD, hỗ trợ mục tiêu điều hành ngoại hối.',
        'Reduces USD dependence and supports foreign-exchange policy objectives.')],
    [t(lang, 'Dữ liệu cho điều hành vĩ mô', 'Macro policy data'),
      t(lang, 'Chỉ số cước là chỉ báo sớm cho thương mại và lạm phát nhập khẩu.',
        'Freight indices are a leading indicator for trade and imported inflation.')],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế tài chính · Tổng quan', 'Financial institution · Overview')}
        title={t(lang, 'Trung tâm Tài chính Logistics', 'Logistics Financial Center')}
        sub={t(lang,
          'Lớp tài chính vận hành trên nền tảng: thanh toán, escrow, tài trợ thương mại, tài trợ tài sản và bảo hiểm — thẩm định trên dữ liệu giao dịch đang chạy thay vì báo cáo tài chính quá khứ.',
          'The financial layer running on the platform: payments, escrow, trade finance, asset finance and insurance — underwritten on live transaction data rather than historical statements.')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Báo cáo ALCO', 'ALCO pack')}</span>
            <Link className="btn p" href="/r/f_credit">
              {t(lang, 'Bộ máy cấp tín dụng', 'Credit engine')} →
            </Link>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Dư nợ tài trợ', 'Financing outstanding')}
          value={num(totalExposure / 1000, 1)} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta="+34% YoY" metaTone="u" spark={walk(200, 20, 0.05, 71)} />
        <KpiTile label={t(lang, 'Escrow đang giữ', 'Escrow held')} value="42.6"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, `412 booking · ${settlementCount[0].n} bản ghi`,
            `412 bookings · ${settlementCount[0].n} records`)} />
        <KpiTile label={t(lang, 'Hồ sơ đã xử lý', 'Applications processed')} value={num(apps.length)}
          meta={`${Math.round((approved.length / apps.length) * 100)}% ${t(lang, 'được duyệt', 'approved')}`}
          metaTone="u" />
        <KpiTile label={t(lang, 'Tỷ lệ nợ xấu (NPL)', 'Non-performing ratio')} value="0.34" unit="%"
          meta={t(lang, 'danh mục SME thường 2,1%', 'SME book typically 2.1%')} metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian quyết định TB', 'Avg decision time')} value="8.4"
          unit={t(lang, 'phút', 'min')}
          meta={t(lang, 'trước đây 12 ngày', 'was 12 days')} metaTone="u" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Dư nợ & thu nhập theo sản phẩm', 'Outstanding & income by product')}>
          <LineChart series={series} height={225} labels={monthLabels(lang)}
            fmt={(v) => `${num(Math.round(v))} ${t(lang, 'tỷ', 'bn')}`} />
          <Legend items={[
            { color: 'var(--up)', label: t(lang, 'Tổng dư nợ', 'Total outstanding') },
            { color: 'var(--brand-500)', label: t(lang, 'Tài trợ thương mại', 'Trade finance') },
            { color: 'var(--gold-500)', label: t(lang, 'Thu nhập luỹ kế', 'Cumulative income') },
          ]} />
        </Card>
        <Card title={t(lang, 'Vì sao rủi ro thấp hơn', 'Why the risk is lower')} bodyStyle={{ padding: 11 }}>
          {whyLower.map(([title, body]) => (
            <div key={title} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
              <b style={{ fontSize: 12, color: 'var(--up)' }}>✓ {title}</b>
              <div className="muted" style={{ marginTop: 2, lineHeight: 1.5 }}>{body}</div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Cơ cấu danh mục', 'Portfolio mix')}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Donut items={mix.map(([, v, c]) => ({ v, c }))} size={150} />
          </div>
          <div style={{ marginTop: 11, fontSize: 12 }}>
            {mix.map(([label, v, c]) => (
              <div key={label} className="between" style={{ padding: '3px 0' }}>
                <span>
                  <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: c, marginRight: 6 }} />
                  {label}
                </span>
                <b className="num">{v} {t(lang, 'tỷ', 'bn')}</b>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t(lang, 'Chất lượng danh mục', 'Portfolio quality')}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <Gauge value={94} label={t(lang, 'Điểm chất lượng', 'Quality score')} size={176} />
          </div>
          <DefinitionList rows={[
            [t(lang, 'Nhóm 1 — Đủ tiêu chuẩn', 'Stage 1 — Performing'),
              <span className="num" style={{ color: 'var(--up)' }}>{stagePct('s1')}%</span>],
            [t(lang, 'Nhóm 2 — Cần chú ý', 'Stage 2 — Watch'),
              <span className="num" style={{ color: 'var(--gold-500)' }}>{stagePct('s2')}%</span>],
            [t(lang, 'Nhóm 3–5 — Nợ xấu', 'Stage 3–5 — NPL'),
              <span className="num" style={{ color: 'var(--down)' }}>{stagePct('s3')}%</span>],
            [t(lang, 'Bao phủ dự phòng', 'Provision coverage'),
              <span className="num" style={{ color: 'var(--brand-600)' }}>186%</span>],
            [t(lang, 'Tổn thất thực tế 12T', 'Realised loss 12M'),
              <span className="num" style={{ color: 'var(--text-2)' }}>0,42 {t(lang, 'tỷ', 'bn')}</span>],
          ]} />
        </Card>

        <Card title={t(lang, 'Vai trò trong đề án VIFC', 'Role in the VIFC programme')}>
          {vifcRole.map(([title, body]) => (
            <div key={title} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
              <b style={{ fontSize: 12 }}>{title}</b>
              <div className="muted" style={{ marginTop: 2, lineHeight: 1.5 }}>{body}</div>
            </div>
          ))}
        </Card>
      </div>

      <DataTable
        id="exp"
        lang={lang}
        basePath={basePath}
        searchParams={searchParams}
        title={t(lang, 'Danh mục dư nợ theo đối tác', 'Exposure by counterparty')}
        rows={exposures}
        pageSize={14}
        searchPlaceholder={t(lang, 'Tìm thành viên, hạng, loại…', 'Search member, rating, type…')}
        search={(e) => `${e.member} ${e.rating} ${typeName.get(e.memberType) ?? ''}`}
        filters={[
          {
            key: 'stage', label: t(lang, 'Nhóm nợ', 'Stage'),
            options: [['s1', t(lang, 'Nhóm 1', 'Stage 1')], ['s2', t(lang, 'Nhóm 2', 'Stage 2')],
              ['s3', t(lang, 'Nhóm 3–5', 'Stage 3–5')]],
            match: (e, v) => e.stage === v,
          },
          {
            key: 'ty', label: t(lang, 'Loại đối tác', 'Counterparty type'),
            options: typeLabels.map((r) => [r.code, lang === 'vi' ? r.nameVi : r.nameEn] as [string, string]),
            match: (e, v) => e.memberType === v,
          },
          {
            key: 'rate', label: t(lang, 'Hạng', 'Rating'),
            options: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'].map((r) => [r, r] as [string, string]),
            match: (e, v) => e.rating === v,
          },
        ]}
        columns={[
          {
            key: 'n', header: t(lang, 'Đối tác', 'Counterparty'), width: '22%',
            sortValue: (e) => e.member,
            render: (e) => (
              <div>
                <OrgCell name={e.member} />
                <div className="muted" style={{ marginLeft: 36 }}>{typeName.get(e.memberType)}</div>
              </div>
            ),
          },
          {
            key: 'rate', header: t(lang, 'Hạng', 'Rating'), cls: 'c', width: '8%',
            sortValue: (e) => e.score,
            render: (e) => <Tag tone={e.score >= 72 ? 'u' : e.score >= 50 ? 'gd' : 'd'}>{e.rating}</Tag>,
          },
          {
            key: 'exp', header: t(lang, 'Dư nợ', 'Exposure'), cls: 'r', width: '11%',
            sortValue: (e) => Number(e.exposure),
            render: (e) => <><b className="num">{num(e.exposure)}</b> {t(lang, 'tr', 'm')}</>,
          },
          {
            key: 'limit', header: t(lang, 'Hạn mức', 'Limit'), cls: 'r', width: '10%',
            sortValue: (e) => Number(e.limit),
            render: (e) => <><span className="num">{num(e.limit)}</span> {t(lang, 'tr', 'm')}</>,
          },
          {
            key: 'util', header: t(lang, 'Sử dụng', 'Utilisation'), width: '11%',
            sortValue: (e) => e.util,
            render: (e) => (
              <Meter value={e.util} width={72}
                color={e.util > 90 ? 'var(--down)' : e.util > 75 ? 'var(--gold-500)' : 'var(--up)'} />
            ),
          },
          {
            key: 'coll', header: t(lang, 'Bao phủ TSBĐ', 'Collateral cover'), cls: 'r', width: '10%',
            sortValue: (e) => Number(e.collateral),
            render: (e) => (
              <span className="num" style={{ color: Number(e.collateral) >= 110 ? 'var(--up)' : 'var(--gold-600)' }}>
                {num(e.collateral)}%
              </span>
            ),
          },
          {
            key: 'ecl', header: t(lang, 'Tổn thất dự kiến', 'Expected loss'), cls: 'r', width: '10%',
            sortValue: (e) => Number(e.ecl),
            render: (e) => <><span className="num">{num(e.ecl, 2)}</span> {t(lang, 'tr', 'm')}</>,
          },
          {
            key: 'dpd', header: t(lang, 'Ngày quá hạn', 'Days past due'), cls: 'c', width: '9%',
            sortValue: (e) => e.dpd,
            render: (e) => (e.dpd ? <Tag tone={e.dpd > 30 ? 'd' : 'gd'}>{e.dpd}d</Tag> : <span className="muted">—</span>),
          },
          {
            key: 'stage', header: t(lang, 'Nhóm', 'Stage'), cls: 'c', width: '9%',
            sortValue: (e) => e.stage,
            render: (e) => (
              <Tag tone={e.stage === 's1' ? 'u' : e.stage === 's2' ? 'gd' : 'd'}>
                {{ s1: t(lang, 'Nhóm 1', 'Stage 1'), s2: t(lang, 'Nhóm 2', 'Stage 2'), s3: t(lang, 'Nhóm 3–5', 'Stage 3–5') }[e.stage]}
              </Tag>
            ),
          },
        ]}
      />
    </>
  )
}

/** ui-2.html:4152 — scoring weights by data family; they sum to 100. */
const SCORE_WEIGHTS: Array<[string, string, number, string, string, string]> = [
  ['Hành vi giao dịch trên nền tảng', 'On-platform trading behaviour', 34,
    'Khối lượng, tần suất, tính đều đặn, tỷ lệ huỷ booking, đa dạng tuyến',
    'Volume, frequency, regularity, booking cancellation rate, lane diversity', 'var(--brand-500)'],
  ['Lịch sử thanh toán', 'Payment track record', 26,
    'Đúng hạn, số ngày chậm bình quân, số lần gia hạn, tranh chấp',
    'On-time ratio, average days late, extensions, disputes', 'var(--up)'],
  ['Chất lượng đối tác thương mại', 'Counterparty quality', 16,
    'Xếp hạng người mua và người bán, mức độ tập trung khách hàng',
    'Buyer and seller ratings, customer concentration', 'var(--violet)'],
  ['Dữ liệu CDP Customer 360', 'CDP Customer 360 data', 14,
    'Vòng đời khách hàng, mức độ gắn kết, tín hiệu rời bỏ — chỉ với sự đồng ý',
    'Lifecycle stage, engagement, churn signals — only under consent', 'var(--gold-500)'],
  ['Báo cáo tài chính truyền thống', 'Traditional financial statements', 10,
    'Chỉ dùng bổ trợ — không còn là nguồn quyết định chính',
    'Supporting only — no longer the primary decision source', 'var(--text-3)'],
]

/** ui-2.html:4176 — old-world underwriting vs the platform's. */
const UNDERWRITING: Array<[string, string, string, string, string, string]> = [
  ['Nguồn dữ liệu chính', 'Primary data', 'Báo cáo tài chính năm', 'Annual financials',
    'Giao dịch thực thời gian thực', 'Live executed transactions'],
  ['Thời gian quyết định', 'Decision time', '10–20 ngày', '10–20 days', '8 phút', '8 min'],
  ['Tài sản bảo đảm', 'Collateral', 'Bất động sản, bảo lãnh cá nhân', 'Real estate, personal guarantees',
    'eB/L, phải thu, escrow', 'eB/L, receivables, escrow'],
  ['Thu hồi nợ', 'Repayment', 'Chờ khách chuyển tiền', 'Wait for the borrower to remit',
    'Trích tại escrow khi có dòng tiền', 'Swept from escrow at the cash event'],
  ['Chi phí phục vụ / hồ sơ', 'Cost to serve', '3,4 tr', '3.4m', '0,82 tr', '0.82m'],
  ['Quy mô tiếp cận', 'Addressable base', '~180 doanh nghiệp lớn', '~180 large corporates',
    '~1.300 thành viên, phần lớn SME', '~1,300 members, mostly SMEs'],
]

/** f_credit — Credit Decision Engine (ui-2.html:4142). */
export async function CreditEnginePage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, products, labels, memberStats] = await Promise.all([
    loadApplications(),
    db.select().from(financeProducts),
    statusLabelMap(lang),
    db.select({ rating: members.rating, limit: members.creditLimitMVnd }).from(members),
  ])

  const openId = openModalId(searchParams)
  const openApp = openId ? rows.find((r) => r.id === openId) ?? null : null

  const autoRate = Math.round((rows.filter((r) => r.autoDecided).length / rows.length) * 100)
  const avgTat = rows.reduce((a, r) => a + Number(r.turnaround), 0) / rows.length
  const totalLimit = memberStats.reduce((a, m) => a + Number(m.limit), 0)
  const withLimit = memberStats.filter((m) => Number(m.limit) > 0).length
  const ratingBands = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC']

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế tài chính · Sản phẩm', 'Financial institution · Products')}
        title={t(lang, 'Bộ máy cấp tín dụng', 'Credit Decision Engine')}
        modules={['F06']}
        sandbox={['SB-04']}
        sub={t(lang,
          'Chấm điểm và đề xuất hạn mức từ hành vi giao dịch trên nền tảng, dữ liệu CDP và hồ sơ thanh toán. Nền tảng chỉ pre-check và chuyển hồ sơ theo sự đồng ý — ngân hàng quyết định.',
          'Scoring and limit proposals from on-platform behaviour, CDP data and payment history. The platform only pre-checks and routes files under consent — the bank decides.')}
        actions={
          <>
            <span className="btn">{t(lang, 'Chạy lại mô hình', 'Re-run model')}</span>
            <Link className="btn p" href={modalHref(basePath, searchParams, rows[0].id)} scroll={false}>
              {t(lang, 'Xem hồ sơ mẫu', 'Open a sample file')}
            </Link>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Hồ sơ đã xử lý', 'Applications processed')} value={num(rows.length)}
          meta={`${autoRate}% ${t(lang, 'tự động hoá', 'straight-through')}`} metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian quyết định TB', 'Avg decision time')} value={num(avgTat, 1)} unit="h"
          meta={t(lang, 'ngưỡng pre-check ≤24 giờ', 'pre-check KPI ≤24h')} metaTone="u" />
        <KpiTile label={t(lang, 'Hạn mức đã cấp', 'Limits granted')} value={num(Math.round(totalLimit / 1000))}
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={`${num(withLimit)} ${t(lang, 'thành viên', 'members')}`} />
        <KpiTile label={t(lang, 'Tỷ lệ sử dụng hạn mức', 'Limit utilisation')} value="42" unit="%"
          meta={t(lang, 'còn dư địa tăng trưởng', 'headroom for growth')} metaTone="b" />
        <KpiTile label={t(lang, 'Độ chính xác mô hình (Gini)', 'Model Gini')} value="0.71"
          meta={t(lang, 'mô hình truyền thống 0,48', 'traditional 0.48')} metaTone="u" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Cấu trúc mô hình chấm điểm', 'Scoring model structure')}
          right={<span className="sub">{t(lang, 'Trọng số theo nhóm dữ liệu', 'Weight by data family')}</span>}>
          {SCORE_WEIGHTS.map(([vi, en, weight, dVi, dEn, color]) => (
            <div key={vi} style={{ marginBottom: 12 }}>
              <div className="between">
                <b style={{ fontSize: 12.5 }}>{t(lang, vi, en)}</b>
                <b className="num" style={{ color }}>{weight}%</b>
              </div>
              {/* The prototype scales the bar to 2.6× so the widest family fills the track. */}
              <div className="bar" style={{ margin: '4px 0' }}>
                <i style={{ width: `${weight * 2.6}%`, background: color }} />
              </div>
              <div className="muted">{t(lang, dVi, dEn)}</div>
            </div>
          ))}
          <BoundaryNote lang={lang}>
            {t(lang,
              'Mọi kết quả chấm điểm ảnh hưởng tới quyền lợi đều có khả năng giải thích và khiếu nại. Dữ liệu CDP chỉ được dùng khi thành viên đã cấp quyền riêng cho mục đích thẩm định tín dụng.',
              'Every score that affects a member’s rights is explainable and contestable. CDP data is used only where the member has granted a specific consent for credit assessment.')}
          </BoundaryNote>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Phân bố theo hạng tín nhiệm', 'Distribution by rating band')}>
            <BarChart
              items={ratingBands.map((r) => ({
                l: r,
                v: memberStats.filter((m) => m.rating === r).length,
                c: r === 'AAA' || r === 'AA' ? 'var(--up)'
                  : r === 'A' || r === 'BBB' ? 'var(--brand-500)'
                    : r === 'CCC' ? 'var(--down)' : 'var(--gold-500)',
              }))}
              height={170}
              padLeft={32}
              valueLabel={(v) => num(v)}
            />
            <div className="muted" style={{ marginTop: 8 }}>
              {t(lang,
                'Hạng BB trở xuống chỉ được cấp hạn mức khi có kiểm soát dòng tiền chặt qua escrow của nền tảng.',
                'BB and below receive limits only with tight escrow-based cash control.')}
            </div>
          </Card>

          <Card title={t(lang, 'So sánh cách thẩm định', 'Underwriting comparison')} bodyStyle={{ padding: 11 }}>
            {UNDERWRITING.map(([vi, en, oldVi, oldEn, newVi, newEn]) => (
              <div key={vi} style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                <b style={{ fontSize: 11.5 }}>{t(lang, vi, en)}</b>
                <div className="between" style={{ marginTop: 3 }}>
                  <span className="muted" style={{ textDecoration: 'line-through' }}>{t(lang, oldVi, oldEn)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--up)' }}>{t(lang, newVi, newEn)}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <DataTable
        id="cr" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Hàng đợi hồ sơ tín dụng', 'Credit application queue')} rows={rows} pageSize={14}
        rowHref={(r) => modalHref(basePath, searchParams, r.id)}
        searchPlaceholder={t(lang, 'Tìm mã hồ sơ, thành viên…', 'Search reference, member…')}
        search={(r) => `${r.id} ${r.member} ${r.bank}`}
        filters={[
          {
            key: 'dec', label: t(lang, 'Kết quả', 'Decision'),
            options: statusOptions(labels, ['approve', 'refer', 'decline']),
            match: (r, v) => r.decision === v,
          },
          {
            key: 'prod', label: t(lang, 'Sản phẩm', 'Product'),
            options: products.map((p) => [p.code, lang === 'vi' ? p.nameVi : p.nameEn]),
            match: (r, v) => r.productCode === v,
          },
          {
            key: 'auto', label: t(lang, 'Tự động', 'Automated'),
            options: [['1', t(lang, 'Tự động', 'Auto')], ['0', t(lang, 'Thủ công', 'Manual')]],
            match: (r, v) => (v === '1' ? r.autoDecided : !r.autoDecided),
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã hồ sơ', 'Reference'), width: '12%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
          {
            key: 'member', header: t(lang, 'Thành viên', 'Member'), width: '21%', sortValue: (r) => r.member,
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{r.member}</span>
                <div className="muted num">{r.memberId} · {r.rating}</div>
              </div>
            ),
          },
          {
            key: 'prod', header: t(lang, 'Sản phẩm', 'Product'), width: '18%',
            sortValue: (r) => (lang === 'vi' ? r.productVi : r.productEn),
            render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.productVi : r.productEn}</span>,
          },
          { key: 'amt', header: t(lang, 'Số tiền', 'Amount'), cls: 'r', width: '10%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{num(r.amount)}</b> },
          { key: 'score', header: t(lang, 'Điểm', 'Score'), width: '11%', sortValue: (r) => r.score, render: (r) => <Meter value={r.score} width={60} /> },
          {
            key: 'rate', header: t(lang, 'Lãi suất / PD', 'Rate / PD'), cls: 'r', width: '10%', sortValue: (r) => Number(r.rate),
            render: (r) => (
              <div>
                <b className="num">{num(r.rate, 2)}%</b>
                <div className="muted num">PD {num(r.pd, 2)}%</div>
              </div>
            ),
          },
          { key: 'tat', header: 'TAT', cls: 'r', width: '7%', sortValue: (r) => Number(r.turnaround), render: (r) => <span className="num">{num(r.turnaround, 1)}h</span> },
          {
            key: 'dec', header: t(lang, 'Kết quả', 'Decision'), cls: 'c', width: '11%', sortValue: (r) => r.decision,
            render: (r) => (
              <div>
                <Tag tone={tone(labels, r.decision)}>{labels.get(r.decision)?.label ?? r.decision}</Tag>
                {!r.autoDecided ? <div className="muted" style={{ marginTop: 2 }}>{t(lang, 'người duyệt', 'manual')}</div> : null}
              </div>
            ),
          },
        ]}
      />

      {openApp ? (
        <CreditModal
          lang={lang} basePath={basePath} searchParams={searchParams}
          application={{
            id: openApp.id, member: openApp.member, memberId: openApp.memberId,
            rating: openApp.rating,
            productName: lang === 'vi' ? openApp.productVi : openApp.productEn,
            amount: Number(openApp.amount), score: openApp.score,
            decisionLabel: labels.get(openApp.decision)?.label ?? openApp.decision,
            decisionTone: labels.get(openApp.decision)?.tone ?? 'n',
            rate: Number(openApp.rate), pd: Number(openApp.pd),
            turnaround: Number(openApp.turnaround), autoDecided: openApp.autoDecided,
            appliedOn: openApp.appliedOn, bank: openApp.bank,
          }}
        />
      ) : null}
    </>
  )
}

interface EmbeddedProduct {
  icon: string
  vi: string; en: string
  descVi: string; descEn: string
  sizeVi: string; sizeEn: string
  priceVi: string; priceEn: string
  color: string
  attach: number
  live: boolean
  module: string
}

/** ui-2.html:4253 — the eight products embedded in the transaction flow. */
const EMBEDDED_PRODUCTS: EmbeddedProduct[] = [
  { icon: '💳', vi: 'Trả chậm cước vận chuyển', en: 'Freight payment terms',
    descVi: 'Chủ hàng đặt chỗ hôm nay, ngân hàng trả hãng tàu ngay, chủ hàng trả sau 60–90 ngày',
    descEn: 'Shipper books today, the bank pays the carrier immediately, the shipper settles in 60–90 days',
    sizeVi: '120 tỷ', sizeEn: '120bn', priceVi: '6,2–7,4% p.a.', priceEn: '6.2–7.4% p.a.',
    color: 'var(--brand-600)', attach: 86, live: true, module: 'F06' },
  { icon: '📄', vi: 'Chiết khấu khoản phải thu', en: 'Receivable discounting',
    descVi: 'Hãng tàu và nhà cung cấp bán khoản phải thu đã được nền tảng xác thực, nhận tiền trong 4 giờ',
    descEn: 'Carriers and providers sell platform-verified receivables, funded within 4 hours',
    sizeVi: '69 tỷ', sizeEn: '69bn', priceVi: '0,38–0,52%/tháng', priceEn: '0.38–0.52%/mo',
    color: 'var(--up)', attach: 72, live: true, module: 'F06' },
  { icon: '📦', vi: 'Tài trợ hàng tồn trên đường', en: 'Inventory-in-transit finance',
    descVi: 'Cho vay thế chấp bằng eB/L, tối đa 80% giá trị lô hàng, tự động tất toán khi giao hàng',
    descEn: 'Lending secured on the eB/L, up to 80% of cargo value, auto-repaid on delivery',
    sizeVi: '51 tỷ', sizeEn: '51bn', priceVi: '7,4–8,6% p.a.', priceEn: '7.4–8.6% p.a.',
    color: 'var(--gold-500)', attach: 48, live: true, module: 'F06' },
  { icon: '🧾', vi: 'Thư tín dụng số', en: 'Digital L/C',
    descVi: 'Mở, phát hành, xuất trình và kiểm tra chứng từ trên cùng hồ sơ giao dịch',
    descEn: 'Apply, issue, present and examine documents against one transaction record',
    sizeVi: '14 tỷ', sizeEn: '14bn', priceVi: 'Theo biểu phí NH', priceEn: 'Per bank tariff',
    color: 'var(--violet)', attach: 34, live: true, module: 'F05' },
  { icon: '🏭', vi: 'Tài trợ vốn lưu động nhà cung cấp', en: 'Supplier working capital',
    descVi: 'Chuỗi cung ứng ngược: nhà cung cấp nhỏ vay theo xếp hạng của chủ hàng lớn',
    descEn: 'Reverse factoring: small providers borrow against the anchor shipper’s rating',
    sizeVi: '32 tỷ', sizeEn: '32bn', priceVi: '6,8–7,8% p.a.', priceEn: '6.8–7.8% p.a.',
    color: 'var(--violet)', attach: 34, live: true, module: 'F06' },
  { icon: '🛡️', vi: 'Bảo hiểm hàng hoá nhúng', en: 'Embedded cargo insurance',
    descVi: 'Một ô tích khi đặt chỗ; bộ hồ sơ bồi thường dựng tự động từ dữ liệu nền tảng',
    descEn: 'One checkbox at booking; the claim pack is auto-built from platform data',
    sizeVi: '4,2 tỷ phí', sizeEn: '4.2bn premium', priceVi: '0,09–0,18%', priceEn: '0.09–0.18%',
    color: 'var(--brand-500)', attach: 64, live: true, module: 'F10' },
  { icon: '⏱️', vi: 'Bảo hiểm trễ hàng theo tham số', en: 'Parametric delay cover',
    descVi: 'Chi trả khi tàu trễ quá ngưỡng cam kết — không cần chứng minh thiệt hại, vẫn có người duyệt',
    descEn: 'Pays out when a vessel exceeds the agreed threshold — no loss adjustment, still human-approved',
    sizeVi: '0,8 tỷ', sizeEn: '0.8bn', priceVi: '0,22%', priceEn: '0.22%',
    color: 'var(--violet)', attach: 12, live: false, module: 'F10' },
  { icon: '🌱', vi: 'Tín dụng xanh gắn hiệu quả vận tải', en: 'Green-linked freight credit',
    descVi: 'Giảm lãi suất khi cường độ phát thải trên mỗi TEU-km giảm theo mục tiêu đã cam kết',
    descEn: 'Rate step-down as emissions intensity per TEU-km falls against committed targets',
    sizeVi: '8 tỷ', sizeEn: '8bn', priceVi: '−0,5% ưu đãi', priceEn: '−0.5% step-down',
    color: 'var(--up)', attach: 8, live: false, module: 'F06' },
]

/** ui-2.html:4276 — the six journey stages and the products attached to each. */
const JOURNEY: Array<[string, string, string[], Array<[string, string]>]> = [
  ['Tìm giá', 'Search', ['F04'], [['Chỉ số VLX & dự báo giá', 'VLX Index & rate forecast']]],
  ['Đặt chỗ', 'Book', ['F10'], [['Bảo hiểm nhúng', 'Embedded insurance'], ['Bảo hiểm trễ hàng', 'Delay cover']]],
  ['Thanh toán', 'Pay', ['F07', 'F05'], [['Escrow theo mốc', 'Milestone escrow'],
    ['Trả chậm cước', 'Payment terms'], ['Thư tín dụng số', 'Digital L/C']]],
  ['Vận chuyển', 'Ship', ['F14', 'F06'], [['Tài trợ hàng trên đường', 'Inventory-in-transit']]],
  ['Giao hàng', 'Deliver', ['F08'], [['Giải toả escrow', 'Escrow release'], ['Bồi thường tự động', 'Auto-claims']]],
  ['Sau giao dịch', 'Post-trade', ['F06', 'F09'], [['Chiết khấu phải thu', 'Receivable discounting'],
    ['Tài trợ tài sản', 'Asset finance']]],
]

/** f_prod — Financing & Insurance products (ui-2.html:4241). */
export async function FinanceProductPage({ lang }: RoutePageProps) {
  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế tài chính · Sản phẩm', 'Financial institution · Products')}
        title={t(lang, 'Tài trợ & Bảo hiểm', 'Financing & Insurance')}
        modules={['F10']}
        sandbox={['SB-05']}
        sub={t(lang,
          'Danh mục sản phẩm nhúng vào từng bước của giao dịch logistics. Sản phẩm do tổ chức được cấp phép cấu trúc và cung cấp; nền tảng là kênh phân phối.',
          'A product set embedded at each step of the logistics transaction. Products are structured and provided by licensed institutions; the platform is the distribution channel.')}
        actions={<span className="btn p">+ {t(lang, 'Sản phẩm mới', 'New product')}</span>}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Sản phẩm đang vận hành', 'Live products')} value="8"
          meta={t(lang, '3 đang thử nghiệm', '3 in pilot')} metaTone="b" />
        <KpiTile label={t(lang, 'Tỷ lệ gắn kèm', 'Attach rate')} value="64.9" unit="%"
          meta="+18 pp YoY" metaTone="u" />
        <KpiTile label={t(lang, 'Biên lãi ròng', 'Net interest margin')} value="3.8" unit="%"
          meta={t(lang, 'danh mục SME 2,9%', 'SME book 2.9%')} metaTone="u" />
        <KpiTile label={t(lang, 'Phí bảo hiểm thu được', 'Insurance premium')} value="4.2"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, 'tỷ lệ bồi thường 42%', 'loss ratio 42%')} metaTone="u" />
        <KpiTile label={t(lang, 'Hoa hồng phân phối', 'Distribution commission')} value="1.8"
          unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, 'công bố minh bạch', 'transparently disclosed')} metaTone="n" />
      </div>

      <div className="grid" style={{ gap: 10, marginBottom: 14 }}>
        {EMBEDDED_PRODUCTS.map((p) => (
          <div className="card" key={p.vi}>
            <div className="card-b">
              <div className="fp-row">
                <div style={{ fontSize: 22, textAlign: 'center' }}>{p.icon}</div>
                <div>
                  <b style={{ fontSize: 13.5 }}>{t(lang, p.vi, p.en)}</b>
                  <span className="mod">{p.module}</span>
                  <div className="muted" style={{ marginTop: 2 }}>{t(lang, p.descVi, p.descEn)}</div>
                </div>
                <div>
                  <div className="muted">{t(lang, 'Quy mô', 'Book size')}</div>
                  <b className="num" style={{ fontSize: 14, color: p.color }}>{t(lang, p.sizeVi, p.sizeEn)}</b>
                </div>
                <div>
                  <div className="muted">{t(lang, 'Giá vốn / phí', 'Pricing')}</div>
                  <b className="num" style={{ fontSize: 12.5 }}>{t(lang, p.priceVi, p.priceEn)}</b>
                </div>
                <div>
                  <div className="muted">{t(lang, 'Tỷ lệ gắn kèm', 'Attach rate')}</div>
                  <Meter value={p.attach} color={p.color} width={66} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag tone={p.live ? 'u' : 'gd'}>
                    {p.live ? t(lang, 'Đang vận hành', 'Live') : t(lang, 'Thử nghiệm', 'Pilot')}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card title={t(lang, 'Sản phẩm gắn với từng bước hành trình giao dịch',
        'Products mapped to the transaction journey')}>
        <div className="fp-journey">
          {JOURNEY.map(([vi, en, modules, products]) => (
            <div key={vi}>
              <div className="fp-stage">
                {t(lang, vi, en)}
                <div style={{ marginTop: 3 }}>
                  {modules.map((m) => (
                    <span key={m} className="mod" style={{ background: 'rgba(255,255,255,.14)', color: '#9FD8E6' }}>{m}</span>
                  ))}
                </div>
              </div>
              <div className="fp-stage-b">
                {products.map(([pVi, pEn]) => (
                  <div key={pVi} className="fp-chip">{t(lang, pVi, pEn)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <BoundaryNote lang={lang}>
          {t(lang,
            'Nguyên tắc phân phối: hoa hồng và vai trò đại lý hoặc môi giới phải được công bố minh bạch; không tự động tăng phí bảo hiểm vượt mức khách hàng đã chấp nhận.',
            'Distribution principle: commissions and any agency or brokerage role must be disclosed transparently; premiums are never increased beyond the quote the customer accepted.')}
        </BoundaryNote>
      </Card>
    </>
  )
}

/** ui-2.html:4301 — what a licensed investor can inspect in the data room. */
const DATA_ROOM: Array<[string, string, Array<[string, string]>]> = [
  ['Dữ liệu vận hành đã xác minh', 'Verified operating data', [
    ['Sản lượng TEU theo tuyến và tuần từ TOS cảng', 'TEU volumes by lane and week from port TOS'],
    ['Tỷ lệ lấp đầy thực tế của tàu, không phải kế hoạch', 'Actual vessel utilisation, not planned'],
    ['Lịch sử đúng giờ từ AIS', 'On-time history from AIS'],
    ['Giá thực hiện so với chỉ số VLX', 'Realised rates versus the VLX Index'],
  ]],
  ['Dòng tiền & tín dụng', 'Cash flow & credit', [
    ['Doanh thu qua nền tảng, đã đối soát với ngân hàng', 'Platform revenue, reconciled with the bank'],
    ['Kỳ thu tiền thực tế và lịch sử thanh toán', 'Actual DSO and payment history'],
    ['Hạn mức, dư nợ và tình trạng nợ quá hạn', 'Limits, exposure and arrears status'],
    ['Hồ sơ tranh chấp và kết quả xử lý', 'Dispute history and outcomes'],
  ]],
  ['Tài sản & bảo đảm', 'Asset & security', [
    ['Hồ sơ đăng ký tàu và thế chấp', 'Ship registry and mortgage filings'],
    ['Báo cáo kiểm định và bảo hiểm hull & machinery', 'Survey reports and hull & machinery cover'],
    ['Giá trị thị trường và định giá độc lập', 'Market value and independent valuation'],
    ['Hồ sơ tuân thủ và cấm vận của chủ tàu', 'Owner compliance and sanctions file'],
  ]],
  ['ESG & phát thải', 'ESG & emissions', [
    ['Cường độ phát thải trên mỗi TEU-km', 'Emissions intensity per TEU-km'],
    ['Xếp hạng CII và loại nhiên liệu', 'CII rating and fuel type'],
    ['Lộ trình giảm phát thải đã cam kết', 'Committed decarbonisation pathway'],
    ['Đủ điều kiện tín dụng xanh hay chưa', 'Eligibility for green-linked credit'],
  ]],
]

/** f_asset — Asset Finance & Investor Data Room (ui-2.html:4290). */
export async function AssetFinancePage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, labels] = await Promise.all([
    db.select({
      id: assetFinanceDeals.id,
      typeVi: assetFinanceTypes.nameVi,
      typeEn: assetFinanceTypes.nameEn,
      typeId: assetFinanceDeals.assetFinanceTypeId,
      structure: assetFinanceTypes.structure,
      member: members.name,
      memberId: assetFinanceDeals.memberId,
      amount: assetFinanceDeals.amount,
      ltv: assetFinanceDeals.ltv,
      term: assetFinanceDeals.termYears,
      rate: assetFinanceDeals.rate,
      status: assetFinanceDeals.statusCode,
      irr: assetFinanceDeals.irr,
      dscr: assetFinanceDeals.dscr,
      collateralVi: collateralTypes.nameVi,
      collateralEn: collateralTypes.nameEn,
      esg: assetFinanceDeals.esgGrade,
      originatedOn: assetFinanceDeals.originatedOn,
      bank: assetFinanceDeals.bank,
    })
      .from(assetFinanceDeals)
      .innerJoin(assetFinanceTypes, eq(assetFinanceTypes.id, assetFinanceDeals.assetFinanceTypeId))
      .innerJoin(collateralTypes, eq(collateralTypes.id, assetFinanceDeals.collateralTypeId))
      .innerJoin(members, eq(members.id, assetFinanceDeals.memberId))
      .orderBy(asc(assetFinanceDeals.originatedOn)),
    db.select().from(assetFinanceTypes).orderBy(asc(assetFinanceTypes.id)),
    statusLabelMap(lang),
  ])

  const live = rows.filter((r) => r.status === 'live')
  const pipeline = rows.filter((r) => r.status === 'pipeline' || r.status === 'diligence')
  const liveAmount = live.reduce((a, r) => a + Number(r.amount), 0)
  const pipelineAmount = pipeline.reduce((a, r) => a + Number(r.amount), 0)
  const avgLtv = live.reduce((a, r) => a + r.ltv, 0) / live.length
  const avgDscr = live.reduce((a, r) => a + Number(r.dscr), 0) / live.length
  const avgIrr = live.reduce((a, r) => a + Number(r.irr), 0) / live.length

  // Mix by asset class spans the whole book, outstanding and pipeline together.
  const byClass = [...rows.reduce((m, r) => {
    const k = lang === 'vi' ? r.typeVi : r.typeEn
    return m.set(k, (m.get(k) ?? 0) + Number(r.amount))
  }, new Map<string, number>())]
    .map(([k, v]) => ({ k, v: Math.round(v) }))
    .sort((a, b) => b.v - a.v)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế tài chính · Sản phẩm', 'Financial institution · Products')}
        title={t(lang, 'Tài trợ tàu & Investor Data Room', 'Asset Finance & Investor Data Room')}
        modules={['F09']}
        sub={t(lang,
          'Tài trợ tàu, thiết bị và hạ tầng logistics. Nền tảng đóng vai trò Deal Factory và data room: tập hợp hồ sơ, dữ liệu vận hành đã xác minh và dòng tiền cho nhà đầu tư được cấp phép.',
          'Ship, equipment and logistics infrastructure finance. The platform acts as deal factory and data room: assembling files, verified operating data and cash flows for licensed investors.')}
        actions={
          <>
            <span className="btn">🔐 {t(lang, 'Mở data room', 'Open data room')}</span>
            <span className="btn p">+ {t(lang, 'Giao dịch mới', 'New deal')}</span>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Dư nợ tài trợ tài sản', 'Asset finance outstanding')}
          value={num(Math.round(liveAmount))} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, `${num(live.length)} giao dịch`, `${num(live.length)} deals`)} />
        <KpiTile label="Pipeline" value={num(Math.round(pipelineAmount))} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, `${num(pipeline.length)} hồ sơ`, `${num(pipeline.length)} files`)} metaTone="b" />
        <KpiTile label={t(lang, 'LTV bình quân', 'Average LTV')} value={num(avgLtv, 1)} unit="%"
          meta={t(lang, 'trần nội bộ 82%', 'internal cap 82%')} metaTone="u" />
        <KpiTile label={t(lang, 'DSCR bình quân', 'Average DSCR')} value={num(avgDscr, 2)} unit="x"
          meta={t(lang, 'ngưỡng ≥1,20x', 'threshold ≥1.20x')} metaTone="u" />
        <KpiTile label={t(lang, 'IRR dự kiến TB', 'Average target IRR')} value={num(avgIrr, 1)} unit="%"
          meta={t(lang, 'cho nhà đầu tư đồng tài trợ', 'for co-investors')} metaTone="b" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title="Investor Data Room"
          right={<span className="sub">{t(lang, 'Truy cập theo vai trò · có lưu vết đầy đủ', 'Role-based access · fully audited')}</span>}>
          <div className="grid g2" style={{ gap: 12 }}>
            {DATA_ROOM.map(([gVi, gEn, items]) => (
              <div key={gVi}>
                <b style={{ fontSize: 12.5, color: 'var(--brand-600)' }}>{t(lang, gVi, gEn)}</b>
                {items.map(([vi, en]) => (
                  <div key={vi} style={{ display: 'flex', gap: 7, fontSize: 11.5, padding: '3px 0', color: 'var(--text-2)' }}>
                    <span style={{ color: 'var(--up)' }}>✓</span>
                    <span>{t(lang, vi, en)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <BoundaryNote lang={lang}>
            <b>{t(lang, 'Điểm khác biệt', 'What makes this different')}:</b>{' '}
            {t(lang,
              'Nhà đầu tư quốc tế thường không mua rủi ro tàu và hạ tầng Việt Nam vì không kiểm chứng được dữ liệu vận hành. Ở đây dữ liệu sản lượng, lấp đầy và dòng tiền đến trực tiếp từ hệ thống vận hành.',
              'International investors typically avoid Vietnamese ship and infrastructure risk because operating data cannot be verified. Here volume, utilisation and cash-flow data come straight from the operating systems.')}
          </BoundaryNote>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Cơ cấu theo loại tài sản', 'Mix by asset class')}>
            {byClass.map((x) => (
              <div key={x.k} className="between" style={{ padding: '5px 0' }}>
                <span style={{ fontSize: 11.5, flex: 1 }}>{x.k}</span>
                <div className="meter">
                  <div className="bar" style={{ width: 70 }}>
                    <i style={{ width: `${(x.v / byClass[0].v) * 100}%`, background: 'var(--gold-500)' }} />
                  </div>
                  <b>{num(x.v)}</b>
                </div>
              </div>
            ))}
            <div className="muted" style={{ marginTop: 8 }}>
              {t(lang, 'Đơn vị: tỷ đồng · dư nợ và pipeline gộp',
                'Billion VND · outstanding and pipeline combined')}
            </div>
          </Card>

          <Card title={t(lang, 'Cửa vào cho Sovico', 'The entry point for Sovico')}>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
              {t(lang,
                'Đây là phần “tài chính hàng hải” đúng nghĩa và là chỗ Sovico có vai trò rõ ràng nhất: cấu trúc giao dịch thuê tài chính, sale-and-leaseback, quỹ tàu và về sau là chứng khoán hoá.',
                'This is maritime finance in the proper sense and where Sovico’s role is clearest: structuring finance leases, sale-and-leaseback, ship funds and later securitisation.')}
            </div>
            <div className="note" style={{ background: 'var(--gold-100)', marginTop: 11 }}>
              <b style={{ color: '#8A6410' }}>{t(lang, 'Giai đoạn sau', 'Later phase')}</b><br />
              {t(lang,
                'Chứng khoán hoá khoản phải thu, quỹ tàu và token hoá quyền lợi tài sản chỉ triển khai khi có cấu trúc pháp lý và cơ chế thử nghiệm riêng — nằm ngoài phạm vi Giai đoạn 1 và 2.',
                'Receivables securitisation, ship funds and tokenised asset interests only proceed once a dedicated legal structure and sandbox exist — outside the scope of Phases 1 and 2.')}
            </div>
          </Card>
        </div>
      </div>

      <DataTable
        id="af" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Danh mục tài trợ tài sản', 'Asset finance portfolio')} rows={rows} pageSize={14}
        searchPlaceholder={t(lang, 'Tìm mã, bên vay…', 'Search reference, borrower…')}
        search={(r) => `${r.id} ${r.member} ${r.bank} ${r.typeVi}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['live', 'pipeline', 'diligence', 'declined']),
            match: (r, v) => r.status === v,
          },
          {
            key: 'ty', label: t(lang, 'Loại tài sản', 'Asset class'),
            options: types.map((x) => [String(x.id), lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => String(r.typeId) === v,
          },
          {
            key: 'esg', label: 'ESG',
            options: [['A', 'A'], ['B', 'B'], ['C', 'C']],
            match: (r, v) => r.esg === v,
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã', 'Reference'), width: '11%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
          {
            key: 'ty', header: t(lang, 'Tài sản', 'Asset'), width: '21%',
            sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>
                <div className="muted">{lang === 'vi' ? r.collateralVi : r.collateralEn}</div>
              </div>
            ),
          },
          { key: 'member', header: t(lang, 'Bên vay', 'Borrower'), width: '17%', sortValue: (r) => r.member, render: (r) => <span style={{ fontSize: 12 }}>{r.member}</span> },
          {
            key: 'amt', header: t(lang, 'Giá trị', 'Amount'), cls: 'r', width: '11%', sortValue: (r) => Number(r.amount),
            render: (r) => (
              <div>
                <b className="num">{num(r.amount)}</b>
                <div className="muted num">{r.term} {t(lang, 'năm', 'yr')}</div>
              </div>
            ),
          },
          { key: 'ltv', header: 'LTV', width: '10%', sortValue: (r) => r.ltv, render: (r) => <Meter value={r.ltv} width={58} /> },
          {
            key: 'dscr', header: 'DSCR / IRR', cls: 'r', width: '11%', sortValue: (r) => Number(r.dscr),
            render: (r) => (
              <div>
                <b className="num" style={{ color: Number(r.dscr) >= 1.2 ? 'var(--up)' : 'var(--gold-500)' }}>
                  {num(r.dscr, 2)}×
                </b>
                <div className="muted num">IRR {num(r.irr, 1)}%</div>
              </div>
            ),
          },
          {
            key: 'esg', header: 'ESG', cls: 'c', width: '7%', sortValue: (r) => r.esg,
            render: (r) => <Tag tone={r.esg === 'A' ? 'u' : r.esg === 'B' ? 'b' : 'gd'}>{r.esg}</Tag>,
          },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '12%', sortValue: (r) => r.status,
            render: (r) => (
              <div>
                <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>
                <div className="muted" style={{ marginTop: 2 }}>{r.bank}</div>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}

/** ui-2.html:4390 — five board-level stress scenarios and the loss each implies. */
const STRESS: Array<[string, string, string, string, number, string]> = [
  ['Cước giảm 40% trong 6 tháng', 'Freight rates fall 40% over 6 months', '3,2', '3.2', 26, 'var(--gold-500)'],
  ['Một hãng tàu lớn mất khả năng thanh toán', 'A major carrier becomes insolvent', '5,8', '5.8', 48, 'var(--down)'],
  ['Tắc nghẽn cảng kéo dài 8 tuần', '8-week port congestion', '2,1', '2.1', 17, 'var(--up)'],
  ['Xuất khẩu Việt Nam giảm 25%', 'Vietnam exports down 25%', '6,4', '6.4', 53, 'var(--down)'],
  ['Kết hợp: suy thoái thương mại toàn cầu', 'Combined: global trade recession', '9,8', '9.8', 82, 'var(--down)'],
]

/** ui-2.html:4409 — behavioural signals only visible from the trading infrastructure. */
const EARLY_WARNING: Array<[string, string, string, string, number, Tone]> = [
  ['Khối lượng giao dịch sụt giảm', 'Trading volume decline',
    'Giảm trên 30% trong 60 ngày so với trung bình 12 tháng',
    'Over 30% drop in 60 days versus the 12-month average', 8, 'gd'],
  ['Chuyển sang tuyến rẻ hơn', 'Downtrading to cheaper lanes',
    'Dấu hiệu áp lực biên lợi nhuận của khách hàng',
    'A sign of margin pressure at the customer', 14, 'gd'],
  ['Tăng tỷ lệ huỷ booking', 'Rising cancellation rate',
    'Vượt 5% — thường báo trước căng thẳng dòng tiền 45–60 ngày',
    'Above 5% — typically precedes cash stress by 45–60 days', 6, 'd'],
  ['Kéo dài kỳ hạn thanh toán', 'Stretching payment terms',
    'Chuyển từ trả ngay sang trả chậm tối đa',
    'Shifting from pay-now to maximum terms', 11, 'gd'],
  ['Giảm mua bảo hiểm', 'Dropping insurance cover',
    'Cắt chi phí không thiết yếu — tín hiệu căng thẳng sớm',
    'Cutting non-essential spend — an early stress marker', 4, 'n'],
  ['Rút ngắn thời gian lưu kho', 'Shortening warehouse dwell',
    'Bán hàng gấp để thu tiền — dấu hiệu thiếu vốn lưu động',
    'Rushing sales to collect cash — a working-capital signal', 5, 'gd'],
]

/** f_risk — Risk & Portfolio (ui-2.html:4365). */
export async function RiskPage({ lang, basePath, searchParams }: RoutePageProps) {
  const rows = await db.select({
    memberId: creditExposures.memberId,
    member: members.name,
    typeVi: memberTypes.nameVi,
    typeEn: memberTypes.nameEn,
    rating: members.rating,
    score: members.score,
    limit: members.creditLimitMVnd,
    exposure: creditExposures.exposure,
    stage: creditExposures.ifrs9StageCode,
    collateral: creditExposures.collateral,
    ecl: creditExposures.ecl,
    dpd: creditExposures.daysPastDue,
    compliance: members.complianceStatusCode,
    typeCode: members.typeCode,
  })
    .from(creditExposures)
    .innerJoin(members, eq(members.id, creditExposures.memberId))
    .innerJoin(memberTypes, eq(memberTypes.code, members.typeCode))
    .orderBy(asc(creditExposures.memberId))

  const [labels, memberTypeRows, laneRows] = await Promise.all([
    statusLabelMap(lang),
    db.select({ code: memberTypes.code, nameVi: memberTypes.nameVi, nameEn: memberTypes.nameEn })
      .from(memberTypes).orderBy(asc(memberTypes.ord)),
    db.select({ code: lanes.code }).from(lanes).orderBy(asc(lanes.ord)),
  ])
  const totalExposure = rows.reduce((a, r) => a + Number(r.exposure), 0)
  const totalEcl = rows.reduce((a, r) => a + Number(r.ecl), 0)
  const stage3 = rows.filter((r) => r.stage === 's3')
  const overdue = rows.filter((r) => r.dpd > 0)
  const coverage = rows.reduce((a, r) => a + Number(r.collateral), 0) / totalExposure

  const stageRows = (['s1', 's2', 's3'] as const).map((s) => {
    const g = rows.filter((r) => r.stage === s)
    return {
      code: s,
      label: { s1: t(lang, 'Nhóm 1 — bình thường', 'Stage 1 — performing'), s2: t(lang, 'Nhóm 2 — cần chú ý', 'Stage 2 — watch'), s3: t(lang, 'Nhóm 3–5 — suy giảm', 'Stage 3–5 — impaired') }[s],
      n: g.length,
      exposure: g.reduce((a, r) => a + Number(r.exposure), 0),
      ecl: g.reduce((a, r) => a + Number(r.ecl), 0),
      tone: ({ s1: 'u', s2: 'gd', s3: 'd' } as const)[s],
    }
  })

  const watch = rows.filter((r) => r.compliance !== 'ok')
  const avgCoverage = rows.reduce((a, r) => a + Number(r.collateral), 0) / rows.length

  /**
   * ui-2.html:4380 — concentration is lane × counterparty type. The prototype spreads
   * each type's book across the lanes with a deterministic weight, so a cell is a
   * share of that type's exposure rather than a stored figure.
   */
  const heatTypes = memberTypeRows.slice(0, 5)
  const typeExposure = new Map(heatTypes.map((ty) => [
    ty.code,
    rows.filter((r) => r.typeCode === ty.code).reduce((a, r) => a + Number(r.exposure), 0) / 1000 / 8,
  ]))
  const cell = (typeCode: string, li: number, ci: number) =>
    Math.round((typeExposure.get(typeCode) ?? 0) * (0.4 + protoRandom(li * 11 + ci * 3) * 1.6))

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế tài chính · Quản trị', 'Financial institution · Governance')}
        title={t(lang, 'Rủi ro & Danh mục', 'Risk & Portfolio')}
        sub={t(lang,
          'Giám sát tập trung rủi ro tín dụng, tập trung theo tuyến và loại đối tác, cùng kết quả kiểm định căng thẳng.',
          'Consolidated credit risk, concentration by lane and counterparty type, and stress-test outcomes.')}
        actions={<span className="btn">{t(lang, 'Chạy kiểm định căng thẳng', 'Run stress test')}</span>}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng dư nợ chịu rủi ro', 'Total exposure')}
          value={num(Math.round(totalExposure / 1000), 1)} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, `${num(rows.length)} đối tác`, `${num(rows.length)} counterparties`)} />
        <KpiTile label={t(lang, 'Tổn thất dự kiến 12T', '12M expected loss')}
          value={num(totalEcl / 1000, 2)} unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={`0,34% ${t(lang, 'dư nợ', 'of book')}`} metaTone="u" />
        <KpiTile label={t(lang, 'Tổn thất bất thường (VaR 99%)', 'Unexpected loss (99% VaR)')}
          value="8.4" unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, 'vốn phân bổ 12 tỷ', '12bn capital allocated')} metaTone="b" />
        <KpiTile label={t(lang, 'Tập trung lớn nhất', 'Largest single exposure')} value="4.2" unit="%"
          meta={t(lang, 'giới hạn nội bộ 8%', 'internal cap 8%')} metaTone="u" />
        <KpiTile label={t(lang, 'Bao phủ tài sản bảo đảm', 'Collateral coverage')}
          value={num(avgCoverage, 0)} unit="%"
          meta={t(lang, 'escrow + eB/L', 'escrow + eB/L')} metaTone="u" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card
          title={t(lang, 'Tập trung rủi ro theo tuyến × loại đối tác', 'Concentration by lane × counterparty type')}
          right={<span className="sub">{t(lang, 'Đơn vị: tỷ đồng · giới hạn nội bộ 30 tỷ mỗi ô', 'Billion VND · internal cap 30bn per cell')}</span>}>
          <div className="scroll-x">
            <table className="heat">
              <thead>
                <tr>
                  <th className="rowh" />
                  {heatTypes.map((ty) => (
                    <th key={ty.code}>{lang === 'vi' ? ty.nameVi : ty.nameEn}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laneRows.map((l, li) => (
                  <tr key={l.code}>
                    <th className="rowh">{l.code}</th>
                    {heatTypes.map((ty, ci) => {
                      const v = cell(ty.code, li, ci)
                      // Inverted so a bigger book reads as the hotter cell.
                      return <td key={ty.code} style={heatStyle(30 - v, 0, 30)}>{v}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            {t(lang,
              'Ô đậm đỏ = dư nợ tập trung cao. Không ô nào được vượt 30 tỷ đồng theo chính sách nội bộ; ô vượt ngưỡng sẽ khoá cấp mới cho tới khi mức tập trung giảm.',
              'Darker red = higher concentration. No cell may exceed 30bn VND under internal policy; a breached cell freezes new lending until concentration falls.')}
          </div>
        </Card>

        <Card title={t(lang, 'Kiểm định căng thẳng', 'Stress testing')}>
          {STRESS.map(([vi, en, lossVi, lossEn, pctOfCapital, color]) => (
            <div key={vi} style={{ marginBottom: 11 }}>
              <div className="between">
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{t(lang, vi, en)}</span>
                <b className="num">{t(lang, `${lossVi} tỷ`, `${lossEn}bn`)}</b>
              </div>
              <div className="bar" style={{ marginTop: 4 }}>
                <i style={{ width: `${pctOfCapital}%`, background: color }} />
              </div>
            </div>
          ))}
          <div className="note" style={{ background: 'var(--up-bg)' }}>
            <b style={{ color: 'var(--up)' }}>{t(lang, 'Kết luận', 'Conclusion')}</b><br />
            {t(lang,
              'Kịch bản xấu nhất tiêu tốn 82% vốn phân bổ (12 tỷ) — danh mục vẫn chịu được, nhưng cần nâng vốn lên 15 tỷ khi dư nợ vượt 350 tỷ đồng.',
              'The worst case consumes 82% of allocated capital (12bn) — the book holds, but capital should rise to 15bn once exposure exceeds 350bn VND.')}
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
        <DataTable
          id="risk" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Danh sách theo dõi', 'Watch list')} rows={rows} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm thành viên…', 'Search member…')}
          search={(r) => `${r.memberId} ${r.member} ${r.rating}`}
          filters={[
            {
              key: 'stage', label: t(lang, 'Nhóm', 'Stage'),
              options: [['s1', t(lang, 'Nhóm 1', 'Stage 1')], ['s2', t(lang, 'Nhóm 2', 'Stage 2')], ['s3', t(lang, 'Nhóm 3–5', 'Stage 3–5')]],
              match: (r, v) => r.stage === v,
            },
            {
              key: 'dpd', label: t(lang, 'Quá hạn', 'Past due')
              , options: [['1', t(lang, 'Có quá hạn', 'Overdue')]],
              match: (r) => r.dpd > 0,
            },
          ]}
          columns={[
            {
              key: 'member', header: t(lang, 'Thành viên', 'Member'), width: '24%', sortValue: (r) => r.member,
              render: (r) => (
                <div>
                  <OrgCell name={r.member} />
                  <div className="muted num" style={{ marginTop: 2 }}>{r.memberId} · {r.rating}</div>
                </div>
              ),
            },
            {
              key: 'ty', header: t(lang, 'Loại', 'Type'), width: '13%', sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>,
            },
            { key: 'exp', header: t(lang, 'Dư nợ', 'Exposure'), cls: 'r', width: '12%', sortValue: (r) => Number(r.exposure), render: (r) => <b className="num">{num(r.exposure)}</b> },
            { key: 'coll', header: t(lang, 'Bảo đảm', 'Collateral'), cls: 'r', width: '11%', sortValue: (r) => Number(r.collateral), render: (r) => <span className="num">{num(r.collateral)}%</span> },
            { key: 'ecl', header: 'ECL', cls: 'r', width: '10%', sortValue: (r) => Number(r.ecl), render: (r) => <span className="num">{num(r.ecl, 2)}</span> },
            {
              key: 'dpd', header: t(lang, 'Quá hạn', 'Days past due'), cls: 'c', width: '10%', sortValue: (r) => r.dpd,
              render: (r) => r.dpd > 0
                ? <Tag tone={r.dpd > 30 ? 'd' : 'gd'}>{r.dpd} {t(lang, 'ngày', 'd')}</Tag>
                : <span className="muted">—</span>,
            },
            { key: 'score', header: t(lang, 'Điểm', 'Score'), width: '10%', sortValue: (r) => r.score, render: (r) => <Meter value={r.score} width={56} /> },
            {
              key: 'stage', header: t(lang, 'Nhóm', 'Stage'), cls: 'c', width: '10%', sortValue: (r) => r.stage,
              render: (r) => <Tag tone={r.stage === 's1' ? 'u' : r.stage === 's2' ? 'gd' : 'd'}>
                {{ s1: t(lang, 'Nhóm 1', 'S1'), s2: t(lang, 'Nhóm 2', 'S2'), s3: t(lang, 'Nhóm 3–5', 'S3–5') }[r.stage]}
              </Tag>,
            },
          ]}
        />
        <Card title={t(lang, 'Cảnh báo sớm từ dữ liệu nền tảng', 'Early-warning signals from platform data')}>
          {EARLY_WARNING.map(([vi, en, dVi, dEn, count, toneCode]) => (
            <div key={vi} className="between" style={{ padding: '9px 0', borderBottom: '1px dashed var(--line)' }}>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 12 }}>{t(lang, vi, en)}</b>
                <div className="muted">{t(lang, dVi, dEn)}</div>
              </div>
              <Tag tone={toneCode}>{count} {t(lang, 'đối tác', 'members')}</Tag>
            </div>
          ))}
          <BoundaryNote lang={lang}>
            {t(lang,
              'Những tín hiệu này chỉ tồn tại vì ngân hàng ngồi trên hạ tầng giao dịch. Không ngân hàng nào nhìn thấy chúng từ sao kê tài khoản.',
              'These signals exist only because the bank sits on the trading infrastructure. No bank sees them from account statements alone.')}
          </BoundaryNote>
        </Card>
      </div>
    </>
  )
}

