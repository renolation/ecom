import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { corridors, lanes, sandboxPrograms } from '@/db/schema'
import { num, pct, t, usd, type Lang } from '@/lib/i18n'

/**
 * Scrolling market ticker — ui-2.html:1126 (`boot()`).
 *
 * The content is emitted twice because `.ticker-track` animates a -50% translate,
 * so the second copy is what makes the loop seamless.
 */
export async function Ticker({ lang }: { lang: Lang }) {
  const [laneRows, corridorRows, sandbox] = await Promise.all([
    db.select({ code: lanes.code, price: lanes.indexPrice, change: lanes.changePct })
      .from(lanes).orderBy(asc(lanes.ord)).limit(7),
    db.select({ status: corridors.statusCode }).from(corridors),
    db.select({ code: sandboxPrograms.code, used: sandboxPrograms.used, cap: sandboxPrograms.cap })
      .from(sandboxPrograms).orderBy(asc(sandboxPrograms.ord)),
  ])

  const liveCorridors = corridorRows.filter((c) => c.status === 'live').length
  // SB-01 (RFQ / booking) is the programme the completed-shipment counter tracks.
  const rfqProgramme = sandbox.find((s) => s.code === 'SB-01')

  const items = [
    ...laneRows.map((l) => (
      <div className="tk" key={l.code}>
        <span className="tk-l">{l.code}</span>
        <span className="tk-v num">{usd(l.price)}</span>
        <span className={`tk-d ${Number(l.change) > 0 ? 'u' : 'd'}`}>{pct(l.change)}</span>
      </div>
    )),
    <div className="tk" key="composite">
      <span className="tk-l">VLX-VN COMPOSITE</span>
      <span className="tk-v num">1,142.6</span>
      <span className="tk-d u">+1.4%</span>
    </div>,
    <div className="tk" key="shipments">
      <span className="tk-l">{t(lang, 'CHUYẾN HOÀN TẤT (LUỸ KẾ)', 'COMPLETED SHIPMENTS')}</span>
      <span className="tk-v num">{num(rfqProgramme?.used ?? 0)} / {num(rfqProgramme?.cap ?? 0)}</span>
    </div>,
    <div className="tk" key="escrow">
      <span className="tk-l">{t(lang, 'ESCROW NGÂN HÀNG GIỮ', 'BANK-HELD ESCROW')}</span>
      <span className="tk-v num">42.6 {t(lang, 'tỷ đ', 'bn VND')}</span>
    </div>,
    <div className="tk" key="corridors">
      <span className="tk-l">{t(lang, 'HÀNH LANG ĐANG MỞ', 'LIVE CORRIDORS')}</span>
      <span className="tk-v num">{liveCorridors} / {corridorRows.length}</span>
    </div>,
  ]

  return (
    <div className="ticker">
      <div className="ticker-track">
        {items}
        {/* Second pass: the -50% keyframe needs an identical copy to loop cleanly. */}
        {items.map((item, i) => <div className="tk" key={`dup-${i}`}>{item.props.children}</div>)}
      </div>
    </div>
  )
}
