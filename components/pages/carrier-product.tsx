import Link from 'next/link'
import { walk } from '@/components/charts'
import { Modal, ModalPanel, ModalRow, ModalStats, modalHref, openModalId } from '@/components/modal'
import { ProductTreeRows, SourceTag } from '@/components/product-tree'
import { DataTable } from '@/components/table/data-table'
import { tableHref } from '@/components/table/table-types'
import { Card, KpiTile, Meter, PageHeader, Tag } from '@/components/ui'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import type { Tone } from '@/lib/queries/home-types'
import {
  aggregate, buildTree, findNode, keysToDepth, type ProductRow,
} from '@/lib/queries/product-tree'
import type { RoutePageProps } from './page-props'

const LEVEL_NAMES = (lang: Lang) => [
  t(lang, 'Cấp 1 · Ngành dịch vụ', 'Level 1 · Sector'),
  t(lang, 'Cấp 2 · Nhóm dịch vụ', 'Level 2 · Service group'),
  t(lang, 'Cấp 3 · Dòng sản phẩm', 'Level 3 · Product line'),
  t(lang, 'Cấp 4 · Sản phẩm', 'Level 4 · Product'),
]

/** c_product — Product 360 (ui-2.html:3185). */
export async function ProductPage({ lang, basePath, searchParams }: RoutePageProps) {
  const one = (k: string): string => {
    const v = searchParams[k]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const sourceFilter = one('tr.f') || '*'
  const openKeys = new Set(one('tr.open').split('~').filter(Boolean))
  const selectedKey = one('tr.sel') || null

  const { nodes, all } = await buildTree(lang, sourceFilter)

  const inHouse = all.filter((p) => p.source === 'in')
  const partner = all.filter((p) => p.source === 'out')
  const revenueIn = inHouse.reduce((a, p) => a + p.revenue, 0)
  const gmvOut = partner.reduce((a, p) => a + p.revenue, 0)
  const commissionOut = partner.reduce((a, p) => a + p.net, 0)
  const avgMarginIn = inHouse.reduce((a, p) => a + p.margin, 0) / (inHouse.length || 1)

  // Partner roll-up for the right-hand table.
  const partners = new Map<string, { n: number; gmv: number; commission: number; groups: Set<string> }>()
  for (const p of partner) {
    const key = p.partnerName ?? '—'
    const entry = partners.get(key) ?? { n: 0, gmv: 0, commission: 0, groups: new Set<string>() }
    entry.n += 1
    entry.gmv += p.revenue
    entry.commission += p.net
    entry.groups.add(p.groupName)
    partners.set(key, entry)
  }
  const partnerKeys = [...partners.keys()].sort((a, b) => partners.get(b)!.gmv - partners.get(a)!.gmv)

  const selected = selectedKey ? findNode(selectedKey, nodes) : null
  const openId = openModalId(searchParams)
  const openProduct = openId ? all.find((p) => p.id === openId) ?? null : null

  const filterHref = (value: string) =>
    tableHref(basePath, searchParams, { 'tr.f': value === '*' ? null : value, 'tr.open': null, 'tr.sel': null })
  const expandHref = (depth: number) =>
    tableHref(basePath, searchParams, {
      'tr.open': depth === 0 ? null : keysToDepth(nodes, depth + 1).join('~'),
    })

  return (
    <>
      <PageHeader
        crumb={t(lang, 'Hãng tàu · Danh mục', 'Carrier · Portfolio')}
        title={t(lang, 'Sản phẩm 360', 'Product 360')}
        modules={['F04', 'F10']}
        sub={t(lang,
          'Toàn bộ danh mục xếp theo cây bốn cấp: ngành dịch vụ → nhóm dịch vụ → dòng sản phẩm → sản phẩm niêm yết. Phân biệt rõ phần tự cung cấp và phần liên kết đối tác bên ngoài (bảo hiểm, nhiên liệu, tài trợ, dịch vụ hàng hải).',
          'The whole catalogue as a four-level tree: service sector → service group → product line → listed product. In-house supply is kept visually separate from partner-provided services (insurance, fuel, financing, marine services).')}
        actions={
          <>
            <span className="btn">⬇ {t(lang, 'Xuất danh mục', 'Export')}</span>
            <span className="btn p">+ {t(lang, 'Sản phẩm mới', 'New product')}</span>
          </>
        }
      />

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <KpiTile
          label={t(lang, 'Sản phẩm trong danh mục', 'Products in catalogue')}
          value={num(all.length)}
          meta={<>
            <span className="tag b">{inHouse.length} {t(lang, 'nội bộ', 'in-house')}</span>{' '}
            <span className="tag gd">{partner.length} {t(lang, 'liên kết', 'partner')}</span>
          </>}
        />
        <KpiTile
          label={t(lang, 'Doanh thu tự cung cấp 12T', 'In-house revenue 12M')}
          value={num(Math.round(revenueIn / 1000), 1)} unit={t(lang, 'tr USD', 'm USD')}
          meta="+18,4% YoY" metaTone="u" spark={walk(80, 20, 0.05, 44)}
        />
        <KpiTile
          label={t(lang, 'GMV dịch vụ liên kết 12T', 'Partner GMV 12M')}
          value={num(Math.round(gmvOut / 1000), 1)} unit={t(lang, 'tr USD', 'm USD')}
          meta={`${t(lang, 'hoa hồng', 'commission')} $${num(Math.round(commissionOut))}K`} metaTone="gd"
          spark={walk(60, 20, 0.06, 17)} sparkColor="var(--gold-500)"
        />
        <KpiTile
          label={t(lang, 'Biên LN nội bộ BQ', 'In-house average margin')}
          value={num(avgMarginIn, 1)} unit="%" meta="+1,8 pp" metaTone="u"
        />
        <KpiTile
          label={t(lang, 'Đối tác liên kết', 'Linked partners')}
          value={num(partnerKeys.length)}
          meta={t(lang, 'bảo hiểm · nhiên liệu · ngân hàng · hàng hải', 'insurance · fuel · bank · marine')}
          metaTone="n"
        />
      </div>

      <div className="grid g-3-2" style={{ marginBottom: 14, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h">
            <h3>{t(lang, 'Cây danh mục sản phẩm', 'Product catalogue tree')}</h3>
            <div className="flex" style={{ gap: 6 }}>
              {([['*', t(lang, 'Tất cả', 'All')], ['in', t(lang, 'Tự cung cấp', 'In-house')],
                ['out', t(lang, 'Liên kết', 'Partner')]] as const).map(([v, label]) => (
                <Link key={v} className={`btn sm${sourceFilter === v ? ' p' : ''}`} href={filterHref(v)} scroll={false}>
                  {label}
                </Link>
              ))}
              <span style={{ width: 6 }} />
              <Link className="btn sm" href={expandHref(2)} scroll={false}>{t(lang, 'Mở 2 cấp', 'Expand 2')}</Link>
              <Link className="btn sm" href={expandHref(3)} scroll={false}>{t(lang, 'Mở hết', 'Expand all')}</Link>
              <Link className="btn sm" href={expandHref(0)} scroll={false}>{t(lang, 'Thu gọn', 'Collapse')}</Link>
            </div>
          </div>

          <div className="tree">
            <div className="tr-h">
              <span>{t(lang, 'Ngành · Nhóm · Dòng · Sản phẩm', 'Sector · Group · Line · Product')}</span>
              <span>{t(lang, 'SP · Giá', 'Items · price')}</span>
              <span className="hid">{t(lang, 'KH', 'Cust.')}</span>
              <span>{t(lang, 'Doanh thu / GMV', 'Revenue / GMV')}</span>
              <span className="hid">{t(lang, 'Biên LN · HH', 'Margin · comm.')}</span>
              <span className="hid">{t(lang, 'Tiêu thụ', 'Take-up')}</span>
            </div>
            <div className="tr-wrap">
              <ProductTreeRows
                nodes={nodes} open={openKeys} selected={selectedKey}
                lang={lang} basePath={basePath} searchParams={searchParams}
              />
            </div>
          </div>

          <div className="card-f between">
            <span>
              {t(lang,
                'Cấp 1 ngành dịch vụ → Cấp 2 nhóm dịch vụ → Cấp 3 dòng sản phẩm → Cấp 4 sản phẩm niêm yết. Nhấp vào sản phẩm ở cấp 4 để mở hồ sơ đầy đủ.',
                'Level 1 sector → level 2 group → level 3 product line → level 4 listed product. Click a level-4 product to open its full record.')}
            </span>
            <span className="flex" style={{ gap: 8 }}>
              <SourceTag source="in" lang={lang} />
              <SourceTag source="out" lang={lang} />
            </span>
          </div>
        </div>

        <div className="stack">
          {selected ? (() => {
            const agg = aggregate(selected.leaves)
            const isPartner = selected.source === 'out'
            return (
              <div className="card">
                <div className="card-h">
                  <h3>{selected.name}</h3>
                  <span className="tag n">{LEVEL_NAMES(lang)[selected.level - 1]}</span>
                </div>
                <div className="card-b">
                  <div className="flex wrap" style={{ gap: 6, marginBottom: 10 }}>
                    <SourceTag source={selected.source} lang={lang} />
                    {selected.partnerName
                      ? <span className="tag gd">{t(lang, 'Đối tác: ', 'Partner: ')}{selected.partnerName}</span>
                      : null}
                  </div>
                  <div className="grid g2" style={{ gap: 9 }}>
                    {([
                      [t(lang, 'Sản phẩm niêm yết', 'Listed products'), num(agg.count)],
                      [isPartner ? t(lang, 'GMV 12 tháng', '12M GMV') : t(lang, 'Doanh thu 12 tháng', '12M revenue'), `$${num(agg.revenue)}K`],
                      [isPartner ? t(lang, 'Hoa hồng 12T', '12M commission') : t(lang, 'Biên đóng góp 12T', '12M contribution'), `$${num(Math.round(agg.net))}K`],
                      [isPartner ? t(lang, 'Tỷ lệ hoa hồng BQ', 'Average commission') : t(lang, 'Biên lợi nhuận BQ', 'Average margin'), `${num(agg.margin, 1)}%`],
                    ] as const).map(([label, value]) => (
                      <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
                        <div className="muted">{label}</div>
                        <div className="num" style={{ fontSize: 15, fontWeight: 750 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {selected.children.length ? (
                    <>
                      <div className="muted" style={{ fontWeight: 700, margin: '11px 0 4px' }}>
                        {t(lang, 'Thành phần bên trong', 'What sits inside')}
                      </div>
                      {selected.children.slice(0, 7).map((child) => {
                        const ca = aggregate(child.leaves)
                        return (
                          <Link
                            key={child.key}
                            href={child.level === 4
                              ? modalHref(basePath, searchParams, child.leaf!.id)
                              : tableHref(basePath, searchParams, {
                                'tr.open': [...new Set([...openKeys, child.key])].join('~'),
                                'tr.sel': child.key,
                              })}
                            scroll={false}
                            className="between panel-row"
                          >
                            <span style={{ fontSize: 11.5 }}>{child.name}</span>
                            <span className="num muted">
                              {child.level === 4
                                ? `$${num(child.leaf!.price)} /${child.leaf!.unit}`
                                : `${ca.count} SP · $${num(ca.revenue)}K`}
                            </span>
                          </Link>
                        )
                      })}
                      {selected.children.length > 7 ? (
                        <div className="muted" style={{ marginTop: 5 }}>
                          {t(lang, `… và ${selected.children.length - 7} mục khác`, `… and ${selected.children.length - 7} more`)}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {isPartner ? (
                    <div className="note">
                      {t(lang,
                        'Nhóm này do đối tác được cấp phép thực hiện. Nền tảng chỉ phân phối, thu phí hoa hồng và giữ hồ sơ giao dịch — không nhận rủi ro bảo hiểm, không kinh doanh nhiên liệu, không quyết định tín dụng.',
                        'This group is delivered by a licensed partner. The platform distributes, earns a commission and keeps the transaction record — it does not carry insurance risk, trade fuel, or make credit decisions.')}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })() : null}

          <Card title={t(lang, 'Tự cung cấp so với liên kết', 'In-house versus partner')}>
            {([
              [t(lang, 'Tự cung cấp', 'In-house'), inHouse, revenueIn, 'var(--brand-500)', 'in'],
              [t(lang, 'Liên kết đối tác', 'Partner-provided'), partner, gmvOut, 'var(--gold-500)', 'out'],
            ] as const).map(([label, group, total, color, kind]) => {
              const avgMargin = group.reduce((a, p) => a + p.margin, 0) / (group.length || 1)
              return (
                <div key={kind} className="panel-row">
                  <div className="between">
                    <b style={{ fontSize: 12.5 }}>{label}</b>
                    <span className="num"><b>{group.length}</b> <span className="muted">{t(lang, 'sản phẩm', 'products')}</span></span>
                  </div>
                  <div className="bar" style={{ marginTop: 5 }}>
                    <i style={{ width: `${(total / (revenueIn + gmvOut)) * 100}%`, background: color }} />
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {kind === 'out' ? 'GMV' : t(lang, 'Doanh thu', 'Revenue')} ${num(total)}K ·{' '}
                    {kind === 'out' ? t(lang, 'hoa hồng BQ', 'avg commission') : t(lang, 'biên LN BQ', 'avg margin')} {num(avgMargin, 1)}%
                  </div>
                </div>
              )
            })}
            <div className="note">
              {t(lang,
                'Danh mục liên kết không làm mỏng biên lợi nhuận cốt lõi: nền tảng thu hoa hồng trên doanh số của đối tác, đồng thời tăng tỷ lệ gắn kèm và giữ khách trên cùng một hồ sơ giao dịch.',
                'The partner catalogue does not dilute the core margin: the platform earns a commission on partner sales while raising attach rate and keeping the customer inside one transaction record.')}
            </div>
          </Card>

          <div className="card">
            <div className="card-h">
              <h3>{t(lang, 'Đối tác liên kết', 'Linked partners')}</h3>
              <span className="tag gd">{partnerKeys.length}</span>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t(lang, 'Đối tác', 'Partner')}</th>
                    <th className="c">SP</th>
                    <th className="r">GMV 12T</th>
                    <th className="r">{t(lang, 'Hoa hồng', 'Commission')}</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerKeys.map((key) => {
                    const p = partners.get(key)!
                    return (
                      <tr key={key}>
                        <td>
                          <b style={{ fontSize: 11.5 }}>{key}</b>
                          <div className="muted">{[...p.groups].join(' · ')}</div>
                        </td>
                        <td className="c num">{p.n}</td>
                        <td className="r num">${num(p.gmv)}K</td>
                        <td className="r num" style={{ fontWeight: 700, color: 'var(--gold-500)' }}>
                          ${num(Math.round(p.commission))}K
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-f">
              {t(lang,
                'Hợp đồng phân phối và tỷ lệ hoa hồng được công bố trong Quy tắc nền tảng. Đối tác trả phí quảng bá được gắn nhãn rõ trên kết quả tìm kiếm.',
                'Distribution agreements and commission rates are published in the Platform Rules. Partners paying for promotion are clearly labelled in search results.')}
            </div>
          </div>
        </div>
      </div>

      <AnalysisCards all={all} lang={lang} basePath={basePath} searchParams={searchParams} />

      <FlatCatalogue
        all={all} lang={lang} basePath={basePath} searchParams={searchParams}
      />

      {openProduct ? (
        <ProductModal
          product={openProduct} lang={lang} basePath={basePath} searchParams={searchParams}
        />
      ) : null}
    </>
  )
}

/** The three analysis cards — lifecycle, price vs index, service quality (ui-2.html:3286). */
function AnalysisCards({
  all, lang,
}: {
  all: ProductRow[]; lang: Lang; basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const lifecycles: Array<[string, string]> = [
    ['new', t(lang, 'Mới ra mắt', 'New')],
    ['growth', t(lang, 'Tăng trưởng', 'Growth')],
    ['mature', t(lang, 'Bão hoà', 'Mature')],
    ['decline', t(lang, 'Suy giảm', 'Declining')],
  ]
  const lifeColor: Record<string, string> = {
    growth: 'var(--up)', new: 'var(--brand-500)', mature: 'var(--text-3)', decline: 'var(--down)',
  }

  const laneLinked = all.filter((p) => p.indexRef > 0)
  const bands: Array<[Tone, string, (p: ProductRow) => boolean]> = [
    ['u', t(lang, 'Thấp hơn chỉ số >5%', 'More than 5% below'), (p) => (p.price - p.indexRef) / p.indexRef < -0.05],
    ['b', t(lang, 'Quanh chỉ số (±5%)', 'Around the index (±5%)'), (p) => Math.abs((p.price - p.indexRef) / p.indexRef) <= 0.05],
    ['gd', t(lang, 'Cao hơn 5–15%', '5–15% above'), (p) => { const q = (p.price - p.indexRef) / p.indexRef; return q > 0.05 && q <= 0.15 }],
    ['d', t(lang, 'Cao hơn >15%', 'More than 15% above'), (p) => (p.price - p.indexRef) / p.indexRef > 0.15],
  ]

  const meetingSla = all.filter((p) => p.slaHit >= p.sla)
  const avgRating = all.reduce((a, p) => a + p.rating, 0) / all.length
  const worst = all.filter((p) => p.slaHit < p.sla)
    .sort((a, b) => (a.slaHit - a.sla) - (b.slaHit - b.sla)).slice(0, 3)

  return (
    <div className="grid g3" style={{ marginBottom: 14 }}>
      <Card title={t(lang, 'Ma trận vòng đời sản phẩm', 'Product lifecycle matrix')}>
        {lifecycles.map(([code, label]) => {
          const group = all.filter((p) => p.lifecycleCode === code)
          const revenue = group.reduce((a, p) => a + p.revenue, 0)
          const margin = group.reduce((a, p) => a + p.margin, 0) / (group.length || 1)
          return (
            <div key={code} className="panel-row">
              <div className="between">
                <b style={{ fontSize: 12 }}>{label}</b>
                <span><b className="num">{group.length}</b> <span className="muted">SP</span></span>
              </div>
              <div className="bar" style={{ marginTop: 5 }}>
                <i style={{ width: `${(group.length / all.length) * 100}%`, background: lifeColor[code] }} />
              </div>
              <div className="muted" style={{ marginTop: 3 }}>${num(revenue)}K · {num(margin, 1)}%</div>
            </div>
          )
        })}
        <div className="note">
          {t(lang,
            'Sản phẩm suy giảm cần quyết định: điều chỉnh giá theo chỉ số, gộp vào gói dịch vụ, hay dừng niêm yết để giải phóng năng lực.',
            'Declining products need a decision: reprice against the index, bundle them, or delist to free capacity.')}
        </div>
      </Card>

      <Card title={t(lang, 'Định vị giá so với chỉ số VLX', 'Price vs the VLX index')}>
        {bands.map(([tone, label, test]) => {
          const group = laneLinked.filter(test)
          return (
            <div key={label} className="between panel-row">
              <span className={`tag ${tone}`}>{label}</span>
              <div className="meter">
                <div className="bar" style={{ width: 70 }}>
                  <i style={{ width: `${(group.length / (laneLinked.length || 1)) * 100}%`, background: 'var(--brand-500)' }} />
                </div>
                <b>{group.length}</b>
              </div>
            </div>
          )
        })}
        <div className="note">
          {t(lang,
            'Chỉ áp dụng cho sản phẩm gắn tuyến. Sản phẩm cao hơn chỉ số trên 15% thường mất đơn về tay đối thủ trên cùng tuyến — cần soát lại giá hoặc chứng minh bằng cam kết SLA cao hơn.',
            'Lane-linked products only. Priced more than 15% above the index, a product usually loses bookings to rivals on the same lane — reprice, or justify it with a higher SLA commitment.')}
        </div>
      </Card>

      <Card title={t(lang, 'Chất lượng dịch vụ cam kết', 'Committed service quality')}>
        <div className="grid g2" style={{ gap: 9, marginBottom: 8 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
            <div className="muted">{t(lang, 'Đạt cam kết SLA', 'Meeting SLA')}</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 750, color: 'var(--up)' }}>
              {Math.round((meetingSla.length / all.length) * 100)}%
            </div>
            <div className="muted">{meetingSla.length} / {all.length}</div>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
            <div className="muted">{t(lang, 'Đánh giá khách hàng', 'Customer rating')}</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 750 }}>
              {num(avgRating, 1)} <span className="muted" style={{ fontSize: 11 }}>/ 5</span>
            </div>
            <div className="muted">{t(lang, 'toàn danh mục', 'whole catalogue')}</div>
          </div>
        </div>
        {worst.length ? (
          <>
            <div className="muted" style={{ fontWeight: 700, margin: '6px 0 2px' }}>
              {t(lang, 'Chưa đạt cam kết', 'Below commitment')}
            </div>
            {worst.map((p) => (
              <div key={p.id} className="between panel-row">
                <span style={{ fontSize: 11 }}>{p.name}</span>
                <span className="tag d">{p.slaHit}% / {p.sla}%</span>
              </div>
            ))}
          </>
        ) : null}
        <div className="note">
          {t(lang,
            'Sản phẩm không đạt cam kết bị gỡ nhãn SLA trên kết quả tìm kiếm và phải bồi hoàn theo biểu phạt trong Quy tắc nền tảng.',
            'A product below its commitment loses the SLA badge in search results and compensates the shortfall under the Platform Rules penalty schedule.')}
        </div>
      </Card>
    </div>
  )
}

/** The flat, searchable view of the whole catalogue (ui-2.html:3327). */
function FlatCatalogue({
  all, lang, basePath, searchParams,
}: {
  all: ProductRow[]; lang: Lang; basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const groupOptions = [...new Map(all.map((p) => [p.groupCode, p.groupName])).entries()]
  const lifeOptions = [...new Map(all.map((p) => [p.lifecycleCode, p.lifecycleName])).entries()]
  const statusOptions = [...new Map(all.map((p) => [p.statusCode, p.statusName])).entries()]

  return (
    <DataTable
      id="prod" lang={lang} basePath={basePath} searchParams={searchParams}
      title={t(lang, 'Toàn bộ danh mục — dạng bảng', 'The whole catalogue — flat view')}
      rows={all} pageSize={12}
      searchPlaceholder={t(lang, 'Tìm tên sản phẩm, tuyến, đối tác, đơn vị tính…', 'Search product, lane, partner, unit…')}
      search={(p) => `${p.id} ${p.name} ${p.laneCode ?? ''} ${p.siteName ?? ''} ${p.partnerName ?? ''} ${p.unit}`}
      filters={[
        {
          key: 'src', label: t(lang, 'Nguồn cung', 'Supply'),
          options: [['in', t(lang, 'Tự cung cấp', 'In-house')], ['out', t(lang, 'Liên kết đối tác', 'Partner-provided')]],
          match: (p, v) => p.source === v,
        },
        { key: 'grp', label: t(lang, 'Nhóm dịch vụ', 'Service group'), options: groupOptions, match: (p, v) => p.groupCode === v },
        { key: 'life', label: t(lang, 'Vòng đời', 'Lifecycle'), options: lifeOptions, match: (p, v) => p.lifecycleCode === v },
        { key: 'st', label: t(lang, 'Trạng thái', 'Status'), options: statusOptions, match: (p, v) => p.statusCode === v },
        {
          key: 'mg', label: t(lang, 'Biên LN', 'Margin'),
          options: [['lo', '< 20%'], ['mid', '20–32%'], ['hi', '> 32%']],
          match: (p, v) => v === 'lo' ? p.margin < 20 : v === 'mid' ? (p.margin >= 20 && p.margin <= 32) : p.margin > 32,
        },
      ]}
      columns={[
        {
          key: 'name', header: t(lang, 'Sản phẩm', 'Product'), width: '26%', sortValue: (p) => p.name,
          render: (p) => (
            <Link href={modalHref(basePath, searchParams, p.id)} scroll={false} className="flex" style={{ gap: 8 }}>
              <span style={{ fontSize: 14 }}>{p.groupIcon}</span>
              <div>
                <b style={{ fontSize: 11.5 }}>{p.name}</b>
                <div className="muted">{p.id} · {p.groupName}{p.partnerName ? ` · ${p.partnerName}` : ''}</div>
              </div>
            </Link>
          ),
        },
        {
          key: 'src', header: t(lang, 'Nguồn', 'Supply'), cls: 'c', width: '9%', sortValue: (p) => p.source,
          render: (p) => <SourceTag source={p.source} lang={lang} />,
        },
        {
          key: 'price', header: t(lang, 'Giá niêm yết', 'List price'), cls: 'r', width: '10%', sortValue: (p) => p.price,
          render: (p) => <><b className="num">${num(p.price)}</b><div className="muted">/{p.unit}</div></>,
        },
        {
          key: 'margin', header: t(lang, 'Biên LN · HH', 'Margin · comm.'), width: '11%', sortValue: (p) => p.margin,
          render: (p) => <Meter value={Math.round(p.margin)} width={52}
            color={p.source === 'out' ? 'var(--gold-500)' : p.margin > 32 ? 'var(--up)' : p.margin > 20 ? 'var(--brand-500)' : 'var(--gold-500)'} />,
        },
        {
          key: 'fill', header: t(lang, 'Mức tiêu thụ', 'Take-up'), width: '10%', sortValue: (p) => p.fill,
          render: (p) => <Meter value={p.fill} width={52}
            color={p.fill > 80 ? 'var(--up)' : p.fill > 60 ? 'var(--brand-500)' : 'var(--gold-500)'} />,
        },
        { key: 'cust', header: t(lang, 'KH', 'Cust.'), cls: 'r', width: '6%', sortValue: (p) => p.customers, render: (p) => <span className="num">{p.customers}</span> },
        { key: 'rev', header: t(lang, 'Doanh thu / GMV', 'Revenue / GMV'), cls: 'r', width: '10%', sortValue: (p) => p.revenue, render: (p) => <b className="num">${num(p.revenue)}K</b> },
        {
          key: 'sla', header: 'SLA', cls: 'c', width: '6%', sortValue: (p) => p.slaHit,
          render: (p) => <Tag tone={p.slaHit >= p.sla ? 'u' : 'd'}>{p.slaHit}%</Tag>,
        },
        {
          key: 'life', header: t(lang, 'Vòng đời', 'Lifecycle'), cls: 'c', width: '8%', sortValue: (p) => p.lifecycleCode,
          render: (p) => <Tag tone={p.lifecycleTone as Tone}>{p.lifecycleName}</Tag>,
        },
        {
          key: 'st', header: t(lang, 'Trạng thái', 'Status'), cls: 'c', width: '8%', sortValue: (p) => p.statusCode,
          render: (p) => <Tag tone={p.statusTone as Tone}>{p.statusName}</Tag>,
        },
      ]}
    />
  )
}

/** prodModal — the full product record (ui-2.html:3357). */
function ProductModal({
  product: p, lang, basePath, searchParams,
}: {
  product: ProductRow; lang: Lang; basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const deviation = p.indexRef ? ((p.price - p.indexRef) / p.indexRef) * 100 : null
  const notReached = Math.round((p.customers * (100 - p.attachRate)) / 100)

  return (
    <Modal
      title={p.name}
      icon={p.groupIcon}
      basePath={basePath}
      searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<>
        <span className={`tag ${p.lifecycleTone}`}>{p.lifecycleName}</span>
        <span className={`tag ${p.statusTone}`}>{p.statusName}</span>
      </>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Giá niêm yết', 'List price'), `$${num(p.price)} /${p.unit}`],
          [t(lang, 'Biên lợi nhuận', 'Margin'), `${num(p.margin, 1)}%`],
          [t(lang, 'Khách hàng đang dùng', 'Active customers'), p.customers],
          [t(lang, 'Doanh thu 12T', '12M revenue'), `$${num(p.revenue)}K`],
        ]} />

        <div className="grid g2" style={{ gap: 12 }}>
          <ModalPanel title={t(lang, 'CƠ CẤU GIÁ & CHỈ SỐ', 'PRICING & INDEX')}>
            <dl>
              <ModalRow term={t(lang, 'Giá niêm yết', 'List price')}><span className="num">${num(p.price)}</span></ModalRow>
              <ModalRow term={t(lang, 'Giá vốn ước tính', 'Estimated cost')}><span className="num">${num(p.cost)}</span></ModalRow>
              <ModalRow term={t(lang, 'Biên đóng góp', 'Contribution')}>
                <span className="num" style={{ color: p.margin > 25 ? 'var(--up)' : 'var(--gold-500)' }}>
                  ${num(p.price - p.cost)} · {num(p.margin, 1)}%
                </span>
              </ModalRow>
              {p.indexRef ? (
                <>
                  <ModalRow term={t(lang, 'Chỉ số tham chiếu VLX', 'VLX reference index')}><span className="num">${num(p.indexRef)}</span></ModalRow>
                  <ModalRow term={t(lang, 'Chênh so với chỉ số', 'Deviation vs index')}>
                    <span className={`tag ${p.price > p.indexRef ? 'd' : 'u'}`}>{pct(deviation!)}</span>
                  </ModalRow>
                </>
              ) : null}
              <ModalRow term={t(lang, 'Đơn vị tính', 'Unit of measure')} last>{p.unit}</ModalRow>
            </dl>
          </ModalPanel>

          <ModalPanel title={t(lang, 'NĂNG LỰC & TIÊU THỤ', 'CAPACITY & TAKE-UP')}>
            <dl>
              <ModalRow term={t(lang, 'Năng lực công bố', 'Published capacity')}><span className="num">{num(p.capacity)} {p.unit}</span></ModalRow>
              <ModalRow term={t(lang, 'Đã bán 12 tháng', 'Sold over 12M')}><span className="num">{num(p.sold)}</span></ModalRow>
              <ModalRow term={t(lang, 'Mức tiêu thụ', 'Take-up')}>
                <Meter value={p.fill} width={70} color={p.fill > 80 ? 'var(--up)' : 'var(--gold-500)'} />
              </ModalRow>
              <ModalRow term={t(lang, 'Tỷ lệ gắn kèm dịch vụ khác', 'Attach rate')}><span className="num">{p.attachRate}%</span></ModalRow>
              <ModalRow term={t(lang, 'Có trong gói dịch vụ', 'In a bundle')}>
                {p.isBundle ? <span className="tag b">{t(lang, 'Có', 'Yes')}</span> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Địa bàn cung cấp', 'Service location')}>{p.laneCode ?? p.siteName}</ModalRow>
              <ModalRow term={t(lang, 'Hành lang', 'Corridor')} last>0{p.corridorId}</ModalRow>
            </dl>
          </ModalPanel>
        </div>

        <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
          <ModalPanel title={t(lang, 'CAM KẾT DỊCH VỤ', 'SERVICE COMMITMENTS')}>
            {([
              [t(lang, 'Cam kết SLA công bố', 'Published SLA commitment'), `${p.sla}%`, false],
              [t(lang, 'Thực hiện SLA 12 tháng', 'SLA achieved over 12M'), `${p.slaHit}%`, true],
              [t(lang, 'Đánh giá của khách hàng', 'Customer rating'), `${num(p.rating, 1)} / 5`, false],
            ] as const).map(([label, value, isSlaRow]) => (
              <div key={label} className="between panel-row">
                <span style={{ fontSize: 11.5 }}>{label}</span>
                <b className="num" style={{
                  fontSize: 12,
                  color: isSlaRow ? (p.slaHit >= p.sla ? 'var(--up)' : 'var(--down)') : 'var(--text)',
                }}>{value}</b>
              </div>
            ))}
            <div className="note">
              {p.slaHit >= p.sla
                ? t(lang,
                  'Đang thực hiện đúng cam kết. Sản phẩm đủ điều kiện hiển thị nhãn SLA trên kết quả tìm kiếm của chủ hàng.',
                  'Meeting its commitment. This product qualifies for the SLA badge in shipper search results.')
                : t(lang,
                  'Chưa đạt cam kết đã công bố. Theo Quy tắc nền tảng, chênh lệch phải được bồi hoàn theo biểu phạt và nhãn SLA bị gỡ.',
                  'Below the published commitment. Under the Platform Rules the shortfall is compensated per the penalty schedule and the SLA badge is removed.')}
            </div>
          </ModalPanel>

          <ModalPanel title={t(lang, 'KHÁCH HÀNG & BÁN CHÉO', 'CUSTOMERS & CROSS-SELL')}>
            <div className="between panel-row">
              <span style={{ fontSize: 11.5 }}>{t(lang, 'Khách hàng đang dùng', 'Active customers')}</span>
              <b className="num" style={{ fontSize: 12 }}>{num(p.customers)}</b>
            </div>
            <div className="between panel-row">
              <span style={{ fontSize: 11.5 }}>{t(lang, 'Tỷ lệ gắn kèm', 'Attach rate')}</span>
              <b className="num" style={{ fontSize: 12 }}>{p.attachRate}%</b>
            </div>
            <div className="note" style={{ background: 'var(--brand-100)' }}>
              <b style={{ color: 'var(--brand-600)' }}>{t(lang, 'Cơ hội bán chéo', 'Cross-sell opportunity')}</b><br />
              {t(lang,
                `${p.customers} khách hàng đang dùng sản phẩm này; ${notReached} khách chưa dùng dịch vụ nào khác của bạn. Trợ lý chào giá theo chuyến có thể đề xuất gói dịch vụ tự động.`,
                `${p.customers} customers use this product; ${notReached} of them buy no other service from you. The voyage offering assistant can propose a bundle automatically.`)}
              <Link className="btn blk sm" style={{ marginTop: 8 }} href={`/r/c_offer?lang=${lang}`}>
                {t(lang, 'Mở trợ lý chào giá', 'Open the offering assistant')} →
              </Link>
            </div>
          </ModalPanel>
        </div>
      </div>
    </Modal>
  )
}
