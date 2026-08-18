import { asc, eq, sql } from 'drizzle-orm'
import { Donut } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import {
  Card, KpiTile, Legend, Meter, OrgCell, PageHeader, Tag, TierPill,
} from '@/components/ui'
import { db } from '@/lib/db'
import {
  amlAlerts, amlAlertTypes, disputes, disputeIssueTypes, evidenceSources, memberTypes,
  members, sectors, shipments,
} from '@/db/schema'
import { num, t, usd, type Lang } from '@/lib/i18n'
import { corridorOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import { modalHref, openModalId } from '@/components/modal'
import { MemberModal } from './record-modals'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** x_mem — Members & KYB (ui-2.html:3653). */
export async function MembersPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, labels, corridorOpts] = await Promise.all([
    db.select({
      id: members.id,
      name: members.name,
      typeCode: members.typeCode,
      typeVi: memberTypes.nameVi,
      typeEn: memberTypes.nameEn,
      sectorVi: sectors.nameVi,
      sectorEn: sectors.nameEn,
      country: members.countryCode,
      rating: members.rating,
      score: members.score,
      limit: members.creditLimitMVnd,
      utilisation: members.utilisationPct,
      teu: members.teu,
      gmv: members.gmvMVnd,
      kyb: members.kybStatusCode,
      risk: members.riskLevelCode,
      compliance: members.complianceStatusCode,
      tier: members.tier,
      joinedOn: members.joinedOn,
      corridorId: members.corridorId,
      active30d: members.active30d,
    })
      .from(members)
      .innerJoin(memberTypes, eq(memberTypes.code, members.typeCode))
      .innerJoin(sectors, eq(sectors.id, members.sectorId))
      .orderBy(asc(members.id)),
    db.select().from(memberTypes).orderBy(asc(memberTypes.ord)),
    statusLabelMap(lang),
    corridorOptions(lang),
  ])

  const pending = rows.filter((r) => r.kyb !== 'done')
  const highRisk = rows.filter((r) => r.risk === 'high')
  const breach = rows.filter((r) => r.compliance === 'breach')
  const active = rows.filter((r) => r.active30d)

  const openId = openModalId(searchParams)
  const openMember = openId ? rows.find((r) => r.id === openId) ?? null : null

  const byType = types.map((ty, i) => ({
    label: lang === 'vi' ? ty.nameVi : ty.nameEn,
    v: rows.filter((r) => r.typeCode === ty.code).length,
    c: ['var(--brand-500)', 'var(--violet)', 'var(--up)', 'var(--gold-500)', 'var(--down)', 'var(--brand-400)'][i % 6],
  })).filter((x) => x.v > 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Thành viên', 'Platform Operations · Members')}
        title={t(lang, 'Thành viên & KYB', 'Members & KYB')}
        modules={['F11']}
        sub={t(lang,
          'Hồ sơ định danh doanh nghiệp phải hoàn tất trước khi được giao dịch. Rà soát cấm vận, xác minh chủ sở hữu hưởng lợi và thẩm định tài chính là ba chốt chặn bắt buộc.',
          'Business identity files must complete before trading is enabled. Sanctions screening, beneficial-owner verification and financial review are the three mandatory gates.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Thành viên', 'Members')} value={num(rows.length)}
          meta={t(lang, `${num(active.length)} hoạt động 30 ngày`, `${num(active.length)} active in 30d`)} />
        <KpiTile label={t(lang, 'KYB chưa xong', 'KYB incomplete')} value={num(pending.length)}
          meta={t(lang, 'chặn giao dịch', 'trading blocked')} metaTone="d" />
        <KpiTile label={t(lang, 'Rủi ro cao', 'High risk')} value={num(highRisk.length)} metaTone="gd"
          meta={t(lang, 'giám sát tăng cường', 'enhanced monitoring')} />
        <KpiTile label={t(lang, 'Vượt ngưỡng tuân thủ', 'Compliance breach')} value={num(breach.length)} metaTone="d" />
        <KpiTile label={t(lang, 'Hạn mức đã cấp', 'Limits granted')}
          value={num(rows.reduce((a, r) => a + Number(r.limit), 0) / 1000, 1)}
          unit={t(lang, 'tỷ đ', 'bn VND')} />
      </div>

      <div className="grid g-1-2" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Theo loại thành viên', 'By member type')}>
          <div style={{ display: 'grid', placeItems: 'center' }}><Donut items={byType} size={150} /></div>
          <Legend items={byType.map((x) => ({ color: x.c, label: `${x.label} (${x.v})` }))} />
        </Card>
        <Card title={t(lang, 'Tiến độ KYB', 'KYB progress')}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t(lang, 'Bước', 'Gate')}</th>
                <th className="r">{t(lang, 'Số hồ sơ', 'Files')}</th>
                <th>{t(lang, 'Tỷ trọng', 'Share')}</th>
              </tr>
            </thead>
            <tbody>
              {['done', 'sanctions', 'ubo', 'financial', 'docs'].map((code) => {
                const n = rows.filter((r) => r.kyb === code).length
                if (!n) return null
                return (
                  <tr key={code}>
                    <td><Tag tone={tone(labels, code)}>{labels.get(code)?.label ?? code}</Tag></td>
                    <td className="r num">{num(n)}</td>
                    <td><Meter value={(n / rows.length) * 100} width={110} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <DataTable
        id="mem" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Danh sách thành viên', 'Member register')} rows={rows} pageSize={14}
        rowHref={(r) => modalHref(basePath, searchParams, r.id)}
        searchPlaceholder={t(lang, 'Tìm tên, mã thành viên…', 'Search name, member id…')}
        search={(r) => `${r.id} ${r.name} ${r.country} ${r.rating}`}
        filters={[
          {
            key: 'ty', label: t(lang, 'Loại', 'Type'),
            options: types.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => r.typeCode === v,
          },
          {
            key: 'kyb', label: 'KYB',
            options: statusOptions(labels, ['done', 'sanctions', 'ubo', 'financial', 'docs']),
            match: (r, v) => r.kyb === v,
          },
          {
            key: 'risk', label: t(lang, 'Rủi ro', 'Risk'),
            options: statusOptions(labels, ['low', 'med', 'high']),
            match: (r, v) => r.risk === v,
          },
          { key: 'cor', label: t(lang, 'Hành lang', 'Corridor'), options: corridorOpts, match: (r, v) => String(r.corridorId) === v },
        ]}
        columns={[
          {
            key: 'name', header: t(lang, 'Thành viên', 'Member'), width: '24%', sortValue: (r) => r.name,
            render: (r) => (
              <div>
                <OrgCell name={r.name} />
                <div className="muted num" style={{ marginTop: 2 }}>{r.id} · {r.country}</div>
              </div>
            ),
          },
          {
            key: 'ty', header: t(lang, 'Loại', 'Type'), width: '14%', sortValue: (r) => r.typeCode,
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>
                <div className="muted">{lang === 'vi' ? r.sectorVi : r.sectorEn}</div>
              </div>
            ),
          },
          {
            key: 'score', header: t(lang, 'Xếp hạng', 'Rating'), cls: 'c', width: '10%', sortValue: (r) => r.score,
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{r.rating}</b>
                <div className="muted num">{r.score}/100</div>
              </div>
            ),
          },
          {
            key: 'limit', header: t(lang, 'Hạn mức', 'Limit'), cls: 'r', width: '13%', sortValue: (r) => Number(r.limit),
            render: (r) => Number(r.limit) > 0 ? (
              <div>
                <b className="num">{num(r.limit)} {t(lang, 'tr', 'm')}</b>
                <Meter value={r.utilisation} width={60} />
              </div>
            ) : <span className="muted">—</span>,
          },
          { key: 'teu', header: 'TEU', cls: 'r', width: '8%', sortValue: (r) => r.teu, render: (r) => <span className="num">{num(r.teu)}</span> },
          {
            key: 'kyb', header: 'KYB', cls: 'c', width: '11%', sortValue: (r) => r.kyb,
            render: (r) => <Tag tone={tone(labels, r.kyb)}>{labels.get(r.kyb)?.label ?? r.kyb}</Tag>,
          },
          {
            key: 'risk', header: t(lang, 'Rủi ro', 'Risk'), cls: 'c', width: '10%', sortValue: (r) => r.risk,
            render: (r) => (
              <div>
                <Tag tone={tone(labels, r.risk)}>{labels.get(r.risk)?.label ?? r.risk}</Tag>
                <div style={{ marginTop: 3 }}>
                  <Tag tone={tone(labels, r.compliance)}>{labels.get(r.compliance)?.label ?? r.compliance}</Tag>
                </div>
              </div>
            ),
          },
          { key: 'joined', header: t(lang, 'Gia nhập', 'Joined'), cls: 'c', width: '10%', sortValue: (r) => r.joinedOn, render: (r) => <span className="num">{r.joinedOn}</span> },
        ]}
      />

      {openMember ? (
        <MemberModal
          lang={lang} basePath={basePath} searchParams={searchParams}
          member={{
            id: openMember.id, name: openMember.name,
            typeName: lang === 'vi' ? openMember.typeVi : openMember.typeEn,
            sectorName: lang === 'vi' ? openMember.sectorVi : openMember.sectorEn,
            country: openMember.country, rating: openMember.rating, score: openMember.score,
            limit: Number(openMember.limit), utilisation: openMember.utilisation,
            teu: openMember.teu, gmv: Number(openMember.gmv),
            kybLabel: labels.get(openMember.kyb)?.label ?? openMember.kyb,
            kybTone: labels.get(openMember.kyb)?.tone ?? 'n',
            riskLabel: labels.get(openMember.risk)?.label ?? openMember.risk,
            riskTone: labels.get(openMember.risk)?.tone ?? 'n',
            complianceLabel: labels.get(openMember.compliance)?.label ?? openMember.compliance,
            complianceTone: labels.get(openMember.compliance)?.tone ?? 'n',
            tier: openMember.tier, joinedOn: openMember.joinedOn,
            corridorId: openMember.corridorId, active30d: openMember.active30d,
            repeat90d: false,
          }}
        />
      ) : null}
    </>
  )
}

/** ui-2.html:3764 — what the agent may do versus what only the officer may do. */
const AML_BOUNDARY: Array<[string, string, string, Array<[string, string]>]> = [
  ['AI Agent làm', 'The AI agent does', 'var(--up)', [
    ['Phát hiện mẫu hình bất thường trên toàn sổ giao dịch', 'Detect anomalous patterns across the whole trade ledger'],
    ['Chấm điểm rủi ro và giải thích tín hiệu nào kích hoạt', 'Score risk and explain which signals fired'],
    ['Dựng hồ sơ STR nháp kèm chứng cứ có dấu thời gian', 'Draft the STR with timestamped evidence'],
    ['Đề xuất mức xử lý và tuyến escalation', 'Propose a disposition and escalation path'],
  ]],
  ['Chỉ cán bộ tuân thủ được làm', 'Only the compliance officer may', 'var(--down)', [
    ['Quyết định chặn giao dịch hoặc đóng băng tài khoản', 'Decide to block a transaction or freeze an account'],
    ['Ký và gửi báo cáo giao dịch đáng ngờ chính thức', 'Sign and file the official suspicious transaction report'],
    ['Đóng cảnh báo mức cao', 'Close a high-severity alert'],
    ['Quyết định chấm dứt tư cách thành viên', 'Decide to terminate membership'],
  ]],
]

/** x_aml — AML / Sanctions / STR (ui-2.html:3750). */
export async function AmlPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, labels, memberCount] = await Promise.all([
    db.select({
      id: amlAlerts.id,
      typeVi: amlAlertTypes.nameVi,
      typeEn: amlAlertTypes.nameEn,
      typeId: amlAlerts.alertTypeId,
      member: members.name,
      memberId: amlAlerts.memberId,
      country: members.countryCode,
      severity: amlAlerts.severityCode,
      status: amlAlerts.statusCode,
      raisedOn: amlAlerts.raisedOn,
      score: amlAlerts.score,
      agentFlagged: amlAlerts.agentFlagged,
      tier: amlAlerts.tier,
      value: amlAlerts.value,
    })
      .from(amlAlerts)
      .innerJoin(amlAlertTypes, eq(amlAlertTypes.id, amlAlerts.alertTypeId))
      .innerJoin(members, eq(members.id, amlAlerts.memberId))
      .orderBy(asc(amlAlerts.raisedOn)),
    db.select().from(amlAlertTypes).orderBy(asc(amlAlertTypes.id)),
    statusLabelMap(lang),
    db.select({ n: sql<number>`count(*)::int` }).from(members),
  ])

  const high = rows.filter((r) => r.severity === 'high')
  const openAlerts = rows.filter((r) => r.status === 'open' || r.status === 'review')
  const openHigh = high.filter((r) => r.status === 'open' || r.status === 'review')
  const str = rows.filter((r) => r.status === 'str')
  const agentFlagged = rows.filter((r) => r.agentFlagged)
  const agentShare = Math.round((agentFlagged.length / rows.length) * 100)

  const byType = [...rows.reduce((m, r) => {
    const k = lang === 'vi' ? r.typeVi : r.typeEn
    return m.set(k, (m.get(k) ?? 0) + 1)
  }, new Map<string, number>())]
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v)

  /** ui-2.html:3785 — screening coverage; the member count comes from the register. */
  const screening: Array<[string, string, string, string, string]> = [
    ['Danh sách đã rà soát', 'Lists screened', '14',
      'OFAC, EU, UN, UK, VN và danh sách nội bộ', 'OFAC, EU, UN, UK, VN and internal lists'],
    ['Thành viên rà soát / 24 giờ', 'Members rescreened / 24h', num(memberCount[0]?.n ?? 0),
      'cộng toàn bộ UBO đã xác định', 'plus all identified UBOs'],
    ['Trùng khớp cần xem xét', 'Matches for review', '6',
      'tất cả đều đang chờ người quyết định', 'all awaiting a human decision'],
    ['Trùng khớp đã xác nhận', 'Confirmed matches', '0',
      'không thành viên nào bị cấm vận', 'no member is sanctioned'],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành nền tảng · Tuân thủ', 'Platform ops · Compliance')}
        title={t(lang, 'AML / Cấm vận / STR', 'AML / Sanctions / STR')}
        modules={['F12']}
        sub={t(lang,
          'Rà soát cấm vận, giám sát giao dịch và dựng hồ sơ báo cáo giao dịch đáng ngờ. AI phát hiện mẫu hình và dựng bản nháp; cán bộ tuân thủ quyết định chặn hay báo cáo.',
          'Sanctions screening, transaction monitoring and STR drafting. AI detects patterns and drafts; the compliance officer decides to block or report.')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Báo cáo tháng', 'Monthly report')}</span>
            <span className="btn" style={{ borderColor: 'var(--down)', color: 'var(--down)' }}>
              {t(lang, 'Dựng hồ sơ STR', 'Draft an STR')}
            </span>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Cảnh báo 30 ngày', 'Alerts in 30 days')} value={num(rows.length)}
          meta={`${agentShare}% ${t(lang, 'do AI phát hiện', 'AI-detected')}`} metaTone="b" />
        <KpiTile label={t(lang, 'Đang xử lý', 'Under investigation')} value={num(openAlerts.length)}
          meta={t(lang, `${openHigh.length} mức cao`, `${openHigh.length} high severity`)} metaTone="d" />
        <KpiTile label={t(lang, 'Đã báo cáo STR', 'STRs filed')} value={num(str.length)}
          meta={t(lang, '100% có người phê duyệt', '100% human-approved')} metaTone="gd" />
        <KpiTile label={t(lang, 'Tỷ lệ dương tính giả', 'False-positive rate')} value="18.4" unit="%"
          meta={t(lang, 'ngành thường 90%+', 'industry 90%+')} metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian xử lý TB', 'Avg handling time')} value="6.2" unit="h"
          meta="−64%" metaTone="u" />
      </div>

      <div className="grid g-3-2" style={{ marginBottom: 14 }}>
      <DataTable
        id="aml" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Cảnh báo giám sát', 'Surveillance alerts')} rows={rows} pageSize={14}
        searchPlaceholder={t(lang, 'Tìm mã, thành viên…', 'Search reference, member…')}
        search={(r) => `${r.id} ${r.member} ${r.typeVi} ${r.typeEn}`}
        filters={[
          {
            key: 'sev', label: t(lang, 'Mức độ', 'Severity'),
            options: statusOptions(labels, ['high', 'med', 'low']),
            match: (r, v) => r.severity === v,
          },
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['open', 'review', 'closed', 'str']),
            match: (r, v) => r.status === v,
          },
          {
            key: 'ty', label: t(lang, 'Mẫu hình', 'Typology'),
            options: types.map((x) => [String(x.id), lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => String(r.typeId) === v,
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã', 'Reference'), width: '12%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
          {
            key: 'ty', header: t(lang, 'Mẫu hình', 'Typology'), width: '24%',
            sortValue: (r) => (lang === 'vi' ? r.typeVi : r.typeEn),
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.typeVi : r.typeEn}</span>
                {r.agentFlagged ? <div style={{ marginTop: 3 }}><Tag tone="v">{t(lang, 'Agent phát hiện', 'Agent-flagged')}</Tag></div> : null}
              </div>
            ),
          },
          {
            key: 'member', header: t(lang, 'Thành viên', 'Member'), width: '20%', sortValue: (r) => r.member,
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{r.member}</span>
                <div className="muted num">{r.memberId} · {r.country}</div>
              </div>
            ),
          },
          {
            key: 'score', header: t(lang, 'Điểm rủi ro', 'Risk score'), width: '11%', sortValue: (r) => r.score,
            render: (r) => <Meter value={r.score} width={62}
              color={r.score >= 75 ? 'var(--down)' : r.score >= 50 ? 'var(--gold-500)' : 'var(--up)'} />,
          },
          { key: 'value', header: t(lang, 'Giá trị', 'Value'), cls: 'r', width: '10%', sortValue: (r) => Number(r.value), render: (r) => <b className="num">{num(r.value)}</b> },
          { key: 'date', header: t(lang, 'Ngày', 'Raised'), cls: 'c', width: '9%', sortValue: (r) => r.raisedOn, render: (r) => <span className="num">{r.raisedOn}</span> },
          {
            key: 'sev', header: t(lang, 'Mức độ', 'Severity'), cls: 'c', width: '7%', sortValue: (r) => r.severity,
            render: (r) => <Tag tone={tone(labels, r.severity)}>{labels.get(r.severity)?.label ?? r.severity}</Tag>,
          },
          {
            key: 'st', header: t(lang, 'Xử lý', 'Status'), cls: 'c', width: '7%', sortValue: (r) => r.status,
            render: (r) => <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>,
          },
        ]}
      />
        <div className="stack">
          <Card title={t(lang, 'Ranh giới quyết định', 'Decision boundary')}
            right={<TierPill tier={3} lang={lang} />} bodyStyle={{ padding: 11 }}>
            {AML_BOUNDARY.map(([vi, en, color, items]) => (
              <div key={en} style={{ marginBottom: 10 }}>
                <b style={{ fontSize: 12, color }}>{t(lang, vi, en)}</b>
                {items.map(([iVi, iEn]) => (
                  <div key={iEn} style={{ display: 'flex', gap: 7, fontSize: 11.5, padding: '3px 0', color: 'var(--text-2)' }}>
                    <span style={{ color }}>{color === 'var(--up)' ? '✓' : '!'}</span>
                    <span>{t(lang, iVi, iEn)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="note">
              {t(lang,
                'Mức L3 theo phân tầng tự chủ §7.4: hệ thống không được tự quyết. Mọi quyết định lưu decision trace gồm dữ liệu đầu vào đã rút gọn, phiên bản mô hình, người duyệt và nội dung ghi đè.',
                'Tier L3 under the §7.4 autonomy ladder: the system may not decide. Every decision writes a trace with the reduced input, model version, approver and any override.')}
            </div>
          </Card>

          <Card title={t(lang, 'Phân bố cảnh báo theo loại', 'Alerts by type')}>
            {byType.map((x) => (
              <div key={x.k} className="between" style={{ padding: '5px 0' }}>
                <span style={{ fontSize: 11.5, flex: 1 }}>{x.k}</span>
                <div className="meter">
                  <div className="bar" style={{ width: 80 }}>
                    <i style={{ width: `${(x.v / byType[0].v) * 100}%`, background: 'var(--brand-500)' }} />
                  </div>
                  <b>{x.v}</b>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card
        title={t(lang, 'Rà soát cấm vận & danh sách theo dõi', 'Sanctions & watchlist screening')}
        right={
          <span className="sub">
            {t(lang, 'Rà soát lại toàn bộ thành viên mỗi 24 giờ và tại mọi giao dịch',
              'Full member base rescreened every 24 hours and at every transaction')}
          </span>
        }>
        <div className="grid g4">
          {screening.map(([vi, en, value, dVi, dEn]) => (
            <div key={en} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 13 }}>
              <div className="muted">{t(lang, vi, en)}</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 750, margin: '3px 0' }}>{value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{t(lang, dVi, dEn)}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}


/** ui-2.html:3815 — the three dispute tiers, their SLA and how each is decided. */
const DISPUTE_TIERS: Array<{
  tier: 1 | 2 | 3
  vi: string; en: string
  slaVi: string; slaEn: string
  bodyVi: string; bodyEn: string
  color: string; bg: string
}> = [
  {
    tier: 1, vi: 'Tầng 1 · Tự động', en: 'Tier 1 · Automated',
    slaVi: '< 24h', slaEn: '< 24h',
    bodyVi: 'Đối chiếu dữ liệu khách quan: AIS, TOS cảng, cân VGM, mốc chứng từ. Sai lệch rõ ràng được xử lý và bồi hoàn tự động theo biểu phạt đã công bố.',
    bodyEn: 'Objective data reconciliation: AIS, port TOS, VGM weights, document timestamps. Clear-cut cases are settled and compensated automatically against the pre-published penalty schedule.',
    color: 'var(--up)', bg: 'var(--up-bg)',
  },
  {
    tier: 2, vi: 'Tầng 2 · Hoà giải nền tảng', en: 'Tier 2 · Platform mediation',
    slaVi: '3–7 ngày', slaEn: '3–7 days',
    bodyVi: 'Chuyên viên nền tảng chủ trì, hai bên nộp chứng cứ trên hệ thống. Phương án chia sẻ thiệt hại trở thành ràng buộc nếu cả hai chấp thuận.',
    bodyEn: 'A platform officer mediates with evidence filed on-system. A loss-sharing proposal becomes binding if both sides accept.',
    color: 'var(--gold-500)', bg: 'var(--gold-100)',
  },
  {
    tier: 3, vi: 'Tầng 3 · Trọng tài', en: 'Tier 3 · Arbitration',
    slaVi: '30–90 ngày', slaEn: '30–90 days',
    bodyVi: 'Chuyển VIAC hoặc trọng tài hàng hải theo thoả thuận thành viên. Phán quyết được thi hành qua giải toả escrow và điều chỉnh hạn mức giao dịch.',
    bodyEn: 'Referred to VIAC or maritime arbitration per the membership agreement. Awards are enforced through escrow release and trading-limit adjustment.',
    color: 'var(--down)', bg: 'var(--down-bg)',
  },
]

/** ui-2.html:3844 — published before any member trades, so most cases need no argument. */
const PENALTY_SCHEDULE: Array<[string, string, string, string, string, string]> = [
  ['Trễ tàu 1–3 ngày', 'Vessel delay 1–3 days', '2% giá cước', '2% of freight', 'AIS', 'AIS'],
  ['Trễ tàu trên 3 ngày', 'Vessel delay over 3 days', '5% giá cước', '5% of freight', 'AIS', 'AIS'],
  ['Không cấp chỗ đã cam kết', 'Failure to provide committed slot',
    '8% + chênh giá thay thế', '8% + replacement cost', 'TOS + EDI', 'TOS + EDI'],
  ['Sai lệch số lượng container', 'Container count discrepancy',
    'Điều chỉnh theo thực tế', 'Adjusted to actual', 'TOS cảng', 'Port TOS'],
  ['Phụ phí ngoài biểu giá công bố', 'Surcharge outside published tariff',
    'Hoàn toàn bộ phần vượt', 'Full refund of excess', 'Bảng cước', 'Rate card'],
  ['Chậm phát hành B/L trên 48 giờ', 'B/L issuance over 48h late',
    '1% giá cước', '1% of freight', 'Mốc chứng từ', 'Doc timestamps'],
  ['Sai lệch cân VGM', 'VGM weight discrepancy',
    'Chi phí cân lại + phí xử lý', 'Re-weigh cost + handling', 'VGM', 'VGM'],
]

/** x_disp — 3-Tier Disputes (ui-2.html:3818). */
export async function DisputePage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, issues, sources, labels] = await Promise.all([
    db.select({
      id: disputes.id,
      shipment: disputes.shipmentId,
      issueVi: disputeIssueTypes.nameVi,
      issueEn: disputeIssueTypes.nameEn,
      issueId: disputes.issueTypeId,
      sourceVi: evidenceSources.nameVi,
      sourceEn: evidenceSources.nameEn,
      value: disputes.value,
      tier: disputes.tier,
      status: disputes.statusCode,
      days: disputes.days,
      claimant: disputes.claimant,
      respondent: disputes.respondent,
      autoResolved: disputes.autoResolved,
      openedOn: disputes.openedOn,
      lane: shipments.laneCode,
    })
      .from(disputes)
      .innerJoin(disputeIssueTypes, eq(disputeIssueTypes.id, disputes.issueTypeId))
      .innerJoin(evidenceSources, eq(evidenceSources.id, disputes.evidenceSourceId))
      .innerJoin(shipments, eq(shipments.id, disputes.shipmentId))
      .orderBy(asc(disputes.openedOn)),
    db.select().from(disputeIssueTypes).orderBy(asc(disputeIssueTypes.id)),
    db.select().from(evidenceSources).orderBy(asc(evidenceSources.id)),
    statusLabelMap(lang),
  ])

  const open = rows.filter((r) => r.status === 'open')
  const escrowHeld = open.reduce((a, r) => a + Number(r.value), 0)
  const share = (tier: number) =>
    Math.round((rows.filter((r) => r.tier === tier).length / rows.length) * 100)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành nền tảng · Tuân thủ', 'Platform ops · Compliance')}
        title={t(lang, 'Tranh chấp 3 tầng', 'Three-Tier Disputes')}
        added
        sub={t(lang,
          'Phần lớn tranh chấp được phán quyết bằng dữ liệu khách quan trong 24 giờ theo biểu phạt công bố trước. Escrow tự động giữ tiền phần tranh chấp cho tới khi xử lý xong.',
          'Most disputes are adjudicated from objective data within 24 hours against a pre-published penalty schedule. Escrow automatically holds the disputed amount until resolution.')}
        actions={<span className="btn">⬇ {t(lang, 'Xuất báo cáo', 'Export')}</span>}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng tranh chấp 12T', 'Total disputes 12M')} value={num(rows.length)}
          meta={t(lang, 'tỷ lệ 1,4% giao dịch', '1.4% of transactions')} metaTone="u" />
        <KpiTile label={t(lang, 'Xử lý tự động (Tầng 1)', 'Auto-resolved (Tier 1)')} value={num(share(1))}
          unit="%" meta={t(lang, 'trong dưới 24 giờ', 'within 24 hours')} metaTone="u" />
        <KpiTile label={t(lang, 'Thời gian xử lý TB', 'Avg resolution time')} value="2.1"
          unit={t(lang, 'ngày', 'days')} meta={t(lang, 'SLA 7 ngày', 'SLA 7 days')} metaTone="u" />
        <KpiTile label={t(lang, 'Giá trị đang giữ escrow', 'Value held in escrow')}
          value={`${usd(Math.round(escrowHeld / 1000))}K`}
          meta={t(lang, `${num(open.length)} vụ đang mở`, `${num(open.length)} open cases`)} metaTone="gd" />
        <KpiTile label={t(lang, 'Tỷ lệ thực hiện hợp đồng', 'Contract performance')} value="98.6"
          unit="%" meta="+0,4 pp" metaTone="u" />
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        {DISPUTE_TIERS.map((ty) => (
          <div className="card" key={ty.tier}>
            <div className="card-h" style={{ background: ty.bg }}>
              <h3>{t(lang, ty.vi, ty.en)}</h3>
              <Tag tone="n">{t(lang, ty.slaVi, ty.slaEn)}</Tag>
            </div>
            <div className="card-b">
              <div className="between">
                <span className="muted">{t(lang, 'Tỷ lệ vụ việc', 'Share of cases')}</span>
                <b className="num" style={{ fontSize: 22, color: ty.color }}>{share(ty.tier)}%</b>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
                {t(lang, ty.bodyVi, ty.bodyEn)}
              </div>
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px dashed var(--line)' }}>
                <TierPill tier={ty.tier} lang={lang} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid g-3-2">
      <DataTable
        id="disp" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Sổ tranh chấp', 'Dispute register')} rows={rows} pageSize={14}
        searchPlaceholder={t(lang, 'Tìm mã, lô hàng, bên liên quan…', 'Search reference, shipment, party…')}
        search={(r) => `${r.id} ${r.shipment} ${r.claimant} ${r.respondent}`}
        filters={[
          {
            key: 'tier', label: t(lang, 'Tầng', 'Tier'),
            options: [['1', t(lang, 'Tầng 1', 'Tier 1')], ['2', t(lang, 'Tầng 2', 'Tier 2')], ['3', t(lang, 'Tầng 3', 'Tier 3')]],
            match: (r, v) => String(r.tier) === v,
          },
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['open', 'resolved', 'escalated']),
            match: (r, v) => r.status === v,
          },
          {
            key: 'iss', label: t(lang, 'Nguyên nhân', 'Issue'),
            options: issues.map((x) => [String(x.id), lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => String(r.issueId) === v,
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã', 'Reference'), width: '11%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
          {
            key: 'iss', header: t(lang, 'Nguyên nhân', 'Issue'), width: '23%',
            sortValue: (r) => (lang === 'vi' ? r.issueVi : r.issueEn),
            render: (r) => (
              <div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.issueVi : r.issueEn}</span>
                <div className="muted">{r.shipment} · {r.lane}</div>
              </div>
            ),
          },
          {
            key: 'parties', header: t(lang, 'Bên khiếu nại → bị khiếu nại', 'Claimant → respondent'), width: '22%',
            sortValue: (r) => r.claimant,
            render: (r) => (
              <div style={{ fontSize: 11.5 }}>
                <b>{r.claimant}</b>
                <div className="muted">→ {r.respondent}</div>
              </div>
            ),
          },
          {
            key: 'src', header: t(lang, 'Bằng chứng', 'Evidence'), cls: 'c', width: '11%',
            sortValue: (r) => (lang === 'vi' ? r.sourceVi : r.sourceEn),
            render: (r) => <Tag tone="b">{lang === 'vi' ? r.sourceVi : r.sourceEn}</Tag>,
          },
          { key: 'value', header: t(lang, 'Giá trị', 'Value'), cls: 'r', width: '10%', sortValue: (r) => Number(r.value), render: (r) => <b className="num">{usd(r.value)}</b> },
          {
            key: 'tier', header: t(lang, 'Tầng', 'Tier'), cls: 'c', width: '8%', sortValue: (r) => r.tier,
            render: (r) => (
              <div>
                <Tag tone={r.tier === 1 ? 'u' : r.tier === 2 ? 'gd' : 'd'}>T{r.tier}</Tag>
                {r.autoResolved ? <div className="muted" style={{ marginTop: 2 }}>{t(lang, 'tự động', 'auto')}</div> : null}
              </div>
            ),
          },
          { key: 'days', header: t(lang, 'Số ngày', 'Days'), cls: 'r', width: '7%', sortValue: (r) => Number(r.days), render: (r) => <span className="num">{num(r.days, 1)}</span> },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '8%', sortValue: (r) => r.status,
            render: (r) => <Tag tone={tone(labels, r.status)}>{labels.get(r.status)?.label ?? r.status}</Tag>,
          },
        ]}
      />
        <div className="stack">
          <Card title={t(lang, 'Biểu phạt công bố trước', 'Pre-published penalty schedule')}
            bodyStyle={{ padding: 11 }}>
            {PENALTY_SCHEDULE.map(([vi, en, pVi, pEn, sVi, sEn]) => (
              <div key={en} className="between" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 11.5 }}>{t(lang, vi, en)}</b>
                  <div className="muted">{t(lang, 'Nguồn dữ liệu', 'Data source')}: {t(lang, sVi, sEn)}</div>
                </div>
                <b style={{ fontSize: 11.5, color: 'var(--down)', textAlign: 'right', maxWidth: 110 }}>
                  {t(lang, pVi, pEn)}
                </b>
              </div>
            ))}
            <div className="note">
              {t(lang,
                'Biểu phạt được công bố trong Quy tắc nền tảng trước khi thành viên giao dịch. Vì phán quyết dựa trên dữ liệu khách quan mà cả hai bên đều thấy, phần lớn vụ việc không cần tranh luận.',
                'The schedule is published in the Platform Rules before any member trades. Because adjudication rests on objective data both sides can see, most cases need no argument.')}
            </div>
          </Card>

          <Card title={t(lang, 'Vì sao cơ chế này quan trọng', 'Why this matters')}>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
              {t(lang,
                'Khi tàu trễ làm chủ hàng mất hợp đồng, nếu nền tảng không phán quyết nhanh và không giữ được tiền, chủ hàng sẽ quay lại làm việc trực tiếp với hãng tàu — và không quay lại nữa. ',
                'When a delay costs a shipper their contract, a platform that cannot adjudicate quickly and cannot hold the money loses that shipper back to direct carrier dealing — permanently. ')}
              <b>{t(lang, 'Đây là nơi các marketplace thường chết.', 'This is where marketplaces usually die.')}</b>{' '}
              {t(lang,
                'Lợi thế của nền tảng này là nó đã nắm dữ liệu AIS, TOS cảng và mốc chứng từ, nên có thể phán quyết trên dữ kiện khách quan thay vì lời khai.',
                'This platform’s advantage is that it already holds AIS, port TOS and document timestamps, so it can adjudicate on objective fact rather than testimony.')}
            </div>
            <div className="note" style={{ background: 'var(--up-bg)', marginTop: 11 }}>
              <b style={{ color: 'var(--up)' }}>
                {t(lang, 'Escrow là công cụ thi hành', 'Escrow is the enforcement tool')}
              </b><br />
              {t(lang,
                'Khoản tiền tranh chấp bị tách và giữ tự động tại tài khoản escrow của ngân hàng. Bên bị thiệt hại không phải đi đòi nợ; bên bị khiếu nại không bị giữ toàn bộ khoản quyết toán.',
                'The disputed amount is separated and held automatically in the bank escrow account. The injured party never has to chase payment; the respondent does not have their entire settlement withheld.')}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

