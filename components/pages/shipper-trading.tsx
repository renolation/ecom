import { asc, eq } from 'drizzle-orm'
import { DataTable } from '@/components/table/data-table'
import { KpiTile, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import { bids, carriers, lanes, offers, ports, rfqs, members, rfqScopes } from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import {
  carrierOptions, equipmentOptions, laneOptions, statusLabelMap, statusOptions,
} from '@/lib/queries/lookups'
import type { RoutePageProps } from './page-props'
import type { Tone } from '@/lib/queries/home-types'

/** s_rfq — RFQ / Tenders (ui-2.html:1620). */
export async function RfqPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels, laneOpts] = await Promise.all([
    db.select({
      id: rfqs.id,
      lane: rfqs.laneCode,
      scopeVi: rfqScopes.nameVi,
      scopeEn: rfqScopes.nameEn,
      shipper: members.name,
      volume: rfqs.volume,
      bidCount: rfqs.bidCount,
      invited: rfqs.invited,
      status: rfqs.statusCode,
      closesIn: rfqs.closesInDays,
      indexPrice: rfqs.indexPrice,
      bestPrice: rfqs.bestPrice,
      saving: rfqs.savingPct,
      value: rfqs.value,
    })
      .from(rfqs)
      .innerJoin(rfqScopes, eq(rfqScopes.id, rfqs.scopeId))
      .innerJoin(members, eq(members.id, rfqs.shipperMemberId))
      .orderBy(asc(rfqs.closesInDays)),
    statusLabelMap(lang),
    laneOptions(),
  ])

  const open = rows.filter((r) => r.status === 'open')
  const awarded = rows.filter((r) => r.status === 'awarded')
  const avgSaving = awarded.reduce((a, r) => a + Number(r.saving), 0) / (awarded.length || 1)
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Chủ hàng · Giao dịch', 'Shipper · Trading')}
        title={t(lang, 'RFQ / Đấu thầu', 'RFQ / Tenders')}
        modules={['F04']}
        sandbox={['SB-01']}
        sub={t(lang,
          'Gói thầu khối lượng gửi tới nhiều hãng tàu cùng lúc. Hệ thống chấm điểm theo giá, thời gian và độ tin cậy; quyết định trao thầu thuộc về bạn.',
          'Volume tenders sent to several carriers at once. The platform scores price, transit and reliability; the award decision stays yours.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Đang mở', 'Open')} value={num(open.length)}
          meta={t(lang, `${open.filter((r) => r.closesIn <= 3).length} đóng trong 3 ngày`, `${open.filter((r) => r.closesIn <= 3).length} close within 3 days`)}
          metaTone="gd" />
        <KpiTile label={t(lang, 'Đã trao thầu', 'Awarded')} value={num(awarded.length)} metaTone="u"
          meta={t(lang, 'chốt giá kỳ tới', 'rates locked')} />
        <KpiTile label={t(lang, 'Tiết kiệm bình quân', 'Average saving')} value={num(avgSaving, 1)} unit="%"
          meta={t(lang, 'so với chỉ số tuyến', 'against the lane index')} metaTone="u" />
        <KpiTile label={t(lang, 'Tổng giá trị', 'Total value')} value={num(totalValue)}
          unit={t(lang, 'nghìn $', 'k$')} />
      </div>

      <DataTable
        id="rfq"
        lang={lang}
        basePath={basePath}
        searchParams={searchParams}
        title={t(lang, 'Gói thầu', 'Tenders')}
        rows={rows}
        searchPlaceholder={t(lang, 'Tìm mã thầu, tuyến, chủ hàng…', 'Search reference, lane, shipper…')}
        search={(r) => `${r.id} ${r.lane} ${r.shipper} ${r.scopeVi} ${r.scopeEn}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['open', 'eval', 'awarded', 'cancel']),
            match: (r, v) => r.status === v,
          },
          { key: 'lane', label: t(lang, 'Tuyến', 'Lane'), options: laneOpts, match: (r, v) => r.lane === v },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã thầu', 'Reference'), width: '14%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          {
            key: 'scope', header: t(lang, 'Phạm vi', 'Scope'), width: '20%',
            sortValue: (r) => (lang === 'vi' ? r.scopeVi : r.scopeEn),
            render: (r) => (
              <div>
                <b style={{ fontSize: 12 }}>{lang === 'vi' ? r.scopeVi : r.scopeEn}</b>
                <div className="muted">{r.lane} · {num(r.volume)} TEU</div>
              </div>
            ),
          },
          { key: 'shipper', header: t(lang, 'Chủ hàng', 'Shipper'), width: '17%', sortValue: (r) => r.shipper, render: (r) => <span style={{ fontSize: 12 }}>{r.shipper}</span> },
          {
            key: 'bids', header: t(lang, 'Chào giá', 'Bids'), cls: 'c', width: '9%',
            sortValue: (r) => r.bidCount,
            render: (r) => <><b className="num">{r.bidCount}</b> <span className="muted">/ {r.invited}</span></>,
          },
          {
            key: 'best', header: t(lang, 'Giá tốt nhất', 'Best price'), cls: 'r', width: '13%',
            sortValue: (r) => Number(r.bestPrice),
            render: (r) => (
              <div>
                <b className="num" style={{ fontSize: 12.5 }}>{usd(r.bestPrice)}</b>
                <div className="muted num">{t(lang, 'chỉ số', 'index')} {usd(r.indexPrice)}</div>
              </div>
            ),
          },
          {
            key: 'saving', header: t(lang, 'Tiết kiệm', 'Saving'), cls: 'r', width: '9%',
            sortValue: (r) => Number(r.saving),
            render: (r) => <Tag tone="u">{pct(r.saving)}</Tag>,
          },
          {
            key: 'close', header: t(lang, 'Đóng thầu', 'Closes'), cls: 'c', width: '9%',
            sortValue: (r) => r.closesIn,
            render: (r) => r.closesIn > 0
              ? <span className={r.closesIn <= 3 ? 'num' : 'num muted'}>{r.closesIn} {t(lang, 'ngày', 'd')}</span>
              : <span className="muted">—</span>,
          },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%',
            sortValue: (r) => r.status,
            render: (r) => {
              const s = labels.get(r.status)
              return <Tag tone={(s?.tone ?? 'n') as Tone}>{s?.label ?? r.status}</Tag>
            },
          },
        ]}
      />
    </>
  )
}
