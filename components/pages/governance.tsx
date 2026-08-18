import { asc, eq, sql } from 'drizzle-orm'
import { DataTable } from '@/components/table/data-table'
import {
  BoundaryNote, Card, KpiTile, Meter, OrgCell, PageHeader, Tag, TierPill,
} from '@/components/ui'
import { Sparkline, walk } from '@/components/charts'
import { db } from '@/lib/db'
import {
  agentActions, agentRuns, aiAgents, cdpAccounts, cdpMergeQueue, cdpMergeRecords,
  cdpNbaActions, cdpSegments, consentPurposes, decisionRights, licenceMatrix, members,
  memberTypes, sandboxPrograms, sectors,
} from '@/db/schema'
import { num, t, type Lang } from '@/lib/i18n'
import { statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import type { RoutePageProps } from './page-props'

const tone = (labels: Map<string, { label: string; tone: string }>, code: string): Tone =>
  (labels.get(code)?.tone ?? 'n') as Tone

/** r_sandbox — Sandbox matrix (ui-2.html:4470). */
export async function SandboxPage({ lang }: RoutePageProps) {
  const [rows, labels] = await Promise.all([
    db.select().from(sandboxPrograms).orderBy(asc(sandboxPrograms.ord)),
    statusLabelMap(lang),
  ])

  const live = rows.filter((r) => r.statusCode === 'live')
  const totalUsed = rows.reduce((a, r) => a + r.used, 0)
  const totalCap = rows.reduce((a, r) => a + r.cap, 0)
  const nearCap = rows.filter((r) => r.cap > 0 && r.used / r.cap > 0.8)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Cơ quan quản lý · Giám sát', 'Regulator · Supervision')}
        title={t(lang, 'Ma trận Sandbox', 'Sandbox Matrix')}
        sandbox={['SB']}
        sub={t(lang,
          'Tám nghiệp vụ thử nghiệm theo Phụ lục 1 của đề án. Mỗi nghiệp vụ có trần khối lượng, nhóm tham gia và biện pháp kiểm soát riêng.',
          'The eight sandbox use cases from Appendix 1. Each carries its own volume cap, participant set and control measures.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Nghiệp vụ', 'Use cases')} value={num(rows.length)}
          meta={t(lang, `${num(live.length)} đang chạy`, `${num(live.length)} live`)} metaTone="u" />
        <KpiTile label={t(lang, 'Đã sử dụng', 'Consumed')} value={num(totalUsed)}
          meta={t(lang, `trần ${num(totalCap)}`, `cap ${num(totalCap)}`)} />
        <KpiTile label={t(lang, 'Mức dùng chung', 'Overall utilisation')}
          value={num((totalUsed / totalCap) * 100, 1)} unit="%" bar={(totalUsed / totalCap) * 100} />
        <KpiTile label={t(lang, 'Gần chạm trần', 'Near cap')} value={num(nearCap.length)}
          meta={t(lang, 'trên 80% hạn mức', 'above 80% of cap')} metaTone={nearCap.length ? 'd' : 'u'} />
      </div>

      <div className="stack">
        {rows.map((s) => (
          <Card key={s.code}>
            <div className="between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div className="flex" style={{ gap: 8 }}>
                  <b className="num" style={{ fontSize: 13 }}>{s.code}</b>
                  <b style={{ fontSize: 13 }}>{lang === 'vi' ? s.nameVi : s.nameEn}</b>
                  <Tag tone={tone(labels, s.statusCode)}>{labels.get(s.statusCode)?.label ?? s.statusCode}</Tag>
                  {s.moduleCode ? <span className="mod">{s.moduleCode}</span> : null}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {t(lang, 'Bên tham gia', 'Participants')}: {lang === 'vi' ? s.participantsVi : s.participantsEn}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                {s.cap > 0 ? (
                  <>
                    <b className="num" style={{ fontSize: 16 }}>{num(s.used)} / {num(s.cap)}</b>
                    <Meter value={(s.used / s.cap) * 100} width={130} />
                  </>
                ) : <span className="muted">{t(lang, 'Chưa kích hoạt', 'Not activated')}</span>}
              </div>
            </div>
            <div className="grid g2" style={{ gap: 12 }}>
              <div style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 9 }}>
                <div className="muted" style={{ marginBottom: 3 }}>{t(lang, 'Phạm vi chức năng', 'Functional scope')}</div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? s.featuresVi : s.featuresEn}</span>
              </div>
              <div style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 9 }}>
                <div className="muted" style={{ marginBottom: 3 }}>{t(lang, 'Biện pháp kiểm soát', 'Control measures')}</div>
                <span style={{ fontSize: 12 }}>{lang === 'vi' ? s.controlsVi : s.controlsEn}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

/** r_license — Licence & responsibility matrix (ui-2.html:4551). */
export async function LicencePage({ lang }: RoutePageProps) {
  const [licence, decisions] = await Promise.all([
    db.select().from(licenceMatrix).orderBy(asc(licenceMatrix.ord)),
    db.select().from(decisionRights).orderBy(asc(decisionRights.ord)),
  ])

  const flagCell = (flag: string) => flag === 'n'
    ? <Tag tone="u">{t(lang, 'Không', 'No')}</Tag>
    : flag === 'p'
      ? <Tag tone="gd">{t(lang, 'Nếu làm đại lý', 'If acting as agent')}</Tag>
      : <Tag tone="d">{t(lang, 'Có', 'Yes')}</Tag>

  const rightCell = (v: string) => v === 'y'
    ? <span style={{ color: 'var(--up)', fontWeight: 700 }}>●</span>
    : v === 'p'
      ? <span style={{ color: 'var(--gold-500)', fontWeight: 700 }}>◐</span>
      : <span style={{ color: 'var(--text-3)' }}>○</span>

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Cơ quan quản lý · Giám sát', 'Regulator · Supervision')}
        title={t(lang, 'Ma trận giấy phép & trách nhiệm', 'Licence & Responsibility Matrix')}
        sub={t(lang,
          'Ai chịu trách nhiệm cho việc gì. Nền tảng là lớp công nghệ, phân phối, dữ liệu và điều phối — không thực hiện hoạt động cần giấy phép nếu chưa được cấp.',
          'Who is responsible for what. The platform is the technology, distribution, data and orchestration layer — it does not perform licensed activities it is not licensed for.')}
      />

      <Card title={t(lang, 'Ma trận giấy phép theo dịch vụ', 'Licence matrix by service')} bodyStyle={{ padding: 0 }}>
        <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '19%' }}>{t(lang, 'Dịch vụ', 'Service')}</th>
                <th style={{ width: '27%' }}>{t(lang, 'Chủ thể chịu trách nhiệm', 'Responsible entity')}</th>
                <th style={{ width: '34%' }}>{t(lang, 'Vai trò của nền tảng', 'Platform role')}</th>
                <th className="c" style={{ width: '12%' }}>{t(lang, 'Nền tảng cần giấy phép?', 'Platform licence needed?')}</th>
                <th className="c" style={{ width: '8%' }}>Module</th>
              </tr>
            </thead>
            <tbody>
              {licence.map((r) => (
                <tr key={r.id}>
                  <td><b style={{ fontSize: 12 }}>{lang === 'vi' ? r.serviceVi : r.serviceEn}</b></td>
                  <td style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.responsibleVi : r.responsibleEn}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{lang === 'vi' ? r.platformRoleVi : r.platformRoleEn}</td>
                  <td className="c">{flagCell(r.licenceNeededFlag)}</td>
                  <td className="c">{r.moduleCodes ? <span className="mod">{r.moduleCodes}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <Card title={t(lang, 'Ai quyết định việc gì', 'Who decides what')} bodyStyle={{ padding: 0 }}>
          <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>{t(lang, 'Vấn đề', 'Matter')}</th>
                  <th className="c">{t(lang, 'Nền tảng', 'Platform')}</th>
                  <th className="c">{t(lang, 'NCC', 'Provider')}</th>
                  <th className="c">{t(lang, 'Ngân hàng', 'Bank')}</th>
                  <th className="c">{t(lang, 'Bảo hiểm', 'Insurer')}</th>
                  <th className="c">{t(lang, 'Cơ quan QL', 'Regulator')}</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12 }}>{lang === 'vi' ? r.matterVi : r.matterEn}</td>
                    <td className="c">{rightCell(r.platform)}</td>
                    <td className="c">{rightCell(r.provider)}</td>
                    <td className="c">{rightCell(r.bank)}</td>
                    <td className="c">{rightCell(r.insurer)}</td>
                    <td className="c">{rightCell(r.regulator)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f">
            <span style={{ color: 'var(--up)' }}>●</span> {t(lang, 'quyết định', 'decides')}
            {' · '}
            <span style={{ color: 'var(--gold-500)' }}>◐</span> {t(lang, 'tham gia một phần', 'partial')}
            {' · '}
            <span style={{ color: 'var(--text-3)' }}>○</span> {t(lang, 'không quyết định', 'does not decide')}
          </div>
        </Card>
      </div>
    </>
  )
}

/** a_agents — AI Agent Governance (ui-2.html:4633). */
export async function AgentGovernancePage({ lang, basePath, searchParams }: RoutePageProps) {
  const [agents, runs, actions, labels] = await Promise.all([
    db.select().from(aiAgents).orderBy(asc(aiAgents.id)),
    db.select({
      id: agentRuns.id,
      agentId: agentRuns.agentId,
      agentVi: aiAgents.nameVi,
      agentEn: aiAgents.nameEn,
      icon: aiAgents.icon,
      actionVi: agentActions.nameVi,
      actionEn: agentActions.nameEn,
      tier: agentRuns.tier,
      outcome: agentRuns.outcomeCode,
      confidence: agentRuns.confidence,
      durationMs: agentRuns.durationMs,
      runAt: agentRuns.runAt,
      approver: agentRuns.approver,
      model: agentRuns.model,
      shipment: agentRuns.shipmentId,
    })
      .from(agentRuns)
      .innerJoin(aiAgents, eq(aiAgents.id, agentRuns.agentId))
      .innerJoin(agentActions, eq(agentActions.id, agentRuns.actionId))
      .orderBy(asc(agentRuns.runAt)),
    db.select().from(agentActions).orderBy(asc(agentActions.id)),
    statusLabelMap(lang),
  ])

  const overrides = runs.filter((r) => r.outcome === 'override')
  const escalated = runs.filter((r) => r.outcome === 'esc')
  const tier3 = runs.filter((r) => r.tier === 3)
  const avgConfidence = runs.reduce((a, r) => a + r.confidence, 0) / runs.length

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Trí tuệ nhân tạo · Quản trị', 'Artificial intelligence · Governance')}
        title={t(lang, 'Quản trị AI Agent', 'AI Agent Governance')}
        modules={['F15']}
        sub={t(lang,
          'Bảy agent chuyên trách, phân theo ba tầng thẩm quyền. Tầng 1 tự động; tầng 2 chỉ đề xuất; tầng 3 không bao giờ tự quyết — luôn phải có người phê duyệt có tên.',
          'Seven specialised agents across three authority tiers. Tier 1 acts automatically; tier 2 only advises; tier 3 never decides — a named human always approves.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Agent', 'Agents')} value={num(agents.length)} />
        <KpiTile label={t(lang, 'Lượt chạy', 'Runs logged')} value={num(runs.length)} />
        <KpiTile label={t(lang, 'Tầng 3', 'Tier 3')} value={num(tier3.length)}
          meta={t(lang, 'luôn có người duyệt', 'always human-approved')} metaTone="u" />
        <KpiTile label={t(lang, 'Người ghi đè', 'Human overrides')} value={num(overrides.length)}
          bar={(overrides.length / runs.length) * 100} />
        <KpiTile label={t(lang, 'Độ tin cậy TB', 'Average confidence')} value={num(avgConfidence, 1)} unit="%"
          meta={t(lang, `${num(escalated.length)} chuyển cấp`, `${num(escalated.length)} escalated`)} metaTone="gd" />
      </div>

      <Card title={t(lang, 'Bảy AI sub-agent và giới hạn thẩm quyền', 'The seven sub-agents and their authority limits')}
        bodyStyle={{ padding: 0 }}>
        <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Agent</th>
                <th style={{ width: '24%' }}>{t(lang, 'Nhiệm vụ', 'Task')}</th>
                <th style={{ width: '28%' }}>{t(lang, 'Giới hạn thẩm quyền', 'Authority limit')}</th>
                <th className="c" style={{ width: '8%' }}>{t(lang, 'Tầng', 'Tier')}</th>
                <th className="r" style={{ width: '8%' }}>{t(lang, 'Lượt chạy', 'Runs')}</th>
                <th style={{ width: '14%' }}>{t(lang, 'Chính xác / ghi đè', 'Accuracy / override')}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="flex" style={{ gap: 7 }}>
                      <span style={{ fontSize: 16 }}>{a.icon}</span>
                      <b style={{ fontSize: 12 }}>{lang === 'vi' ? a.nameVi : a.nameEn}</b>
                    </div>
                  </td>
                  <td style={{ fontSize: 11.5 }}>{lang === 'vi' ? a.taskVi : a.taskEn}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{lang === 'vi' ? a.controlVi : a.controlEn}</td>
                  <td className="c">
                    <Tag tone={a.tier === 1 ? 'u' : a.tier === 2 ? 'gd' : 'd'}>
                      L{a.tier}
                    </Tag>
                  </td>
                  <td className="r num">{num(a.runs)}</td>
                  <td>
                    <Meter value={Number(a.accuracy)} width={70} />
                    <div className="muted num">{t(lang, 'ghi đè', 'override')} {num(a.overrideRate, 1)}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="run" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Nhật ký lượt chạy', 'Run log')} rows={runs} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm mã, người duyệt, mô hình…', 'Search reference, approver, model…')}
          search={(r) => `${r.id} ${r.approver} ${r.model} ${r.shipment}`}
          filters={[
            {
              key: 'tier', label: t(lang, 'Tầng', 'Tier'),
              options: [['1', 'L1'], ['2', 'L2'], ['3', 'L3']],
              match: (r, v) => String(r.tier) === v,
            },
            {
              key: 'out', label: t(lang, 'Kết quả', 'Outcome'),
              options: statusOptions(labels, ['auto', 'approved', 'override', 'esc']),
              match: (r, v) => r.outcome === v,
            },
            {
              key: 'agent', label: 'Agent',
              options: agents.map((a) => [String(a.id), lang === 'vi' ? a.nameVi : a.nameEn]),
              match: (r, v) => String(r.agentId) === v,
            },
          ]}
          columns={[
            { key: 'id', header: t(lang, 'Mã', 'Reference'), width: '11%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 11.5 }}>{r.id}</b> },
            {
              key: 'agent', header: 'Agent', width: '18%', sortValue: (r) => (lang === 'vi' ? r.agentVi : r.agentEn),
              render: (r) => (
                <div className="flex" style={{ gap: 6 }}>
                  <span>{r.icon}</span>
                  <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.agentVi : r.agentEn}</span>
                </div>
              ),
            },
            {
              key: 'act', header: t(lang, 'Hành động', 'Action'), width: '21%',
              sortValue: (r) => (lang === 'vi' ? r.actionVi : r.actionEn),
              render: (r) => (
                <div>
                  <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.actionVi : r.actionEn}</span>
                  <div className="muted num">{r.shipment}</div>
                </div>
              ),
            },
            { key: 'conf', header: t(lang, 'Tin cậy', 'Confidence'), width: '10%', sortValue: (r) => r.confidence, render: (r) => <Meter value={r.confidence} width={56} /> },
            { key: 'ms', header: t(lang, 'Thời gian', 'Duration'), cls: 'r', width: '8%', sortValue: (r) => r.durationMs, render: (r) => <span className="num">{num(r.durationMs)}ms</span> },
            {
              key: 'approver', header: t(lang, 'Người duyệt', 'Approver'), width: '13%', sortValue: (r) => r.approver,
              render: (r) => r.approver === '—'
                ? <span className="muted">{t(lang, 'tự động', 'automated')}</span>
                : <span style={{ fontSize: 11.5 }}>{r.approver}</span>,
            },
            { key: 'tier', header: t(lang, 'Tầng', 'Tier'), cls: 'c', width: '7%', sortValue: (r) => r.tier, render: (r) => <Tag tone={r.tier === 1 ? 'u' : r.tier === 2 ? 'gd' : 'd'}>L{r.tier}</Tag> },
            {
              key: 'out', header: t(lang, 'Kết quả', 'Outcome'), cls: 'c', width: '12%', sortValue: (r) => r.outcome,
              render: (r) => <Tag tone={tone(labels, r.outcome)}>{labels.get(r.outcome)?.label ?? r.outcome}</Tag>,
            },
          ]}
        />
      </div>
    </>
  )
}

/** a_gov — Neutrality & Data (ui-2.html:4719). */
export async function NeutralityPage({ lang }: RoutePageProps) {
  const [purposes, decisions, agents] = await Promise.all([
    db.select().from(consentPurposes).orderBy(asc(consentPurposes.ord)),
    db.select().from(decisionRights).orderBy(asc(decisionRights.ord)),
    db.select({ tier: aiAgents.tier, n: sql<number>`count(*)::int` }).from(aiAgents).groupBy(aiAgents.tier),
  ])

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Quản trị nền tảng', 'Platform governance')}
        title={t(lang, 'Trung lập & Dữ liệu', 'Neutrality & Data')}
        sub={t(lang,
          'Nền tảng vận hành như hạ tầng chung: không ưu tiên bên nào, không dùng dữ liệu của một thành viên để cạnh tranh với chính họ.',
          'The platform runs as shared infrastructure: it favours no participant and never uses one member’s data to compete against them.')}
      />

      <BoundaryNote lang={lang}>
        {t(lang,
          ' — dữ liệu giao dịch của mỗi thành viên bị cô lập theo mặc định. Chỉ số giá chỉ dùng dữ liệu đã ẩn danh và tổng hợp; không có đường nào để một thành viên đọc được giao dịch của thành viên khác.',
          ' — each member’s transaction data is isolated by default. The price index consumes only anonymised, aggregated data; there is no path for one member to read another’s transactions.')}
      </BoundaryNote>

      <div className="grid g4" style={{ margin: '14px 0' }}>
        <KpiTile label={t(lang, 'Mục đích xử lý dữ liệu', 'Processing purposes')} value={num(purposes.length)}
          meta={t(lang, `${num(purposes.filter((p) => p.revocable).length)} có thể thu hồi`, `${num(purposes.filter((p) => p.revocable).length)} revocable`)} metaTone="u" />
        <KpiTile label={t(lang, 'Quyết định có ràng buộc', 'Governed decisions')} value={num(decisions.length)}
          meta={t(lang, 'phân định rõ chủ thể', 'clear ownership')} />
        <KpiTile label={t(lang, 'Agent tầng 3', 'Tier-3 agents')}
          value={num(agents.find((a) => a.tier === 3)?.n ?? 0)}
          meta={t(lang, 'không tự quyết', 'never decide alone')} metaTone="d" />
        <KpiTile label={t(lang, 'Agent tầng 1', 'Tier-1 agents')}
          value={num(agents.find((a) => a.tier === 1)?.n ?? 0)}
          meta={t(lang, 'tự động, có thể ghi đè', 'automated, overridable')} metaTone="b" />
      </div>

      <div className="grid g2">
        <Card title={t(lang, 'Nguyên tắc trung lập', 'Neutrality principles')}>
          <div className="stack" style={{ gap: 10 }}>
            {[
              [t(lang, 'Không tự doanh', 'No proprietary trading'),
                t(lang, 'Nền tảng không mua bán chỗ trên chính sàn của mình.', 'The platform does not buy or sell slots on its own exchange.')],
              [t(lang, 'Xếp hạng minh bạch', 'Transparent ranking'),
                t(lang, 'Thứ tự hiển thị dựa trên giá, thời gian và độ tin cậy — không bán vị trí.', 'Ordering follows price, transit and reliability — placement is not for sale.')],
              [t(lang, 'Chỉ số độc lập', 'Independent index'),
                t(lang, 'Phương pháp tính do hội đồng chỉ số độc lập giám sát.', 'Methodology is overseen by an independent index committee.')],
              [t(lang, 'Dữ liệu thuộc về thành viên', 'Member-owned data'),
                t(lang, 'Thành viên có quyền mang dữ liệu đi và thu hồi đồng ý bất cứ lúc nào.', 'Members can port their data out and revoke consent at any time.')],
            ].map(([title, body]) => (
              <div key={title} style={{ padding: 11, background: 'var(--surface-2)', borderRadius: 10 }}>
                <b style={{ fontSize: 12.5 }}>{title}</b>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{body}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t(lang, 'Mục đích xử lý & cơ sở pháp lý', 'Processing purposes & legal basis')} bodyStyle={{ padding: 0 }}>
          <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, 'Mục đích', 'Purpose')}</th>
                  <th>{t(lang, 'Bên nhận', 'Counterparty')}</th>
                  <th className="c">{t(lang, 'Lưu giữ', 'Retention')}</th>
                  <th className="c">{t(lang, 'Thu hồi', 'Revocable')}</th>
                </tr>
              </thead>
              <tbody>
                {purposes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b style={{ fontSize: 11.5 }}>{lang === 'vi' ? p.purposeVi : p.purposeEn}</b>
                      <div className="muted">{lang === 'vi' ? p.legalBasisVi : p.legalBasisEn}</div>
                    </td>
                    <td style={{ fontSize: 11.5 }}>{p.counterparty}</td>
                    <td className="c num">{p.retentionMonths ? `${p.retentionMonths}${t(lang, ' th', 'mo')}` : '—'}</td>
                    <td className="c">
                      {p.revocable
                        ? <Tag tone="u">{t(lang, 'Có', 'Yes')}</Tag>
                        : <Tag tone="n">{t(lang, 'Theo hợp đồng', 'Contractual')}</Tag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

/** ui-2.html:4827 — the six source systems feeding the lakehouse, with freshness. */
const CDP_SOURCES: Array<[string, string, string, string, string, string, number]> = [
  ['TOS cảng', 'TOS port', 'Sự kiện hạ bãi, xếp dỡ, sản lượng', 'Gate, handling and volume events',
    'API stream', 'API stream', 99.2],
  ['Oracle EBS', 'Oracle EBS', 'Hoá đơn, khoản phải thu, hợp đồng', 'Invoices, receivables, contracts',
    'API/batch', 'API/batch', 99.6],
  ['CRM / Forwarding', 'CRM / Forwarding', 'Liên hệ, cơ hội, lịch sử tương tác',
    'Contacts, opportunities, interaction history', 'API pull', 'API pull', 98.4],
  ['Nhà cung cấp AIS', 'AIS provider', 'Vị trí tàu, ETA, hành trình', 'Vessel position, ETA, voyage',
    'API stream', 'API stream', 97.1],
  ['EDI manifest', 'EDI manifest', 'Danh sách hàng theo chuyến', 'Cargo manifest by voyage',
    'API + trích xuất', 'API + parser', 96.8],
  ['Nền tảng VLX', 'VLX platform', 'Chỉ giao dịch của Gemadept trên nền tảng',
    'Only Gemadept’s own platform transactions', 'API', 'API', 99.9],
]

/** ui-2.html:4820 — segment cards cycle through these icons and bar colours. */
const SEGMENT_ICONS = ['⭐', '🔀', '🚢', '🌏', '⚠️', '💤']
const SEGMENT_COLORS = ['var(--up)', 'var(--brand-500)', 'var(--violet)', 'var(--gold-500)', 'var(--down)', 'var(--text-3)']

/** cdp_360 — Unified Customers, Gemadept member view (ui-2.html:4792). */
export async function CdpUnifiedPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, segments, queue, records, labels, memberTypeRows] = await Promise.all([
    db.select({
      memberId: cdpAccounts.memberId,
      member: members.name,
      memberType: members.typeCode,
      teu: members.teu,
      sectorVi: sectors.nameVi,
      sectorEn: sectors.nameEn,
      segmentId: cdpAccounts.segmentId,
      segmentVi: cdpSegments.nameVi,
      segmentEn: cdpSegments.nameEn,
      shareOfWallet: cdpAccounts.shareOfWallet,
      revenue: cdpAccounts.revenue,
      trend: cdpAccounts.trend,
      churn: cdpAccounts.churnRiskCode,
      sourceCount: cdpAccounts.sourceCount,
      confidence: cdpAccounts.confidence,
      isMerged: cdpAccounts.isMerged,
      services: cdpAccounts.services,
      nbaVi: cdpNbaActions.nameVi,
      nbaEn: cdpNbaActions.nameEn,
    })
      .from(cdpAccounts)
      .innerJoin(members, eq(members.id, cdpAccounts.memberId))
      .innerJoin(sectors, eq(sectors.id, members.sectorId))
      .innerJoin(cdpSegments, eq(cdpSegments.id, cdpAccounts.segmentId))
      .innerJoin(cdpNbaActions, eq(cdpNbaActions.id, cdpAccounts.nbaActionId))
      .orderBy(asc(cdpAccounts.memberId)),
    db.select().from(cdpSegments).orderBy(asc(cdpSegments.id)),
    db.select().from(cdpMergeQueue).orderBy(asc(cdpMergeQueue.ord)),
    db.select().from(cdpMergeRecords).orderBy(asc(cdpMergeRecords.queueId), asc(cdpMergeRecords.ord)),
    statusLabelMap(lang),
    db.select({ code: memberTypes.code, nameVi: memberTypes.nameVi, nameEn: memberTypes.nameEn })
      .from(memberTypes).orderBy(asc(memberTypes.ord)),
  ])

  const serviceIcons: Array<[string, string]> = [
    ['port', '⚓'], ['truck', '🚛'], ['wh', '🏭'], ['cold', '❄️'], ['air', '✈️'],
  ]
  const typeName = new Map(memberTypeRows.map((r) => [r.code, lang === 'vi' ? r.nameVi : r.nameEn]))
  const avgSow = rows.reduce((a, r) => a + r.shareOfWallet, 0) / rows.length

  const segmentCounts = [...rows.reduce((m, r) => {
    const k = lang === 'vi' ? r.segmentVi : r.segmentEn
    return m.set(k, (m.get(k) ?? 0) + 1)
  }, new Map<string, number>())]
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'CDP 360 · Thành viên Gemadept', 'CDP 360 · Gemadept member view')}
        title={t(lang, 'Khách hàng hợp nhất', 'Unified Customers')}
        modules={['F11']}
        sub={t(lang,
          'Định danh hợp nhất cấp tài khoản theo mã số thuế và cây tập đoàn. AI đề xuất hợp nhất, con người phê duyệt. Nền tảng dùng lại thiết kế này cho module định danh của mình, nhưng dữ liệu tách biệt.',
          'Account-level identity resolution by tax ID and corporate tree. AI proposes merges, humans approve. The platform reuses this design for its own identity module, but the data stays separate.')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Xuất danh sách', 'Export')}</span>
            <span className="btn p">{t(lang, 'Mời khách hàng lên nền tảng', 'Invite customers to the platform')}</span>
          </>
        }
      />

      <BoundaryNote lang={lang}>
        {t(lang,
          'Toàn bộ dữ liệu trên màn hình này thuộc phạm vi thành viên Gemadept: chỉ các giao dịch giữa Gemadept và khách hàng của Gemadept. CDP không phải hệ thống chủ dữ liệu khách hàng của nền tảng và không thấy dữ liệu của hãng tàu hay ngân hàng khác. Dùng dữ liệu này cho tiếp thị cần sự đồng ý riêng của từng khách hàng.',
          'Everything on this screen is within Gemadept’s member scope: only transactions between Gemadept and Gemadept’s own customers. The CDP is not the platform’s customer master and cannot see other carriers’ or banks’ data. Using this data for marketing requires each customer’s separate consent.')}
      </BoundaryNote>

      <div className="grid g5" style={{ margin: '14px 0' }}>
        <KpiTile label={t(lang, 'Hồ sơ hợp nhất', 'Unified profiles')} value={num(rows.length)}
          meta={t(lang, '+39 tháng này', '+39 this month')} metaTone="u" spark={walk(96, 20, 0.05, 61)} />
        <KpiTile label={t(lang, 'Tỷ lệ khớp định danh', 'Identity match rate')} value="96.4" unit="%"
          meta={t(lang, 'AI đề xuất, người duyệt', 'AI-proposed, human-approved')} metaTone="u" />
        <KpiTile label={t(lang, 'Bản ghi nguồn', 'Source records')} value="214.5K"
          meta="TOS · Oracle EBS · CRM · AIS · EDI" />
        <KpiTile label={t(lang, 'Chờ người duyệt', 'Awaiting approval')} value={num(queue.length)}
          meta={t(lang, 'không tự động hợp nhất', 'no automatic merging')} metaTone="gd" />
        <KpiTile label={t(lang, 'Share-of-wallet bình quân', 'Average share of wallet')}
          value={num(avgSow, 0)} unit="%"
          meta={t(lang, 'còn dư địa bán chéo', 'cross-sell headroom')} metaTone="b" />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 14 }}>
        <Card title={`🧩 ${t(lang, 'Hàng đợi hợp nhất định danh', 'Identity merge queue')}`}
          right={<TierPill tier={2} lang={lang} />} bodyStyle={{ padding: 12 }}>
          {queue.map((q) => (
            <div key={q.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 11, marginBottom: 8 }}>
              <div className="between">
                <b style={{ fontSize: 12.5 }}>{q.goldenName}</b>
                <Tag tone={q.confidence >= 90 ? 'u' : q.confidence >= 80 ? 'b' : 'gd'}>
                  AI · {t(lang, 'tin cậy', 'confidence')} {q.confidence}%
                </Tag>
              </div>
              <div className="muted num" style={{ marginTop: 3 }}>{t(lang, 'MST', 'Tax ID')} {q.taxIdMasked}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {records.filter((r) => r.queueId === q.id).length} {t(lang, 'bản ghi', 'records')}:{' '}
                {records.filter((r) => r.queueId === q.id)
                  .map((r) => `“${r.sourceRecord}”`).join(' · ')}
              </div>
              <div className="flex" style={{ marginTop: 8, alignItems: 'center' }}>
                <span className="btn xs p">{t(lang, 'Hợp nhất', 'Merge')}</span>
                <span className="btn xs">{t(lang, 'Tách riêng', 'Keep separate')}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>
                  {t(lang, 'Cần người phê duyệt', 'Requires human approval')}
                </span>
              </div>
            </div>
          ))}
          <div className="note">
            {t(lang,
              'AI không được tự hợp nhất hồ sơ. Hợp nhất sai làm sai lệch hạn mức tín dụng, share-of-wallet và mọi phân tích phía sau — nên bước này chạy ở tầng L2 với phê duyệt bắt buộc của con người.',
              'AI may not merge profiles on its own. A wrong merge distorts credit limits, share of wallet and every downstream analysis — so this runs at tier L2 with mandatory human approval.')}
          </div>
        </Card>

        <div className="stack">
          <Card title={t(lang, 'Phân khúc AI', 'AI segments')} bodyStyle={{ padding: 11 }}>
            {segmentCounts.map((x, i) => (
              <div key={x.k} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '8px 10px', marginBottom: 7 }}>
                <div className="between">
                  <b style={{ fontSize: 12 }}>{SEGMENT_ICONS[i % 6]} {x.k}</b>
                  <b className="num" style={{ fontSize: 15 }}>{x.v}</b>
                </div>
                <div className="bar" style={{ marginTop: 5 }}>
                  <i style={{ width: `${(x.v / segmentCounts[0].v) * 100}%`, background: SEGMENT_COLORS[i % 6] }} />
                </div>
              </div>
            ))}
          </Card>

          <Card title={t(lang, 'Nguồn dữ liệu', 'Data sources')} bodyStyle={{ padding: 11 }}>
            {CDP_SOURCES.map(([nVi, nEn, dVi, dEn, mVi, mEn, freshness]) => (
              <div key={nEn} style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                <div className="between">
                  <b style={{ fontSize: 11.5 }}>{t(lang, nVi, nEn)}</b>
                  <span className="qtag">{t(lang, mVi, mEn)}</span>
                </div>
                <div className="muted">{t(lang, dVi, dEn)}</div>
                <div style={{ marginTop: 4 }}>
                  <Meter value={freshness} color={freshness > 98 ? 'var(--up)' : 'var(--gold-500)'} width={80} />
                </div>
              </div>
            ))}
            <div className="note">
              {t(lang,
                'Kiến trúc Bronze → Silver → Gold trên lakehouse, mọi tín hiệu có lineage và điểm tin cậy, triển khai on-prem theo yêu cầu bảo vệ dữ liệu.',
                'Bronze → Silver → Gold lakehouse architecture, every signal carries lineage and a confidence score, deployed on-premises to meet data-protection requirements.')}
            </div>
          </Card>
        </div>
      </div>

      <DataTable
        id="cdp" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Khách hàng hợp nhất — Account 360', 'Unified customers — Account 360')}
        rows={rows} pageSize={15}
        searchPlaceholder={t(lang, 'Tìm khách hàng, phân khúc, ngành…', 'Search customer, segment, sector…')}
        search={(r) => `${r.member} ${r.segmentVi} ${r.segmentEn} ${typeName.get(r.memberType) ?? ''} ${r.sectorVi} ${r.sectorEn}`}
        filters={[
          {
            key: 'seg', label: t(lang, 'Phân khúc', 'Segment'),
            options: segments.map((s) => [String(s.id), lang === 'vi' ? s.nameVi : s.nameEn]),
            match: (r, v) => String(r.segmentId) === v,
          },
          {
            key: 'churn', label: t(lang, 'Rủi ro rời bỏ', 'Churn risk'),
            options: statusOptions(labels, ['low', 'med', 'high']),
            match: (r, v) => r.churn === v,
          },
          {
            key: 'ty', label: t(lang, 'Loại', 'Type'),
            options: memberTypeRows.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn] as [string, string]),
            match: (r, v) => r.memberType === v,
          },
        ]}
        columns={[
          {
            key: 'n', header: t(lang, 'Khách hàng', 'Customer'), width: '21%',
            sortValue: (r) => r.member,
            render: (r) => (
              <div>
                <OrgCell name={r.member} />
                <div className="muted" style={{ marginLeft: 36 }}>{lang === 'vi' ? r.sectorVi : r.sectorEn}</div>
              </div>
            ),
          },
          {
            key: 'seg', header: t(lang, 'Phân khúc', 'Segment'), width: '15%',
            sortValue: (r) => r.segmentId,
            render: (r) => <Tag tone="b">{lang === 'vi' ? r.segmentVi : r.segmentEn}</Tag>,
          },
          {
            key: 'sow', header: t(lang, 'Share of wallet', 'Share of wallet'), width: '12%',
            sortValue: (r) => r.shareOfWallet,
            render: (r) => (
              <Meter value={r.shareOfWallet} width={72}
                color={r.shareOfWallet > 70 ? 'var(--up)' : r.shareOfWallet > 45 ? 'var(--gold-500)' : 'var(--down)'} />
            ),
          },
          {
            key: 'rev', header: t(lang, 'Doanh thu 12T', '12M revenue'), cls: 'r', width: '10%',
            sortValue: (r) => Number(r.revenue),
            render: (r) => <><b className="num">{num(r.revenue)}</b> {t(lang, 'tỷ', 'bn')}</>,
          },
          {
            key: 'teu', header: 'TEU YTD', cls: 'r', width: '8%',
            sortValue: (r) => r.teu,
            render: (r) => <span className="num">{num(r.teu)}</span>,
          },
          {
            key: 'svc', header: t(lang, 'Dịch vụ đang dùng', 'Services used'), cls: 'c', width: '12%',
            sortValue: (r) => serviceIcons.filter(([k]) => (r.services as Record<string, boolean>)[k]).length,
            render: (r) => (
              <span>
                {serviceIcons.map(([k, icon]) => (
                  <span key={k} style={{ opacity: (r.services as Record<string, boolean>)[k] ? 1 : 0.2, fontSize: 13 }}>
                    {icon}{' '}
                  </span>
                ))}
              </span>
            ),
          },
          {
            key: 'trend', header: t(lang, 'Xu hướng', 'Trend'), cls: 'c', width: '9%',
            sortValue: (r) => Number(r.trend),
            render: (r) => (
              <Sparkline
                values={walk(10, 14, Number(r.trend) > 0 ? 0.14 : 0.16, r.teu / 100)}
                width={64} height={20}
                color={Number(r.trend) > 0 ? 'var(--up)' : 'var(--down)'}
              />
            ),
          },
          {
            key: 'churn', header: t(lang, 'Rủi ro rời bỏ', 'Churn risk'), cls: 'c', width: '8%',
            sortValue: (r) => r.churn,
            render: (r) => <Tag tone={tone(labels, r.churn)}>{labels.get(r.churn)?.label ?? r.churn}</Tag>,
          },
          {
            key: 'nba', header: t(lang, 'NBA đề xuất', 'Proposed NBA'), width: '11%',
            sortValue: (r) => (lang === 'vi' ? r.nbaVi : r.nbaEn),
            render: (r) => (
              <span style={{ fontSize: 10.5, color: 'var(--brand-600)', fontWeight: 650 }}>
                {lang === 'vi' ? r.nbaVi : r.nbaEn}
              </span>
            ),
          },
        ]}
      />
    </>
  )
}

function OrgCellLite({ name, id }: { name: string; id: string }) {
  return (
    <div>
      <b style={{ fontSize: 12 }}>{name}</b>
      <div className="muted num">{id}</div>
    </div>
  )
}

/** ui-2.html:4880 — cross-sell reach today. A blank cell is the opportunity. */
const CROSS_SELL: Array<[string, string, boolean[]]> = [
  ['Hãng tàu', 'Carriers', [true, false, false, false, false]],
  ['BCO lớn', 'Large BCOs', [true, true, false, false, false]],
  ['BCO vừa và nhỏ', 'SME BCOs', [true, false, false, false, false]],
  ['Forwarder', 'Forwarders', [true, true, true, false, false]],
  ['Chủ hàng FDI', 'FDI shippers', [true, true, false, false, false]],
]

const CROSS_SELL_COLS: Array<[string, string]> = [
  ['Cảng', 'Port'], ['Vận tải bộ', 'Trucking'], ['Kho', 'Warehouse'],
  ['Chuỗi lạnh', 'Cold chain'], ['Hàng không', 'Air'],
]

/** ui-2.html:4890 — what the CDP gives the platform, and the one thing it must not become. */
const CDP_CONTRIBUTION: Array<[string, string, string, string, boolean]> = [
  ['Kiến trúc định danh dùng lại được', 'Reusable identity architecture',
    'Thuật toán khớp MST, cây tập đoàn, hàng đợi AI–người duyệt — rút ngắn 2–3 tháng',
    'Tax-ID matching, corporate tree and the AI-to-human queue — saves 2–3 months', true],
  ['Nguồn sản lượng mồi hợp pháp', 'A legitimate anchor-volume source',
    'Gemadept mời khách hàng của chính mình lên nền tảng, có thu thập đồng ý riêng cho mục đích đó',
    'Gemadept invites its own customers onto the platform, with separate consent for that purpose', true],
  ['Engine chào giá phía cung', 'A supply-side quoting engine',
    'AI Agent đề xuất gói dịch vụ theo chuyến đã chạy thật — trở thành trợ lý chào giá trên nền tảng',
    'The voyage service-basket agent already runs — it becomes the platform’s offering assistant', true],
  ['Cohort chiến dịch có sẵn', 'Ready-made campaign cohorts',
    'Phân khúc AI ánh xạ gần như 1:1 vào các phân khúc ưu tiên của chương trình phát triển thị trường',
    'AI segments map almost 1:1 onto the go-to-market priority segments', true],
  ['Không phải hệ thống chủ dữ liệu của nền tảng', 'Not the platform’s data master',
    'Dùng CDP làm danh sách thành viên mặc định sẽ phá vỡ tính trung lập và vi phạm nguyên tắc dữ liệu',
    'Using the CDP as the default member list would break neutrality and violate the data principles', false],
]

/** cdp_act — Activation & Next-Best-Action (ui-2.html:4863). */
export async function CdpActivationPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, nbaActions, labels] = await Promise.all([
    db.select({
      memberId: cdpAccounts.memberId,
      member: members.name,
      memberType: members.typeCode,
      segmentVi: cdpSegments.nameVi,
      segmentEn: cdpSegments.nameEn,
      nbaId: cdpAccounts.nbaActionId,
      nbaVi: cdpNbaActions.nameVi,
      nbaEn: cdpNbaActions.nameEn,
      shareOfWallet: cdpAccounts.shareOfWallet,
      revenue: cdpAccounts.revenue,
      churn: cdpAccounts.churnRiskCode,
      confidence: cdpAccounts.confidence,
      trend: cdpAccounts.trend,
      services: cdpAccounts.services,
    })
      .from(cdpAccounts)
      .innerJoin(members, eq(members.id, cdpAccounts.memberId))
      .innerJoin(cdpSegments, eq(cdpSegments.id, cdpAccounts.segmentId))
      .innerJoin(cdpNbaActions, eq(cdpNbaActions.id, cdpAccounts.nbaActionId))
      .orderBy(asc(cdpAccounts.memberId)),
    db.select().from(cdpNbaActions).orderBy(asc(cdpNbaActions.id)),
    statusLabelMap(lang),
  ])

  const usesWarehouse = (r: typeof rows[number]) => (r.services as Record<string, boolean>).wh

  /** ui-2.html:4864 — five plays, each sized from the account book. */
  const plays: Array<[string, string, number, number, Tone]> = [
    ['Giữ chân sụt sản lượng', 'Retain volume decline',
      rows.filter((r) => r.churn === 'high').length, 64, 'd'],
    ['Bán chéo kho & cold-chain cho BCO', 'Cross-sell warehouse & cold to BCOs',
      rows.filter((r) => !usesWarehouse(r) && r.memberType === 'shipper').length, 38, 'b'],
    ['Chào tuyến mới cho hãng tàu', 'Offer new lanes to carriers',
      rows.filter((r) => r.memberType === 'carrier').length, 42, 'u'],
    ['Điều chỉnh giá theo chỉ số VLX', 'Reprice against the VLX Index',
      rows.filter((r) => r.shareOfWallet < 50).length, 29, 'gd'],
    ['Mời lên nền tảng VLX', 'Invite onto the VLX platform',
      rows.filter((r) => r.shareOfWallet > 60).length, 71, 'v'],
  ]
  const accountsInPlay = plays.reduce((a, p) => a + p[2], 0)
  const avgConversion = plays.reduce((a, p) => a + p[3], 0) / plays.length

  /** ui-2.html:4874 — the rationale shown beside each proposal, in priority order. */
  const rationale = (r: typeof rows[number]) =>
    r.churn === 'high'
      ? t(lang, 'Sản lượng giảm và share-of-wallet dưới 45%', 'Volume declining and share of wallet below 45%')
      : !usesWarehouse(r)
        ? t(lang, 'Chưa dùng kho — cơ hội bán chéo rõ', 'Not using warehousing — a clear cross-sell')
        : r.shareOfWallet < 50
          ? t(lang, 'Giá đang lệch so với chỉ số tuyến', 'Pricing is off the lane index')
          : t(lang, 'Khối lượng ổn định, đủ điều kiện mời lên nền tảng',
            'Stable volume, eligible for platform onboarding')

  return (
    <>
      <PageHeader
        crumb={t(lang, 'CDP 360 · Thành viên Gemadept', 'CDP 360 · Gemadept member view')}
        title={t(lang, 'Kích hoạt & Next-Best-Action', 'Activation & Next-Best-Action')}
        modules={['F15']}
        sub={t(lang,
          'AI đề xuất — con người quyết định. Lọc, chọn nhiều và duyệt hàng loạt. Mọi tín hiệu có lineage, điểm tin cậy và phân quyền; mọi hành động có người phê duyệt.',
          'AI advises — humans decide. Filter, multi-select and bulk-approve. Every signal carries lineage, a confidence score and access control; every action has an approver.')}
        actions={
          <>
            <span className="btn">{t(lang, 'Bỏ qua', 'Dismiss')}</span>
            <span className="btn p">✓ {t(lang, 'Duyệt hàng loạt', 'Bulk approve')}</span>
          </>
        }
      />

      <BoundaryNote lang={lang}>
        {t(lang,
          'Toàn bộ dữ liệu trên màn hình này thuộc phạm vi thành viên Gemadept: chỉ các giao dịch giữa Gemadept và khách hàng của Gemadept. CDP không phải hệ thống chủ dữ liệu khách hàng của nền tảng và không thấy dữ liệu của hãng tàu hay ngân hàng khác. Dùng dữ liệu này cho tiếp thị cần sự đồng ý riêng của từng khách hàng.',
          'Everything on this screen is within Gemadept’s member scope: only transactions between Gemadept and Gemadept’s own customers. The CDP is not the platform’s customer master and cannot see other carriers’ or banks’ data. Using this data for marketing requires each customer’s separate consent.')}
      </BoundaryNote>

      <div className="grid g5" style={{ margin: '14px 0' }}>
        <KpiTile label={t(lang, 'Play đang chạy', 'Plays running')} value={num(plays.length)}
          meta={t(lang, 'AI đề xuất, người duyệt', 'AI-proposed, human-approved')} metaTone="v" />
        <KpiTile label={t(lang, 'Tài khoản trong play', 'Accounts in play')} value={num(accountsInPlay)}
          meta={t(lang, 'có thể trùng nhiều play', 'may overlap across plays')} />
        <KpiTile label={t(lang, 'Tỷ lệ chuyển đổi TB', 'Average conversion')}
          value={num(avgConversion, 0)} unit="%" meta="+14 pp YoY" metaTone="u" />
        <KpiTile label={t(lang, 'Doanh thu rủi ro đã nhận diện', 'Revenue at risk identified')}
          value="128" unit={t(lang, 'tỷ đ', 'bn VND')}
          meta={t(lang, '9 tài khoản lớn', '9 major accounts')} metaTone="d" />
        <KpiTile label={t(lang, 'Khách đã mời lên nền tảng', 'Invited onto the platform')} value="86"
          meta={t(lang, '62 đã hoàn tất KYB', '62 completed KYB')} metaTone="u" />
      </div>

      <Card title={`📣 ${t(lang, 'Play đang chạy', 'Running plays')}`} >
        <div className="grid g5">
          {plays.map(([vi, en, accounts, conversion]) => {
            const color = conversion >= 50 ? 'var(--up)' : 'var(--gold-500)'
            return (
              <div key={vi} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 13 }}>
                <b style={{ fontSize: 12.5 }}>{t(lang, vi, en)}</b>
                <div className="flex" style={{ gap: 6, margin: '7px 0' }}>
                  <b className="num" style={{ fontSize: 20 }}>{accounts}</b>
                  <span className="muted">{t(lang, 'tài khoản', 'accounts')}</span>
                </div>
                <div className="between">
                  <span className="muted">{t(lang, 'Chuyển đổi', 'Conversion')}</span>
                  <b className="num" style={{ color }}>{conversion}%</b>
                </div>
                <div className="bar" style={{ marginTop: 5 }}>
                  <i style={{ width: `${conversion}%`, background: color }} />
                </div>
                <span className="btn xs blk" style={{ marginTop: 9 }}>
                  {t(lang, 'Xem danh sách', 'View list')}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid g-3-2" style={{ marginTop: 14 }}>
        <DataTable
          id="nba" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Hàng đợi Next-Best-Action', 'Next-Best-Action queue')}
          rows={rows} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm khách hàng, hành động…', 'Search customer, action…')}
          search={(r) => `${r.member} ${r.nbaVi} ${r.nbaEn} ${r.segmentVi}`}
          filters={[
            {
              key: 'nba', label: t(lang, 'Loại hành động', 'Action type'),
              options: nbaActions.map((a) => [String(a.id), lang === 'vi' ? a.nameVi : a.nameEn]),
              match: (r, v) => String(r.nbaId) === v,
            },
            {
              key: 'churn', label: t(lang, 'Rủi ro rời bỏ', 'Churn risk'),
              options: statusOptions(labels, ['high', 'med', 'low']),
              match: (r, v) => r.churn === v,
            },
          ]}
          columns={[
            {
              key: 'n', header: t(lang, 'Khách hàng', 'Customer'), width: '24%',
              sortValue: (r) => r.member,
              render: (r) => <OrgCell name={r.member} />,
            },
            {
              key: 'nba', header: t(lang, 'Hành động đề xuất', 'Proposed action'), width: '22%',
              sortValue: (r) => r.nbaId,
              render: (r) => (
                <b style={{ fontSize: 12, color: 'var(--brand-600)' }}>{lang === 'vi' ? r.nbaVi : r.nbaEn}</b>
              ),
            },
            {
              key: 'why', header: t(lang, 'Vì sao', 'Rationale'), width: '24%',
              render: (r) => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{rationale(r)}</span>,
            },
            {
              key: 'conf', header: t(lang, 'Độ tin cậy', 'Confidence'), width: '12%',
              sortValue: (r) => r.confidence,
              render: (r) => (
                <Meter value={r.confidence} width={48}
                  color={r.confidence >= 85 ? 'var(--up)' : 'var(--gold-500)'} />
              ),
            },
            {
              key: 'churn', header: t(lang, 'Rủi ro', 'Risk'), cls: 'c', width: '10%',
              sortValue: (r) => r.churn,
              render: (r) => <Tag tone={tone(labels, r.churn)}>{labels.get(r.churn)?.label ?? r.churn}</Tag>,
            },
            {
              key: 'act', header: '', cls: 'r', width: '8%',
              render: () => <span className="btn xs p">{t(lang, 'Duyệt', 'Approve')}</span>,
            },
          ]}
        />

        <div className="stack">
          <Card title={t(lang, 'Ma trận bán chéo', 'Cross-sell matrix')}
            right={<span className="sub">{t(lang, 'Ô trống = cơ hội', 'Blank = opportunity')}</span>}
            bodyStyle={{ padding: 0 }}>
            <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
              <table className="tbl mtx">
                <thead>
                  <tr>
                    <th>{t(lang, 'Nhóm', 'Group')}</th>
                    {CROSS_SELL_COLS.map(([cVi, cEn]) => (
                      <th key={cEn} className="c">{t(lang, cVi, cEn)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CROSS_SELL.map(([gVi, gEn, cells]) => (
                    <tr key={gEn}>
                      <td style={{ fontSize: 11.5 }}>{t(lang, gVi, gEn)}</td>
                      {cells.map((yes, i) => (
                        <td key={i} className="c">
                          <span className={`yn ${yes ? 'y' : 'n'}`}>{yes ? '✓' : '✕'}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note">
              {t(lang,
                'Ưu tiên rõ nhất: kho và cold-chain cho BCO lớn. Đây cũng là dịch vụ Gemadept có năng lực dư và là lý do mạnh để đưa nhóm khách này lên nền tảng.',
                'The clearest priority: warehousing and cold chain for large BCOs. It is also where Gemadept has spare capacity, and a strong reason to bring these customers onto the platform.')}
            </div>
          </Card>

          <Card title={t(lang, 'CDP đóng góp gì cho nền tảng', 'What the CDP contributes')}
            bodyStyle={{ padding: 11 }}>
            {CDP_CONTRIBUTION.map(([vi, en, dVi, dEn, positive]) => (
              <div key={en} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <b style={{ fontSize: 11.5, color: positive ? 'var(--up)' : 'var(--down)' }}>
                  {positive ? '✓ ' : '✕ '}{t(lang, vi, en)}
                </b>
                <div className="muted" style={{ marginTop: 2 }}>{t(lang, dVi, dEn)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  )
}
