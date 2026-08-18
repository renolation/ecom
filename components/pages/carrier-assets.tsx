import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { Donut, LineChart, walk } from '@/components/charts'
import { DataTable } from '@/components/table/data-table'
import { Card, KpiTile, Legend, Meter, PageHeader, Tag } from '@/components/ui'
import { db } from '@/lib/db'
import {
  assetTypes, corridors, fleetAssets, fleetStatuses, lifecycleStages, ownershipTypes, productGroups,
  productIndustries, productStatuses, products, settlements, settlementTriggers,
} from '@/db/schema'
import { monthLabels, num, t, usd, type Lang } from '@/lib/i18n'
import { laneOptions, productGroupOptions, statusLabelMap, statusOptions } from '@/lib/queries/lookups'
import type { Tone } from '@/lib/queries/home-types'
import { modalHref, openModalId } from '@/components/modal'
import { FleetModal } from './record-modals'
import type { RoutePageProps } from './page-props'

/** ui-2.html:2894 — CII bands. D twice or E once forces a corrective action plan. */
const CII_BANDS: Array<[string, string, string, string]> = [
  ['A', 'Vượt yêu cầu', 'Superior', 'var(--up)'],
  ['B', 'Đạt tốt', 'Good', 'var(--up)'],
  ['C', 'Đạt', 'Compliant', 'var(--gold-500)'],
  ['D', 'Dưới chuẩn', 'Below', 'var(--down)'],
  ['E', 'Không đạt', 'Inferior', 'var(--down)'],
]

const OWNERSHIP_COLORS: Record<string, string> = {
  own: 'var(--brand-500)', lease: 'var(--gold-500)', charter: 'var(--violet)',
}

/** c_fleet — Transport Asset 360 (ui-2.html:2830). */
export async function FleetPage({ lang, basePath, searchParams }: RoutePageProps) {
  const [rows, types, statuses, owners, corridorRows, laneOpts] = await Promise.all([
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
      speed: fleetAssets.speedKnots,
      fuel: fleetAssets.fuel,
      co2: fleetAssets.co2,
      crew: fleetAssets.crew,
      maintOn: fleetAssets.maintOn,
      cii: fleetAssets.ciiGrade,
      certDays: fleetAssets.certDays,
      maintDue: fleetAssets.maintDueDays,
      opex: fleetAssets.opex,
      revenue: fleetAssets.revenue,
      value: fleetAssets.assetValue,
      financed: fleetAssets.isFinanced,
      dscr: fleetAssets.dscr,
      imo: fleetAssets.imo,
      corridorId: fleetAssets.corridorId,
    })
      .from(fleetAssets)
      .innerJoin(assetTypes, eq(assetTypes.code, fleetAssets.assetTypeCode))
      .innerJoin(fleetStatuses, eq(fleetStatuses.code, fleetAssets.statusCode))
      .innerJoin(ownershipTypes, eq(ownershipTypes.code, fleetAssets.ownershipCode))
      .orderBy(asc(fleetAssets.id)),
    db.select().from(assetTypes).orderBy(asc(assetTypes.ord)),
    db.select().from(fleetStatuses),
    db.select().from(ownershipTypes),
    db.select({ id: corridors.id, nameVi: corridors.nameVi, nameEn: corridors.nameEn })
      .from(corridors).orderBy(asc(corridors.id)),
    laneOptions(),
  ])

  const ships = rows.filter((r) => r.isShip)
  const active = rows.filter((r) => r.status === 'active')
  const certExpiring = rows.filter((r) => r.certDays < 45)
  const maintDue = rows.filter((r) => r.maintDue < 21)
  const alerts = rows.filter((r) => r.certDays < 45 || r.maintDue < 21)
  const avgUtil = rows.reduce((a, r) => a + r.utilisation, 0) / rows.length
  const totalValue = rows.reduce((a, r) => a + Number(r.value), 0)

  const financed = rows.filter((r) => r.financed)
  const financedValue = financed.reduce((a, r) => a + Number(r.value), 0)
  const weakDscr = financed.filter((r) => Number(r.dscr) < 1.2)

  const ciiCounts = Object.fromEntries(
    CII_BANDS.map(([grade]) => [grade, ships.filter((s) => s.cii === grade).length]),
  ) as Record<string, number>
  const ciiMax = Math.max(...Object.values(ciiCounts), 1)

  const openId = openModalId(searchParams)
  const openAsset = openId ? rows.find((r) => r.id === openId) ?? null : null

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Tài sản', 'Carrier · Assets')}
        title={t(lang, 'Phương tiện vận tải 360', 'Transport Asset 360')}
        modules={['F09', 'F14']}
        sub={t(lang,
          'Toàn bộ phương tiện và thiết bị khai thác trên một hồ sơ: thông số kỹ thuật, khai thác, tuân thủ, bảo dưỡng, phát thải và tài chính — dùng chung cho hãng tàu và nhà cung cấp logistics.',
          'Every vessel, vehicle and asset in one record: specification, utilisation, compliance, maintenance, emissions and finance — shared by carriers and logistics providers.')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Xuất hồ sơ', 'Export')}</span>
            <Link className="btn p" href={modalHref(basePath, searchParams, rows[0].id)} scroll={false}>
              {t(lang, 'Xem hồ sơ mẫu', 'Open a sample record')}
            </Link>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile label={t(lang, 'Tổng phương tiện & thiết bị', 'Total assets')} value={num(rows.length)}
          meta={t(lang, `${num(ships.length)} phương tiện thuỷ`, `${num(ships.length)} waterborne`)}
          spark={walk(90, 20, 0.04, 12)} />
        <KpiTile label={t(lang, 'Đang khai thác', 'In service')} value={num(active.length)}
          meta={`${Math.round((active.length / rows.length) * 100)}% ${t(lang, 'đội tàu', 'of fleet')}`}
          metaTone="u" />
        <KpiTile label={t(lang, 'Hiệu suất khai thác BQ', 'Average utilisation')} value={num(avgUtil, 1)}
          unit="%" meta="+4,2 pp YoY" metaTone="u" spark={walk(78, 20, 0.03, 22)} sparkColor="var(--up)" />
        <KpiTile label={t(lang, 'Chứng chỉ sắp hết hạn', 'Certificates expiring')} value={num(certExpiring.length)}
          meta={t(lang, 'trong 45 ngày', 'within 45 days')} metaTone="d" />
        <KpiTile label={t(lang, 'Đến hạn bảo dưỡng', 'Maintenance due')} value={num(maintDue.length)}
          meta={t(lang, 'trong 21 ngày', 'within 21 days')} metaTone="gd" />
      </div>

      <div className="grid g-3-2" style={{ marginBottom: 14 }}>
        <div className="stack">
          <Card title={t(lang, 'Cơ cấu đội phương tiện', 'Fleet composition')}
            right={<span className="sub">{t(lang, 'Theo loại tài sản và trạng thái khai thác', 'By asset type and operating status')}</span>}
            bodyStyle={{ padding: 0 }}>
            <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t(lang, 'Loại tài sản', 'Asset type')}</th>
                    <th className="r">{t(lang, 'Số lượng', 'Count')}</th>
                    <th className="r">{t(lang, 'Tổng sức chở', 'Total capacity')}</th>
                    <th style={{ width: 130 }}>{t(lang, 'Hiệu suất BQ', 'Avg utilisation')}</th>
                    <th className="c">{t(lang, 'Đang khai thác', 'In service')}</th>
                    <th className="r">{t(lang, 'Doanh thu 12T', '12M revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((ty) => {
                    const g = rows.filter((r) => r.typeCode === ty.code)
                    if (!g.length) return null
                    const u = Math.round(g.reduce((a, r) => a + r.utilisation, 0) / g.length)
                    const cap = g.reduce((a, r) => a + r.capacity, 0)
                    const rev = g.reduce((a, r) => a + Number(r.revenue), 0)
                    const inService = g.filter((r) => r.status === 'active').length
                    return (
                      <tr key={ty.code}>
                        <td>
                          <div className="flex" style={{ gap: 8 }}>
                            <span style={{ fontSize: 15 }}>{ty.icon}</span>
                            <b style={{ fontSize: 12.5 }}>{lang === 'vi' ? ty.nameVi : ty.nameEn}</b>
                          </div>
                        </td>
                        <td className="r num">{g.length}</td>
                        <td className="r num">{num(cap)} <span className="muted">{g[0].unit}</span></td>
                        <td>
                          <Meter value={u} width={68}
                            color={u > 85 ? 'var(--up)' : u > 70 ? 'var(--brand-500)' : 'var(--gold-500)'} />
                        </td>
                        <td className="c num">{inService}/{g.length}</td>
                        <td className="r num" style={{ fontWeight: 700 }}>
                          {num(rev, rev < 10 ? 2 : 0)} {t(lang, 'tỷ', 'bn')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title={t(lang, 'Hiệu suất khai thác & mức sẵn sàng 12 tháng',
              'Utilisation & availability, trailing 12 months')}
            right={<Legend items={[
              { color: 'var(--brand-500)', label: t(lang, 'Hiệu suất khai thác', 'Utilisation') },
              { color: 'var(--up)', label: t(lang, 'Mức sẵn sàng kỹ thuật', 'Technical availability') },
            ]} />}
            footer={t(lang,
              'Mức sẵn sàng kỹ thuật là tỷ lệ thời gian phương tiện đủ điều kiện khai thác (không nằm bảo dưỡng, lên đà hay hết chứng chỉ). Khoảng cách giữa hai đường là sức chở có thể bán thêm.',
              'Technical availability is the share of time an asset is fit to operate — not in maintenance, dry dock, or out of certificate. The gap between the two lines is sellable capacity.')}>
            <LineChart
              series={[
                { data: walk(63, 12, 0.06, 7).map((v) => Math.min(96, Math.round(v))), color: 'var(--brand-500)', fill: true },
                { data: walk(88, 12, 0.03, 19).map((v) => Math.min(99, Math.round(v))), color: 'var(--up)', dash: true },
              ]}
              height={190}
              labels={monthLabels(lang)}
              fmt={(v) => `${Math.round(v)}%`}
            />
          </Card>

          <Card title={t(lang, 'Cơ cấu sở hữu & phân bổ hành lang', 'Ownership mix & corridor allocation')}>
            <div className="flex" style={{ gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <Donut size={132} thickness={20}
                  items={owners.map((o) => ({
                    v: rows.filter((r) => r.ownership === o.code).length,
                    c: OWNERSHIP_COLORS[o.code] ?? 'var(--text-3)',
                  }))} />
              </div>
              <div style={{ flex: 1, minWidth: 190 }}>
                {owners.map((o) => {
                  const g = rows.filter((r) => r.ownership === o.code)
                  const val = g.reduce((a, r) => a + Number(r.value), 0)
                  return (
                    <div key={o.code} className="between"
                      style={{ padding: '5px 0', borderBottom: '1px dashed var(--line)' }}>
                      <span style={{ fontSize: 11.5 }}>
                        <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: OWNERSHIP_COLORS[o.code] ?? 'var(--text-3)', marginRight: 6 }} />
                        {lang === 'vi' ? o.nameVi : o.nameEn}
                      </span>
                      <span className="num" style={{ fontSize: 11.5 }}>
                        <b>{g.length}</b> <span className="muted">· {num(val, 0)} {t(lang, 'tỷ', 'bn')}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 11 }}>
              {corridorRows.map((c) => {
                const g = rows.filter((r) => r.corridorId === c.id)
                const u = Math.round(g.reduce((a, r) => a + r.utilisation, 0) / (g.length || 1))
                return (
                  <div key={c.id} className="between"
                    style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
                    <span style={{ fontSize: 11.5 }}>
                      <b>{String(c.id).padStart(2, '0')}</b> · {lang === 'vi' ? c.nameVi : c.nameEn}
                    </span>
                    <div className="meter">
                      <span className="muted">{g.length} {t(lang, 'phương tiện', 'assets')}</span>
                      <Meter value={u} width={64}
                        color={u > 80 ? 'var(--up)' : u > 65 ? 'var(--brand-500)' : 'var(--gold-500)'} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title={t(lang, 'Cảnh báo tuân thủ & bảo dưỡng', 'Compliance & maintenance alerts')}
            right={<Tag tone="d">{alerts.length}</Tag>}
            footer={t(lang,
              `Xem toàn bộ ${alerts.length} cảnh báo trong hồ sơ phương tiện ↓`,
              `View all ${alerts.length} alerts in the asset register ↓`)}>
            {alerts
              .slice()
              .sort((a, b) => Math.min(a.certDays, a.maintDue) - Math.min(b.certDays, b.maintDue))
              .slice(0, 6)
              .map((a) => {
                const critical = a.certDays < 0 || a.maintDue < 0
                const parts: string[] = []
                if (a.certDays < 45) {
                  parts.push(a.certDays < 0
                    ? t(lang, `Chứng chỉ đã hết hạn ${Math.abs(a.certDays)} ngày`,
                      `Certificate expired ${Math.abs(a.certDays)} days ago`)
                    : t(lang, `Chứng chỉ còn ${a.certDays} ngày`, `Certificate due in ${a.certDays} days`))
                }
                if (a.maintDue < 21) {
                  parts.push(a.maintDue < 0
                    ? t(lang, `Bảo dưỡng quá hạn ${Math.abs(a.maintDue)} ngày`,
                      `Maintenance overdue by ${Math.abs(a.maintDue)} days`)
                    : t(lang, `Bảo dưỡng sau ${a.maintDue} ngày`, `Maintenance in ${a.maintDue} days`))
                }
                return (
                  <Link key={a.id} href={modalHref(basePath, searchParams, a.id)} className="cq-row" scroll={false}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 11.5 }}>{a.name}</b>
                      <div className="muted">{parts.join(' · ')}</div>
                    </div>
                    <Tag tone={critical ? 'd' : 'gd'}>
                      {critical ? t(lang, 'Quá hạn', 'Overdue') : t(lang, 'Sắp tới', 'Due')}
                    </Tag>
                  </Link>
                )
              })}
          </Card>

          <Card title={t(lang, 'Phát thải & xếp hạng CII', 'Emissions & CII rating')}>
            {CII_BANDS.map(([grade, dVi, dEn, color]) => (
              <div key={grade} className="between" style={{ padding: '5px 0' }}>
                <span style={{ fontSize: 12 }}><b>{grade}</b> · {t(lang, dVi, dEn)}</span>
                <div className="meter">
                  <div className="bar" style={{ width: 90 }}>
                    <i style={{ width: `${(ciiCounts[grade] / ciiMax) * 100}%`, background: color }} />
                  </div>
                  <b>{ciiCounts[grade]}</b>
                </div>
              </div>
            ))}
            <div className="note">
              {t(lang,
                'Tàu hạng D hai năm liên tiếp hoặc hạng E một năm phải có kế hoạch hành động khắc phục. Dữ liệu phát thải này cũng là đầu vào cho tín dụng xanh gắn hiệu quả vận tải.',
                'A vessel rated D for two consecutive years or E for one year needs a corrective action plan. This emissions data also feeds green-linked freight credit.')}
            </div>
          </Card>

          <Card title={t(lang, 'Tài sản đang được tài trợ', 'Assets under financing')}
            right={<Tag tone="b">F09</Tag>}>
            {([
              [t(lang, 'Số tài sản có khoản vay', 'Assets with a facility'), <b className="num">{financed.length}</b>],
              [t(lang, 'Giá trị tài sản thế chấp', 'Pledged asset value'),
                <b className="num">{num(financedValue, 0)} {t(lang, 'tỷ', 'bn')}</b>],
              [t(lang, 'Tỷ trọng trên tổng đội', 'Share of total fleet value'),
                <b className="num">{num((financedValue / totalValue) * 100, 1)}%</b>],
              [t(lang, 'DSCR dưới 1,20x', 'DSCR below 1.20x'),
                <Tag tone={weakDscr.length ? 'd' : 'u'}>{weakDscr.length}</Tag>],
            ] as Array<[string, React.ReactNode]>).map(([label, value]) => (
              <div key={label} className="between" style={{ padding: '5px 0' }}>
                <span style={{ fontSize: 11.5 }}>{label}</span>
                {value}
              </div>
            ))}
            <div className="note">
              {t(lang,
                'Hồ sơ phương tiện là nguồn dữ liệu gốc cho Data Room tài trợ tài sản của định chế tài chính: đăng kiểm, bảo hiểm, khai thác và phát thải chỉ chia sẻ trong phạm vi thành viên đã đồng ý.',
                'The asset register is the source of record for the lender-facing asset finance Data Room: class, insurance, utilisation and emissions are shared strictly within the member consent scope.')}
            </div>
          </Card>
        </div>
      </div>

      <DataTable
        id="fleet" lang={lang} basePath={basePath} searchParams={searchParams}
        title={t(lang, 'Danh sách phương tiện', 'Asset register')} rows={rows}
        rowHref={(r) => modalHref(basePath, searchParams, r.id)}
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

      {openAsset ? (
        <FleetModal
          lang={lang} basePath={basePath} searchParams={searchParams}
          asset={{
            id: openAsset.id, name: openAsset.name, icon: openAsset.icon,
            typeName: lang === 'vi' ? openAsset.typeVi : openAsset.typeEn,
            isShip: openAsset.isShip, capacity: openAsset.capacity, unit: openAsset.unit,
            builtYear: openAsset.built, age: openAsset.age, flag: openAsset.flag,
            classSociety: openAsset.classSociety,
            statusName: lang === 'vi' ? openAsset.statusVi : openAsset.statusEn,
            ownerName: lang === 'vi' ? openAsset.ownerVi : openAsset.ownerEn,
            laneCode: openAsset.lane, utilisation: openAsset.utilisation,
            position: openAsset.position, speed: Number(openAsset.speed),
            fuel: Number(openAsset.fuel), co2: openAsset.co2, cii: openAsset.cii,
            insurance: '', certDays: openAsset.certDays, maintOn: openAsset.maintOn,
            maintDue: openAsset.maintDue, opex: Number(openAsset.opex),
            revenue: Number(openAsset.revenue), value: Number(openAsset.value),
            financed: openAsset.financed, dscr: Number(openAsset.dscr),
            crew: openAsset.crew, imo: openAsset.imo,
          }}
        />
      ) : null}
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
