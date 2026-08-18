import { evalArrayLiteral } from './prototype-data'
import type { SqlValue } from './sql-writer'
import { insertRows, section } from './sql-writer'

type Ctx = Record<string, any>
type Bi = { vi: Ctx; en: Ctx }

const LICENCE_MARKER = 'Ma trận giấy phép theo dịch vụ'
const DECISION_MARKER = 'Ai quyết định việc gì'
const MATRIX_END = '.map(function(r)'

/** Product taxonomy, fleet classifications, campaigns, consent and the two governance matrices. */
export function buildCatalog(bi: Bi): string {
  const { vi, en } = bi
  const parts: string[] = []

  parts.push(section('Reference — product taxonomy'))
  parts.push(
    insertRows(
      'product_industries',
      ['code', 'name_vi', 'name_en', 'icon', 'source', 'ord'],
      vi.PROD_L1.map((l: any, i: number) => [l[0], l[1][0], l[1][1], l[2], l[3], i]),
    ),
  )
  parts.push(
    insertRows(
      'product_groups',
      ['code', 'name_vi', 'name_en', 'icon', 'industry_code', 'source', 'ord'],
      vi.PROD_GROUPS.map((g: any, i: number) => [g[0], g[1][0], g[1][1], g[2], g[3], g[4], i]),
    ),
  )
  parts.push(
    insertRows(
      'lifecycle_stages',
      ['code', 'name_vi', 'name_en'],
      Object.entries(vi.LIFECYCLE as Record<string, [string, string, string]>).map(
        ([code, v]) => [code, v[1], v[2]],
      ),
    ),
  )

  parts.push(section('Reference — fleet classifications'))
  parts.push(
    insertRows(
      'asset_types',
      ['code', 'name_vi', 'name_en', 'icon', 'seed_count', 'ord'],
      vi.ASSET_TYPES.map((a: any, i: number) => [a[0], a[1][0], a[1][1], a[2], a[3], i]),
    ),
  )
  parts.push(
    insertRows(
      'fleet_statuses',
      ['code', 'name_vi', 'name_en'],
      Object.entries(vi.FL_ST as Record<string, [string, string, string]>).map(
        ([code, v]) => [code, v[1], v[2]],
      ),
    ),
  )
  parts.push(
    insertRows(
      'ownership_types',
      ['code', 'name_vi', 'name_en'],
      Object.entries(vi.FL_OWN as Record<string, [string, string]>).map(
        ([code, v]) => [code, v[0], v[1]],
      ),
    ),
  )

  parts.push(section('Reference — growth and consent'))
  const biText = (v: any, lang: 0 | 1): string => (Array.isArray(v) ? v[lang] : String(v))
  parts.push(
    insertRows(
      'campaigns',
      ['id', 'name_vi', 'name_en', 'target_vi', 'target_en', 'budget', 'used',
        'activated', 'repeat_rate', 'cpa', 'status_code', 'rule_vi', 'rule_en'],
      vi.CAMPAIGNS.map((c: any, i: number): SqlValue[] => [
        i + 1, biText(c.n, 0), biText(c.n, 1), biText(c.tgt, 0), biText(c.tgt, 1),
        c.bud, c.used, c.act, c.rep, c.cpa, c.st, biText(c.rule, 0), biText(c.rule, 1),
      ]),
    ),
  )
  parts.push(
    insertRows(
      'consent_purposes',
      ['id', 'purpose_vi', 'purpose_en', 'counterparty', 'data_scope_vi', 'data_scope_en',
        'legal_basis_vi', 'legal_basis_en', 'retention_months', 'revocable', 'ord'],
      vi.CONSENTS.map((c: any, i: number): SqlValue[] => {
        const months = /^\d+/.exec(String(c.ret))
        return [
          i + 1, c.p[0], c.p[1], c.who, c.d[0], c.d[1], c.basis[0], c.basis[1],
          months ? Number(months[0]) : null, Boolean(c.rev), i,
        ]
      }),
    ),
  )

  /**
   * Licence and decision-rights matrices — lifted out of `pageRLicense()`.
   * Both passes are evaluated so the bilingual columns come from the source, not a
   * transcription. Row shape: [service, responsible, platformRole, licenceFlag, modules].
   */
  parts.push(section('Reference — governance matrices'))
  const licVi = evalArrayLiteral(vi, LICENCE_MARKER, MATRIX_END)
  const licEn = evalArrayLiteral(en, LICENCE_MARKER, MATRIX_END)
  /*
   * Most rows are [L(service), L(responsible), L(role), flag, module] — 5 elements.
   * The eB/L row writes its service name as two plain literals instead of calling L(),
   * giving 6. Normalising on length keeps both shapes honest without special-casing
   * the label itself.
   */
  const licence = (r: string[], en: string[]) => {
    const wide = r.length === 6
    return {
      serviceVi: r[0],
      serviceEn: wide ? r[1] : en[0],
      responsibleVi: r[wide ? 2 : 1],
      responsibleEn: wide ? en[2] : en[1],
      roleVi: r[wide ? 3 : 2],
      roleEn: wide ? en[3] : en[2],
      flag: r[wide ? 4 : 3],
      modules: r[wide ? 5 : 4],
    }
  }
  parts.push(
    insertRows(
      'licence_matrix',
      ['id', 'service_vi', 'service_en', 'responsible_vi', 'responsible_en',
        'platform_role_vi', 'platform_role_en', 'licence_needed', 'module_codes', 'ord'],
      licVi.map((r: string[], i: number): SqlValue[] => {
        const x = licence(r, licEn[i])
        if (!['n', 'p', 'y'].includes(x.flag)) {
          throw new Error(`licence_matrix row ${i}: unexpected licence flag "${x.flag}"`)
        }
        return [
          i + 1, x.serviceVi, x.serviceEn, x.responsibleVi, x.responsibleEn,
          x.roleVi, x.roleEn, x.flag, x.modules === '—' ? null : x.modules, i,
        ]
      }),
    ),
  )

  // Row shape: [matter, platform, provider, bank, insurer, regulator].
  const decVi = evalArrayLiteral(vi, DECISION_MARKER, MATRIX_END)
  const decEn = evalArrayLiteral(en, DECISION_MARKER, MATRIX_END)
  parts.push(
    insertRows(
      'decision_rights',
      ['id', 'matter_vi', 'matter_en', 'platform', 'provider', 'bank', 'insurer', 'regulator', 'ord'],
      decVi.map((r: string[], i: number): SqlValue[] => [
        i + 1, r[0], decEn[i][0], r[1], r[2], r[3], r[4], r[5], i,
      ]),
    ),
  )

  return parts.join('\n')
}
