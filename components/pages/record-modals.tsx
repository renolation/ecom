import { Modal, ModalPanel, ModalRow, ModalStats } from '@/components/modal'
import { Gauge } from '@/components/charts'
import { Meter, Tag } from '@/components/ui'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'
import type { Tone } from '@/lib/queries/home-types'

/**
 * Record dialogs for the fleet, member, credit and shipment tables.
 * Each mirrors the corresponding prototype modal (fleetModal, memModal,
 * creditModal, shipModal) and is opened by `?m=<id>` on the page URL.
 */

interface Ctx {
  lang: Lang
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}

export interface FleetRecord {
  id: string; name: string; icon: string; typeName: string; isShip: boolean
  capacity: number; unit: string; builtYear: number; age: number | null
  flag: string; classSociety: string; statusName: string; ownerName: string
  laneCode: string; utilisation: number; position: string; speed: number
  fuel: number; co2: number; cii: string; insurance: string; certDays: number
  maintOn: string; maintDue: number; opex: number; revenue: number
  value: number; financed: boolean; dscr: number; crew: number; imo: string
}

/** fleetModal — ui-2.html:3006. */
export function FleetModal({ asset: a, lang, basePath, searchParams }: Ctx & { asset: FleetRecord }) {
  const needsAttention = a.certDays < 45 || a.maintDue < 21
  return (
    <Modal
      title={a.name} icon={a.icon} basePath={basePath} searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<>
        <span className="tag n">{a.typeName}</span>
        {needsAttention ? <span className="tag d">{t(lang, 'Cần chú ý', 'Attention')}</span> : null}
      </>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Sức chở', 'Capacity'), `${num(a.capacity)} ${a.unit}`],
          [t(lang, 'Khai thác', 'Utilisation'), `${a.utilisation}%`],
          [t(lang, 'Giá trị tài sản', 'Asset value'), `${num(a.value)} ${t(lang, 'tỷ', 'bn')}`],
          [t(lang, 'Tuổi', 'Age'), `${a.age ?? '—'} ${t(lang, 'năm', 'yr')}`],
        ]} />

        <div className="grid g2" style={{ gap: 12 }}>
          <ModalPanel title={t(lang, 'HỒ SƠ KỸ THUẬT', 'TECHNICAL RECORD')}>
            <dl>
              <ModalRow term={t(lang, 'Mã tài sản', 'Asset id')}><span className="num">{a.id}</span></ModalRow>
              <ModalRow term={t(lang, 'Năm đóng', 'Built')}><span className="num">{a.builtYear}</span></ModalRow>
              {a.isShip ? (
                <>
                  <ModalRow term={t(lang, 'Số IMO', 'IMO number')}><span className="num">{a.imo}</span></ModalRow>
                  <ModalRow term={t(lang, 'Quốc tịch tàu', 'Flag')}>{a.flag}</ModalRow>
                  <ModalRow term={t(lang, 'Đăng kiểm', 'Class society')}>{a.classSociety}</ModalRow>
                  <ModalRow term={t(lang, 'Thuyền viên', 'Crew')}><span className="num">{a.crew}</span></ModalRow>
                </>
              ) : null}
              <ModalRow term={t(lang, 'Hình thức sở hữu', 'Ownership')} last>{a.ownerName}</ModalRow>
            </dl>
          </ModalPanel>

          <ModalPanel title={t(lang, 'KHAI THÁC & VỊ TRÍ', 'OPERATION & POSITION')}>
            <dl>
              <ModalRow term={t(lang, 'Trạng thái', 'Status')}>{a.statusName}</ModalRow>
              <ModalRow term={t(lang, 'Vị trí hiện tại', 'Current position')}>{a.position}</ModalRow>
              <ModalRow term={t(lang, 'Tuyến khai thác', 'Assigned lane')}>{a.laneCode}</ModalRow>
              <ModalRow term={t(lang, 'Mức khai thác', 'Utilisation')}>
                <Meter value={a.utilisation} width={70} />
              </ModalRow>
              {a.isShip ? <ModalRow term={t(lang, 'Tốc độ', 'Speed')}><span className="num">{num(a.speed, 1)} kn</span></ModalRow> : null}
              <ModalRow term={t(lang, 'Tiêu thụ nhiên liệu', 'Fuel burn')} last><span className="num">{num(a.fuel, 1)}</span></ModalRow>
            </dl>
          </ModalPanel>
        </div>

        <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
          <ModalPanel title={t(lang, 'TUÂN THỦ & BẢO DƯỠNG', 'COMPLIANCE & MAINTENANCE')}>
            <dl>
              <ModalRow term={t(lang, 'Chứng chỉ còn hiệu lực', 'Certificate valid for')}>
                {a.certDays < 0
                  ? <Tag tone="d">{t(lang, 'Đã hết hạn', 'Expired')}</Tag>
                  : <span className="num" style={{ color: a.certDays < 45 ? 'var(--down)' : undefined }}>
                    {a.certDays} {t(lang, 'ngày', 'days')}
                  </span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Kỳ bảo dưỡng kế tiếp', 'Next maintenance')}><span className="num">{a.maintOn}</span></ModalRow>
              <ModalRow term={t(lang, 'Còn lại', 'Due in')}>
                <span className="num" style={{ color: a.maintDue < 21 ? 'var(--gold-500)' : undefined }}>
                  {a.maintDue} {t(lang, 'ngày', 'days')}
                </span>
              </ModalRow>
              {a.isShip ? (
                <ModalRow term={t(lang, 'Xếp hạng CII', 'CII rating')}>
                  <Tag tone={['A', 'B'].includes(a.cii) ? 'u' : a.cii === 'C' ? 'gd' : 'd'}>{a.cii}</Tag>
                </ModalRow>
              ) : null}
              <ModalRow term={t(lang, 'Phát thải CO₂', 'CO₂ emissions')} last><span className="num">{num(a.co2)}</span></ModalRow>
            </dl>
            {needsAttention ? (
              <div className="note">
                {t(lang,
                  'Chứng chỉ sắp hết hạn hoặc đến kỳ bảo dưỡng. Chứng chỉ hết hiệu lực sẽ chặn khai thác — cần đặt lịch đăng kiểm hoặc lên đà trước hạn.',
                  'A certificate is close to expiry or maintenance is due. An expired certificate blocks operation — schedule survey or dry-docking before the deadline.')}
              </div>
            ) : null}
          </ModalPanel>

          <ModalPanel title={t(lang, 'KINH TẾ TÀI SẢN', 'ASSET ECONOMICS')}>
            <dl>
              <ModalRow term={t(lang, 'Chi phí vận hành năm', 'Annual opex')}><span className="num">{num(a.opex)} {t(lang, 'tỷ', 'bn')}</span></ModalRow>
              <ModalRow term={t(lang, 'Doanh thu năm', 'Annual revenue')}><span className="num">{num(a.revenue)} {t(lang, 'tỷ', 'bn')}</span></ModalRow>
              <ModalRow term={t(lang, 'Biên đóng góp', 'Contribution')}>
                <span className="num" style={{ color: a.revenue > a.opex ? 'var(--up)' : 'var(--down)' }}>
                  {num(a.revenue - a.opex)} {t(lang, 'tỷ', 'bn')}
                </span>
              </ModalRow>
              <ModalRow term={t(lang, 'Có khoản vay', 'Financed')}>
                {a.financed ? <Tag tone="b">{t(lang, 'Có', 'Yes')}</Tag> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
              <ModalRow term="DSCR" last>
                <span className="num" style={{ color: a.dscr >= 1.2 ? 'var(--up)' : 'var(--gold-500)' }}>{num(a.dscr, 2)}×</span>
              </ModalRow>
            </dl>
          </ModalPanel>
        </div>
      </div>
    </Modal>
  )
}

export interface MemberRecord {
  id: string; name: string; typeName: string; sectorName: string; country: string
  rating: string; score: number; limit: number; utilisation: number
  teu: number; gmv: number; kybLabel: string; kybTone: string
  riskLabel: string; riskTone: string; complianceLabel: string; complianceTone: string
  tier: string; joinedOn: string; corridorId: number; active30d: boolean; repeat90d: boolean
}

/** memModal — ui-2.html:3708. */
export function MemberModal({ member: m, lang, basePath, searchParams }: Ctx & { member: MemberRecord }) {
  return (
    <Modal
      title={m.name} icon="🏢" basePath={basePath} searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<>
        <span className={`tag ${m.kybTone}`}>{m.kybLabel}</span>
        <span className={`tag ${m.riskTone}`}>{m.riskLabel}</span>
      </>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Xếp hạng', 'Rating'), m.rating],
          [t(lang, 'Điểm tín nhiệm', 'Credit score'), `${m.score}/100`],
          [t(lang, 'Hạn mức', 'Limit'), m.limit > 0 ? `${num(m.limit)} ${t(lang, 'tr', 'm')}` : '—'],
          ['TEU', num(m.teu)],
        ]} />

        <div className="grid g2" style={{ gap: 12 }}>
          <ModalPanel title={t(lang, 'HỒ SƠ DOANH NGHIỆP', 'COMPANY RECORD')}>
            <dl>
              <ModalRow term={t(lang, 'Mã thành viên', 'Member id')}><span className="num">{m.id}</span></ModalRow>
              <ModalRow term={t(lang, 'Loại thành viên', 'Member type')}>{m.typeName}</ModalRow>
              <ModalRow term={t(lang, 'Ngành hàng', 'Sector')}>{m.sectorName}</ModalRow>
              <ModalRow term={t(lang, 'Quốc gia', 'Country')}>{m.country}</ModalRow>
              <ModalRow term={t(lang, 'Hạng kết nối', 'Access tier')}>{m.tier}</ModalRow>
              <ModalRow term={t(lang, 'Ngày gia nhập', 'Joined')} last><span className="num">{m.joinedOn}</span></ModalRow>
            </dl>
          </ModalPanel>

          <ModalPanel title={t(lang, 'ĐỊNH DANH & TUÂN THỦ', 'IDENTITY & COMPLIANCE')}>
            <dl>
              <ModalRow term={t(lang, 'Trạng thái KYB', 'KYB status')}><Tag tone={m.kybTone as Tone}>{m.kybLabel}</Tag></ModalRow>
              <ModalRow term={t(lang, 'Mức rủi ro', 'Risk level')}><Tag tone={m.riskTone as Tone}>{m.riskLabel}</Tag></ModalRow>
              <ModalRow term={t(lang, 'Tuân thủ', 'Compliance')}><Tag tone={m.complianceTone as Tone}>{m.complianceLabel}</Tag></ModalRow>
              <ModalRow term={t(lang, 'Hành lang', 'Corridor')}>0{m.corridorId}</ModalRow>
              <ModalRow term={t(lang, 'Hoạt động 30 ngày', 'Active in 30 days')}>
                {m.active30d ? <Tag tone="u">{t(lang, 'Có', 'Yes')}</Tag> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Quay lại trong 90 ngày', 'Repeat in 90 days')} last>
                {m.repeat90d ? <Tag tone="u">{t(lang, 'Có', 'Yes')}</Tag> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
            </dl>
            {m.kybLabel && m.kybTone !== 'u' ? (
              <div className="note">
                {t(lang,
                  'Hồ sơ định danh chưa hoàn tất nên quyền giao dịch đang bị chặn. Ba chốt bắt buộc: rà soát cấm vận, xác minh chủ sở hữu hưởng lợi và thẩm định tài chính.',
                  'The identity file is incomplete, so trading stays blocked. Three mandatory gates: sanctions screening, beneficial-owner verification and financial review.')}
              </div>
            ) : null}
          </ModalPanel>
        </div>

        <div style={{ marginTop: 12 }}>
          <ModalPanel title={t(lang, 'QUY MÔ GIAO DỊCH', 'TRADING FOOTPRINT')}>
            <div className="grid g3" style={{ gap: 9 }}>
              {([
                [t(lang, 'Khối lượng', 'Volume'), `${num(m.teu)} TEU`],
                ['GMV', `${num(m.gmv)} ${t(lang, 'tr đ', 'm VND')}`],
                [t(lang, 'Sử dụng hạn mức', 'Limit drawn'), `${m.utilisation}%`],
              ] as const).map(([label, value]) => (
                <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 10 }}>
                  <div className="muted">{label}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 750 }}>{value}</div>
                </div>
              ))}
            </div>
            {m.limit > 0 ? <div style={{ marginTop: 10 }}><Meter value={m.utilisation} width={200} /></div> : null}
          </ModalPanel>
        </div>
      </div>
    </Modal>
  )
}

export interface CreditRecord {
  id: string; member: string; memberId: string; rating: string; productName: string
  amount: number; score: number; decisionLabel: string; decisionTone: string
  rate: number; pd: number; turnaround: number; autoDecided: boolean
  appliedOn: string; bank: string
}

/** creditModal — ui-2.html:4211. */
export function CreditModal({ application: a, lang, basePath, searchParams }: Ctx & { application: CreditRecord }) {
  return (
    <Modal
      title={a.member} icon="🧠" basePath={basePath} searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<>
        <span className={`tag ${a.decisionTone}`}>{a.decisionLabel}</span>
        <span className="tag n">{a.bank}</span>
      </>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Số tiền đề nghị', 'Requested'), `${num(a.amount)} ${t(lang, 'tr', 'm')}`],
          [t(lang, 'Lãi suất', 'Rate'), `${num(a.rate, 2)}%`],
          [t(lang, 'Xác suất vỡ nợ', 'PD'), `${num(a.pd, 2)}%`],
          [t(lang, 'Thời gian xử lý', 'Turnaround'), `${num(a.turnaround, 1)}h`],
        ]} />

        <div className="grid g2" style={{ gap: 12 }}>
          <ModalPanel title={t(lang, 'ĐIỂM TÍN NHIỆM', 'CREDIT SCORE')}>
            <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0' }}>
              <Gauge value={a.score} label={t(lang, 'trên 100', 'of 100')} size={170} />
            </div>
            <dl>
              <ModalRow term={t(lang, 'Xếp hạng nội bộ', 'Internal rating')}>{a.rating}</ModalRow>
              <ModalRow term={t(lang, 'Mã hồ sơ', 'Reference')} last><span className="num">{a.id}</span></ModalRow>
            </dl>
          </ModalPanel>

          <ModalPanel title={t(lang, 'QUYẾT ĐỊNH & THẨM QUYỀN', 'DECISION & AUTHORITY')}>
            <dl>
              <ModalRow term={t(lang, 'Sản phẩm', 'Product')}>{a.productName}</ModalRow>
              <ModalRow term={t(lang, 'Ngày nộp', 'Applied')}><span className="num">{a.appliedOn}</span></ModalRow>
              <ModalRow term={t(lang, 'Kết quả', 'Decision')}><Tag tone={a.decisionTone as Tone}>{a.decisionLabel}</Tag></ModalRow>
              <ModalRow term={t(lang, 'Cách quyết định', 'Decided by')}>
                {a.autoDecided
                  ? <Tag tone="b">{t(lang, 'Máy đề xuất', 'Engine-proposed')}</Tag>
                  : <Tag tone="gd">{t(lang, 'Chuyên viên duyệt', 'Officer review')}</Tag>}
              </ModalRow>
              <ModalRow term={t(lang, 'Ngân hàng quyết định', 'Deciding bank')} last>{a.bank}</ModalRow>
            </dl>
            <div className="note">
              {t(lang,
                'Nền tảng thu thập hồ sơ theo đồng ý của khách hàng và kết nối API — không quyết định tín dụng. Mọi phê duyệt thuộc thẩm quyền của ngân hàng.',
                'The platform collects files under customer consent and connects APIs — it makes no credit decision. Every approval rests with the bank.')}
            </div>
          </ModalPanel>
        </div>
      </div>
    </Modal>
  )
}

export interface ShipmentRecord {
  id: string; laneCode: string; carrier: string; shipper: string; qty: number
  statusName: string; statusOrdinal: number; etd: string; eta: string
  value: number; cargoValue: number; vessel: string; risk: number
  hasEbl: boolean; hasInsurance: boolean; hasFinance: boolean
  inDispute: boolean; docCount: number; corridorId: number
}

/** shipModal — ui-2.html:1815. */
export function ShipmentModal({ shipment: s, lang, basePath, searchParams }: Ctx & { shipment: ShipmentRecord }) {
  const progress = ((s.statusOrdinal + 1) / 8) * 100
  return (
    <Modal
      title={s.id} icon="🛰️" basePath={basePath} searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
      tags={<>
        <span className={`tag ${s.statusOrdinal >= 7 ? 'u' : s.statusOrdinal >= 4 ? 'b' : 'n'}`}>{s.statusName}</span>
        {s.risk === 2 ? <span className="tag d">{t(lang, 'Rủi ro cao', 'High risk')}</span> : null}
      </>}
    >
      <div style={{ padding: '18px 20px' }}>
        <ModalStats items={[
          [t(lang, 'Khối lượng', 'Volume'), `${s.qty} TEU`],
          [t(lang, 'Giá trị cước', 'Freight value'), usd(s.value)],
          [t(lang, 'Giá trị hàng', 'Cargo value'), usd(s.cargoValue)],
          [t(lang, 'Chứng từ', 'Documents'), s.docCount],
        ]} />

        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontWeight: 700, marginBottom: 5 }}>
            {t(lang, 'Tiến độ hành trình', 'Journey progress')}
          </div>
          <Meter value={progress} width={260} />
        </div>

        <div className="grid g2" style={{ gap: 12 }}>
          <ModalPanel title={t(lang, 'HÀNH TRÌNH', 'JOURNEY')}>
            <dl>
              <ModalRow term={t(lang, 'Tuyến', 'Lane')}>{s.laneCode}</ModalRow>
              <ModalRow term={t(lang, 'Hãng tàu', 'Carrier')}>{s.carrier}</ModalRow>
              <ModalRow term={t(lang, 'Tàu', 'Vessel')}>{s.vessel}</ModalRow>
              <ModalRow term="ETD"><span className="num">{s.etd}</span></ModalRow>
              <ModalRow term="ETA"><span className="num">{s.eta}</span></ModalRow>
              <ModalRow term={t(lang, 'Hành lang', 'Corridor')} last>0{s.corridorId}</ModalRow>
            </dl>
          </ModalPanel>

          <ModalPanel title={t(lang, 'DỊCH VỤ KÈM THEO', 'ATTACHED SERVICES')}>
            <dl>
              <ModalRow term={t(lang, 'Chủ hàng', 'Shipper')}>{s.shipper}</ModalRow>
              <ModalRow term={t(lang, 'Vận đơn điện tử', 'Electronic B/L')}>
                {s.hasEbl ? <Tag tone="v">eB/L</Tag> : <span className="muted">{t(lang, 'Bản giấy', 'Paper')}</span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Bảo hiểm hàng hoá', 'Cargo insurance')}>
                {s.hasInsurance ? <Tag tone="b">{t(lang, 'Có', 'Yes')}</Tag> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Tài trợ cước', 'Freight financing')}>
                {s.hasFinance ? <Tag tone="u">{t(lang, 'Có', 'Yes')}</Tag> : <span className="muted">{t(lang, 'Không', 'No')}</span>}
              </ModalRow>
              <ModalRow term={t(lang, 'Tranh chấp', 'Dispute')} last>
                {s.inDispute ? <Tag tone="d">{t(lang, 'Đang mở', 'Open')}</Tag> : <span className="muted">{t(lang, 'Không', 'None')}</span>}
              </ModalRow>
            </dl>
            {s.risk === 2 ? (
              <div className="note">
                {t(lang,
                  'Lô hàng đang trễ vượt ngưỡng cam kết. Có thể mở hồ sơ tranh chấp Tầng 1 — hệ thống tự phân xử từ bằng chứng AIS và mốc chứng từ, escrow giữ tiền cho tới khi kết luận.',
                  'This shipment is delayed beyond the agreed threshold. A Tier-1 dispute can be opened — it auto-adjudicates from AIS and document evidence, and escrow holds the funds until it concludes.')}
              </div>
            ) : null}
          </ModalPanel>
        </div>
      </div>
    </Modal>
  )
}
