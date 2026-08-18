import { and, asc, avg, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'
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

/** Carrier / service provider — mirrors pageCHome (ui-2.html:1246). */
export async function carrierHome(lang: Lang): Promise<HomeView> {
  const [openTenders, attention, avgFill, unpublished, wonVoyages, idleAssets] = await Promise.all([
    db.select({ n }).from(rfqs).where(eq(rfqs.statusCode, 'open')),
    db.select({ n }).from(fleetAssets)
      .where(or(lt(fleetAssets.certDays, 45), lt(fleetAssets.maintDueDays, 21))),
    db.select({ v: avg(rateCards.fillPct) }).from(rateCards),
    db.select({ n }).from(rateCards).where(eq(rateCards.published, false)),
    db.select({ n }).from(voyages).where(eq(voyages.statusCode, 'won')),
    db.select({ n }).from(fleetAssets).where(eq(fleetAssets.statusCode, 'idle')),
  ])

  return {
    heroTitle: t(lang, 'Chào buổi chiều, Pacific Lines 👋', 'Good afternoon, Pacific Lines 👋'),
    heroSub: t(lang,
      `Đối tác sáng lập — ${openTenders[0]?.n ?? 0} gói thầu đang mở và ${attention[0]?.n ?? 0} phương tiện cần chú ý.`,
      `Founding partner — ${openTenders[0]?.n ?? 0} open tenders and ${attention[0]?.n ?? 0} assets need attention.`),
    heroTags: [
      t(lang, 'Hãng tàu / NCC dịch vụ', 'Carrier / Service Provider'),
      t(lang, 'Pacific Lines VN', 'Pacific Lines VN'),
    ],
    kpis: [
      { label: t(lang, 'Lấp đầy trung bình', 'Average fill rate'),
        value: num(avgFill[0]?.v ?? 0, 1), unit: '%', bar: Number(avgFill[0]?.v ?? 0) },
      { label: t(lang, 'Hộp thầu đang mở', 'Open bid inbox'), value: num(openTenders[0]?.n ?? 0),
        meta: t(lang, 'cần chào giá', 'awaiting your quote'), metaTone: 'gd' },
      { label: t(lang, 'Phương tiện cần chú ý', 'Assets needing attention'), value: num(attention[0]?.n ?? 0),
        meta: t(lang, 'chứng chỉ hoặc bảo dưỡng', 'certificates or maintenance'), metaTone: 'd' },
      { label: t(lang, 'Chuyến đã chốt', 'Voyages won'), value: num(wonVoyages[0]?.n ?? 0),
        meta: t(lang, 'trong danh mục chào giá', 'in the offering pipeline'), metaTone: 'u' },
      { label: t(lang, 'Ô giá chưa công bố', 'Unpublished rate cells'), value: num(unpublished[0]?.n ?? 0),
        meta: t(lang, 'trên bản đồ nhiệt', 'on the heatmap') },
    ],
    todos: [
      { icon: '📥',
        title: t(lang, `${openTenders[0]?.n ?? 0} gói thầu đang chờ chào giá`, `Tenders awaiting your bid: ${openTenders[0]?.n ?? 0}`),
        detail: t(lang, 'Chào giá trước khi đóng thầu để không mất lượt phân bổ khối lượng',
          'Submit before close or lose the volume allocation round'),
        route: 'c_bids', tone: 'd', badge: t(lang, 'Ưu tiên', 'Priority') },
      { icon: '🚢',
        title: t(lang, `${attention[0]?.n ?? 0} phương tiện sắp hết hạn chứng chỉ hoặc đến kỳ bảo dưỡng`,
          `Assets with expiring certificates or due maintenance: ${attention[0]?.n ?? 0}`),
        detail: t(lang, 'Chứng chỉ hết hạn sẽ chặn khai thác — đặt lịch đăng kiểm và lên đà sớm',
          'An expired certificate blocks operation — schedule survey and dry-docking early'),
        route: 'c_fleet', tone: 'd', badge: t(lang, 'Chặn khai thác', 'Blocks service') },
      { icon: '🗂️',
        title: t(lang, `${unpublished[0]?.n ?? 0} ô giá chưa công bố`, `Unpublished rate cells: ${unpublished[0]?.n ?? 0}`),
        detail: t(lang, 'Giá chưa công bố không xuất hiện trong kết quả tìm kiếm của chủ hàng',
          'Unpublished rates do not appear in shipper search results'),
        route: 'c_inv', tone: 'gd', badge: t(lang, 'Mất hiển thị', 'Not visible') },
      { icon: '⛴️',
        title: t(lang, `${idleAssets[0]?.n ?? 0} phương tiện đang chờ việc`, `Assets currently idle: ${idleAssets[0]?.n ?? 0}`),
        detail: t(lang, 'Cân nhắc chào chuyến hoặc cho thuê ngoài để giảm chi phí neo đậu',
          'Consider offering a voyage or chartering out to reduce lay-up cost'),
        route: 'c_offer', tone: 'b', badge: t(lang, 'Cơ hội', 'Opportunity') },
      { icon: '🧾',
        title: t(lang, 'Đối soát và thanh toán kỳ này', 'Reconciliation and payout this period'),
        detail: t(lang, 'Khớp mốc giao hàng với lệnh chi để giải phóng escrow đúng hạn',
          'Match delivery milestones to payment instructions so escrow releases on time'),
        route: 'c_settle', tone: 'b', badge: t(lang, 'Theo dõi', 'Monitor') },
    ],
    shortcuts: [
      { icon: '📈', label: t(lang, 'Bảng điều khiển', 'Dashboard'), route: 'c_dash' },
      { icon: '🗂️', label: t(lang, 'Năng lực & niêm yết giá', 'Capacity & rates'), route: 'c_inv' },
      { icon: '✨', label: t(lang, 'Trợ lý chào giá', 'Offering assistant'), route: 'c_offer' },
      { icon: '📥', label: t(lang, 'Hộp thầu', 'Bid inbox'), route: 'c_bids' },
      { icon: '🚢', label: t(lang, 'Phương tiện 360', 'Transport Asset 360'), route: 'c_fleet' },
      { icon: '📦', label: t(lang, 'Sản phẩm 360', 'Product 360'), route: 'c_product' },
    ],
  }
}
