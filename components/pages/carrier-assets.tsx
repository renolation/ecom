import { asc, eq, sql } from 'drizzle-orm'
import { Donut } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  assetTypes, fleetAssets, fleetStatuses, lifecycleStages, ownershipTypes, productGroups,
  productIndustries, productStatuses, products, settlements, settlementTriggers,
} from '@/db/schema'
import { num, t, usd, type Lang } from '@/lib/i18n'
import { laneOptions, productGroupOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import type { RoutePageProps } from './page-props'

/** c_fleet — Transport Asset 360 (ui-2.html:2843). */
export async function FleetPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, statuses, owners, laneOpts] = await Promise.all([
    db.select({
      id: fleetAssets.id,
      typeCode: fleetAssets.assetTypeCode,
      typeVi: assetTypes.nameVi,
      typeEn: assetTypes.nameEn,
      icon: assetTypes.icon,
      name: fleetAssets.name,
      isShip: fleetAssets.isShip,
      capacity: fleetAssets.capacity,
      unit: fleetAssets.capacityUnit,
      built: fleetAssets.builtYear,
      age: fleetAssets.age,
      flag: fleetAssets.flag,
      classSociety: fleetAssets.classSociety,
      status: fleetAssets.statusCode,
      statusVi: fleetStatuses.nameVi,
      statusEn: fleetStatuses.nameEn,
      ownership: fleetAssets.ownershipCode,
      ownerVi: ownershipTypes.nameVi,
      ownerEn: ownershipTypes.nameEn,
      lane: fleetAssets.laneCode,
      utilisation: fleetAssets.utilisationPct,
      position: fleetAssets.position,
      cii: fleetAssets.ciiGrade,
      certDays: fleetAssets.certDays,
      maintDue: fleetAssets.maintDueDays,
      opex: fleetAssets.opex,
      revenue: fleetAssets.revenue,
      value: fleetAssets.assetValue,
      financed: fleetAssets.isFinanced,
      dscr: fleetAssets.dscr,
      imo: fleetAssets.imo,
    })
      .from(fleetAssets)
      .innerJoin(assetTypes, eq(assetTypes.code, fleetAssets.assetTypeCode))
      .innerJoin(fleetStatuses, eq(fleetStatuses.code, fleetAssets.statusCode))
      .innerJoin(ownershipTypes, eq(ownershipTypes.code, fleetAssets.ownershipCode))
      .orderBy(asc(fleetAssets.id)),
    db.select().from(assetTypes).orderBy(asc(assetTypes.ord)),
    db.select().from(fleetStatuses),
    db.select().from(ownershipTypes),
    laneOptions(),
  ])

  const attention = rows.filter((r) => r.certDays < 45 || r.maintDue < 21)
  const active = rows.filter((r) => r.status === 'active')
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)
  const totalOpex = rows.reduce((a, r) => a + Number(r.opex), 0)
  const totalRevenue = rows.reduce((a, r) => a + Number(r.revenue), 0)
  const avgUtil = rows.reduce((a, r) => a + r.utilisation, 0) / rows.length

  const byStatus = statuses.map((s, i) => ({
    label: lang === 'vi' ? s.nameVi : s.nameEn,
    v: rows.filter((r) => r.status === s.code).length,
    c: ['var(--up)', 'var(--text-3)', 'var(--gold-500)', 'var(--down)', 'var(--brand-500)'][i % 5],
  })).filter((x) => x.v > 0)

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Tài sản & Sản phẩm', 'Carrier · Assets & Products')}
        title={t(lang, 'Phương tiện vận tải 360', 'Transport Asset 360')}
        modules={['F09']}
        sub={t(lang,
          'Toàn bộ đội phương tiện: tàu, sà lan, đầu kéo, container và thiết bị bãi — kèm khai thác, chứng chỉ, chi phí và tài trợ.',
          'The whole fleet — vessels, barges, tractors, containers and yard equipment — with utilisation, certificates, cost and financing.')}
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng phương tiện', 'Total assets')} value={num(rows.length)}
          meta={t(lang, `${num(active.length)} đang khai thác`, `${num(active.length)} in service`)} />
        <KpiTile label={t(lang, 'Cần chú ý', 'Needs attention')} value={num(attention.length)}
          meta={t(lang, 'chứng chỉ / bảo dưỡng', 'certificates / maintenance')} metaTone="d" />
        <KpiTile label={t(lang, 'Khai thác bình quân', 'Average utilisation')} value={num(avgUtil, 1)} unit="%"
          bar={avgUtil} />
        <KpiTile label={t(lang, 'Giá trị tài sản', 'Asset value')} value={num(totalValue)}
          unit={t(lang, 'tỷ đ', 'bn VND')} />
        <KpiTile label={t(lang, 'Doanh thu / chi phí', 'Revenue / opex')}
          value={num(totalRevenue / totalOpex, 2)} unit="×"
          meta={t(lang, `${num(totalOpex)} tỷ chi phí`, `${num(totalOpex)}bn opex`)}
          metaTone={totalRevenue > totalOpex ? 'u' : 'd'} />
      </div>

      <div className="grid g-1-2" style={{ marginBottom: 14 }}>
        <Card title={t(lang, 'Theo trạng thái', 'By status')}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Donut items={byStatus} size={150} />
          </div>
          <Legend items={byStatus.map((s) => ({ color: s.c, label: `${s.label} (${s.v})` }))} />
        </Card>
        <Card title={t(lang, 'Theo loại phương tiện', 'By asset class')}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t(lang, 'Loại', 'Class')}</th>
                <th className="r">{t(lang, 'Số lượng', 'Count')}</th>
                <th>{t(lang, 'Khai thác', 'Utilisation')}</th>
                <th className="r">{t(lang, 'Giá trị', 'Value')}</th>
              </tr>
            </thead>
            <tbody>
              {types.map((ty) => {
                const group = rows.filter((r) => r.typeCode === ty.code)
                if (!group.length) return null
                const util = group.reduce((a, r) => a + r.utilisation, 0) / group.length
                const val = group.reduce((a, r) => a + Number(r.value), 0)
                return (
                  <tr key={ty.code}>
                    <td><span style={{ marginRight: 6 }}>{ty.icon}</span><b style={{ fontSize: 12 }}>{lang === 'vi' ? ty.nameVi : ty.nameEn}</b></td>
                    <td className="r num">{group.length}</td>
                    <td><Meter value={util} width={70} /></td>
                    <td className="r num">{num(val)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <DataTable
        id="fleet" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Danh sách phương tiện', 'Asset register')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm tên, IMO, vị trí…', 'Search name, IMO, position…')}
        search={(r) => `${r.id} ${r.name} ${r.imo} ${r.position} ${r.flag}`}
        filters={[
          {
            key: 'ty', label: t(lang, 'Loại', 'Class'),
            options: types.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => r.typeCode === v,
          },
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statuses.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => r.status === v,
          },
          {
            key: 'own', label: t(lang, 'Sở hữu', 'Ownership'),
            options: owners.map((x) => [x.code, lang === 'vi' ? x.nameVi : x.nameEn]),
            match: (r, v) => r.ownership === v,
          },
          {
            key: 'att', label: t(lang, 'Cần chú ý', 'Attention'),
            options: [['1', t(lang, 'Có', 'Yes')]],
            match: (r) => r.certDays < 45 || r.maintDue < 21,
          },
        ]}
        columns={[
          {
            key: 'name', header: t(lang, 'Phương tiện', 'Asset'), width: '20%', sortValue: (r) => r.name,
            render: (r) => (
              <div className="flex" style={{ gap: 7 }}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <div>
                  <b style={{ fontSize: 12 }}>{r.name}</b>
                  <div className="muted num">{r.id} {r.isShip ? `· ${r.imo}` : ''}</div>
                </div>
              </div>
            ),
          },
          {
            key: 'cap', header: t(lang, 'Sức chở', 'Capacity'), cls: 'r', width: '10%', sortValue: (r) => r.capacity,
            render: (r) => <><b className="num">{num(r.capacity)}</b> <span className="muted">{r.unit}</span></>,
          },
          {
            key: 'age', header: t(lang, 'Tuổi', 'Age'), cls: 'c', width: '7%', sortValue: (r) => r.age ?? 0,
            render: (r) => <div><b className="num">{r.age}</b><div className="muted num">{r.built}</div></div>,
          },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), width: '12%', sortValue: (r) => r.status,
            render: (r) => (
              <div>
                <Tag tone={r.status === 'active' ? 'u' : r.status === 'drydock' ? 'd' : r.status === 'maint' ? 'gd' : 'n'}>
                  {lang === 'vi' ? r.statusVi : r.statusEn}
                </Tag>
                <div className="muted">{lang === 'vi' ? r.ownerVi : r.ownerEn}</div>
              </div>
            ),
          },
          { key: 'util', header: t(lang, 'Khai thác', 'Utilisation'), width: '11%', sortValue: (r) => r.utilisation, render: (r) => <Meter value={r.utilisation} width={64} /> },
          {
            key: 'cert', header: t(lang, 'Chứng chỉ', 'Certificate'), cls: 'c', width: '10%', sortValue: (r) => r.certDays,
            render: (r) => r.certDays < 0
              ? <Tag tone="d">{t(lang, 'Hết hạn', 'Expired')}</Tag>
              : <span className={r.certDays < 45 ? 'num' : 'num muted'} style={r.certDays < 45 ? { color: 'var(--down)' } : undefined}>
                {r.certDays} {t(lang, 'ngày', 'd')}
              </span>,
          },
          {
            key: 'maint', header: t(lang, 'Bảo dưỡng', 'Maintenance'), cls: 'c', width: '10%', sortValue: (r) => r.maintDue,
            render: (r) => <span className={r.maintDue < 21 ? 'num' : 'num muted'} style={r.maintDue < 21 ? { color: 'var(--gold-500)' } : undefined}>
              {r.maintDue} {t(lang, 'ngày', 'd')}
            </span>,
          },
          {
            key: 'fin', header: t(lang, 'Tài chính', 'Financials'), cls: 'r', width: '12%', sortValue: (r) => Number(r.value),
            render: (r) => (
              <div>
                <b className="num">{num(r.value)}</b>
                <div className="muted num">
                  {r.financed ? `DSCR ${Number(r.dscr).toFixed(2)}` : t(lang, 'không vay', 'unlevered')}
                </div>
              </div>
            ),
          },
          {
            key: 'cii', header: 'CII', cls: 'c', width: '6%', sortValue: (r) => r.cii,
            render: (r) => r.cii === '—'
              ? <span className="muted">—</span>
              : <Tag tone={['A', 'B'].includes(r.cii) ? 'u' : r.cii === 'C' ? 'gd' : 'd'}>{r.cii}</Tag>,
          },
        ]}
      />
    </>
  )
}

/** c_settle — Reconciliation & Payout (ui-2.html:2702). */
export async function CarrierSettlementPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, labels] = await Promise.all([
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
      early: settlements.earlyPayment,
    })
      .from(settlements)
      .innerJoin(settlementTriggers, eq(settlementTriggers.id, settlements.triggerId))
      .orderBy(asc(settlements.settledOn)),
    statusLabelMap(lang),
  ])

  const unmatched = rows.filter((r) => !r.matched)
  const paid = rows.filter((r) => r.status === 'paid')
  const totalPayout = paid.reduce((a, r) => a + Number(r.amount), 0)
  const matchRate = (rows.filter((r) => r.matched).length / rows.length) * 100

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Sau giao dịch', 'Carrier · Post-trade')}
        title={t(lang, 'Đối soát & Thanh toán', 'Reconciliation & Payout')}
        modules={['F08']}
        sandbox={['SB-07']}
        sub={t(lang,
          'Khớp mốc giao hàng với lệnh chi của ngân hàng. Nền tảng không giữ tiền — chỉ tạo mã tham chiếu và đối soát.',
          'Match delivery milestones to bank payment instructions. The platform holds no funds — it issues references and reconciles.')}
      />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Đã chi trả', 'Paid out')} value={usd(totalPayout)}
          meta={t(lang, `${num(paid.length)} khoản`, `${num(paid.length)} items`)} metaTone="u" />
        <KpiTile label={t(lang, 'Tỷ lệ khớp tự động', 'Auto-match rate')} value={num(matchRate, 1)} unit="%"
          bar={matchRate} />
        <KpiTile label={t(lang, 'Chưa khớp', 'Unmatched')} value={num(unmatched.length)}
          meta={t(lang, 'cần đối soát thủ công', 'manual reconciliation')} metaTone="gd" />
        <KpiTile label={t(lang, 'Thanh toán sớm', 'Early payment')}
          value={num(rows.filter((r) => r.early).length)}
          meta={t(lang, 'đã nhận chiết khấu', 'discount taken')} metaTone="b" />
      </div>

      <DataTable
        id="cset" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Đối soát theo mốc', 'Milestone reconciliation')} rows={rows}
        searchPlaceholder={t(lang, 'Tìm mã, lô hàng, mã chi…', 'Search reference, shipment, payment ref…')}
        search={(r) => `${r.id} ${r.shipment} ${r.counterparty} ${r.ref}`}
        filters={[
          {
            key: 'st', label: t(lang, 'Trạng thái', 'Status'),
            options: statusOptions(labels, ['paid', 'pending', 'exception', 'dispute']),
            match: (r, v) => r.status === v,
          },
          {
            key: 'match', label: t(lang, 'Khớp', 'Matched'),
            options: [['1', t(lang, 'Đã khớp', 'Matched')], ['0', t(lang, 'Chưa khớp', 'Unmatched')]],
            match: (r, v) => (v === '1' ? r.matched : !r.matched),
          },
        ]}
        columns={[
          { key: 'id', header: t(lang, 'Mã quyết toán', 'Settlement'), width: '14%', sortValue: (r) => r.id, render: (r) => <b className="num" style={{ fontSize: 12 }}>{r.id}</b> },
          { key: 'ship', header: t(lang, 'Lô hàng', 'Shipment'), width: '15%', sortValue: (r) => r.shipment, render: (r) => <span className="num" style={{ fontSize: 11.5 }}>{r.shipment}</span> },
          { key: 'cp', header: t(lang, 'Chủ hàng', 'Shipper'), width: '18%', sortValue: (r) => r.counterparty, render: (r) => <span style={{ fontSize: 12 }}>{r.counterparty}</span> },
          {
            key: 'trig', header: t(lang, 'Mốc', 'Trigger'), width: '15%',
            sortValue: (r) => (lang === 'vi' ? r.triggerVi : r.triggerEn),
            render: (r) => <span style={{ fontSize: 12 }}>{lang === 'vi' ? r.triggerVi : r.triggerEn}</span>,
          },
          { key: 'amt', header: t(lang, 'Số tiền', 'Amount'), cls: 'r', width: '11%', sortValue: (r) => Number(r.amount), render: (r) => <b className="num">{usd(r.amount)}</b> },
          { key: 'ref', header: t(lang, 'Mã chi', 'Payment ref'), cls: 'c', width: '10%', sortValue: (r) => r.ref, render: (r) => <span className="num muted">{r.ref}</span> },
          {
            key: 'match', header: t(lang, 'Khớp', 'Match'), cls: 'c', width: '8%', sortValue: (r) => (r.matched ? 1 : 0),
            render: (r) => r.matched ? <Tag tone="u">✓</Tag> : <Tag tone="gd">!</Tag>,
          },
          {
            key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '9%', sortValue: (r) => r.status,
            render: (r) => <Tag tone={(labels.get(r.status)?.tone ?? 'n') as Tone}>{labels.get(r.status)?.label ?? r.status}</Tag>,
          },
        ]}
      />
    </>
  )
}
