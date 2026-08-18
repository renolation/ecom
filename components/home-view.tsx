import Link from 'next/link'
import { Sparkline } from '@/components/charts'
import type { HomeView, Kpi, Shortcut, TodoItem, Tone } from '@/lib/queries/home-types'
import type { Lang } from '@/lib/i18n'
import { t } from '@/lib/i18n'

const toneVar: Record<Tone, string> = {
  d: 'var(--down)', gd: 'var(--gold-500)', u: 'var(--up)',
  b: 'var(--brand-500)', v: 'var(--violet)', n: 'var(--line-2)',
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="kpi">
      <div className="kpi-l">{kpi.label}</div>
      <div className="kpi-v">
        {kpi.value}
        {kpi.unit ? <small>{kpi.unit}</small> : null}
      </div>
      <div className="kpi-m">
        {kpi.bar !== undefined ? (
          <div className="bar" style={{ width: 96 }}>
            <i style={{ width: `${Math.min(100, Math.max(0, kpi.bar))}%` }} />
          </div>
        ) : null}
        {kpi.meta ? (
          kpi.metaTone
            ? <span className={`tag ${kpi.metaTone}`}>{kpi.meta}</span>
            : <span>{kpi.meta}</span>
        ) : null}
      </div>
      {kpi.spark ? (
        <div className="kpi-spark">
          <Sparkline values={kpi.spark} width={110} height={36} color={kpi.sparkColor} fill />
        </div>
      ) : null}
    </div>
  )
}

function TodoCard({ items, lang }: { items: TodoItem[]; lang: Lang }) {
  const urgent = items.filter((i) => i.tone === 'd').length
  return (
    <div className="card">
      <div className="card-h">
        <h3>{t(lang, 'Việc cần làm hôm nay', 'Your work today')}</h3>
        <span className="tag d">{urgent} {t(lang, 'gấp', 'urgent')}</span>
        <span className="sub" style={{ marginLeft: 'auto' }}>
          {t(lang, 'Sắp theo mức độ khẩn', 'Sorted by urgency')}
        </span>
      </div>
      <div className="card-b" style={{ padding: 10 }}>
        {items.map((item) => (
          <Link
            key={`${item.route}-${item.title}`}
            href={`/r/${item.route}?lang=${lang}`}
            className="todo-row"
            style={{ borderLeftColor: toneVar[item.tone] }}
          >
            <div className="todo-ic">{item.icon}</div>
            <div>
              <b style={{ fontSize: 12.5 }}>{item.title}</b>
              <div className="muted" style={{ marginTop: 2 }}>{item.detail}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`tag ${item.tone}`}>{item.badge}</span>
            </div>
            <span style={{ color: 'var(--text-3)' }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function ShortcutCard({ links, lang }: { links: Shortcut[]; lang: Lang }) {
  return (
    <div className="card">
      <div className="card-h"><h3>{t(lang, 'Lối tắt', 'Shortcuts')}</h3></div>
      <div className="card-b" style={{ padding: 11 }}>
        <div className="grid g2" style={{ gap: 8 }}>
          {links.map((l) => (
            <Link key={l.route} className="btn shortcut-btn" href={`/r/${l.route}?lang=${lang}`}>
              <span style={{ fontSize: 16, marginRight: 8 }}>{l.icon}</span>
              <span><b style={{ fontSize: 12, display: 'block' }}>{l.label}</b></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HomeViewLayout({ view, lang }: { view: HomeView; lang: Lang }) {
  return (
    <>
      <div className="hero" style={{ marginBottom: 14, padding: '24px 28px' }}>
        <div className="flex wrap" style={{ gap: 7, marginBottom: 10 }}>
          {view.heroTags.map((tag) => (
            <span key={tag} className="tag hero-tag">{tag}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 760, letterSpacing: '-.025em' }}>{view.heroTitle}</h1>
        <p style={{ color: '#B9D3E0', fontSize: 13.5, marginTop: 6, maxWidth: 760 }}>{view.heroSub}</p>
      </div>

      <div className="grid g5" style={{ marginBottom: 14 }}>
        {view.kpis.map((k) => <KpiCard key={k.label} kpi={k} />)}
      </div>

      <div className="grid g-2-1">
        <TodoCard items={view.todos} lang={lang} />
        <div className="stack">
          <ShortcutCard links={view.shortcuts} lang={lang} />
          {view.panel ? (
            <div className="card">
              <div className="card-h"><h3>{view.panel.title}</h3></div>
              <div className="card-b" style={{ padding: 11 }}>
                {view.panel.rows.map((r) => (
                  <div key={r.title} className="between panel-row">
                    <div>
                      <b style={{ fontSize: 12 }}>{r.title}</b>
                      <div className="muted">{r.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b className="num" style={{ fontSize: 13 }}>{r.value}</b>
                      {r.delta ? <span className={`tag ${r.deltaTone ?? 'n'}`} style={{ marginLeft: 6 }}>{r.delta}</span> : null}
                    </div>
                  </div>
                ))}
                <Link className="btn blk sm p" style={{ marginTop: 9 }} href={`/r/${view.panel.footerRoute}?lang=${lang}`}>
                  {view.panel.footerLabel} →
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
