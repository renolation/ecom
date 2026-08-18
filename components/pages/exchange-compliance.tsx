import { asc, eq, sql } from 'drizzle-orm'
import { Donut } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, OrgCell, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  amlAlerts, amlAlertTypes, disputes, disputeIssueTypes, evidenceSources, memberTypes,
  members, sectors, shipments,
} from '@/db/schema'
import { num, t, usd, type Lang } from '@/lib/i18n'
import { corridorOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
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
    </>
  )
}

/** x_aml — AML / Sanctions / STR (ui-2.html:3750). */
export async function AmlPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, labels] = await Promise.all([
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
  ])

  const high = rows.filter((r) => r.severity === 'high')
  const openHigh = high.filter((r) => r.status === 'open' || r.status === 'review')
  const str = rows.filter((r) => r.status === 'str')
  const agentFlagged = rows.filter((r) => r.agentFlagged)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Tuân thủ', 'Platform Operations · Compliance')}
        title={t(lang, 'AML / Cấm vận / STR', 'AML / Sanctions / STR')}
        modules={['F12']}
        sub={t(lang,
          'Agent phát hiện mẫu hình và dựng hồ sơ nháp — đây là tác vụ tầng 3, agent không bao giờ tự quyết. Chặn giao dịch hoặc nộp báo cáo STR luôn do cán bộ AML quyết định.',
          'The agent detects patterns and drafts files — a tier-3 task, so it never decides. Blocking a transaction or filing an STR is always the AML officer’s decision.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng cảnh báo', 'Total alerts')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Mức cao đang mở', 'High severity open')} value={num(openHigh.length)}
          meta={t(lang, 'cần xử lý ngay', 'act now')} metaTone="d" />
        <KpiTile label={t(lang, 'Đã nộp STR', 'STR filed')} value={num(str.length)}
          meta={t(lang, 'do cán bộ AML quyết định', 'officer-decided')} metaTone="gd" />
        <KpiTile label={t(lang, 'Agent phát hiện', 'Agent-detected')} value={num(agentFlagged.length)}
          bar={(agentFlagged.length / rows.length) * 100} />
        <KpiTile label={t(lang, 'Giá trị liên quan', 'Exposed value')}
          value={num(rows.reduce((a, r) => a + Number(r.value), 0))} unit={t(lang, 'tr đ', 'm VND')} />
      </div>

      <DataTable
        id="aml" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Cảnh báo AML', 'AML alerts')} rows={rows} pageSize={14}
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
    </>
  )
}

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

  const tiers = [1, 2, 3].map((tier) => {
    const group = rows.filter((r) => r.tier === tier)
    return {
      tier,
      count: group.length,
      resolved: group.filter((r) => r.status === 'resolved').length,
      avgDays: group.reduce((a, r) => a + Number(r.days), 0) / (group.length || 1),
      value: group.reduce((a, r) => a + Number(r.value), 0),
    }
  })

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Vận hành Nền tảng · Tuân thủ', 'Platform Operations · Compliance')}
        title={t(lang, 'Tranh chấp 3 tầng', '3-Tier Disputes')}
        sub={t(lang,
          'Tầng 1 tự phân xử từ bằng chứng khách quan (AIS, TOS cảng, VGM, mốc chứng từ). Tầng 2 hòa giải có người điều phối. Tầng 3 chuyển trọng tài bên ngoài.',
          'Tier 1 adjudicates automatically from objective evidence (AIS, port TOS, VGM, document timestamps). Tier 2 is facilitated mediation. Tier 3 escalates to external arbitration.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng tranh chấp', 'Total disputes')} value={num(rows.length)}
          meta={t(lang, `${num(rows.filter((r) => r.status === 'resolved').length)} đã xử lý`, `${num(rows.filter((r) => r.status === 'resolved').length)} resolved`)} metaTone="u" />
        <KpiTile label={t(lang, 'Đang mở', 'Open')} value={num(rows.filter((r) => r.status === 'open').length)} metaTone="gd" />
        <KpiTile label={t(lang, 'Đã chuyển tầng', 'Escalated')} value={num(rows.filter((r) => r.status === 'escalated').length)} metaTone="d" />
        <KpiTile label={t(lang, 'Giá trị tranh chấp', 'Disputed value')}
          value={usd(rows.reduce((a, r) => a + Number(r.value), 0))} />
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        {tiers.map((x) => (
          <Card key={x.tier} title={t(lang, `Tầng ${x.tier}`, `Tier ${x.tier}`)}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div>
                <b className="num" style={{ fontSize: 24 }}>{num(x.count)}</b>
                <div className="muted">{t(lang, 'hồ sơ', 'cases')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b className="num" style={{ fontSize: 15 }}>{num(x.avgDays, 1)}</b>
                <div className="muted">{t(lang, 'ngày trung bình', 'avg days')}</div>
              </div>
            </div>
            <Meter value={(x.resolved / (x.count || 1)) * 100} width={140} />
            <div className="muted" style={{ marginTop: 6 }}>
              {x.tier === 1 && t(lang, 'Tự phân xử theo bằng chứng khách quan', 'Auto-adjudicated from objective evidence')}
              {x.tier === 2 && t(lang, 'Hòa giải có người điều phối', 'Facilitated mediation')}
              {x.tier === 3 && t(lang, 'Trọng tài bên ngoài', 'External arbitration')}
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        id="disp" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Hồ sơ tranh chấp', 'Dispute cases')} rows={rows} pageSize={14}
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
    </>
  )
}
