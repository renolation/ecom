import Link from 'next/link'
import { RailToggle } from '@/components/rail-toggle'
import { Ticker } from '@/components/shell/ticker'
import { NotificationBell, PersonaSelector, ThemeToggle } from '@/components/shell/topbar-controls'
import { t, type Lang } from '@/lib/i18n'
import type { NavGroupView, PersonaView } from '@/lib/queries/navigation'

/**
 * Topbar + sidebar, following ui-2.html's shell markup (lines 312–348, 1111–1148).
 *
 * Both are driven by the `personas`, `nav_groups` and `nav_items` tables, so a menu
 * change is a data change rather than a redeploy. Persona switching is presentational:
 * this build has no authentication and every query returns the full dataset.
 */
export function AppShell({
  lang, persona, personas, groups, activeRoute, children,
}: {
  lang: Lang
  persona: PersonaView
  personas: PersonaView[]
  groups: NavGroupView[]
  activeRoute: string
  children: React.ReactNode
}) {
  return (
    <>
      <header className="top">
        <RailToggle label={t(lang, 'Mở menu', 'Toggle menu')} />
        <Link className="brand" href={`/${persona.code}?lang=${lang}`}>
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 17.5c1.6 1.2 3 1.2 4.5 0s2.9-1.2 4.5 0 3 1.2 4.5 0 2.9-1.2 4.5 0"
                stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M5.5 13.5 12 3l6.5 10.5" stroke="#fff" strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              <path d="M12 3v10.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="brand-txt">
            <b>VLX</b>
            <span>{t(lang, 'Nền tảng giao dịch Hàng hải & Tài chính', 'Maritime Trade & Finance Platform')}</span>
          </div>
        </Link>

        <Ticker lang={lang} />

        <div className="top-act">
          <ThemeToggle title={t(lang, 'Đổi giao diện sáng/tối', 'Toggle light/dark theme')} />
          <div className="lang">
            <Link href={`/${persona.code}?lang=vi`} className={lang === 'vi' ? 'on' : ''}>VI</Link>
            <Link href={`/${persona.code}?lang=en`} className={lang === 'en' ? 'on' : ''}>EN</Link>
          </div>
          <NotificationBell
            count={7}
            message={t(lang, 'Bạn có 7 thông báo mới', 'You have 7 new notifications')}
          />
          <div className="avatar">{persona.initials}</div>
        </div>
      </header>

      <aside className="rail">
        <PersonaSelector
          current={persona}
          personas={personas}
          lang={lang}
          label={t(lang, 'Đăng nhập với vai trò', 'Signed in as')}
        />

        <nav className="nav">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="nav-grp">{g.name}</div>
              {g.items.map((it) => (
                <Link
                  key={it.route}
                  href={`/r/${it.route}?lang=${lang}`}
                  className={it.route === activeRoute ? 'on' : ''}
                >
                  <span className="ni">{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.badge ? <span className="pill">{it.badge}</span> : null}
                  {it.isAi ? <span className="pill ph2">AI</span> : null}
                  {it.isNew ? (
                    <span className="pill" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>
                      {t(lang, 'Mới', 'New')}
                    </span>
                  ) : null}
                  {it.moduleCode ? <span className="qtag">{it.moduleCode}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="between">
            <span>VLX · VMFB {t(lang, 'bản demo', 'demo')} v1.0</span>
            <span className="tag n">SANDBOX</span>
          </div>
          <div style={{ marginTop: 5 }}>
            {t(lang,
              'Dữ liệu mô phỏng · Fiat-first · Không nắm giữ tiền khách hàng',
              'Simulated data · Fiat-first · No client funds held')}
          </div>
        </div>
      </aside>

      <main className="main"><div className="page">{children}</div></main>
    </>
  )
}
