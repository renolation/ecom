import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { AppShell } from '@/components/app-shell'
import { db } from '@/lib/db'
import { navGroups, navItems } from '@/db/schema'
import { DEFAULT_LANG, isLang, t, type Lang } from '@/lib/i18n'
import { listPersonas, navigationFor } from '@/lib/queries/navigation'
import { PAGES } from '@/components/pages/registry'

export const dynamic = 'force-dynamic'

/**
 * Placeholder for the 32 prototype routes not yet ported.
 *
 * The sidebar is real and comes from the database, so every link resolves; this page
 * says plainly which screen is missing rather than 404-ing. Persona home routes are
 * redirected to their built page.
 */
export default async function RouteStub({
  params, searchParams,
}: {
  params: Promise<{ route: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { route } = await params
  const sp = await searchParams
  const langParam = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang
  const lang: Lang = isLang(langParam) ? langParam : DEFAULT_LANG

  const personas = await listPersonas(lang)
  const home = personas.find((p) => p.homeRoute === route)
  if (home) redirect(`/${home.code}?lang=${lang}`)

  const owner = await db
    .select({ personaCode: navGroups.personaCode, labelVi: navItems.labelVi, labelEn: navItems.labelEn })
    .from(navItems)
    .innerJoin(navGroups, eq(navGroups.id, navItems.groupId))
    .where(eq(navItems.route, route))
    .limit(1)

  const personaCode = owner[0]?.personaCode ?? 'shipper'
  const persona = personas.find((p) => p.code === personaCode) ?? personas[0]
  const groups = await navigationFor(personaCode, lang)
  const label = owner[0] ? (lang === 'vi' ? owner[0].labelVi : owner[0].labelEn) : route

  const Page = PAGES[route]
  const body = Page
    ? await Page({ lang, route, basePath: `/r/${route}`, searchParams: sp })
    : (
      <div className="stub">
        <div className="stub-inner">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <h2>{label}</h2>
          <p>
            {t(lang,
              'Màn hình này chưa được port sang Next.js. Cơ sở dữ liệu đã có đầy đủ dữ liệu cho nó — chỉ còn phần giao diện.',
              'This screen has not been ported to Next.js yet. The database already holds all of its data — only the interface is pending.')}
          </p>
          <p className="muted" style={{ marginTop: 10 }}>
            {t(lang, 'Tuyến', 'Route')}: <code>{route}</code>
          </p>
        </div>
      </div>
    )

  return (
    <AppShell lang={lang} persona={persona} personas={personas} groups={groups} activeRoute={route}>
      {body}
    </AppShell>
  )
}
