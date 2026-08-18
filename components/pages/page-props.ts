import type { Lang } from '@/lib/i18n'

/** Every ported route page takes the same shape. */
export interface RoutePageProps {
  lang: Lang
  route: string
  /** Path the table controls link back to, e.g. `/r/s_market`. */
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}

export type RoutePage = (props: RoutePageProps) => Promise<React.ReactNode>
