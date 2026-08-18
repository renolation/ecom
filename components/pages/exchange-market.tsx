import { asc, eq, sql } from 'drizzle-orm'
import { LineChart, Sparkline } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  campaigns, corridors, indexLanePoints, indexLaneStats, indexPoints, lanes, members,
  settlements, settlementTriggers, abuseFlags, abuseTypes,
} from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import { statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import type { RoutePageProps } from './page-props'

/** x_index — VLX Index (ui-2.html:3521). */
export async function IndexPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [series, laneStats, lanePoints] = await Promise.all([
    db.select().from(indexPoints).orderBy(asc(indexPoints.observedOn)),
    db.select({
      lane: indexLaneStats.laneCode,
      level: indexLaneStats.level,
      d1: indexLaneStats.d1,
      w1: indexLaneStats.w1,
      m1: indexLaneStats.m1,
      ytd: indexLaneStats.ytd,
      quality: indexLaneStats.qualityGrade,
      trades: indexLaneStats.trades,
      providers: indexLaneStats.providers,
      volume: lanes.volumeTeu,
    }).from(indexLaneStats).innerJoin(lanes, eq(lanes.code, indexLaneStats.laneCode))
      .orderBy(asc(indexLaneStats.laneCode)),
    db.select().from(indexLanePoints).orderBy(asc(indexLanePoints.laneCode), asc(indexLanePoints.seq)),
  ])

  const values = series.map((p) => Number(p.value))
  const latest = values[values.length - 1]
  const first = values[0]
  const change = ((latest - first) / first) * 100
  const high = Math.max(...values)
  const low = Math.min(...values)

  const sparkFor = (lane: string) =>
    lanePoints.filter((p) => p.laneCode === lane).map((p) => Number(p.value))

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Thị trường', 'Platform Operations · Market')}
        title={t(lang, 'Chỉ số VLX Index', 'VLX Index')}
        sub={t(lang,
          'Chỉ số giá cước dựng từ giao dịch đã khớp, đã ẩn danh và tổng hợp. Đây là dữ liệu, không phải sản phẩm tài chính; hội đồng chỉ số độc lập giám sát phương pháp.',
          'A freight price index built from executed, anonymised and aggregated trades. This is data, not a financial product; an independent index committee oversees the methodology.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Mức hiện tại', 'Current level')} value={num(latest, 1)}
          meta={pct(change)} metaTone={change >= 0 ? 'u' : 'd'} />
        <KpiTile label={t(lang, 'Cao nhất kỳ', 'Period high')} value={num(high, 1)} />
        <KpiTile label={t(lang, 'Thấp nhất kỳ', 'Period low')} value={num(low, 1)} />
        <KpiTile label={t(lang, 'Số quan sát', 'Observations')} value={num(series.length)}
          meta={t(lang, 'ngày liên tiếp', 'consecutive days')} />
        <KpiTile label={t(lang, 'Tuyến có chỉ số', 'Indexed lanes')} value={num(laneStats.length)}
          meta={t(lang, `${num(laneStats.reduce((a, l) => a + l.providers, 0))} nguồn dữ liệu`, `${num(laneStats.reduce((a, l) => a + l.providers, 0))} data providers`)} />
      </div>

      <Card title={t(lang, 'Chỉ số tổng hợp — 240 ngày', 'Composite index — 240 days')}>
        <LineChart
          series={[{ data: values, color: 'var(--brand-500)', fill: true }]}
          labels={series.filter((_, i) => i % 30 === 0).map((p) => p.observedOn.slice(5))}
          height={260}
          fmt={(v) => num(v, 0)}
        />
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="idx" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Chỉ số theo tuyến', 'Index by lane')} rows={laneStats} pageSize={10}
          searchPlaceholder={t(lang, 'Tìm tuyến…', 'Search lane…')}
          search={(r) => r.lane}
          filters={[
            {
              key: 'q', label: t(lang, 'Chất lượng', 'Quality'),
              options: [['AAA', 'AAA'], ['AA', 'AA'], ['A', 'A'], ['B', 'B']],
              match: (r, v) => r.quality === v,
            },
          ]}
          columns={[
            { key: 'lane', header: t(lang, 'Tuyến', 'Lane'), width: '12%', sortValue: (r) => r.lane, render: (r) => <b style={{ fontSize: 12 }}>{r.lane}</b> },
            { key: 'level', header: t(lang, 'Mức', 'Level'), cls: 'r', width: '11%', sortValue: (r) => Number(r.level), render: (r) => <b className="num">{num(r.level, 1)}</b> },
            {
              key: 'trend', header: t(lang, 'Diễn biến', 'Trend'), width: '14%',
              render: (r) => {
                const pts = sparkFor(r.lane)
                const up = pts.length > 1 && pts[pts.length - 1] >= pts[0]
                return <Sparkline values={pts} width={100} height={26} color={up ? 'var(--up)' : 'var(--down)'} />
              },
            },
            ...(['d1', 'w1', 'm1', 'ytd'] as const).map((k) => ({
              key: k,
              header: { d1: '1D', w1: '1W', m1: '1M', ytd: 'YTD' }[k],
              cls: 'r' as const,
              width: '8%',
              sortValue: (r: typeof laneStats[number]) => Number(r[k]),
              render: (r: typeof laneStats[number]) => (
                <span className="num" style={{ color: Number(r[k]) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {pct(r[k])}
                </span>
              ),
            })),
            {
              key: 'quality', header: t(lang, 'Chất lượng', 'Quality'), cls: 'c', width: '10%',
              sortValue: (r) => r.quality,
              render: (r) => (
                <div>
                  <Tag tone={r.quality === 'AAA' ? 'u' : r.quality === 'AA' ? 'b' : r.quality === 'A' ? 'gd' : 'n'}>{r.quality}</Tag>
                  <div className="muted num">{num(r.trades)} {t(lang, 'lệnh', 'trades')}</div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  )
}

/** x_corridor — Corridors & P&L (ui-2.html:3587). */
export async function CorridorPage({ lang }: RoutePageProps) {
  const [rows, laneRows, memberCounts] = await Promise.all([
    db.select().from(corridors).orderBy(asc(corridors.id)),
    db.select({
      code: lanes.code, corridorId: lanes.corridorId, price: lanes.indexPrice,
      change: lanes.changePct, volume: lanes.volumeTeu, transit: lanes.transitDays,
    }).from(lanes).orderBy(asc(lanes.ord)),
    db.select({ corridorId: members.corridorId, n: sql<number>`count(*)::int` })
      .from(members).groupBy(members.corridorId),
  ])

  const labels = await statusLabelMap(lang)
  const totalTeu = rows.reduce((a, r) => a + r.teu, 0)
  const totalGmv = rows.reduce((a, r) => a + Number(r.gmvMVnd), 0)
  const weightedPl = rows.reduce((a, r) => a + Number(r.pl) * r.teu, 0) / totalTeu

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Thị trường', 'Platform Operations · Market')}
        title={t(lang, 'Hành lang & P&L', 'Corridors & P&L')}
        sub={t(lang,
          'Ba hành lang thí điểm theo đề án. Mỗi hành lang được đo bằng thanh khoản hai chiều, chất lượng khớp lệnh và lãi lỗ đơn vị.',
          'The three pilot corridors. Each is measured on two-sided liquidity, match quality and unit economics.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Hành lang', 'Corridors')} value={num(rows.length)}
          meta={t(lang, `${num(rows.filter((r) => r.statusCode === 'live').length)} đang chạy`, `${num(rows.filter((r) => r.statusCode === 'live').length)} live`)} />
        <KpiTile label={t(lang, 'TEU luỹ kế', 'Cumulative TEU')} value={num(totalTeu)} />
        <KpiTile label="GMV" value={num(totalGmv / 1000, 1)} unit={t(lang, 'tỷ đ', 'bn VND')} />
        <KpiTile label={t(lang, 'P&L đơn vị bình quân', 'Weighted unit P&L')} value={num(weightedPl, 2)}
          meta={t(lang, 'trên mỗi TEU', 'per TEU')} metaTone={weightedPl >= 0 ? 'u' : 'd'} />
      </div>

      <div className="stack">
        {rows.map((c) => {
          const cLanes = laneRows.filter((l) => l.corridorId === c.id)
          const mCount = memberCounts.find((m) => m.corridorId === c.id)?.n ?? 0
          return (
            <Card key={c.id}>
              <div className="between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div className="flex" style={{ gap: 8 }}>
                    <b style={{ fontSize: 15 }}>{lang === 'vi' ? c.nameVi : c.nameEn}</b>
                    <Tag tone={(labels.get(c.statusCode)?.tone ?? 'n') as Tone}>
                      {labels.get(c.statusCode)?.label ?? c.statusCode}
                    </Tag>
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>{c.route}</div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, maxWidth: 620 }}>
                    {lang === 'vi' ? c.useCaseVi : c.useCaseEn}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted">{t(lang, 'P&L đơn vị', 'Unit P&L')}</div>
                  <b className="num" style={{ fontSize: 20, color: Number(c.pl) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                    {num(c.pl, 2)}
                  </b>
                </div>
              </div>

              <div className="grid g5" style={{ gap: 10, marginBottom: 12 }}>
                {[
                  [t(lang, 'Nhà cung cấp', 'Suppliers'), num(c.suppliers)],
                  [t(lang, 'Chủ hàng', 'Shippers'), num(c.shippers)],
                  [t(lang, 'Thành viên', 'Members'), num(mCount)],
                  ['TEU', num(c.teu)],
                  ['GMV', `${num(Number(c.gmvMVnd) / 1000, 1)} ${t(lang, 'tỷ', 'bn')}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 9, background: 'var(--surface-2)', borderRadius: 9 }}>
                    <div className="muted">{label}</div>
                    <b className="num" style={{ fontSize: 15 }}>{value}</b>
                  </div>
                ))}
              </div>

              <div className="grid g2" style={{ gap: 12 }}>
                <div>
                  <div className="muted" style={{ marginBottom: 4 }}>{t(lang, 'Chất lượng khớp lệnh', 'Match quality')}</div>
                  <Meter value={c.quality} width={140} />
                  <div className="muted" style={{ marginTop: 6 }}>
                    {t(lang, 'Thời gian ra báo giá', 'Time to quote')}: <b className="num">{num(c.timeToQuote, 1)}h</b>
                    {' · '}
                    {t(lang, 'Khách quay lại', 'Repeat rate')}: <b className="num">{c.repeatRate}%</b>
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 4 }}>{t(lang, 'Tuyến trong hành lang', 'Lanes in corridor')}</div>
                  {cLanes.map((l) => (
                    <div key={l.code} className="between" style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)' }}>
                      <b style={{ fontSize: 11.5 }}>{l.code}</b>
                      <span>
                        <span className="num">{usd(l.price)}</span>
                        <span className="tag" style={{ marginLeft: 6 }}
                          data-tone={Number(l.change) >= 0 ? 'u' : 'd'}>
                          <span style={{ color: Number(l.change) >= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(l.change)}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

/** x_campaign — Campaigns & Anti-abuse (ui-2.html:3861). */
export async function CampaignPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [camps, flags, labels] = await Promise.all([
    db.select().from(campaigns).orderBy(asc(campaigns.id)),
    db.select({
      id: abuseFlags.id,
      typeVi: abuseTypes.nameVi,
      typeEn: abuseTypes.nameEn,
      typeId: abuseFlags.abuseTypeId,
      member: members.name,
      campaignVi: campaigns.nameVi,
      campaignEn: campaigns.nameEn,
      amount: abuseFlags.amount,
      status: abuseFlags.statusCode,
      flaggedOn: abuseFlags.flaggedOn,
    })
      .from(abuseFlags)
      .innerJoin(abuseTypes, eq(abuseTypes.id, abuseFlags.abuseTypeId))
      .innerJoin(members, eq(members.id, abuseFlags.memberId))
      .innerJoin(campaigns, eq(campaigns.id, abuseFlags.campaignId))
      .orderBy(asc(abuseFlags.flaggedOn)),
    statusLabelMap(lang),
  ])

  const totalBudget = camps.reduce((a, c) => a + Number(c.budget), 0)
  const totalUsed = camps.reduce((a, c) => a + Number(c.used), 0)
  const totalActivated = camps.reduce((a, c) => a + c.activated, 0)
  const clawback = flags.filter((f) => f.status === 'clawback')

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Tăng trưởng', 'Platform Operations · Growth')}
        title={t(lang, 'Chiến dịch & Chống lạm dụng', 'Campaigns & Anti-abuse')}
        sub={t(lang,
          'Ưu đãi tăng trưởng luôn đi kèm điều kiện đủ và cơ chế thu hồi. Mọi khoản credit đều phải gắn với giao dịch thật đã KYB.',
          'Growth incentives always carry eligibility rules and a clawback path. Every credit must attach to a real, KYB-verified transaction.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Chiến dịch', 'Campaigns')} value={num(camps.length)}
          meta={t(lang, `${num(camps.filter((c) => c.statusCode === 'run').length)} đang chạy`, `${num(camps.filter((c) => c.statusCode === 'run').length)} running`)} />
        <KpiTile label={t(lang, 'Ngân sách', 'Budget')} value={num(totalBudget, 1)} unit={t(lang, 'tỷ đ', 'bn')} />
        <KpiTile label={t(lang, 'Đã dùng', 'Spent')} value={num(totalUsed, 1)} unit={t(lang, 'tỷ đ', 'bn')}
          bar={(totalUsed / totalBudget) * 100} />
        <KpiTile label={t(lang, 'Đã kích hoạt', 'Activated')} value={num(totalActivated)}
          meta={t(lang, 'doanh nghiệp', 'companies')} />
        <KpiTile label={t(lang, 'Cờ lạm dụng', 'Abuse flags')} value={num(flags.length)}
          meta={t(lang, `${num(clawback.length)} phải thu hồi`, `${num(clawback.length)} clawed back`)} metaTone="d" />
      </div>

      <Card title={t(lang, 'Chiến dịch tăng trưởng', 'Growth campaigns')} bodyStyle={{ padding: 0 }}>
        <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>{t(lang, 'Chiến dịch', 'Campaign')}</th>
                <th style={{ width: '14%' }}>{t(lang, 'Đối tượng', 'Target')}</th>
                <th style={{ width: '16%' }}>{t(lang, 'Ngân sách', 'Budget')}</th>
                <th className="r" style={{ width: '9%' }}>{t(lang, 'Kích hoạt', 'Activated')}</th>
                <th className="r" style={{ width: '9%' }}>{t(lang, 'Quay lại', 'Repeat')}</th>
                <th className="r" style={{ width: '9%' }}>CPA</th>
                <th style={{ width: '21%' }}>{t(lang, 'Điều kiện', 'Rule')}</th>
              </tr>
            </thead>
            <tbody>
              {camps.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b style={{ fontSize: 12 }}>{lang === 'vi' ? c.nameVi : c.nameEn}</b>
                    <div style={{ marginTop: 3 }}>
                      <Tag tone={(labels.get(c.statusCode)?.tone ?? 'n') as Tone}>
                        {labels.get(c.statusCode)?.label ?? c.statusCode}
                      </Tag>
                    </div>
                  </td>
                  <td style={{ fontSize: 11.5 }}>{lang === 'vi' ? c.targetVi : c.targetEn}</td>
                  <td>
                    <Meter value={(Number(c.used) / Number(c.budget)) * 100} width={70} />
                    <div className="muted num">{num(c.used, 2)} / {num(c.budget, 2)} {t(lang, 'tỷ', 'bn')}</div>
                  </td>
                  <td className="r num">{num(c.activated)}</td>
                  <td className="r num">{c.repeatRate}%</td>
                  <td className="r num">{num(c.cpa, 1)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{lang === 'vi' ? c.ruleVi : c.ruleEn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="abuse" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Cờ lạm dụng ưu đãi', 'Incentive abuse flags')} rows={flags} pageSize={12}
          searchPlaceholder={t(lang, 'Tìm thành viên, chiến dịch…', 'Search member, campaign…')}
          search={(r) => `${r.id} ${r.member} ${r.campaignVi} ${r.typeVi}`}
          filters={[
            {
              key: 'st', label: t(lang, 'Xử lý', 'Handling'),
              options: statusOptions(labels, ['hold', 'clawback', 'cleared']),
              match: (r, v) => r.status === v,
            },
          ]}
          columns={[
            { key: 'id', header: t(lang, 'Mã cờ', 'Flag'), width: '10%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
            {
              key: 'ty', header: t(lang, 'Mẫu hình', 'Pattern'), width: '26%',
              sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
              render: (r) => <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>,
            },
            { key: 'member', header: t(lang, 'Thành viên', 'Member'), width: '22%', sortValue: (r) => r.member, render: (r) => <span style={{ fontSize: 12 }}>{r.member}</span> },
            {
              key: 'camp', header: t(lang, 'Chiến dịch', 'Campaign'), width: '18%',
              sortValue: (r) => (lang === 'vi' ? r.campaignVi : r.campaignEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.campaignVi : r.campaignEn}</span>,
            },
            { key: 'amt', header: t(lang, 'Giá trị', 'Amount'), cls: 'r', width: '10%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{num(r.amount)}</b> },
            { key: 'date', header: t(lang, 'Ngày', 'Date'), cls: 'c', width: '9%', sortValue: (r) => r.flaggedOn, render: (r) => <span className="num">{r.flaggedOn}</span> },
            {
              key: 'st', header: t(lang, 'Xử lý', 'Handling'), cls: 'c', width: '10%', sortValue: (r) => r.status,
              render: (r) => <Tag tone={(labels.get(r.status)?.tone ?? 'n') as Tone}>{labels.get(r.status)?.label ?? r.status}</Tag>,
            },
          ]}
        />
      </div>
    </>
  )
}

/** x_clear — Reconciliation & Settlement (ui-2.html:3932). */
export async function ClearingPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, byBank] = await Promise.all([
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
      ref: settlements.paymentRef,
      bank: settlements.bank,
      corridorId: settlements.corridorId,
    })
      .from(settlements)
      .innerJoin(settlementTriggers, eq(settlementTriggers.id, settlements.triggerId))
      .orderBy(asc(settlements.settledOn)),
    statusLabelMap(lang),
    db.select({
      bank: settlements.bank,
      total: sql<number>`sum(${settlements.amount})::numeric`,
      n: sql<number>`count(*)::int`,
      unmatched: sql<number>`count(*) FILTER (WHERE NOT ${settlements.isMatched})::int`,
    }).from(settlements).groupBy(settlements.bank),
  ])

  const total = rows.reduce((a, r) => a + Number(r.amount), 0)
  const exceptions = rows.filter((r) => r.status === 'exception' || r.status === 'dispute')
  const matchRate = (rows.filter((r) => r.matched).length / rows.length) * 100

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Sau giao dịch', 'Platform Operations · Post-trade')}
        title={t(lang, 'Đối soát & Quyết toán', 'Reconciliation & Settlement')}
        modules={['F08']}
        sandbox={['SB-07']}
        sub={t(lang,
          'Nền tảng không giữ tiền và không phải là trung gian thanh toán. Đối soát mốc giao dịch với lệnh chi của từng ngân hàng là bắt buộc trước khi đóng kỳ.',
          'The platform holds no funds and is not a payment intermediary. Reconciling milestones against each bank instruction is mandatory before a period closes.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng quyết toán', 'Total settled')} value={usd(total)}
          meta={t(lang, `${num(rows.length)} giao dịch`, `${num(rows.length)} transactions`)} />
        <KpiTile label={t(lang, 'Tỷ lệ khớp', 'Match rate')} value={num(matchRate, 1)} unit="%" bar={matchRate} />
        <KpiTile label={t(lang, 'Sai lệch / tranh chấp', 'Exceptions')} value={num(exceptions.length)}
          meta={t(lang, 'chặn đóng kỳ', 'blocks period close')} metaTone="d" />
        <KpiTile label={t(lang, 'Ngân hàng đối tác', 'Partner banks')} value={num(byBank.length)} />
      </div>

      <Card title={t(lang, 'Theo ngân hàng', 'By bank')} bodyStyle={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(lang, 'Ngân hàng', 'Bank')}</th>
              <th className="r">{t(lang, 'Giao dịch', 'Transactions')}</th>
              <th className="r">{t(lang, 'Giá trị', 'Value')}</th>
              <th className="r">{t(lang, 'Chưa khớp', 'Unmatched')}</th>
              <th>{t(lang, 'Tỷ lệ khớp', 'Match rate')}</th>
            </tr>
          </thead>
          <tbody>
            {byBank.map((b) => (
              <tr key={b.bank}>
                <td><b style={{ fontSize: 12 }}>{b.bank}</b></td>
                <td className="r num">{num(b.n)}</td>
                <td className="r num">{usd(b.total)}</td>
                <td className="r num">{b.unmatched > 0 ? <span style={{ color: 'var(--gold-500)' }}>{num(b.unmatched)}</span> : '—'}</td>
                <td><Meter value={((b.n - b.unmatched) / b.n) * 100} width={90} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="clr" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Sổ quyết toán', 'Settlement ledger')} rows={rows} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm mã, lô hàng, mã chi…', 'Search reference, shipment, payment ref…')}
          search={(r) => `${r.id} ${r.shipment} ${r.counterparty} ${r.carrier} ${r.ref}`}
          filters={[
            {
              key: 'st', label: t(lang, 'Trạng thái', 'Status'),
              options: statusOptions(labels, ['paid', 'pending', 'exception', 'dispute']),
              match: (r, v) => r.status === v,
            },
            {
              key: 'bank', label: t(lang, 'Ngân hàng', 'Bank'),
              options: byBank.map((b) => [b.bank, b.bank] as [string, string]),
              match: (r, v) => r.bank === v,
            },
            {
              key: 'cor', label: t(lang, 'Hành lang', 'Corridor'),
              options: [['1', '01'], ['2', '02'], ['3', '03']],
              match: (r, v) => String(r.corridorId) === v,
            },
          ]}
          columns={[
            { key: 'id', header: t(lang, 'Mã', 'Reference'), width: '13%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
            { key: 'ship', header: t(lang, 'Lô hàng', 'Shipment'), width: '14%', sortValue: (r) => r.shipment, render: (r) => <span className="num" style={{ fontSize: 11.5 }}>{r.shipment}</span> },
            { key: 'cp', header: t(lang, 'Chủ hàng', 'Shipper'), width: '17%', sortValue: (r) => r.counterparty, render: (r) => <span style={{ fontSize: 12 }}>{r.counterparty}</span> },
            { key: 'car', header: t(lang, 'Hãng tàu', 'Carrier'), width: '14%', sortValue: (r) => r.carrier, render: (r) => <span style={{ fontSize: 12 }}>{r.carrier}</span> },
            {
              key: 'trig', header: t(lang, 'Mốc', 'Trigger'), width: '14%',
              sortValue: (r) => (lang === 'vi' ? r.triggerVi : r.triggerEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.triggerVi : r.triggerEn}</span>,
            },
            { key: 'amt', header: t(lang, 'Số tiền', 'Amount'), cls: 'r', width: '11%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{usd(r.amount)}</b> },
            { key: 'bank', header: t(lang, 'NH', 'Bank'), cls: 'c', width: '8%', sortValue: (r) => r.bank, render: (r) => <span style={{ fontSize: 11 }}>{r.bank}</span> },
            {
              key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%', sortValue: (r) => r.status,
              render: (r) => (
                <div>
                  <Tag tone={(labels.get(r.status)?.tone ?? 'n') as Tone}>{labels.get(r.status)?.label ?? r.status}</Tag>
                  {!r.matched ? <div style={{ marginTop: 3 }}><Tag tone="gd">{t(lang, 'Chưa khớp', 'Unmatched')}</Tag></div> : null}
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  )
}
