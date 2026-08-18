import { notFound } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { HomeViewLayout } from '@/components/home-view'
import { DEFAULT_LANG, isLang, type Lang } from '@/lib/i18n'
import type { HomeView } from '@/lib/queries/home-types'
import { cdpHome, exchangeHome, financeHome, regulatorHome } from '@/lib/queries/home-institutional'
import { carrierHome, shipperHome } from '@/lib/queries/home-trade'
import { listPersonas, navigationFor } from '@/lib/queries/navigation'

/** Every page reads live data — nothing is prerendered. */
export const dynamic = 'force-dynamic'

const HOME_BY_PERSONA: Record<string, (lang: Lang) => Promise<HomeView>> = {
  shipper: shipperHome,
  carrier: carrierHome,
  finance: financeHome,
  exchange: exchangeHome,
  regulator: regulatorHome,
  cdp: cdpHome,
}

export default async function PersonaHome({
  params, searchParams,
}: {
  params: Promise<{ persona: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { persona: personaCode } = await params
  const { lang: langParam } = await searchParams
  const lang: Lang = isLang(langParam) ? langParam : DEFAULT_LANG

  const buildHome = HOME_BY_PERSONA[personaCode]
  if (!buildHome) notFound()

  const [personas, groups, view] = await Promise.all([
    listPersonas(lang),
    navigationFor(personaCode, lang),
    buildHome(lang),
  ])

  const persona = personas.find((p) => p.code === personaCode)
  if (!persona) notFound()

  return (
    <AppShell
      lang={lang}
      persona={persona}
      personas={personas}
      groups={groups}
      activeRoute={persona.homeRoute}
    >
      <HomeViewLayout view={view} lang={lang} />
    </AppShell>
  )
}
