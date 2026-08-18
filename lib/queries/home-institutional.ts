import { and, asc, avg, eq, gt, inArray, lt, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  agentRuns, amlAlerts, assetFinanceDeals, cdpAccounts, cdpMergeQueue, corridors,
  creditExposures, disputes, financeApplications, financeProducts, lettersOfCredit, members,
  sandboxPrograms, settlements,
} from '@/db/schema'
import type { Lang } from '@/lib/i18n'
import { num, t } from '@/lib/i18n'
import { walk } from '@/components/charts'
import type { HomeView } from './home-types'

const n = sql<number>`count(*)::int`

/** f_home — HDBank home (ui-2.html:1295). */
export async function financeHome(lang: Lang): Promise<HomeView> {
  const [referred, lcDiscrepant, breach, watch, diligence, earlyPayout, priority] =
    await Promise.all([
      db.select({ n }).from(financeApplications).where(eq(financeApplications.decisionCode, 'refer')),
      // Step 4 is document presentation; a discrepancy there starts the 5-day clock.
      db.select({ n }).from(lettersOfCredit)
        .where(and(eq(lettersOfCredit.stepOrdinal, 4), gt(lettersOfCredit.discrepancies, 0))),
      db.select({ n }).from(creditExposures)
        .innerJoin(members, eq(members.id, creditExposures.memberId))
        .where(eq(members.complianceStatusCode, 'breach')),
      db.select({ n }).from(creditExposures)
        .innerJoin(members, eq(members.id, creditExposures.memberId))
        .where(eq(members.complianceStatusCode, 'watch')),
      db.select({ n }).from(assetFinanceDeals).where(eq(assetFinanceDeals.statusCode, 'diligence')),
      db.select({ n }).from(settlements).where(eq(settlements.statusCode, 'pending')),
      db.select({
        member: members.name,
        productVi: financeProducts.nameVi,
        productEn: financeProducts.nameEn,
        amount: financeApplications.amount,
        score: financeApplications.score,
      })
        .from(financeApplications)
        .innerJoin(members, eq(members.id, financeApplications.memberId))
        .innerJoin(financeProducts, eq(financeProducts.code, financeApplications.productCode))
        .where(eq(financeApplications.decisionCode, 'refer'))
        .orderBy(asc(financeApplications.id))
        .limit(9),
    ])

  const referCount = referred[0]?.n ?? 0
  const breachCount = breach[0]?.n ?? 0
  const watchCount = watch[0]?.n ?? 0
  const lcCount = lcDiscrepant[0]?.n ?? 0
  const diligenceCount = diligence[0]?.n ?? 0
  const earlyCount = earlyPayout[0]?.n ?? 0

  return {
    heroTitle: t(lang, 'Chào buổi chiều, Châu 👋', 'Good afternoon, Châu 👋'),
    heroSub: t(lang,
      `HDBank · Sovico Group — ${referCount} hồ sơ cần thẩm định thủ công và ${breachCount} đối tác vượt ngưỡng tuân thủ.`,
      `HDBank · Sovico Group — ${referCount} files need manual underwriting and ${breachCount} counterparties are in breach.`),
    heroTags: [
      t(lang, 'Định chế tài chính', 'Financial institution'),
      t(lang, 'Dư nợ 286 tỷ', '286bn outstanding'),
      t(lang, 'NPL 0,34%', 'NPL 0.34%'),
    ],
    kpis: [
      {
        label: t(lang, 'Hồ sơ chờ quyết định', 'Files awaiting decision'),
        value: num(referCount),
        meta: t(lang, 'AI đã chấm điểm, chờ người duyệt', 'scored by AI, awaiting a human'),
        metaTone: 'gd',
      },
      {
        label: t(lang, 'Dư nợ tài trợ', 'Outstanding'),
        value: '286', unit: t(lang, 'tỷ đ', 'bn VND'),
        meta: '+34% YoY', metaTone: 'u', spark: walk(200, 20, 0.05, 71),
      },
      {
        label: t(lang, 'Đối tác vượt ngưỡng', 'Counterparties in breach'),
        value: num(breachCount),
        meta: t(lang, `${watchCount} đang theo dõi`, `${watchCount} on watch`),
        metaTone: 'd',
      },
      {
        label: t(lang, 'L/C có sai lệch chứng từ', 'L/C with discrepancies'),
        value: num(lcCount),
        meta: t(lang, 'hạn trả lời 5 ngày làm việc', '5 banking days to respond'),
        metaTone: 'gd',
      },
      {
        label: t(lang, 'Escrow đang giữ', 'Escrow held'),
        value: '42.6', unit: t(lang, 'tỷ đ', 'bn VND'),
        meta: t(lang, '412 booking', '412 bookings'),
      },
    ],
    todos: [
      {
        icon: '🧠',
        title: t(lang, `${referCount} hồ sơ tín dụng chờ thẩm định thủ công`,
          `Credit files awaiting manual underwriting: ${referCount}`),
        detail: t(lang,
          'Điểm nằm trong vùng xám 50–70 — mô hình không tự quyết, cần chuyên viên xem bằng chứng giao dịch',
          'Scores in the 50–70 grey zone — the model does not decide, an officer reviews the trade evidence'),
        route: 'f_credit', tone: 'gd', badge: t(lang, 'Cần người duyệt', 'Human required'),
      },
      {
        icon: '⚠️',
        title: t(lang, `${breachCount} đối tác vượt ngưỡng tuân thủ`,
          `Counterparties in compliance breach: ${breachCount}`),
        detail: t(lang,
          'Vượt hạn mức hoặc có nợ quá hạn — cần quyết định giảm hạn mức hay yêu cầu bổ sung bảo đảm',
          'Over limit or in arrears — decide whether to cut the limit or call for more security'),
        route: 'f_risk', tone: 'd', badge: t(lang, 'Gấp', 'Urgent'),
      },
      {
        icon: '🧾',
        title: t(lang, `${lcCount} bộ chứng từ L/C có sai lệch`,
          `L/C document sets with discrepancies: ${lcCount}`),
        detail: t(lang,
          'Hệ thống đã đánh dấu và giải thích từng điểm — quyết định chấp nhận hay từ chối thuộc về bạn',
          'The system flagged and explained each point — accepting or refusing is your call'),
        route: 'f_dash', tone: 'gd', badge: t(lang, '5 ngày', '5 days'),
      },
      {
        icon: '⚓',
        title: t(lang, `${diligenceCount} giao dịch tài trợ tài sản đang thẩm định`,
          `Asset finance deals in diligence: ${diligenceCount}`),
        detail: t(lang,
          'Data room đã có dữ liệu vận hành đã xác minh từ TOS cảng và AIS',
          'The data room already holds verified operating data from port TOS and AIS'),
        route: 'f_asset', tone: 'gd', badge: t(lang, 'Đang mở', 'Open'),
      },
      {
        icon: '⚡',
        title: t(lang, `${earlyCount} yêu cầu nhận tiền sớm chờ duyệt`,
          `Early payout requests pending: ${earlyCount}`),
        detail: t(lang,
          'Khoản phải thu đã được nền tảng xác thực — rủi ro thấp, quyết định vẫn thuộc ngân hàng',
          'Receivables verified by the platform — low risk, the decision still rests with the bank'),
        route: 'f_prod', tone: 'b', badge: t(lang, 'Tuỳ chọn', 'Optional'),
      },
      {
        icon: '📉',
        title: t(lang, '6 đối tác có tín hiệu cảnh báo sớm',
          'Counterparties showing early-warning signals: 6'),
        detail: t(lang,
          'Khối lượng giảm, tăng huỷ booking, kéo dài kỳ hạn — dấu hiệu căng thẳng dòng tiền trước 45–60 ngày',
          'Volume down, cancellations up, terms stretched — cash stress 45–60 days ahead'),
        route: 'f_risk', tone: 'b', badge: t(lang, 'Theo dõi', 'Watch'),
      },
    ],
    shortcuts: [
      { icon: '🧠', label: t(lang, 'Bộ máy cấp tín dụng', 'Credit engine'), route: 'f_credit' },
      { icon: '💠', label: t(lang, 'Sản phẩm tài trợ', 'Financing products'), route: 'f_prod' },
      { icon: '⚓', label: t(lang, 'Tài trợ tàu', 'Asset finance'), route: 'f_asset' },
      { icon: '⚠️', label: t(lang, 'Rủi ro & danh mục', 'Risk & portfolio'), route: 'f_risk' },
      { icon: '🏦', label: t(lang, 'Tổng quan', 'Overview'), route: 'f_dash' },
      { icon: '🤖', label: t(lang, 'Quản trị AI', 'AI governance'), route: 'a_agents' },
    ],
    panel: {
      title: t(lang, 'Hồ sơ ưu tiên hôm nay', 'Priority files today'),
      rows: priority.map((p) => ({
        title: p.member,
        sub: lang === 'vi' ? p.productVi : p.productEn,
        value: `${num(p.amount)} ${t(lang, 'tr', 'm')}`,
        delta: String(p.score),
        deltaTone: p.score >= 70 ? 'u' : p.score >= 50 ? 'gd' : 'd',
      })),
      footerLabel: t(lang, 'Mở hàng đợi tín dụng', 'Open the credit queue'),
      footerRoute: 'f_credit',
    },
  }
}

/** Platform operations — landing view for the ops console (ui-2.html:3406). */
export async function exchangeHome(lang: Lang): Promise<HomeView> {
  const [kybPending, amlHigh, openDisputes, memberCount, corridorRows, escalated] = await Promise.all([
    db.select({ n }).from(members).where(sql`${members.kybStatusCode} <> 'done'`),
    db.select({ n }).from(amlAlerts)
      .where(and(eq(amlAlerts.severityCode, 'high'), inArray(amlAlerts.statusCode, ['open', 'review']))),
    db.select({ n }).from(disputes).where(eq(disputes.statusCode, 'open')),
    db.select({ n }).from(members),
    db.select({ nameVi: corridors.nameVi, nameEn: corridors.nameEn, teu: corridors.teu, gmv: corridors.gmvMVnd })
      .from(corridors).orderBy(corridors.id),
    db.select({ n }).from(disputes).where(eq(disputes.statusCode, 'escalated')),
  ])

  return {
    heroTitle: t(lang, 'Trung tâm vận hành nền tảng', 'Platform operations console'),
    heroSub: t(lang,
      `${memberCount[0]?.n ?? 0} thành viên · ${kybPending[0]?.n ?? 0} hồ sơ KYB chưa hoàn tất · ${amlHigh[0]?.n ?? 0} cảnh báo AML mức cao.`,
      `${memberCount[0]?.n ?? 0} members · ${kybPending[0]?.n ?? 0} incomplete KYB files · ${amlHigh[0]?.n ?? 0} high-severity AML alerts.`),
    heroTags: [
      t(lang, 'Vận hành Nền tảng', 'Platform Operations'),
      t(lang, 'VLX Operating Co. · Gemadept', 'VLX Operating Co. · Gemadept'),
    ],
    kpis: [
      { label: t(lang, 'Thành viên', 'Members'), value: num(memberCount[0]?.n ?? 0) },
      { label: t(lang, 'KYB chưa hoàn tất', 'KYB incomplete'), value: num(kybPending[0]?.n ?? 0),
        meta: t(lang, 'chặn giao dịch', 'blocks trading'), metaTone: 'gd' },
      { label: t(lang, 'Cảnh báo AML mức cao', 'High-severity AML'), value: num(amlHigh[0]?.n ?? 0),
        meta: t(lang, 'cán bộ AML quyết định', 'AML officer decides'), metaTone: 'd' },
      { label: t(lang, 'Tranh chấp đang mở', 'Open disputes'), value: num(openDisputes[0]?.n ?? 0),
        meta: t(lang, `${escalated[0]?.n ?? 0} đã chuyển tầng`, `${escalated[0]?.n ?? 0} escalated`), metaTone: 'gd' },
      { label: t(lang, 'Hành lang đang chạy', 'Live corridors'), value: num(corridorRows.length),
        meta: t(lang, 'theo đề án thí điểm', 'per the pilot programme') },
    ],
    todos: [
      { icon: '🏢',
        title: t(lang, `${kybPending[0]?.n ?? 0} hồ sơ KYB chưa hoàn tất`, `Incomplete KYB files: ${kybPending[0]?.n ?? 0}`),
        detail: t(lang, 'Gồm rà soát cấm vận, xác minh UBO và thẩm định tài chính — chặn quyền giao dịch',
          'Sanctions screening, UBO verification and financial review — trading stays blocked'),
        route: 'x_mem', tone: 'd', badge: t(lang, 'Chặn giao dịch', 'Blocks trading') },
      { icon: '🛡️',
        title: t(lang, `${amlHigh[0]?.n ?? 0} cảnh báo AML mức cao đang mở`, `High-severity AML alerts open: ${amlHigh[0]?.n ?? 0}`),
        detail: t(lang, 'Agent chỉ dựng hồ sơ nháp — quyết định chặn hoặc báo cáo STR thuộc cán bộ AML',
          'The agent drafts only — blocking or filing an STR is the AML officer decision'),
        route: 'x_aml', tone: 'd', badge: t(lang, 'Tầng 3', 'Tier 3') },
      { icon: '⚔️',
        title: t(lang, `${openDisputes[0]?.n ?? 0} tranh chấp đang mở`, `Open disputes: ${openDisputes[0]?.n ?? 0}`),
        detail: t(lang, 'Tầng 1 tự xử theo bằng chứng AIS và mốc chứng từ; tầng 2–3 cần hòa giải',
          'Tier 1 auto-resolves from AIS and document evidence; tiers 2–3 need mediation'),
        route: 'x_disp', tone: 'gd', badge: t(lang, 'Ba tầng', 'Three tiers') },
      { icon: '🎯',
        title: t(lang, 'Chiến dịch và chống lạm dụng', 'Campaigns and anti-abuse'),
        detail: t(lang, 'Kiểm tra cờ trùng MST, giao dịch vòng tròn và các khoản cần thu hồi',
          'Review duplicate tax ID flags, circular trades and clawback candidates'),
        route: 'x_campaign', tone: 'b', badge: t(lang, 'Theo dõi', 'Monitor') },
      { icon: '🏦',
        title: t(lang, 'Đối soát và quyết toán', 'Reconciliation and settlement'),
        detail: t(lang, 'Nền tảng không giữ tiền — đối soát mốc và mã tham chiếu với ngân hàng',
          'The platform holds no funds — reconcile milestones and references with the banks'),
        route: 'x_clear', tone: 'b', badge: t(lang, 'Hằng ngày', 'Daily') },
    ],
    shortcuts: [
      { icon: '🎛️', label: t(lang, 'Trung tâm vận hành', 'Operations console'), route: 'x_ops' },
      { icon: '📉', label: t(lang, 'Chỉ số VLX', 'VLX Index'), route: 'x_index' },
      { icon: '🧭', label: t(lang, 'Hành lang & P&L', 'Corridors & P&L'), route: 'x_corridor' },
      { icon: '🏢', label: t(lang, 'Thành viên & KYB', 'Members & KYB'), route: 'x_mem' },
      { icon: '🛡️', label: t(lang, 'AML / cấm vận', 'AML / sanctions'), route: 'x_aml' },
      { icon: '⚔️', label: t(lang, 'Tranh chấp', 'Disputes'), route: 'x_disp' },
    ],
    panel: {
      title: t(lang, 'Hành lang thí điểm', 'Pilot corridors'),
      rows: corridorRows.map((c) => ({
        title: lang === 'vi' ? c.nameVi : c.nameEn,
        sub: t(lang, `${num(c.teu)} TEU luỹ kế`, `${num(c.teu)} cumulative TEU`),
        value: `${num(Number(c.gmv) / 1000, 1)} ${t(lang, 'tỷ đ', 'bn')}`,
      })),
      footerLabel: t(lang, 'Xem hành lang & P&L', 'View corridors & P&L'),
      footerRoute: 'x_corridor',
    },
  }
}

/** Regulator / supervisor — landing view for the supervisory dashboard (ui-2.html:4408). */
export async function regulatorHome(lang: Lang): Promise<HomeView> {
  const [sandboxRows, tier3Runs, overrides, amlStr, agentTotal] = await Promise.all([
    db.select({ code: sandboxPrograms.code, nameVi: sandboxPrograms.nameVi, nameEn: sandboxPrograms.nameEn,
      used: sandboxPrograms.used, cap: sandboxPrograms.cap }).from(sandboxPrograms).orderBy(sandboxPrograms.ord),
    db.select({ n }).from(agentRuns).where(eq(agentRuns.tier, 3)),
    db.select({ n }).from(agentRuns).where(eq(agentRuns.outcomeCode, 'override')),
    db.select({ n }).from(amlAlerts).where(eq(amlAlerts.statusCode, 'str')),
    db.select({ n }).from(agentRuns),
  ])

  const live = sandboxRows.filter((s) => s.cap > 0)
  const overridePct = agentTotal[0]?.n ? ((overrides[0]?.n ?? 0) / agentTotal[0].n) * 100 : 0

  return {
    heroTitle: t(lang, 'Dashboard giám sát sandbox', 'Sandbox supervisory dashboard'),
    heroSub: t(lang,
      `${live.length} nghiệp vụ đang thử nghiệm · ${tier3Runs[0]?.n ?? 0} lượt AI tầng 3 có người quyết định.`,
      `${live.length} live sandbox use cases · ${tier3Runs[0]?.n ?? 0} Tier-3 AI runs with a human decision.`),
    heroTags: [
      t(lang, 'Cơ quan quản lý', 'Regulator / Supervisor'),
      t(lang, 'VIFC-HCMC · Giám sát sandbox', 'VIFC-HCMC · Sandbox supervision'),
    ],
    kpis: [
      { label: t(lang, 'Nghiệp vụ đang thử nghiệm', 'Live sandbox use cases'), value: num(live.length),
        meta: t(lang, 'trên 8 chương trình', 'of 8 programmes') },
      { label: t(lang, 'Lượt AI tầng 3', 'Tier-3 AI runs'), value: num(tier3Runs[0]?.n ?? 0),
        meta: t(lang, 'luôn có người quyết định', 'always human-decided'), metaTone: 'u' },
      { label: t(lang, 'Tỷ lệ người ghi đè', 'Human override rate'), value: num(overridePct, 1), unit: '%',
        bar: overridePct },
      { label: t(lang, 'Hồ sơ STR đã nộp', 'STR files submitted'), value: num(amlStr[0]?.n ?? 0),
        meta: t(lang, 'do cán bộ AML quyết định', 'decided by the AML officer'), metaTone: 'gd' },
      { label: t(lang, 'Tổng lượt chạy AI', 'Total AI runs'), value: num(agentTotal[0]?.n ?? 0),
        meta: t(lang, 'có nhật ký đầy đủ', 'fully logged') },
    ],
    todos: [
      { icon: '🧪',
        title: t(lang, 'Rà soát hạn mức từng nghiệp vụ sandbox', 'Review each sandbox use case against its cap'),
        detail: t(lang, 'So sánh số lượng đã dùng với trần cho phép theo Phụ lục 1 của đề án',
          'Compare consumed volume against the cap set in Appendix 1'),
        route: 'r_sandbox', tone: 'gd', badge: t(lang, 'Định kỳ', 'Periodic') },
      { icon: '🤖',
        title: t(lang, `${tier3Runs[0]?.n ?? 0} lượt AI tầng 3 cần đối chiếu nhật ký`,
          `Tier-3 AI runs to reconcile against the log: ${tier3Runs[0]?.n ?? 0}`),
        detail: t(lang, 'Tầng 3 không được tự quyết — kiểm tra mọi lượt đều có người phê duyệt',
          'Tier 3 may never decide alone — confirm every run has a named approver'),
        route: 'a_agents', tone: 'd', badge: t(lang, 'Bắt buộc', 'Mandatory') },
      { icon: '📜',
        title: t(lang, 'Ma trận giấy phép và trách nhiệm', 'Licence and responsibility matrix'),
        detail: t(lang, 'Xác nhận nền tảng không thực hiện hoạt động cần giấy phép mà chưa được cấp',
          'Confirm the platform performs no licensed activity it does not hold'),
        route: 'r_license', tone: 'b', badge: t(lang, 'Đối chiếu', 'Cross-check') },
      { icon: '🔒',
        title: t(lang, 'Trung lập và ranh giới dữ liệu', 'Neutrality and data boundaries'),
        detail: t(lang, 'Kiểm tra chặn dữ liệu giữa các nhóm thành viên và cơ chế đồng ý',
          'Check data walls between member groups and the consent mechanism'),
        route: 'a_gov', tone: 'b', badge: t(lang, 'Giám sát', 'Supervision') },
      { icon: '🏛️',
        title: t(lang, 'Báo cáo giám sát định kỳ', 'Periodic supervisory report'),
        detail: t(lang, 'Dữ liệu tổng hợp, không định danh doanh nghiệp, theo nghĩa vụ pháp lý',
          'Aggregated and not company-identifiable, per the legal obligation'),
        route: 'r_dash', tone: 'b', badge: t(lang, 'Theo kỳ', 'Scheduled') },
    ],
    shortcuts: [
      { icon: '🏛️', label: t(lang, 'Dashboard giám sát', 'Supervisory dashboard'), route: 'r_dash' },
      { icon: '🧪', label: t(lang, 'Ma trận Sandbox', 'Sandbox matrix'), route: 'r_sandbox' },
      { icon: '📜', label: t(lang, 'Ma trận giấy phép', 'Licence matrix'), route: 'r_license' },
      { icon: '🤖', label: t(lang, 'Quản trị AI Agent', 'AI agent governance'), route: 'a_agents' },
      { icon: '🔒', label: t(lang, 'Trung lập & dữ liệu', 'Neutrality & data'), route: 'a_gov' },
      { icon: '🛡️', label: t(lang, 'AML / cấm vận', 'AML / sanctions'), route: 'x_aml' },
    ],
    panel: {
      title: t(lang, 'Sử dụng hạn mức sandbox', 'Sandbox cap utilisation'),
      rows: live.map((s) => ({
        title: s.code,
        sub: lang === 'vi' ? s.nameVi : s.nameEn,
        value: `${num(s.used)} / ${num(s.cap)}`,
        delta: `${num((s.used / s.cap) * 100, 0)}%`,
        deltaTone: (s.used / s.cap > 0.8 ? 'd' : 'u') as 'd' | 'u',
      })),
      footerLabel: t(lang, 'Xem ma trận sandbox', 'View sandbox matrix'),
      footerRoute: 'r_sandbox',
    },
  }
}

/** CDP member view — mirrors pageCdpHome (ui-2.html:1345). */
export async function cdpHome(lang: Lang): Promise<HomeView> {
  const [accounts, churnHigh, mergeQueue, avgSow, avgConfidence, unmerged] = await Promise.all([
    db.select({ n }).from(cdpAccounts),
    db.select({ n }).from(cdpAccounts).where(eq(cdpAccounts.churnRiskCode, 'high')),
    db.select({ n }).from(cdpMergeQueue),
    db.select({ v: avg(cdpAccounts.shareOfWallet) }).from(cdpAccounts),
    db.select({ v: avg(cdpAccounts.confidence) }).from(cdpAccounts),
    db.select({ n }).from(cdpAccounts).where(eq(cdpAccounts.isMerged, false)),
  ])

  return {
    heroTitle: t(lang, 'CDP 360 — khách hàng hợp nhất', 'CDP 360 — unified customers'),
    heroSub: t(lang,
      `${accounts[0]?.n ?? 0} khách hàng trong phạm vi thành viên · ${churnHigh[0]?.n ?? 0} có nguy cơ rời bỏ cao.`,
      `${accounts[0]?.n ?? 0} member-scoped customers · ${churnHigh[0]?.n ?? 0} at high churn risk.`),
    heroTags: [
      t(lang, 'CDP 360 — Thành viên', 'CDP 360 — Member view'),
      t(lang, 'Gemadept · Dữ liệu phạm vi thành viên', 'Gemadept · Member-scoped data'),
    ],
    kpis: [
      { label: t(lang, 'Khách hàng hợp nhất', 'Unified customers'), value: num(accounts[0]?.n ?? 0) },
      { label: t(lang, 'Nguy cơ rời bỏ cao', 'High churn risk'), value: num(churnHigh[0]?.n ?? 0),
        meta: t(lang, 'cần giữ chân', 'retention needed'), metaTone: 'd' },
      { label: t(lang, 'Share of wallet bình quân', 'Average share of wallet'),
        value: num(avgSow[0]?.v ?? 0, 1), unit: '%', bar: Number(avgSow[0]?.v ?? 0) },
      { label: t(lang, 'Chờ hợp nhất định danh', 'Awaiting identity merge'), value: num(mergeQueue[0]?.n ?? 0),
        meta: t(lang, 'cần người xác nhận', 'needs human confirmation'), metaTone: 'gd' },
      { label: t(lang, 'Độ tin cậy hồ sơ', 'Profile confidence'), value: num(avgConfidence[0]?.v ?? 0, 1),
        unit: '%', meta: t(lang, `${unmerged[0]?.n ?? 0} hồ sơ chưa gộp`, `${unmerged[0]?.n ?? 0} unmerged`) },
    ],
    todos: [
      { icon: '🧬',
        title: t(lang, `${mergeQueue[0]?.n ?? 0} nhóm bản ghi chờ hợp nhất`, `Record groups awaiting merge: ${mergeQueue[0]?.n ?? 0}`),
        detail: t(lang, 'Cùng một doanh nghiệp xuất hiện dưới nhiều tên trong TOS, CRM và hệ thống giao nhận',
          'The same company appears under several names across TOS, CRM and forwarding systems'),
        route: 'cdp_360', tone: 'gd', badge: t(lang, 'Cần xác nhận', 'Confirm') },
      { icon: '📉',
        title: t(lang, `${churnHigh[0]?.n ?? 0} khách hàng có nguy cơ rời bỏ cao`, `Customers at high churn risk: ${churnHigh[0]?.n ?? 0}`),
        detail: t(lang, 'Sản lượng giảm và share of wallet thấp — ưu tiên tiếp cận giữ chân',
          'Falling volume and low share of wallet — prioritise a retention approach'),
        route: 'cdp_act', tone: 'd', badge: t(lang, 'Ưu tiên', 'Priority') },
      { icon: '🤖',
        title: t(lang, 'Kích hoạt hành động kế tiếp (NBA)', 'Activate next best actions'),
        detail: t(lang, 'Đề xuất bán chéo kho, chuỗi lạnh và tuyến mới theo hồ sơ từng khách hàng',
          'Cross-sell warehousing, cold chain and new lanes based on each profile'),
        route: 'cdp_act', tone: 'b', badge: t(lang, 'Cơ hội', 'Opportunity') },
      { icon: '🔒',
        title: t(lang, 'Ranh giới dữ liệu thành viên', 'Member data boundary'),
        detail: t(lang, 'Chỉ hiển thị dữ liệu giao dịch giữa bạn và khách hàng của bạn',
          'Only transactions between you and your own customers are visible'),
        route: 'a_gov', tone: 'b', badge: t(lang, 'Giới hạn', 'Scoped') },
      { icon: '🧭',
        title: t(lang, 'Rà soát phân khúc khách hàng', 'Review customer segmentation'),
        detail: t(lang, 'Champions, BCO tiềm năng bán chéo, FDI mới và nhóm cần đánh thức',
          'Champions, cross-sell BCOs, new FDI shippers and dormant accounts'),
        route: 'cdp_360', tone: 'b', badge: t(lang, 'Định kỳ', 'Routine') },
    ],
    shortcuts: [
      { icon: '🧭', label: t(lang, 'Khách hàng hợp nhất', 'Unified customers'), route: 'cdp_360' },
      { icon: '🤖', label: t(lang, 'Kích hoạt & NBA', 'Activation & NBA'), route: 'cdp_act' },
      { icon: '🔒', label: t(lang, 'Ranh giới dữ liệu', 'Data boundary'), route: 'a_gov' },
      { icon: '🏢', label: t(lang, 'Thành viên', 'Members'), route: 'x_mem' },
      { icon: '📦', label: t(lang, 'Sản phẩm 360', 'Product 360'), route: 'c_product' },
      { icon: '🧾', label: t(lang, 'Đối soát', 'Reconciliation'), route: 'c_settle' },
    ],
  }
}
