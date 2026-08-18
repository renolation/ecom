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

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

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

/** ui-2.html:3597 — corridor P&L, in bn VND, cumulative since opening. */
const CORRIDOR_PL: Array<[string, string, number[], 'rev' | 'cost' | 'sub' | 'tot']> = [
  ['Doanh thu phí booking', 'Booking fee revenue', [0.34, 0.25, 0.22], 'rev'],
  ['Doanh thu origination tài trợ', 'Financing origination', [0.62, 0.41, 0.48], 'rev'],
  ['Doanh thu chứng từ / eB/L', 'Document / eB/L revenue', [0.18, 0.12, 0.09], 'rev'],
  ['Thuê bao & dữ liệu', 'Subscription & data', [0.28, 0.19, 0.11], 'rev'],
  ['Tổng doanh thu', 'Total revenue', [1.42, 0.97, 0.90], 'sub'],
  ['Chi phí kích hoạt (khuyến mãi)', 'Activation spend (incentives)', [-0.86, -0.94, -1.42], 'cost'],
  ['Chi phí tích hợp đối tác', 'Partner integration cost', [-0.42, -0.58, -0.86], 'cost'],
  ['Chi phí vận hành hành lang', 'Corridor operating cost', [-0.56, -0.63, -0.68], 'cost'],
  ['P&L hành lang', 'Corridor P&L', [-0.42, -1.18, -2.06], 'tot'],
]

/** ui-2.html:3620 — the four decisions available at the new-corridor gate. */
const CORRIDOR_GATES: Array<[string, string, string, string, string, string, string]> = [
  ['Mở chiến dịch', 'Open campaign',
    'Có đủ nguồn cung, quy tắc chiến dịch, chống lạm dụng, chủ sở hữu, cap và dashboard',
    'Sufficient supply, campaign rules, anti-abuse, an owner, caps and a dashboard',
    'Chạy thử có cap', 'Run a capped pilot', 'var(--up)'],
  ['Mở rộng', 'Expand',
    'Đạt tỷ lệ kích hoạt, phủ báo giá, lặp lại và chi phí/lặp lại trong ngưỡng',
    'Activation, quote coverage, repeat and cost-per-repeat within thresholds',
    'Tăng cap và mở tuyến kế tiếp', 'Raise the cap and open the next lane', 'var(--brand-500)'],
  ['Điều chỉnh', 'Adjust',
    'Có giao dịch nhưng tỷ lệ chuyển đổi thấp hoặc ma sát rõ',
    'Transactions occur but conversion is low or friction is evident',
    'Sửa thông điệp, giá và luồng', 'Fix messaging, pricing and the flow', 'var(--gold-500)'],
  ['Dừng', 'Stop',
    'Vượt cap 2 kỳ, giao dịch ảo, nguồn cung yếu hoặc không tạo lặp lại',
    'Over cap for 2 periods, fake volume, weak supply or no repeat',
    'Khoá ưu đãi và đánh giá lại nguồn cung', 'Freeze incentives and reassess supply', 'var(--down)'],
]

/** ui-2.html:3577 — the corridor leads are named in the prototype, not in any table. */
const CORRIDOR_LEADS = ['Trần Hải Long', 'Phạm Thu Hà', 'Nguyễn Văn Đức']

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

  /** ui-2.html:3569 — five expansion gates; all five must pass to open the next corridor. */
  const gatesOf = (c: typeof rows[number]): Array<[string, boolean]> => [
    [t(lang, '≥3 nhà cung cấp / tuyến', '≥3 providers per lane'), c.suppliers >= 9],
    [t(lang, '30–50 chủ hàng mục tiêu', '30–50 target shippers'), c.shippers >= 30],
    [t(lang, 'Tỷ lệ ≥3 báo giá ≥70%', '≥3-quote rate ≥70%'), c.quality >= 70],
    [t(lang, 'Thời gian báo giá đầu ≤4 giờ', 'Time to first quote ≤4h'), Number(c.timeToQuote) <= 4],
    [t(lang, 'Lặp lại 90 ngày ≥50%', '90-day repeat ≥50%'), c.repeatRate >= 50],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành nền tảng · Thị trường', 'Platform ops · Market')}
        title={t(lang, 'Hành lang & P&L', 'Corridors & P&L')}
        added
        lang={lang}
        sub={t(lang,
          'Mỗi hành lang được vận hành như một micro-market có P&L riêng và một Corridor Lead chịu trách nhiệm. Chỉ mở hành lang tiếp theo khi hành lang hiện tại đạt ngưỡng.',
          'Each corridor runs as a micro-market with its own P&L and an accountable Corridor Lead. The next corridor opens only when the current one clears its thresholds.')}
        actions={<span className="btn">⬇ {t(lang, 'Xuất báo cáo', 'Export')}</span>}
      />

      <div className="grid g3" style={{ marginBottom: 14 }}>
        {rows.map((c) => {
          const gates = gatesOf(c)
          const passed = gates.filter(([, ok]) => ok).length
          const live = c.statusCode === 'live'
          const pl = Number(c.pl)
          return (
            <div className="card" key={c.id}>
              <div className="card-h" style={{ background: live ? 'var(--up-bg)' : 'var(--gold-100)' }}>
                <h3>
                  {t(lang, 'Hành lang', 'Corridor')} {String(c.id).padStart(2, '0')} ·{' '}
                  {lang === 'vi' ? c.nameVi : c.nameEn}
                </h3>
                <Tag tone={tone(labels, c.statusCode)}>{labels.get(c.statusCode)?.label ?? c.statusCode}</Tag>
              </div>
              <div className="card-b">
                <div className="muted">{c.route}</div>
                <div className="grid g2" style={{ gap: 9, marginTop: 10 }}>
                  {([
                    [t(lang, 'TEU luỹ kế', 'Cumulative TEU'), num(c.teu)],
                    ['GMV', `${num(Number(c.gmvMVnd) / 1000, 1)} ${t(lang, 'tỷ', 'bn')}`],
                    [t(lang, 'Chủ hàng hoạt động', 'Active shippers'), String(c.shippers)],
                    [t(lang, 'Nhà cung cấp', 'Providers'), String(c.suppliers)],
                  ] as Array<[string, string]>).map(([label, value]) => (
                    <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 9 }}>
                      <div className="muted">{label}</div>
                      <div className="num" style={{ fontSize: 15, fontWeight: 750 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="sep" />
                <div className="between">
                  <b style={{ fontSize: 12 }}>{t(lang, 'Điều kiện mở rộng', 'Expansion gates')}</b>
                  <Tag tone={passed === 5 ? 'u' : passed >= 3 ? 'gd' : 'd'}>{passed}/5</Tag>
                </div>
                {gates.map(([label, ok]) => (
                  <div key={label} className="between" style={{ padding: '4px 0', fontSize: 11.5 }}>
                    <span>{label}</span>
                    <span style={{ color: ok ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>{ok ? '✓' : '✕'}</span>
                  </div>
                ))}
                <div className="between" style={{
                  background: pl < -1.5 ? 'var(--down-bg)' : 'var(--surface-3)',
                  borderRadius: 9, padding: 10, marginTop: 9,
                }}>
                  <b style={{ fontSize: 12 }}>{t(lang, 'P&L hành lang (luỹ kế)', 'Corridor P&L (cumulative)')}</b>
                  <b className="num" style={{ fontSize: 15, color: pl < 0 ? 'var(--down)' : 'var(--up)' }}>
                    {num(pl, 2)} {t(lang, 'tỷ', 'bn')}
                  </b>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Corridor Lead: {CORRIDOR_LEADS[c.id - 1]}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card
          title={t(lang, 'P&L chi tiết theo hành lang', 'Detailed corridor P&L')}
          right={
            <span className="sub">
              {t(lang, 'Đơn vị: tỷ đồng · luỹ kế từ khi mở hành lang',
                'Billion VND · cumulative since corridor opening')}
            </span>
          }
          bodyStyle={{ padding: 0 }}
          footer={t(lang,
            'Hành lang 03 chưa đạt ngưỡng và đang lỗ sâu nhất — theo nguyên tắc §9.4, tuyến không đạt mật độ tối thiểu sau 2 chu kỳ thử nghiệm phải dừng ưu đãi và đánh giá lại nguồn cung.',
            'Corridor 03 has not cleared its gates and carries the deepest loss — under §9.4, a lane below minimum density after two test cycles must pause subsidy and have its supply reassessed.')}>
          <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, 'Khoản mục', 'Line item')}</th>
                  {rows.map((c) => (
                    <th key={c.id} className="r">{String(c.id).padStart(2, '0')}</th>
                  ))}
                  <th className="r">{t(lang, 'Tổng', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {CORRIDOR_PL.map(([vi, en, values, kind]) => {
                  const total = values.reduce((a, b) => a + b, 0)
                  const rowStyle = kind === 'sub'
                    ? { fontWeight: 700, background: 'var(--surface-2)' }
                    : kind === 'tot'
                      ? { fontWeight: 800, background: 'var(--surface-3)' }
                      : undefined
                  return (
                    <tr key={en} style={rowStyle}>
                      <td>{t(lang, vi, en)}</td>
                      {values.map((v, i) => (
                        <td key={i} className="r num" style={{
                          color: v < 0 ? 'var(--down)'
                            : kind === 'rev' || kind === 'sub' ? 'var(--up)' : 'inherit',
                        }}>{num(v, 2)}</td>
                      ))}
                      <td className="r num" style={{ fontWeight: 700, color: total < 0 ? 'var(--down)' : 'var(--up)' }}>
                        {num(total, 2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Chỉ số chất lượng thị trường', 'Market quality metrics')}>
            {rows.map((c) => {
              // Time-to-quote is inverted onto a 0–100 scale so a shorter wait reads as fuller.
              const ttqScore = Math.round(100 - Number(c.timeToQuote) * 12)
              const metrics: Array<[string, number, number, string]> = [
                [t(lang, 'Tỷ lệ ≥3 báo giá', '≥3-quote rate'), c.quality, 70, `${c.quality}%`],
                [t(lang, 'Lặp lại 90 ngày', '90-day repeat'), c.repeatRate, 50, `${c.repeatRate}%`],
                [t(lang, 'Thời gian báo giá đầu (giờ)', 'Time to first quote (h)'), ttqScore, 100,
                  `${num(c.timeToQuote, 1)}h`],
              ]
              return (
                <div key={c.id} style={{ marginBottom: 13 }}>
                  <b style={{ fontSize: 12.5 }}>
                    {String(c.id).padStart(2, '0')} · {lang === 'vi' ? c.nameVi : c.nameEn}
                  </b>
                  {metrics.map(([label, value, threshold, display]) => (
                    <div key={label} className="between" style={{ padding: '3px 0', fontSize: 11.5 }}>
                      <span>{label}</span>
                      <div className="meter">
                        <div className="bar" style={{ width: 70 }}>
                          <i style={{
                            width: `${Math.min(100, value)}%`,
                            background: value >= threshold ? 'var(--up)' : 'var(--down)',
                          }} />
                        </div>
                        <b>{display}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </Card>

          <Card title={t(lang, 'Cửa phê duyệt mở hành lang mới', 'New-corridor approval gate')}
            bodyStyle={{ padding: 11 }}>
            {CORRIDOR_GATES.map(([vi, en, cVi, cEn, aVi, aEn, color]) => (
              <div key={en} style={{
                borderLeft: `3px solid ${color}`, padding: '9px 11px',
                background: 'var(--surface-2)', borderRadius: '0 9px 9px 0', marginBottom: 8,
              }}>
                <b style={{ fontSize: 12 }}>{t(lang, vi, en)}</b>
                <div className="muted" style={{ marginTop: 2 }}>{t(lang, cVi, cEn)}</div>
                <div style={{ fontSize: 11, fontWeight: 650, color: 'var(--brand-600)', marginTop: 4 }}>
                  → {t(lang, aVi, aEn)}
                </div>
              </div>
            ))}
          </Card>
        </div>
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
