import { asc, eq, sql } from 'drizzle-orm'
import { BarChart, Donut, Gauge } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, OrgCell, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  assetFinanceDeals, assetFinanceTypes, collateralTypes, creditExposures, financeApplications,
  financeProducts, members, memberTypes,
} from '@/db/schema'
import { num, t, usd, type Lang } from '@/lib/i18n'
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

/** f_dash — Logistics Financial Center (ui-2.html:4064). */
export async function FinanceDashboardPage({ lang }: RoutePageProps) {
  const [apps, exposures, byProduct] = await Promise.all([
    loadApplications(),
    db.select({
      memberId: creditExposures.memberId,
      exposure: creditExposures.exposure,
      stage: creditExposures.ifrs9StageCode,
      collateral: creditExposures.collateral,
      ecl: creditExposures.ecl,
      dpd: creditExposures.daysPastDue,
      member: members.name,
      rating: members.rating,
    }).from(creditExposures).innerJoin(members, eq(members.id, creditExposures.memberId)),
    db.select({
      code: financeApplications.productCode,
      nameVi: financeProducts.nameVi,
      nameEn: financeProducts.nameEn,
      n: sql<number>`count(*)::int`,
      amount: sql<number>`sum(${financeApplications.amount})::numeric`,
      approved: sql<number>`count(*) FILTER (WHERE ${financeApplications.decisionCode} = 'approve')::int`,
    })
      .from(financeApplications)
      .innerJoin(financeProducts, eq(financeProducts.code, financeApplications.productCode))
      .groupBy(financeApplications.productCode, financeProducts.nameVi, financeProducts.nameEn),
  ])

  const approved = apps.filter((a) => a.decision === 'approve')
  const totalExposure = exposures.reduce((a, e) => a + Number(e.exposure), 0)
  const totalEcl = exposures.reduce((a, e) => a + Number(e.ecl), 0)
  const avgRate = approved.reduce((a, r) => a + Number(r.rate), 0) / (approved.length || 1)
  const autoRate = (apps.filter((a) => a.autoDecided).length / apps.length) * 100

  const stageSplit = (['s1', 's2', 's3'] as const).map((s, i) => ({
    label: { s1: t(lang, 'Nhóm 1', 'Stage 1'), s2: t(lang, 'Nhóm 2', 'Stage 2'), s3: t(lang, 'Nhóm 3–5', 'Stage 3–5') }[s],
    v: exposures.filter((e) => e.stage === s).length,
    c: ['var(--up)', 'var(--gold-500)', 'var(--down)'][i],
  }))

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế Tài chính · Bắt đầu', 'Financial Institution · Start here')}
        title={t(lang, 'Trung tâm Tài chính Logistics', 'Logistics Financial Center')}
        sub={t(lang,
          'Danh mục tài trợ logistics theo sản phẩm và theo nhóm rủi ro IFRS-9. Nền tảng thu thập hồ sơ theo đồng ý; quyết định tín dụng thuộc về ngân hàng.',
          'The logistics financing book by product and IFRS-9 stage. The platform collects files under consent; the credit decision belongs to the bank.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Hồ sơ', 'Applications')} value={num(apps.length)}
          meta={t(lang, `${num(approved.length)} đã duyệt`, `${num(approved.length)} approved`)} metaTone="u" />
        <KpiTile label={t(lang, 'Tổng dư nợ', 'Total exposure')} value={num(totalExposure)}
          unit={t(lang, 'tr đ', 'm VND')} />
        <KpiTile label={t(lang, 'Tổn thất dự kiến', 'Expected credit loss')} value={num(totalEcl, 1)}
          unit={t(lang, 'tr đ', 'm VND')}
          meta={`${num((totalEcl / totalExposure) * 100, 2)}% ${t(lang, 'dư nợ', 'of book')}`} metaTone="d" />
        <KpiTile label={t(lang, 'Lãi suất bình quân', 'Average rate')} value={num(avgRate, 2)} unit="% p.a." />
        <KpiTile label={t(lang, 'Quyết định tự động', 'Auto-decided')} value={num(autoRate, 1)} unit="%"
          bar={autoRate} />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Hồ sơ theo sản phẩm', 'Applications by product')}>
          <BarChart
            items={byProduct.map((p, i) => ({
              l: (lang === 'vi' ? p.nameVi : p.nameEn).split(' ').slice(0, 2).join(' '),
              v: p.n,
              c: ['var(--brand-500)', 'var(--brand-400)', 'var(--violet)', 'var(--up)', 'var(--gold-500)', 'var(--down)', 'var(--navy-600)'][i % 7],
            }))}
            height={240}
            padLeft={38}
            valueLabel={(v) => num(v)}
          />
        </Card>
        <Card title={t(lang, 'Phân nhóm IFRS-9', 'IFRS-9 staging')}>
          <div style={{ display: 'grid', placeItems: 'center' }}><Donut items={stageSplit} size={150} /></div>
          <Legend items={stageSplit.map((s) => ({ color: s.c, label: `${s.label} (${s.v})` }))} />
        </Card>
      </div>

      <Card title={t(lang, 'Sản phẩm tài trợ', 'Financing products')} bodyStyle={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(lang, 'Sản phẩm', 'Product')}</th>
              <th className="r">{t(lang, 'Hồ sơ', 'Applications')}</th>
              <th className="r">{t(lang, 'Đã duyệt', 'Approved')}</th>
              <th>{t(lang, 'Tỷ lệ duyệt', 'Approval rate')}</th>
              <th className="r">{t(lang, 'Giá trị', 'Value')}</th>
            </tr>
          </thead>
          <tbody>
            {byProduct.map((p) => (
              <tr key={p.code}>
                <td><b style={{ fontSize: 12 }}>{lang === 'vi' ? p.nameVi : p.nameEn}</b></td>
                <td className="r num">{num(p.n)}</td>
                <td className="r num">{num(p.approved)}</td>
                <td><Meter value={(p.approved / p.n) * 100} width={90} /></td>
                <td className="r num"><b>{num(p.amount)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** f_credit — Credit Decision Engine (ui-2.html:4142). */
export async function CreditEnginePage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, products, labels] = await Promise.all([
    loadApplications(),
    db.select().from(financeProducts),
    statusLabelMap(lang),
  ])

  const openId = openModalId(searchParams)
  const openApp = openId ? rows.find((r) => r.id === openId) ?? null : null

  const approved = rows.filter((r) => r.decision === 'approve')
  const referred = rows.filter((r) => r.decision === 'refer')
  const declined = rows.filter((r) => r.decision === 'decline')
  const avgTat = rows.reduce((a, r) => a + Number(r.turnaround), 0) / rows.length
  const avgScore = rows.reduce((a, r) => a + r.score, 0) / rows.length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế Tài chính · Sản phẩm', 'Financial Institution · Products')}
        title={t(lang, 'Bộ máy cấp tín dụng', 'Credit Decision Engine')}
        modules={['F06']}
        sandbox={['SB-04']}
        sub={t(lang,
          'Agent tầng 2: chấm điểm và đề xuất hạn mức từ dữ liệu giao dịch có đồng ý. Mọi hồ sơ chuyển thẩm định đều phải có chuyên viên ngân hàng phê duyệt.',
          'A tier-2 agent: it scores and proposes limits from consented transaction data. Every referred file requires a bank officer to approve.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng hồ sơ', 'Applications')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Đã duyệt', 'Approved')} value={num(approved.length)}
          bar={(approved.length / rows.length) * 100} />
        <KpiTile label={t(lang, 'Chuyển thẩm định', 'Referred')} value={num(referred.length)}
          meta={t(lang, 'cần người quyết định', 'human decision required')} metaTone="gd" />
        <KpiTile label={t(lang, 'Từ chối', 'Declined')} value={num(declined.length)} metaTone="d" />
        <KpiTile label={t(lang, 'Thời gian xử lý', 'Turnaround')} value={num(avgTat, 1)} unit="h"
          meta={t(lang, 'ngưỡng KPI ≤24h', 'KPI ≤24h')} metaTone={avgTat <= 24 ? 'u' : 'd'} />
      </div>

      <div className="grid g-1-2" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Điểm tín nhiệm bình quân', 'Average credit score')}>
          <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0' }}>
            <Gauge value={avgScore} label={t(lang, 'trên 100', 'of 100')} size={180} />
          </div>
        </Card>
        <Card title={t(lang, 'Nguyên tắc quyết định', 'Decision policy')}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t(lang, 'Kết quả', 'Outcome')}</th>
                <th className="r">{t(lang, 'Số hồ sơ', 'Files')}</th>
                <th className="r">{t(lang, 'Điểm TB', 'Avg score')}</th>
                <th className="r">{t(lang, 'Lãi suất TB', 'Avg rate')}</th>
                <th>{t(lang, 'Ai quyết định', 'Who decides')}</th>
              </tr>
            </thead>
            <tbody>
              {([['approve', approved], ['refer', referred], ['decline', declined]] as const).map(([code, group]) => (
                <tr key={code}>
                  <td><Tag tone={tone(labels, code)}>{labels.get(code)?.label ?? code}</Tag></td>
                  <td className="r num">{num(group.length)}</td>
                  <td className="r num">{num(group.reduce((a, r) => a + r.score, 0) / (group.length || 1), 1)}</td>
                  <td className="r num">{num(group.reduce((a, r) => a + Number(r.rate), 0) / (group.length || 1), 2)}%</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                    {code === 'refer'
                      ? t(lang, 'Chuyên viên ngân hàng', 'Bank officer')
                      : t(lang, 'Máy đề xuất · ngân hàng chốt', 'Engine proposes · bank confirms')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <DataTable
        id="cr" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Hồ sơ tín dụng', 'Credit applications')} rows={rows} pageSize={14}
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

/** f_prod — Financing & Insurance products (ui-2.html:4241). */
export async function FinanceProductPage({ lang }: RoutePageProps) {
  const [products, stats] = await Promise.all([
    db.select().from(financeProducts),
    db.select({
      code: financeApplications.productCode,
      n: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) FILTER (WHERE ${financeApplications.decisionCode} = 'approve')::int`,
      amount: sql<number>`sum(${financeApplications.amount})::numeric`,
      avgRate: sql<number>`avg(${financeApplications.rate})::numeric`,
      avgTat: sql<number>`avg(${financeApplications.turnaroundHours})::numeric`,
      avgPd: sql<number>`avg(${financeApplications.pd})::numeric`,
    }).from(financeApplications).groupBy(financeApplications.productCode),
  ])

  const byCode = new Map(stats.map((s) => [s.code, s]))
  const total = stats.reduce((a, s) => a + s.n, 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế Tài chính · Sản phẩm', 'Financial Institution · Products')}
        title={t(lang, 'Tài trợ & Bảo hiểm', 'Financing & Insurance')}
        modules={['F10']}
        sub={t(lang,
          'Danh mục sản phẩm tài trợ và bảo hiểm phân phối qua nền tảng. Nền tảng là kênh phân phối; tổ chức được cấp phép chịu trách nhiệm cấp và định phí.',
          'The financing and insurance products distributed through the platform. The platform is the distribution channel; licensed institutions underwrite and price.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Sản phẩm', 'Products')} value={num(products.length)} />
        <KpiTile label={t(lang, 'Hồ sơ', 'Applications')} value={num(total)} />
        <KpiTile label={t(lang, 'Giá trị', 'Value')}
          value={num(stats.reduce((a, s) => a + Number(s.amount), 0))} unit={t(lang, 'tr đ', 'm VND')} />
        <KpiTile label={t(lang, 'Tỷ lệ duyệt', 'Approval rate')}
          value={num((stats.reduce((a, s) => a + s.approved, 0) / total) * 100, 1)} unit="%" />
      </div>

      <div className="grid g2">
        {products.map((p) => {
          const s = byCode.get(p.code)
          return (
            <Card key={p.code}>
              <div className="between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <b style={{ fontSize: 13 }}>{lang === 'vi' ? p.nameVi : p.nameEn}</b>
                  <div style={{ marginTop: 4 }}>
                    {p.moduleCode ? <span className="mod">{p.moduleCode}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b className="num" style={{ fontSize: 18 }}>{num(s?.n ?? 0)}</b>
                  <div className="muted">{t(lang, 'hồ sơ', 'applications')}</div>
                </div>
              </div>
              {s ? (
                <>
                  <Meter value={(s.approved / s.n) * 100} width={150} />
                  <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>
                    {[
                      [t(lang, 'Giá trị', 'Value'), num(s.amount)],
                      [t(lang, 'Lãi suất TB', 'Avg rate'), `${num(s.avgRate, 2)}%`],
                      [t(lang, 'TAT', 'TAT'), `${num(s.avgTat, 1)}h`],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 8 }}>
                        <div className="muted">{label}</div>
                        <b className="num" style={{ fontSize: 13 }}>{value}</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div className="muted">{t(lang, 'Chưa có hồ sơ', 'No applications yet')}</div>}
            </Card>
          )
        })}
      </div>
    </>
  )
}

/** f_asset — Asset Finance & Data Room (ui-2.html:4290). */
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
  const diligence = rows.filter((r) => r.status === 'diligence')
  const totalCommitted = live.reduce((a, r) => a + Number(r.amount), 0)
  const avgLtv = rows.reduce((a, r) => a + r.ltv, 0) / rows.length
  const avgDscr = rows.reduce((a, r) => a + Number(r.dscr), 0) / rows.length
  const weakDscr = rows.filter((r) => Number(r.dscr) < 1.2)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế Tài chính · Sản phẩm', 'Financial Institution · Products')}
        title={t(lang, 'Tài trợ tàu & Data Room', 'Asset Finance & Data Room')}
        modules={['F09']}
        sub={t(lang,
          'Nền tảng là deal factory và data room — tập hợp hồ sơ, dữ liệu khai thác và bảo đảm. Nền tảng không cấu trúc và không phát hành khoản vay.',
          'The platform is a deal factory and data room — it assembles files, operating data and security. It does not structure or issue the loan.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng thương vụ', 'Total deals')} value={num(rows.length)}
          meta={t(lang, `${num(live.length)} đang hiệu lực`, `${num(live.length)} live`)} metaTone="u" />
        <KpiTile label={t(lang, 'Dư nợ cam kết', 'Committed')} value={num(totalCommitted)}
          unit={t(lang, 'tỷ đ', 'bn VND')} />
        <KpiTile label={t(lang, 'Đang thẩm định', 'In diligence')} value={num(diligence.length)} metaTone="gd" />
        <KpiTile label={t(lang, 'LTV bình quân', 'Average LTV')} value={num(avgLtv, 1)} unit="%" bar={avgLtv} />
        <KpiTile label={t(lang, 'DSCR bình quân', 'Average DSCR')} value={num(avgDscr, 2)} unit="×"
          meta={t(lang, `${num(weakDscr.length)} dưới 1,20`, `${num(weakDscr.length)} below 1.20`)}
          metaTone={weakDscr.length > 0 ? 'gd' : 'u'} />
      </div>

      <DataTable
        id="af" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Thương vụ tài trợ tài sản', 'Asset finance pipeline')} rows={rows} pageSize={14}
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
  })
    .from(creditExposures)
    .innerJoin(members, eq(members.id, creditExposures.memberId))
    .innerJoin(memberTypes, eq(memberTypes.code, members.typeCode))
    .orderBy(asc(creditExposures.memberId))

  const labels = await statusLabelMap(lang)
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

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Định chế Tài chính · Quản trị', 'Financial Institution · Governance')}
        title={t(lang, 'Rủi ro & Danh mục', 'Risk & Portfolio')}
        sub={t(lang,
          'Dư nợ theo nhóm IFRS-9, mức bảo đảm và tổn thất dự kiến. Nhóm 3–5 cần trích lập và phương án thu hồi.',
          'Exposure by IFRS-9 stage, collateral coverage and expected credit loss. Stage 3–5 requires provisioning and a recovery plan.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng dư nợ', 'Total exposure')} value={num(totalExposure)} unit={t(lang, 'tr đ', 'm VND')} />
        <KpiTile label={t(lang, 'Tổn thất dự kiến', 'Expected loss')} value={num(totalEcl, 1)} unit={t(lang, 'tr đ', 'm VND')}
          meta={`${num((totalEcl / totalExposure) * 100, 2)}%`} metaTone="d" />
        <KpiTile label={t(lang, 'Nhóm 3–5', 'Stage 3–5')} value={num(stage3.length)}
          meta={t(lang, 'cần trích lập', 'provisioning required')} metaTone="d" />
        <KpiTile label={t(lang, 'Quá hạn', 'Past due')} value={num(overdue.length)}
          meta={t(lang, `tối đa ${num(Math.max(...rows.map((r) => r.dpd)))} ngày`, `up to ${num(Math.max(...rows.map((r) => r.dpd)))} days`)} metaTone="gd" />
        <KpiTile label={t(lang, 'Tỷ lệ bảo đảm', 'Collateral coverage')} value={num(coverage * 100, 0)} unit="%"
          bar={Math.min(100, coverage * 100)} />
      </div>

      <Card title={t(lang, 'Phân nhóm IFRS-9', 'IFRS-9 staging')} bodyStyle={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(lang, 'Nhóm', 'Stage')}</th>
              <th className="r">{t(lang, 'Khoản vay', 'Exposures')}</th>
              <th className="r">{t(lang, 'Dư nợ', 'Balance')}</th>
              <th className="r">{t(lang, 'Tổn thất dự kiến', 'ECL')}</th>
              <th>{t(lang, 'Tỷ trọng dư nợ', 'Share of book')}</th>
            </tr>
          </thead>
          <tbody>
            {stageRows.map((s) => (
              <tr key={s.code}>
                <td><Tag tone={s.tone}>{s.label}</Tag></td>
                <td className="r num">{num(s.n)}</td>
                <td className="r num"><b>{num(s.exposure)}</b></td>
                <td className="r num">{num(s.ecl, 1)}</td>
                <td><Meter value={(s.exposure / totalExposure) * 100} width={110} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="risk" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Dư nợ theo thành viên', 'Exposure by member')} rows={rows} pageSize={14}
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
      </div>
    </>
  )
}
