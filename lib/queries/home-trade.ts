import { and, asc, avg, eq, gte, inArray, lt, lte, or, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import { DATE_ANCHOR } from '@/db/schema/common'
import { walk } from '@/components/charts'
import {
  documents, fleetAssets, lanes, lettersOfCredit, members, ports, rateCards, rfqs,
  settlements, shipments, voyages,
} from '@/db/schema'
import type { Lang } from '@/lib/i18n'
import { num, t, usd } from '@/lib/i18n'
import type { HomeView } from './home-types'

const n = sql<number>`count(*)::int`

/** Shipper / BCO — mirrors pageSHome (ui-2.html:1196). */
export async function shipperHome(lang: Lang): Promise<HomeView> {
  const [active, late, cutoff, openRfq, lcExam, escrowIssues, submittedDocs, laneRows,
    demoMember, spend] =
    await Promise.all([
      db.select({ n }).from(shipments).where(lt(shipments.statusOrdinal, 7)),
      db.select({ n }).from(shipments)
        .where(and(eq(shipments.riskLevel, 2), lt(shipments.statusOrdinal, 7))),
      // Anchored to DATE_ANCHOR, not CURRENT_DATE: every etd resolves against the
      // prototype's fixed 2026-08-15 base, so wall-clock drift would silently zero this.
      db.select({ n }).from(shipments)
        .where(and(lt(shipments.statusOrdinal, 3),
          gte(shipments.etd, sql`${DATE_ANCHOR}::date`),
          lte(shipments.etd, sql`${DATE_ANCHOR}::date + 3`))),
      db.select({ n }).from(rfqs).where(and(eq(rfqs.statusCode, 'open'), lte(rfqs.closesInDays, 3))),
      db.select({ n }).from(lettersOfCredit).where(eq(lettersOfCredit.stepOrdinal, 4)),
      db.select({ n }).from(settlements).where(inArray(settlements.statusCode, ['exception', 'dispute'])),
      db.select({ n }).from(documents).where(eq(documents.statusCode, 'submitted')),
      db.select({
        code: lanes.code, price: lanes.indexPrice, change: lanes.changePct,
        origin: sql<string>`origin.name`, dest: sql<string>`dest.name`,
      })
        .from(lanes)
        .innerJoin(sql`${ports} AS origin`, sql`origin.code = ${lanes.originPortCode}`)
        .innerJoin(sql`${ports} AS dest`, sql`dest.code = ${lanes.destPortCode}`)
        .orderBy(asc(lanes.ord)).limit(5),
      // The prototype signs in as MEMBERS[0]; its credit line feeds the hero and KPIs.
      db.select({ limit: members.creditLimitMVnd, utilisation: members.utilisationPct })
        .from(members).orderBy(asc(members.id)).limit(1),
      // Freight spend: value of shipments loaded or beyond. shipments.value is USD
      // (qty x lane price), so this stays in USD — it is not a VND figure.
      db.select({ total: sql<number>`coalesce(sum(${shipments.value}), 0)::numeric` })
        .from(shipments).where(gte(shipments.statusOrdinal, 3)),
    ])

  const urgent = (late[0]?.n ?? 0) + (cutoff[0]?.n ?? 0) + (openRfq[0]?.n ?? 0)

  // The demo shipper is MEMBERS[0]; its credit line drives the hero tag and last KPI.
  // Limits are million VND (see CLAUDE.md), so /1000 gives the tỷ đ the UI shows.
  const demo = demoMember[0]
  const limitBn = Number(demo?.limit ?? 0) / 1000
  const utilisation = demo?.utilisation ?? 0
  const availableCredit = limitBn * (1 - utilisation / 100)
  const freightSpend = Number(spend[0]?.total ?? 0)

  return {
    heroTitle: t(lang, 'Chào buổi chiều, Vân 👋', 'Good afternoon, Vân 👋'),
    heroSub: t(lang,
      `Vinamilk Logistics · Founding 100 — bạn có ${urgent} việc cần xử lý hôm nay.`,
      `Vinamilk Logistics · Founding 100 — you have ${urgent} items to handle today.`),
    heroTags: [
      t(lang, 'Chủ hàng / BCO', 'Shipper / BCO'),
      t(lang, 'Hành lang 01 · ASEAN Gateway', 'Corridor 01 · ASEAN Gateway'),
      t(lang, `Hạn mức còn ${num(availableCredit, 1)} tỷ`, `${num(availableCredit, 1)}bn limit available`),
    ],
    // KPI set follows pageSHome (ui-2.html:1196). The prototype hardcodes the last two
    // figures; here they come from the member's own credit line and freight spend.
    kpis: [
      { label: t(lang, 'Lô đang chạy', 'Active shipments'), value: num(active[0]?.n ?? 0),
        meta: t(lang, 'trên 8 tuyến', 'across 8 lanes'), spark: walk(40, 20, 0.08, 2) },
      { label: t(lang, 'Sắp cắt máng ≤3 ngày', 'Cut-off within 3 days'), value: num(cutoff[0]?.n ?? 0),
        meta: t(lang, 'cần xác nhận chứng từ', 'documents to confirm'), metaTone: 'gd' },
      { label: t(lang, 'Cảnh báo trễ', 'Delay alerts'), value: num(late[0]?.n ?? 0),
        meta: t(lang, 'ảnh hưởng giao hàng', 'delivery at risk'), metaTone: 'd' },
      { label: t(lang, 'Chi cước đã xếp tàu', 'Freight loaded to date'),
        value: usd(freightSpend),
        meta: t(lang, `${num(openRfq[0]?.n ?? 0)} gói thầu đang chốt giá`, `${num(openRfq[0]?.n ?? 0)} tenders locking rates`),
        metaTone: 'u' },
      { label: t(lang, 'Hạn mức khả dụng', 'Available credit'),
        value: num(availableCredit, 1), unit: t(lang, 'tỷ đ', 'bn VND'),
        bar: utilisation,
        meta: t(lang, `đã dùng ${num(utilisation, 0)}%`, `${num(utilisation, 0)}% drawn`) },
    ],
    todos: [
      { icon: '⚠️',
        title: t(lang, `${late[0]?.n ?? 0} lô hàng đang trễ so với lịch`, `Shipments running late: ${late[0]?.n ?? 0}`),
        detail: t(lang, 'Tàu trễ vượt ngưỡng cam kết — có thể mở hồ sơ tranh chấp Tầng 1, escrow tự động giữ tiền',
          'Delay beyond the agreed threshold — a Tier-1 dispute can be opened and escrow will hold funds'),
        route: 's_ship', tone: 'd', badge: t(lang, 'Xử lý ngay', 'Act now') },
      { icon: '⏱️',
        title: t(lang, `${cutoff[0]?.n ?? 0} lô sắp cắt máng trong 3 ngày`, `Cut-off within 3 days: ${cutoff[0]?.n ?? 0}`),
        detail: t(lang, 'Cần nộp VGM và chỉ thị giao hàng trước hạn, nếu không sẽ bị rớt tàu',
          'VGM and shipping instructions due, otherwise the booking will be rolled'),
        route: 's_ship', tone: 'd', badge: t(lang, 'Trước 17:00', 'Before 17:00') },
      { icon: '📑',
        title: t(lang, `${openRfq[0]?.n ?? 0} gói thầu đóng trong 3 ngày`, `Tenders closing within 3 days: ${openRfq[0]?.n ?? 0}`),
        detail: t(lang, 'Đã nhận đủ báo giá — cần chấm điểm và trao thầu để chốt giá cho quý tới',
          'All bids received — score and award to lock rates for next quarter'),
        route: 's_rfq', tone: 'gd', badge: t(lang, 'Cần quyết định', 'Decision due') },
      { icon: '🧾',
        title: t(lang, `${lcExam[0]?.n ?? 0} bộ chứng từ L/C đang được ngân hàng kiểm tra`,
          `L/C document sets under bank examination: ${lcExam[0]?.n ?? 0}`),
        detail: t(lang, 'Có sai lệch được hệ thống đánh dấu — nên bổ sung trước khi ngân hàng trả lời chính thức',
          'The system flagged discrepancies — amend before the bank responds formally'),
        route: 's_lc', tone: 'gd', badge: t(lang, '5 ngày làm việc', '5 banking days') },
      { icon: '💳',
        title: t(lang, `${escrowIssues[0]?.n ?? 0} khoản escrow có sai lệch hoặc tranh chấp`,
          `Escrow items with an exception or dispute: ${escrowIssues[0]?.n ?? 0}`),
        detail: t(lang, 'Tiền đang được ngân hàng giữ cho tới khi đối soát xong — không ảnh hưởng booking khác',
          'Funds held by the bank until reconciliation completes — other bookings unaffected'),
        route: 's_fin', tone: 'b', badge: t(lang, 'Đang giữ', 'On hold') },
    ],
    shortcuts: [
      { icon: '🔎', label: t(lang, 'Tìm giá & đặt chỗ', 'Search & book'), route: 's_market' },
      { icon: '📑', label: t(lang, 'Tạo gói thầu', 'Create a tender'), route: 's_rfq' },
      { icon: '🧾', label: t(lang, 'Mở L/C mới', 'Open an L/C'), route: 's_lc' },
      { icon: '📄', label: t(lang, 'Kho chứng từ', 'Document vault'), route: 's_docs' },
      { icon: '💳', label: t(lang, 'Ví & tài trợ', 'Wallet & financing'), route: 's_fin' },
      { icon: '🔐', label: t(lang, 'Dữ liệu của tôi', 'My data'), route: 's_consent' },
    ],
    panel: {
      title: t(lang, 'Giá tuyến chính của bạn', 'Your main lane rates'),
      rows: laneRows.map((l) => ({
        title: l.code,
        sub: `${l.origin} → ${l.dest}`,
        value: usd(l.price),
        delta: `${Number(l.change) > 0 ? '+' : ''}${num(l.change, 1)}%`,
        deltaTone: (Number(l.change) > 0 ? 'u' : 'd') as 'u' | 'd',
      })),
      footerLabel: t(lang, 'Xem toàn bộ báo giá', 'See all live quotes'),
      footerRoute: 's_market',
    },
  }
}

/** c_home — Pacific Lines VN home (ui-2.html:1246). */
export async function carrierHome(lang: Lang): Promise<HomeView> {
  const [lowFill, openTenders, closingSoon, draftVoyages, exceptions, pending, unsold] =
    await Promise.all([
      // Lane-weeks under 70% fill with the cut-off inside three weeks.
      db.select({
        lane: rateCards.laneCode,
        week: rateCards.week,
        remaining: rateCards.remaining,
        fill: rateCards.fillPct,
        daysOut: rateCards.daysOut,
      }).from(rateCards)
        .where(and(lt(rateCards.fillPct, 70), lte(rateCards.daysOut, 21)))
        .orderBy(asc(rateCards.fillPct)),
      db.select({ n }).from(rfqs).where(eq(rfqs.statusCode, 'open')),
      db.select({ n }).from(rfqs).where(and(eq(rfqs.statusCode, 'open'), lte(rfqs.closesInDays, 2))),
      db.select({ n }).from(voyages).where(eq(voyages.statusCode, 'draft')),
      db.select({ n }).from(settlements).where(eq(settlements.statusCode, 'exception')),
      db.select({ n }).from(settlements).where(eq(settlements.statusCode, 'pending')),
      db.select({ v: sum(rateCards.remaining) }).from(rateCards),
    ])

  const unsoldTeu = Number(unsold[0]?.v ?? 0)
  const closing = closingSoon[0]?.n ?? 0
  const drafts = draftVoyages[0]?.n ?? 0
  const excCount = exceptions[0]?.n ?? 0
  const earlyCount = pending[0]?.n ?? 0

  return {
    heroTitle: t(lang, 'Chào buổi chiều, Long 👋', 'Good afternoon, Long 👋'),
    heroSub: t(lang,
      `Pacific Lines VN · Đối tác sáng lập — ${num(unsoldTeu)} TEU còn trống trong 13 tuần tới.`,
      `Pacific Lines VN · Founding partner — ${num(unsoldTeu)} TEU unsold over the next 13 weeks.`),
    heroTags: [
      t(lang, 'Hãng tàu / NCC', 'Carrier / Provider'),
      t(lang, '3 hành lang', '3 corridors'),
      t(lang, 'Hạng tuân thủ: Tốt', 'Compliance: Good'),
    ],
    kpis: [
      {
        label: t(lang, 'Chỗ còn trống', 'Unsold capacity'),
        value: num(unsoldTeu), unit: 'TEU',
        meta: t(lang, `${lowFill.length} tuyến-tuần dưới 70%`, `${lowFill.length} lane-weeks below 70%`),
        metaTone: 'gd',
      },
      {
        label: t(lang, 'Lời mời thầu đang mở', 'Open tender invitations'),
        value: num(openTenders[0]?.n ?? 0),
        meta: t(lang, `${closing} đóng trong 48 giờ`, `${closing} close within 48h`),
        metaTone: 'd',
      },
      {
        label: t(lang, 'Chuyến chưa chào giá', 'Voyages not yet quoted'),
        value: num(drafts),
        meta: t(lang, 'trợ lý AI đã có đề xuất', 'AI assistant has proposals'),
        metaTone: 'b',
      },
      {
        label: t(lang, 'Chờ thanh toán', 'Pending payout'),
        value: '11.4', unit: t(lang, 'tỷ đ', 'bn VND'),
        meta: t(lang, 'có thể nhận sớm trong 4 giờ', 'early payout within 4 hours'),
        metaTone: 'gd',
      },
      {
        label: t(lang, 'Tỷ lệ lấp đầy', 'Slot utilisation'),
        value: '87.4', unit: '%', meta: '+6,1 pp', metaTone: 'u',
        spark: walk(80, 20, 0.03, 9), sparkColor: 'var(--up)',
      },
    ],
    todos: [
      {
        icon: '📥',
        title: t(lang, `${closing} gói thầu đóng trong 48 giờ`, `Tenders closing within 48 hours: ${closing}`),
        detail: t(lang,
          'Chưa gửi chào giá — hệ thống đã ước tính giá thắng và biên lợi nhuận cho từng gói',
          'No bid submitted yet — the system has estimated the winning price and margin for each'),
        route: 'c_bids', tone: 'd', badge: t(lang, 'Gấp', 'Urgent'),
      },
      {
        icon: '📉',
        title: t(lang, `${lowFill.length} tuyến-tuần lấp đầy dưới 70%`, `Lane-weeks below 70% fill: ${lowFill.length}`),
        detail: t(lang,
          'Sắp tới hạn cắt máng. Trợ lý định giá đề xuất mức giá tối ưu doanh thu cho từng ô',
          'Cut-off approaching. The pricing assistant proposes a revenue-optimal rate per cell'),
        route: 'c_inv', tone: 'gd', badge: t(lang, 'Định giá', 'Reprice'),
      },
      {
        icon: '✨',
        title: t(lang, `${drafts} chuyến sắp cập cảng chưa có giỏ dịch vụ`,
          `Arriving voyages without a service basket: ${drafts}`),
        detail: t(lang,
          'AI đã phân tích manifest và đề xuất 3 phương án — bạn chỉ cần chọn và duyệt',
          'AI has analysed the manifest and proposed 3 options — select and approve'),
        route: 'c_offer', tone: 'b', badge: t(lang, 'Trợ lý AI', 'AI assistant'),
      },
      {
        icon: '🧾',
        title: t(lang, `${excCount} khoản đối soát có sai lệch`, `Reconciliation exceptions: ${excCount}`),
        detail: t(lang,
          'Lệch giữa booking, chứng từ và hoá đơn — cần xử lý để không chặn thanh toán',
          'Mismatch across booking, documents and invoice — resolve to unblock payment'),
        route: 'c_settle', tone: 'gd', badge: t(lang, 'Đối soát', 'Reconcile'),
      },
      {
        icon: '⚡',
        title: t(lang, `${earlyCount} khoản phải thu đủ điều kiện nhận tiền sớm`,
          `Receivables eligible for early payout: ${earlyCount}`),
        detail: t(lang,
          'Phí chiết khấu 0,42% — tiền về trong 4 giờ nếu ngân hàng phê duyệt',
          '0.42% discount fee — funded within 4 hours subject to bank approval'),
        route: 'c_settle', tone: 'b', badge: t(lang, 'Tuỳ chọn', 'Optional'),
      },
      {
        icon: '📊',
        title: t(lang, 'Giá của bạn đang cao hơn chỉ số ở 2 tuyến',
          'Your rates are above index on 2 lanes'),
        detail: t(lang,
          'Chênh trên 4% so với VLX Index — nguy cơ mất khối lượng vào tay đối thủ',
          'Over 4% above the VLX Index — volume may shift to competitors'),
        route: 'c_inv', tone: 'b', badge: t(lang, 'Theo dõi', 'Watch'),
      },
    ],
    shortcuts: [
      { icon: '🗂️', label: t(lang, 'Niêm yết giá', 'Publish rates'), route: 'c_inv' },
      { icon: '✨', label: t(lang, 'Trợ lý chào giá', 'Offering assistant'), route: 'c_offer' },
      { icon: '📥', label: t(lang, 'Hộp thầu', 'Bid inbox'), route: 'c_bids' },
      { icon: '📈', label: t(lang, 'Bảng điều khiển', 'Dashboard'), route: 'c_dash' },
      { icon: '🧾', label: t(lang, 'Đối soát', 'Reconciliation'), route: 'c_settle' },
      { icon: '⚡', label: t(lang, 'Nhận tiền sớm', 'Get paid early'), route: 'c_settle' },
    ],
    panel: {
      title: t(lang, 'Tuyến cần chú ý', 'Lanes needing attention'),
      rows: lowFill.slice(0, 6).map((r) => ({
        title: `${r.lane} · ${r.week}`,
        sub: t(lang,
          `còn ${r.remaining} TEU · cắt máng sau ${r.daysOut}d`,
          `${r.remaining} TEU left · cut-off in ${r.daysOut}d`),
        value: `${r.fill}%`,
        meter: { value: r.fill, color: r.fill < 60 ? 'var(--down)' : 'var(--gold-500)' },
      })),
      footerLabel: t(lang, 'Mở bảng cước', 'Open the rate card'),
      footerRoute: 'c_inv',
    },
  }
}
