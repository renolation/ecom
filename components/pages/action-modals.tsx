import type { ReactNode } from 'react'
import { Modal } from '@/components/modal'
import { TierPill } from '@/components/ui'
import { num, t, type Lang } from '@/lib/i18n'

/**
 * Action dialogs — the prototype's `eblModal`, `lcModal`, `bidModal` and `suspendModal`
 * (ui-2.html:1938, 2130, 2686, 3479).
 *
 * These differ from the record dialogs in `record-modals.tsx`: they are forms opened from
 * a page's header button rather than from a table row. The prototype's submit handlers
 * only raise a toast — nothing is persisted — so the controls here are presentational and
 * carry `disabled`/`readOnly`, which also keeps the pages server-rendered.
 */

interface Ctx {
  lang: Lang
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}

/** Reserved `?m=` keys for the header-button dialogs, so they never collide with a record id. */
export const ACTION_MODAL = {
  ebl: 'ebl',
  lc: 'lc',
  suspend: 'suspend',
} as const

/** Bid dialogs carry the tender reference: `?m=bid:RFQ-xxxx`. */
export const bidModalKey = (rfq: string) => `bid:${rfq}`
export const bidModalRef = (openId: string | null) =>
  openId?.startsWith('bid:') ? openId.slice(4) : null

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fld">
      <label>{label}</label>
      {children}
    </div>
  )
}

function Select({ options }: { options: string[] }) {
  return (
    <select className="inp" defaultValue={options[0]} disabled>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Footer({ lang, confirm, danger }: { lang: Lang; confirm: string; danger?: boolean }) {
  return (
    <div className="flex" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
      <span className="btn">{t(lang, 'Huỷ', 'Cancel')}</span>
      <span className={danger ? 'btn' : 'btn p'}
        style={danger ? { background: 'var(--down)', borderColor: 'var(--down)', color: '#fff' } : undefined}>
        {confirm}
      </span>
    </div>
  )
}

/** ui-2.html:1938 — endorse an electronic bill of lading to a financing bank. */
export function EblEndorseModal({ documents, lang, basePath, searchParams }: Ctx & { documents: string[] }) {
  const checks: Array<[string, string]> = [
    ['Bên nhận đã tham gia nền tảng và có chứng thư số',
      'Recipient is on-platform with a digital certificate'],
    ['Luật áp dụng công nhận bản ghi điện tử chuyển nhượng được',
      'Applicable law recognises transferable electronic records'],
    ['Chỉ tồn tại một bản gốc — bản cũ sẽ bị khoá',
      'Only one original exists — the prior version will be locked'],
    ['Phương án fallback giấy đã được thoả thuận trong hợp đồng',
      'Paper fallback agreed in the contract'],
  ]

  return (
    <Modal
      title={t(lang, 'Chuyển nhượng vận đơn điện tử', 'Endorse electronic B/L')}
      tags={<span className="mod sb">SB-02</span>}
      basePath={basePath}
      searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
    >
      <div style={{ padding: '18px 20px' }}>
        <div className="stack" style={{ gap: 11 }}>
          <Field label={t(lang, 'Vận đơn', 'Bill of lading')}>
            <Select options={documents} />
          </Field>
          <Field label={t(lang, 'Chuyển quyền kiểm soát cho', 'Transfer control to')}>
            <Select options={[
              `HDBank — ${t(lang, 'ngân hàng tài trợ', 'financing bank')}`,
              'MBBank', 'SHB', 'TPBank',
            ]} />
          </Field>
          <Field label={t(lang, 'Mục đích', 'Purpose')}>
            <Select options={[
              t(lang, 'Bảo đảm cho khoản tài trợ', 'Security for financing'),
              t(lang, 'Xuất trình theo L/C', 'Presentation under an L/C'),
              t(lang, 'Chuyển quyền sở hữu hàng hoá', 'Transfer of title to the goods'),
            ]} />
          </Field>
          <Field label={t(lang, 'Luật áp dụng', 'Governing law')}>
            <Select options={[
              t(lang, 'Pháp luật Việt Nam', 'Vietnamese law'), 'English law', 'Singapore law',
            ]} />
          </Field>
        </div>

        <div className="note" style={{ marginTop: 13 }}>
          <b>{t(lang, 'Kiểm tra trước khi chuyển', 'Pre-transfer checks')}</b><br />
          {checks.map(([vi, en]) => (
            <div key={en} style={{ display: 'flex', gap: 7, padding: '3px 0' }}>
              <span style={{ color: 'var(--up)' }}>✓</span>
              <span>{t(lang, vi, en)}</span>
            </div>
          ))}
        </div>

        <Footer lang={lang} confirm={t(lang, 'Ký số & chuyển nhượng', 'Sign & endorse')} />
      </div>
    </Modal>
  )
}

/** ui-2.html:2130 — apply for a digital letter of credit. */
export function LcApplyModal({ shipments, lang, basePath, searchParams }: Ctx & { shipments: string[] }) {
  // ui-2.html:2144 — the first five are pre-ticked; the rest are optional.
  const documentSet: Array<[string, string, boolean]> = [
    ['eB/L', 'eB/L', true],
    ['Hoá đơn thương mại', 'Commercial invoice', true],
    ['Packing list', 'Packing list', true],
    ['C/O Form B', 'C/O Form B', true],
    ['Chứng nhận bảo hiểm', 'Insurance certificate', true],
    ['Phiếu kiểm định', 'Inspection certificate', false],
    ['Chứng nhận kiểm dịch', 'Phytosanitary certificate', false],
    ['Vận đơn đường bộ', 'Truck waybill', false],
  ]

  return (
    <Modal
      title={t(lang, 'Mở thư tín dụng số', 'Open a digital L/C')}
      tags={<span className="mod sb">SB-03</span>}
      basePath={basePath}
      searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
    >
      <div style={{ padding: '18px 20px' }}>
        <div className="grid g2" style={{ gap: 11 }}>
          <Field label={t(lang, 'Loại L/C', 'L/C type')}>
            <Select options={[
              t(lang, 'L/C không huỷ ngang', 'Irrevocable L/C'), 'UPAS L/C',
              t(lang, 'L/C trả ngay', 'Sight L/C'), t(lang, 'L/C trả chậm', 'Usance L/C'),
              t(lang, 'L/C xác nhận', 'Confirmed L/C'),
            ]} />
          </Field>
          <Field label={t(lang, 'Ngân hàng phát hành', 'Issuing bank')}>
            <Select options={['HDBank', 'MBBank', 'SHB', 'TPBank']} />
          </Field>
          <Field label={t(lang, 'Người thụ hưởng', 'Beneficiary')}>
            <input className="inp" defaultValue="Rotterdam Foods BV" readOnly />
          </Field>
          <Field label={t(lang, 'Giá trị', 'Value')}>
            <input className="inp num" defaultValue="1,284,000" readOnly />
          </Field>
          <Field label={t(lang, 'Lô hàng gắn kèm', 'Linked shipment')}>
            <Select options={shipments} />
          </Field>
          <Field label={t(lang, 'Ngày hết hạn', 'Expiry date')}>
            <input className="inp" type="date" defaultValue="2026-10-30" readOnly />
          </Field>
        </div>

        <div className="card" style={{ marginTop: 13 }}>
          <div className="card-b" style={{ padding: 13 }}>
            <b style={{ fontSize: 12.5 }}>{t(lang, 'Bộ chứng từ yêu cầu', 'Required document set')}</b>
            <div className="grid g2" style={{ gap: 6, marginTop: 8 }}>
              {documentSet.map(([vi, en, checked]) => (
                <label key={en} className="flex" style={{ gap: 7, fontSize: 12 }}>
                  <input type="checkbox" checked={checked} disabled readOnly />
                  {t(lang, vi, en)}
                </label>
              ))}
            </div>
            <div className="note" style={{ marginTop: 9 }}>
              {t(lang,
                'Các chứng từ đã tồn tại trên nền tảng sẽ được gắn tự động từ hồ sơ giao dịch — bạn không cần nhập lại.',
                'Documents already on the platform are attached automatically from the transaction record — no re-keying.')}
            </div>
          </div>
        </div>

        <Footer lang={lang} confirm={t(lang, 'Gửi hồ sơ mở L/C', 'Submit the application')} />
      </div>
    </Modal>
  )
}

/** ui-2.html:2686 — submit a bid against a tender invitation. */
export function BidSubmitModal({
  reference, client, indexPrice, estimate, winProbability, transitDays,
  lang, basePath, searchParams,
}: Ctx & {
  reference: string
  client: string
  indexPrice: number
  estimate: number
  winProbability: number
  transitDays: number
}) {
  return (
    <Modal
      title={`${t(lang, 'Chào giá', 'Submit bid')} · ${reference}`}
      tags={<span className="tag b">{client}</span>}
      basePath={basePath}
      searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
    >
      <div style={{ padding: '18px 20px' }}>
        <div className="grid g2" style={{ gap: 12 }}>
          <Field label={t(lang, 'Giá chào ($/cont)', 'Bid rate ($/unit)')}>
            <input className="inp num" defaultValue={num(estimate)} readOnly />
          </Field>
          <Field label={t(lang, 'Khối lượng cam kết', 'Committed volume')}>
            <Select options={[
              t(lang, 'Toàn bộ', 'Full volume'), t(lang, 'Tối đa 60%', 'Up to 60%'),
              t(lang, 'Tối đa 40%', 'Up to 40%'),
            ]} />
          </Field>
          <Field label={t(lang, 'Thời gian vận chuyển cam kết', 'Committed transit')}>
            <input className="inp num" readOnly
              defaultValue={`${transitDays} ${t(lang, 'ngày', 'days')}`} />
          </Field>
          <Field label={t(lang, 'Cam kết đúng lịch', 'On-time commitment')}>
            <Select options={[
              `95% ${t(lang, '(phạt 3% nếu vi phạm)', '(3% penalty)')}`, '90%',
              t(lang, 'Không cam kết', 'No commitment'),
            ]} />
          </Field>
        </div>

        <div className="card" style={{ marginTop: 13, borderColor: 'var(--brand-500)' }}>
          <div className="card-b" style={{ padding: 13 }}>
            <div className="between">
              <b style={{ fontSize: 12.5 }}>{t(lang, 'Phân tích cạnh tranh', 'Competitive analysis')}</b>
              <TierPill tier={2} lang={lang} />
            </div>
            <div className="grid g4" style={{ gap: 10, marginTop: 9 }}>
              {([
                [t(lang, 'Chỉ số tuyến', 'Lane index'), `$${num(indexPrice)}`],
                [t(lang, 'Giá thắng ước tính', 'Est. winning bid'), `$${num(estimate)}`],
                [t(lang, 'Khả năng thắng', 'Win probability'), `${winProbability}%`],
                [t(lang, 'Biên LN tại mức này', 'Margin here'), '21,4%'],
              ] as Array<[string, string]>).map(([label, value]) => (
                <div key={label}>
                  <div className="muted">{label}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 750 }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="sep" />
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {t(lang,
                'Dựa trên 6 gói thầu tương tự trong 12 tháng: giá thắng thường nằm ở 92–95% chỉ số. ',
                'Based on 6 comparable tenders over 12 months, winning bids land at 92–95% of index. ')}
              {t(lang,
                `Chào $${num(estimate)} đưa bạn vào nhóm hai nhà thầu dẫn đầu.`,
                `Bidding $${num(estimate)} places you in the top two.`)}
            </div>
          </div>
        </div>

        <Footer lang={lang} confirm={t(lang, 'Gửi chào giá', 'Submit bid')} />
      </div>
    </Modal>
  )
}

/** ui-2.html:3479 — suspend a listing. Destructive, so the dialog leads with the consequence. */
export function SuspendListingModal({ lang, basePath, searchParams }: Ctx) {
  return (
    <Modal
      title={`⚠ ${t(lang, 'Tạm ngừng niêm yết', 'Suspend listing')}`}
      basePath={basePath}
      searchParams={searchParams}
      closeLabel={t(lang, 'Đóng', 'Close')}
    >
      <div style={{ padding: '18px 20px' }}>
        <div style={{
          background: 'var(--down-bg)', borderRadius: 10, padding: 12,
          fontSize: 12.5, color: 'var(--text-2)', marginBottom: 14,
        }}>
          {t(lang,
            'Hành động này dừng hiển thị niêm yết và được ghi vào nhật ký giám sát. Các bên bị ảnh hưởng nhận thông báo qua API và email; booking đã xác nhận không bị ảnh hưởng.',
            'This stops the listing from being displayed and is written to the surveillance log. Affected parties are notified via API and email; confirmed bookings are unaffected.')}
        </div>

        <div className="stack" style={{ gap: 11 }}>
          <Field label={t(lang, 'Phạm vi', 'Scope')}>
            <Select options={[
              t(lang, 'Một dòng bảng cước', 'A single rate-card row'),
              t(lang, 'Toàn bộ niêm yết của một thành viên', 'All listings from one member'),
              t(lang, 'Một tuyến', 'One lane'),
            ]} />
          </Field>
          <Field label={t(lang, 'Cơ sở theo Quy tắc nền tảng', 'Basis under the Platform Rules')}>
            <Select options={[
              t(lang, 'Giá lệch xa chỉ số bất thường', 'Abnormal off-index pricing'),
              t(lang, 'Không đủ năng lực thực tế', 'Capacity cannot be substantiated'),
              t(lang, 'Vi phạm cam kết SLA lặp lại', 'Repeated SLA breaches'),
              t(lang, 'Nghi vấn giao dịch ảo', 'Suspected wash trading'),
            ]} />
          </Field>
          <Field label={t(lang, 'Thời lượng', 'Duration')}>
            <Select options={[
              t(lang, 'Đến khi thành viên phản hồi', 'Until the member responds'),
              `24 ${t(lang, 'giờ', 'hours')}`, `7 ${t(lang, 'ngày', 'days')}`,
            ]} />
          </Field>
          <Field label={t(lang, 'Thông báo công khai', 'Public notice')}>
            <textarea className="inp" style={{ height: 60, padding: '8px 11px' }} readOnly
              defaultValue={t(lang,
                'Niêm yết tạm ngừng để xác minh năng lực thực tế. Booking đã xác nhận không bị ảnh hưởng.',
                'Listing suspended pending verification of actual capacity. Confirmed bookings are unaffected.')} />
          </Field>
        </div>

        <Footer lang={lang} danger confirm={t(lang, 'Tạm ngừng niêm yết', 'Suspend the listing')} />
      </div>
    </Modal>
  )
}
