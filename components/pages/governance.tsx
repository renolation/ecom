import { asc, eq, sql } from 'drizzle-orm'
import { DataTable } from '@/components/table/data-table'
import { BoundaryNote, Card, KpiTile, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  agentActions, agentRuns, aiAgents, cdpAccounts, cdpMergeQueue, cdpMergeRecords,
  cdpNbaActions, cdpSegments, consentPurposes, decisionRights, licenceMatrix, members,
  sandboxPrograms,
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

/** cdp_360 — Unified customers (ui-2.html:4792). */
export async function CdpUnifiedPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, segments, queue, records, labels] = await Promise.all([
    db.select({
      memberId: cdpAccounts.memberId,
      member: members.name,
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
      .innerJoin(cdpSegments, eq(cdpSegments.id, cdpAccounts.segmentId))
      .innerJoin(cdpNbaActions, eq(cdpNbaActions.id, cdpAccounts.nbaActionId))
      .orderBy(asc(cdpAccounts.memberId)),
    db.select().from(cdpSegments).orderBy(asc(cdpSegments.id)),
    db.select().from(cdpMergeQueue).orderBy(asc(cdpMergeQueue.ord)),
    db.select().from(cdpMergeRecords).orderBy(asc(cdpMergeRecords.queueId), asc(cdpMergeRecords.ord)),
    statusLabelMap(lang),
  ])

  const serviceKeys: Array<[string, string, string]> = [
    ['port', 'Cảng', 'Port'], ['truck', 'Vận tải bộ', 'Trucking'],
    ['wh', 'Kho', 'Warehouse'], ['cold', 'Chuỗi lạnh', 'Cold'], ['air', 'Hàng không', 'Air'],
  ]

  return (
    <>
      <PageHeader
        crumb={t(lang, 'CDP 360', 'CDP 360')}
        title={t(lang, 'Khách hàng hợp nhất', 'Unified Customers')}
        sub={t(lang,
          'Hồ sơ khách hàng hợp nhất từ nhiều hệ thống nguồn. Chỉ hiển thị dữ liệu giao dịch giữa bạn và khách hàng của bạn.',
          'Customer profiles unified across source systems. Only transactions between you and your own customers are shown.')}
      />

      <BoundaryNote lang={lang}>
        {t(lang, ' — phạm vi thành viên. Giao dịch của khách hàng với nhà cung cấp khác không hiển thị ở đây.',
          ' — member scope. A customer’s transactions with other providers are not visible here.')}
      </BoundaryNote>

      <div className="grid g5" style={{ margin: '14px 0' }}>
        <KpiTile label={t(lang, 'Khách hàng', 'Customers')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Nguy cơ rời bỏ cao', 'High churn risk')}
          value={num(rows.filter((r) => r.churn === 'high').length)} metaTone="d" />
        <KpiTile label={t(lang, 'Share of wallet TB', 'Average wallet share')}
          value={num(rows.reduce((a, r) => a + r.shareOfWallet, 0) / rows.length, 1)} unit="%"
          bar={rows.reduce((a, r) => a + r.shareOfWallet, 0) / rows.length} />
        <KpiTile label={t(lang, 'Chờ hợp nhất', 'Awaiting merge')} value={num(queue.length)}
          meta={t(lang, `${num(records.length)} bản ghi nguồn`, `${num(records.length)} source records`)} metaTone="gd" />
        <KpiTile label={t(lang, 'Doanh thu', 'Revenue')}
          value={num(rows.reduce((a, r) => a + Number(r.revenue), 0))} unit={t(lang, 'tr đ', 'm VND')} />
      </div>

      <Card title={t(lang, 'Hàng đợi hợp nhất định danh', 'Identity resolution queue')} bodyStyle={{ padding: 12 }}>
        <div className="grid g2" style={{ gap: 10 }}>
          {queue.map((q) => (
            <div key={q.id} style={{ padding: 11, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface-2)' }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <b style={{ fontSize: 12.5 }}>{q.goldenName}</b>
                <Tag tone={q.confidence >= 90 ? 'u' : q.confidence >= 80 ? 'gd' : 'd'}>{q.confidence}%</Tag>
              </div>
              <div className="muted num" style={{ marginBottom: 6 }}>{t(lang, 'MST', 'Tax ID')}: {q.taxIdMasked}</div>
              {records.filter((r) => r.queueId === q.id).map((r) => (
                <div key={r.id} style={{ fontSize: 11.5, color: 'var(--text-2)', padding: '2px 0' }}>
                  ↳ {r.sourceRecord}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="cdp" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Khách hàng hợp nhất', 'Unified customers')} rows={rows} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm khách hàng…', 'Search customer…')}
          search={(r) => `${r.memberId} ${r.member}`}
          filters={[
            {
              key: 'seg', label: t(lang, 'Phân khúc', 'Segment'),
              options: segments.map((s) => [String(s.id), lang === 'vi' ? s.nameVi : s.nameEn]),
              match: (r, v) => String(r.segmentId) === v,
            },
            {
              key: 'churn', label: t(lang, 'Nguy cơ rời bỏ', 'Churn risk'),
              options: statusOptions(labels, ['low', 'med', 'high']),
              match: (r, v) => r.churn === v,
            },
          ]}
          columns={[
            { key: 'member', header: t(lang, 'Khách hàng', 'Customer'), width: '22%', sortValue: (r) => r.member, render: (r) => <OrgCellLite name={r.member} id={r.memberId} /> },
            {
              key: 'seg', header: t(lang, 'Phân khúc', 'Segment'), width: '17%',
              sortValue: (r) => (lang === 'vi' ? r.segmentVi : r.segmentEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.segmentVi : r.segmentEn}</span>,
            },
            { key: 'sow', header: t(lang, 'Share of wallet', 'Wallet share'), width: '12%', sortValue: (r) => r.shareOfWallet, render: (r) => <Meter value={r.shareOfWallet} width={62} /> },
            {
              key: 'rev', header: t(lang, 'Doanh thu', 'Revenue'), cls: 'r', width: '10%', sortValue: (r) => Number(r.revenue),
              render: (r) => (
                <div>
                  <b className="num">{num(r.revenue)}</b>
                  <div className="muted">{r.trend > 0 ? '↑' : '↓'}</div>
                </div>
              ),
            },
            {
              key: 'svc', header: t(lang, 'Dịch vụ đang dùng', 'Services used'), width: '16%',
              render: (r) => {
                const s = r.services as Record<string, unknown>
                return (
                  <div className="flex wrap" style={{ gap: 3 }}>
                    {serviceKeys.filter(([k]) => Boolean(s?.[k])).map(([k, vi, en]) => (
                      <Tag key={k} tone="b">{lang === 'vi' ? vi : en}</Tag>
                    ))}
                  </div>
                )
              },
            },
            {
              key: 'nba', header: t(lang, 'Hành động kế tiếp', 'Next best action'), width: '15%',
              sortValue: (r) => (lang === 'vi' ? r.nbaVi : r.nbaEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.nbaVi : r.nbaEn}</span>,
            },
            {
              key: 'churn', header: t(lang, 'Rời bỏ', 'Churn'), cls: 'c', width: '8%', sortValue: (r) => r.churn,
              render: (r) => <Tag tone={tone(labels, r.churn)}>{labels.get(r.churn)?.label ?? r.churn}</Tag>,
            },
          ]}
        />
      </div>
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

/** cdp_act — Activation & NBA (ui-2.html:4863). */
export async function CdpActivationPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, nbaActions, labels] = await Promise.all([
    db.select({
      memberId: cdpAccounts.memberId,
      member: members.name,
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
    })
      .from(cdpAccounts)
      .innerJoin(members, eq(members.id, cdpAccounts.memberId))
      .innerJoin(cdpSegments, eq(cdpSegments.id, cdpAccounts.segmentId))
      .innerJoin(cdpNbaActions, eq(cdpNbaActions.id, cdpAccounts.nbaActionId))
      .orderBy(asc(cdpAccounts.memberId)),
    db.select().from(cdpNbaActions).orderBy(asc(cdpNbaActions.id)),
    statusLabelMap(lang),
  ])

  const byAction = nbaActions.map((a) => {
    const g = rows.filter((r) => r.nbaId === a.id)
    return {
      id: a.id,
      label: lang === 'vi' ? a.nameVi : a.nameEn,
      n: g.length,
      revenue: g.reduce((x, r) => x + Number(r.revenue), 0),
      highChurn: g.filter((r) => r.churn === 'high').length,
      avgSow: g.reduce((x, r) => x + r.shareOfWallet, 0) / (g.length || 1),
    }
  })

  return (
    <>
      <PageHeader
        crumb={t(lang, 'CDP 360', 'CDP 360')}
        title={t(lang, 'Kích hoạt & NBA', 'Activation & NBA')}
        sub={t(lang,
          'Hành động kế tiếp được đề xuất cho từng khách hàng dựa trên share of wallet, xu hướng sản lượng và nguy cơ rời bỏ. Đề xuất là gợi ý, không tự thực thi.',
          'A next-best action proposed per customer from wallet share, volume trend and churn risk. Proposals are advisory and never execute themselves.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Khách hàng có đề xuất', 'Customers with an action')} value={num(rows.length)} />
        <KpiTile label={t(lang, 'Loại hành động', 'Action types')} value={num(nbaActions.length)} />
        <KpiTile label={t(lang, 'Ưu tiên giữ chân', 'Retention priority')}
          value={num(rows.filter((r) => r.churn === 'high').length)} metaTone="d"
          meta={t(lang, 'nguy cơ rời bỏ cao', 'high churn risk')} />
        <KpiTile label={t(lang, 'Doanh thu liên quan', 'Revenue in scope')}
          value={num(rows.reduce((a, r) => a + Number(r.revenue), 0))} unit={t(lang, 'tr đ', 'm VND')} />
      </div>

      <Card title={t(lang, 'Theo loại hành động', 'By action type')} bodyStyle={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(lang, 'Hành động kế tiếp', 'Next best action')}</th>
              <th className="r">{t(lang, 'Khách hàng', 'Customers')}</th>
              <th className="r">{t(lang, 'Rủi ro cao', 'High risk')}</th>
              <th>{t(lang, 'Share of wallet TB', 'Avg wallet share')}</th>
              <th className="r">{t(lang, 'Doanh thu', 'Revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {byAction.map((a) => (
              <tr key={a.id}>
                <td><b style={{ fontSize: 12 }}>{a.label}</b></td>
                <td className="r num">{num(a.n)}</td>
                <td className="r num">{a.highChurn > 0 ? <span style={{ color: 'var(--down)' }}>{num(a.highChurn)}</span> : '—'}</td>
                <td><Meter value={a.avgSow} width={100} /></td>
                <td className="r num"><b>{num(a.revenue)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 14 }}>
        <DataTable
          id="nba" lang={lang} basePath={basePath} searchParams={searchParams}
          title={t(lang, 'Danh sách kích hoạt', 'Activation list')} rows={rows} pageSize={14}
          searchPlaceholder={t(lang, 'Tìm khách hàng…', 'Search customer…')}
          search={(r) => `${r.memberId} ${r.member}`}
          filters={[
            {
              key: 'nba', label: t(lang, 'Hành động', 'Action'),
              options: nbaActions.map((a) => [String(a.id), lang === 'vi' ? a.nameVi : a.nameEn]),
              match: (r, v) => String(r.nbaId) === v,
            },
            {
              key: 'churn', label: t(lang, 'Nguy cơ', 'Risk'),
              options: statusOptions(labels, ['low', 'med', 'high']),
              match: (r, v) => r.churn === v,
            },
          ]}
          columns={[
            { key: 'member', header: t(lang, 'Khách hàng', 'Customer'), width: '24%', sortValue: (r) => r.member, render: (r) => <OrgCellLite name={r.member} id={r.memberId} /> },
            {
              key: 'seg', header: t(lang, 'Phân khúc', 'Segment'), width: '18%',
              sortValue: (r) => (lang === 'vi' ? r.segmentVi : r.segmentEn),
              render: (r) => <span style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.segmentVi : r.segmentEn}</span>,
            },
            {
              key: 'nba', header: t(lang, 'Hành động kế tiếp', 'Next best action'), width: '22%',
              sortValue: (r) => (lang === 'vi' ? r.nbaVi : r.nbaEn),
              render: (r) => <b style={{ fontSize: 11.5 }}>{lang === 'vi' ? r.nbaVi : r.nbaEn}</b>,
            },
            { key: 'sow', header: t(lang, 'Share of wallet', 'Wallet share'), width: '13%', sortValue: (r) => r.shareOfWallet, render: (r) => <Meter value={r.shareOfWallet} width={64} /> },
            { key: 'rev', header: t(lang, 'Doanh thu', 'Revenue'), cls: 'r', width: '10%', sortValue: (r) => Number(r.revenue), render: (r) => <b className="num">{num(r.revenue)}</b> },
            { key: 'conf', header: t(lang, 'Tin cậy', 'Confidence'), cls: 'r', width: '8%', sortValue: (r) => r.confidence, render: (r) => <span className="num">{r.confidence}%</span> },
            {
              key: 'churn', header: t(lang, 'Nguy cơ', 'Risk'), cls: 'c', width: '9%', sortValue: (r) => r.churn,
              render: (r) => <Tag tone={tone(labels, r.churn)}>{labels.get(r.churn)?.label ?? r.churn}</Tag>,
            },
          ]}
        />
      </div>
    </>
  )
}
