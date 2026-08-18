import type { SqlValue } from './sql-writer'
import { insertRows, insertRowsOverriding, section } from './sql-writer'

type Ctx = Record<string, any>
type Bi = { vi: Ctx; en: Ctx }

/**
 * Reference rows are built from the prototype's own arrays. Where a lookup lives
 * inside a generator IIFE and is not exported, its distinct values are recovered
 * from the generated rows instead — the 'vi' and 'en' passes produce identical
 * row order, so labels pair by index.
 *
 * `weight` is populated only where the source exposes it. The seed never consumes
 * these weights (rows come from the prototype itself), so they are documentation.
 */

export type Lookup = Map<string, number>

export interface LabelTuple {
  vi: string
  en: string
  weight: number
}

/**
 * Recovers a label pair from a collection.
 *
 * Two shapes exist in the prototype and they need different handling:
 *
 *  - **Tuple on the row** — `pick(scopes)` / `pickw(types)` store the whole
 *    `[vi, en, weight?]` literal (e.g. ui-2.html:794, 868, 2025). Both languages are
 *    already present, so read `[0]` and `[1]` from the SAME pass. Running the 'en'
 *    pass and reading `[0]` again returns Vietnamese — that was the C1 bug.
 *  - **Resolved at generation time** — `L(vi,en)` collapses to one string before it
 *    reaches the row (e.g. `settlements.trig`, `disputes.src`, `assets.coll`). Only
 *    those genuinely need the second pass; use `distinctResolved` for them.
 */
function distinctTuples(
  vi: Ctx,
  collection: string,
  read: (row: any) => any[] | undefined,
): LabelTuple[] {
  const seen = new Set<string>()
  const out: LabelTuple[] = []
  for (const row of vi[collection]) {
    const tuple = read(row)
    if (!tuple) continue
    const [labelVi, labelEn, third] = tuple
    if (typeof labelVi !== 'string' || seen.has(labelVi)) continue
    seen.add(labelVi)
    out.push({
      vi: labelVi,
      en: typeof labelEn === 'string' ? labelEn : labelVi,
      weight: typeof third === 'number' ? third : 0,
    })
  }
  return out
}

/** For fields where `L()` already collapsed the pair — needs both language passes. */
function distinctResolved(bi: Bi, collection: string, read: (row: any) => string): LabelTuple[] {
  const rowsVi = bi.vi[collection]
  const rowsEn = bi.en[collection]
  if (rowsVi.length !== rowsEn.length) {
    throw new Error(
      `${collection}: vi pass has ${rowsVi.length} rows, en pass has ${rowsEn.length} — ` +
        'the two passes desynchronised and labels cannot be paired by index.',
    )
  }
  const seen = new Set<string>()
  const out: LabelTuple[] = []
  for (let i = 0; i < rowsVi.length; i++) {
    // Guard the pairing invariant the whole bilingual design rests on.
    const keyVi = rowsVi[i]?.id
    const keyEn = rowsEn[i]?.id
    if (keyVi !== undefined && keyVi !== keyEn) {
      throw new Error(`${collection}[${i}]: row identity differs across passes (${keyVi} vs ${keyEn}).`)
    }
    const v = read(rowsVi[i])
    if (typeof v !== 'string' || seen.has(v)) continue
    seen.add(v)
    out.push({ vi: v, en: read(rowsEn[i]), weight: 0 })
  }
  return out
}

function lookupTable(table: string, pairs: LabelTuple[]): { sql: string; index: Lookup } {
  const index: Lookup = new Map()
  const rows: SqlValue[][] = pairs.map((p, i) => {
    index.set(p.vi, i + 1)
    return [i + 1, p.vi, p.en, p.weight]
  })
  return {
    sql: insertRows(table, ['id', 'name_vi', 'name_en', 'weight'], rows),
    index,
  }
}

/** Stable ASCII code from an English label, for lookups keyed by code. */
function slug(en: string): string {
  return en
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export interface ReferenceResult {
  sql: string
  lookups: Record<string, Lookup>
  /** ISO port code by prototype port display name, for lane/offer resolution. */
  portCodeByName: Map<string, string>
}

export function buildReference(bi: Bi): ReferenceResult {
  const { vi, en } = bi
  const parts: string[] = []
  const lookups: Record<string, Lookup> = {}

  // ---- status_labels (ST_TAGS carries both languages already) -------------
  parts.push(section('Reference — status dictionary'))

  /**
   * Voyage and asset-finance statuses are used by the data but absent from ST_TAGS.
   * `stTag()` falls back to rendering the raw code for those, so the prototype has
   * no bilingual label to copy — the code is stored as its own label, matching the UI.
   */
  const untitled: Array<[string, string]> = [
    ['draft', 'n'], ['quoted', 'b'], ['won', 'u'], ['lost', 'd'],
    ['pipeline', 'b'], ['diligence', 'gd'], ['declined', 'd'],
  ]
  const statusRows: SqlValue[][] = Object.entries(
    vi.ST_TAGS as Record<string, [string, string, string]>,
  ).map(([code, [tone, nameVi, nameEn]]) => [code, tone, nameVi, nameEn])
  for (const [code, tone] of untitled) {
    if (!(code in vi.ST_TAGS)) statusRows.push([code, tone, code, code])
  }
  parts.push(insertRows('status_labels', ['code', 'tone', 'name_vi', 'name_en'], statusRows))

  /**
   * Product listing states live in their own table: PR_ST reuses the code `live`
   * with a different meaning ("Đang niêm yết") than ST_TAGS ("Đang mở").
   */
  parts.push(
    insertRows(
      'product_statuses',
      ['code', 'tone', 'name_vi', 'name_en'],
      Object.entries(vi.PR_ST as Record<string, [string, string, string]>).map(
        ([code, [tone, nameVi, nameEn]]) => [code, tone, nameVi, nameEn],
      ),
    ),
  )

  // ---- personas + navigation ---------------------------------------------
  parts.push(section('Reference — personas and navigation'))
  const personaCodes = Object.keys(vi.PERSONAS)
  parts.push(
    insertRows(
      'personas',
      ['code', 'icon', 'name_vi', 'name_en', 'org_vi', 'org_en', 'initials', 'home_route', 'ord'],
      personaCodes.map((code, i) => [
        code,
        vi.PERSONAS[code].ic,
        vi.PERSONAS[code].name(),
        en.PERSONAS[code].name(),
        vi.PERSONAS[code].org(),
        en.PERSONAS[code].org(),
        vi.PERSONAS[code].who,
        vi.HOMEOF[code] ?? vi.NAV[code][0].items[0].r,
        i,
      ]),
    ),
  )

  // Module codes are referenced by nav items and the licence matrix; the prototype
  // never gives them a title, so names stay NULL rather than being invented.
  const moduleCodes = new Set<string>()
  for (const code of personaCodes) {
    for (const grp of vi.NAV[code]) {
      for (const item of grp.items) if (item.m) for (const m of String(item.m).split(' · ')) moduleCodes.add(m)
    }
  }
  for (const sb of vi.SANDBOX) if (sb.mod && sb.mod !== '—') moduleCodes.add(sb.mod)
  parts.push(
    insertRows(
      'modules',
      ['code', 'name_vi', 'name_en'],
      [...moduleCodes].sort().map((c) => [c, null, null]),
    ),
  )

  // Badge keys name the count query the sidebar runs (5 badges in ui-2.html).
  const badgeKeyByRoute: Record<string, string> = {
    s_rfq: 'rfq_closing',
    c_bids: 'rfq_open',
    c_fleet: 'fleet_attention',
    x_mem: 'kyb_pending',
    x_aml: 'aml_high',
  }
  const groupRows: SqlValue[][] = []
  const itemRows: SqlValue[][] = []
  let groupId = 0
  for (const code of personaCodes) {
    const groupsVi = vi.NAV[code]
    const groupsEn = en.NAV[code]
    for (let g = 0; g < groupsVi.length; g++) {
      groupId += 1
      groupRows.push([groupId, code, g, groupsVi[g].g(), groupsEn[g].g()])
      for (let i = 0; i < groupsVi[g].items.length; i++) {
        const it = groupsVi[g].items[i]
        const itEn = groupsEn[g].items[i]
        itemRows.push([
          groupId, i, it.r, it.i, it.t(), itEn.t(),
          it.m ? String(it.m).split(' · ')[0] : null,
          Boolean(it.ai), Boolean(it.nw),
          badgeKeyByRoute[it.r] ?? null,
        ])
      }
    }
  }
  parts.push(
    insertRowsOverriding(
      'nav_groups',
      ['id', 'persona_code', 'ord', 'name_vi', 'name_en'],
      groupRows,
    ),
  )
  parts.push(
    insertRows(
      'nav_items',
      ['group_id', 'ord', 'route', 'icon', 'label_vi', 'label_en', 'module_code', 'is_ai', 'is_new', 'badge_key'],
      itemRows,
    ),
  )

  // ---- sandbox, corridors, ports, lanes, carriers, agents ----------------
  parts.push(section('Reference — programme, geography and supply'))
  parts.push(
    insertRows(
      'sandbox_programs',
      ['code', 'name_vi', 'name_en', 'participants_vi', 'participants_en', 'features_vi',
        'features_en', 'controls_vi', 'controls_en', 'status_code', 'used', 'cap', 'module_code', 'ord'],
      vi.SANDBOX.map((s: any, i: number) => [
        s.id, s.n(), en.SANDBOX[i].n(), s.p(), en.SANDBOX[i].p(), s.f(), en.SANDBOX[i].f(),
        s.c(), en.SANDBOX[i].c(), s.st, s.used, s.cap,
        s.mod && s.mod !== '—' ? s.mod : null, i,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'corridors',
      ['id', 'name_vi', 'name_en', 'route', 'use_case_vi', 'use_case_en', 'status_code',
        'suppliers', 'shippers', 'teu', 'gmv_m_vnd', 'quality', 'time_to_quote', 'repeat_rate', 'pl'],
      vi.CORRIDORS.map((c: any, i: number) => [
        c.id, c.n(), en.CORRIDORS[i].n(), c.r, c.uc(), en.CORRIDORS[i].uc(), c.st,
        c.sup, c.ship, c.teu,
        // Corridor GMV renders in tỷ đ; normalised to million VND like every other money column.
        c.gmv * 1000,
        c.q, c.ttq, c.rep, c.pl,
      ]),
    ),
  )

  const portCodeByName = new Map<string, string>()
  const portRows: SqlValue[][] = []
  const addPort = (code: string, name: string, country: string, tranship = false) => {
    if (portCodeByName.has(name)) return
    portCodeByName.set(name, code)
    portRows.push([code, name, country, tranship])
  }
  for (const l of vi.LANES) {
    addPort(l.oc, l.o, l.oc.slice(0, 2))
    addPort(l.dc, l.d, l.dc.slice(0, 2))
  }
  // TSPORTS are transhipment hubs used by indirect offers; several are not lane endpoints.
  const tsCountry: Record<string, string> = {
    Singapore: 'SG', 'Port Klang': 'MY', 'Hong Kong': 'HK',
    Kaohsiung: 'TW', Busan: 'KR', Colombo: 'LK',
  }
  for (const name of vi.TSPORTS as string[]) {
    if (portCodeByName.has(name)) {
      const code = portCodeByName.get(name)!
      const row = portRows.find((r) => r[0] === code)
      if (row) row[3] = true
    } else {
      addPort(`TS-${name.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`, name, tsCountry[name] ?? 'XX', true)
    }
  }
  parts.push(insertRows('ports', ['code', 'name', 'country_code', 'is_transhipment'], portRows))

  parts.push(
    insertRows(
      'lanes',
      ['code', 'origin_port_code', 'dest_port_code', 'index_price', 'change_pct',
        'volume_teu', 'transit_days', 'corridor_id', 'ord'],
      vi.LANES.map((l: any, i: number) => [l.c, l.oc, l.dc, l.px, l.ch, l.vol, l.tt, l.cor ?? 1, i]),
    ),
  )
  parts.push(
    insertRows(
      'carriers',
      ['code', 'name', 'color', 'reliability', 'co2_grade', 'ord'],
      vi.CARRIERS.map((c: any, i: number) => [c.s, c.n, c.c, c.rel, c.co2, i]),
    ),
  )
  parts.push(
    insertRows(
      'ai_agents',
      ['id', 'icon', 'name_vi', 'name_en', 'task_vi', 'task_en', 'control_vi', 'control_en',
        'tier', 'runs', 'accuracy', 'override_rate'],
      vi.AGENTS.map((a: any, i: number) => [
        i + 1, a.ic, a.n(), en.AGENTS[i].n(), a.task(), en.AGENTS[i].task(),
        a.ctrl(), en.AGENTS[i].ctrl(), a.tier, a.runs, a.acc, a.ovr,
      ]),
    ),
  )

  // ---- classification lookups -------------------------------------------
  parts.push(section('Reference — classifications'))
  parts.push(
    insertRows(
      'member_types',
      ['code', 'name_vi', 'name_en', 'share_pct', 'ord'],
      vi.MTYPES.map((m: any, i: number) => [m[0], m[1](), en.MTYPES[i][1](), m[2], i]),
    ),
  )
  const sectorIndex: Lookup = new Map()
  parts.push(
    insertRows(
      'sectors',
      ['id', 'name_vi', 'name_en'],
      vi.SECTORS.map((s: string[], i: number) => {
        sectorIndex.set(s[0], i + 1)
        return [i + 1, s[0], s[1]]
      }),
    ),
  )
  lookups.sectors = sectorIndex

  parts.push(
    insertRows(
      'shipment_statuses',
      ['ordinal', 'name_vi', 'name_en'],
      vi.STNAMES.map((s: string[], i: number) => [i, s[0], s[1]]),
    ),
  )
  parts.push(
    insertRows(
      'equipment_types',
      ['code', 'ord', 'teu_factor', 'capacity_factor', 'weight'],
      vi.EQF.map((e: any[], i: number) => {
        const rc = vi.RC_EQ.find((r: any[]) => r[0] === e[0])
        return [e[0], i, e[1], rc ? rc[2] : 1, [50, 26, 16, 8][i] ?? 0]
      }),
    ),
  )
  parts.push(
    insertRows(
      'service_modes',
      ['code', 'weight'],
      [['CY/CY', 54], ['CY/Door', 30], ['Door/Door', 16]],
    ),
  )
  parts.push(
    insertRows(
      'commodity_types',
      ['code', 'name_vi', 'name_en', 'ord'],
      vi.COMMOD.map((c: any, i: number) => [c[0], c[1][0], c[1][1], i]),
    ),
  )
  // DOCS types are `[vi, en, weight]`; the code is slugged from English so the FK on
  // `documents` is a stable ASCII key rather than a Vietnamese display string.
  const docTypes = distinctTuples(vi, 'DOCS', (d) => d.ty)
  const docTypeCodeByVi = new Map(docTypes.map((p) => [p.vi, slug(p.en)]))
  parts.push(
    insertRows(
      'document_types',
      ['code', 'name_vi', 'name_en', 'weight', 'is_ebl'],
      docTypes.map((p) => [slug(p.en), p.vi, p.en, p.weight, p.vi === 'eB/L' ? 1 : 0]),
    ),
  )
  lookups.__document_type_codes = docTypeCodeByVi as unknown as Lookup
  parts.push(
    insertRows(
      'finance_products',
      ['code', 'name_vi', 'name_en', 'module_code', 'weight'],
      vi.FINPROD.map((f: any[]) => [f[0], f[0], f[1], f[2], f[3]]),
    ),
  )
  /**
   * lc_steps ordinals must be the prototype's canonical index, not first-seen order:
   * `letters_of_credit.step_ordinal` stores `l.st`, which indexes the `steps` array at
   * ui-2.html:2027. Deriving ordinals from encounter order mislabelled every L/C.
   */
  const stepByOrdinal = new Map<number, [string, string]>()
  for (const lc of vi.LCS) stepByOrdinal.set(lc.st, lc.step)
  const stepOrdinals = [...stepByOrdinal.keys()].sort((a, b) => a - b)
  if (stepOrdinals.some((o, i) => o !== i)) {
    throw new Error(`lc_steps: expected contiguous ordinals from 0, got ${stepOrdinals.join(',')}`)
  }
  parts.push(
    insertRows(
      'lc_steps',
      ['ordinal', 'name_vi', 'name_en'],
      stepOrdinals.map((o) => {
        const [nameVi, nameEn] = stepByOrdinal.get(o)!
        return [o, nameVi, nameEn]
      }),
    ),
  )

  // Lookups whose source arrays are IIFE-local, recovered from the generated rows.
  // These carry the whole [vi, en, weight] tuple, so one pass has both languages.
  const tupleDerived: Array<[table: string, collection: string, read: (r: any) => any[]]> = [
    ['rfq_scopes', 'RFQS', (r) => r.scope],
    ['dispute_issue_types', 'DISPUTES', (r) => r.iss],
    ['aml_alert_types', 'AMLALERTS', (r) => r.ty],
    ['agent_actions', 'AGENTRUNS', (r) => r.act],
    ['abuse_types', 'ABUSE', (r) => r.ty],
    ['cdp_segments', 'CDPACC', (r) => r.seg],
    ['cdp_nba_actions', 'CDPACC', (r) => r.nba],
    ['lc_types', 'LCS', (r) => r.ty],
  ]
  for (const [table, collection, read] of tupleDerived) {
    const { sql, index } = lookupTable(table, distinctTuples(vi, collection, read))
    parts.push(sql)
    lookups[table] = index
  }

  // These three are collapsed by L() before reaching the row, so they need both passes.
  const resolvedDerived: Array<[string, string, (r: any) => string]> = [
    ['evidence_sources', 'DISPUTES', (r) => r.src],
    ['settlement_triggers', 'SETTLES', (r) => r.trig],
    ['collateral_types', 'ASSETS', (r) => r.coll],
  ]
  for (const [table, collection, read] of resolvedDerived) {
    const { sql, index } = lookupTable(table, distinctResolved(bi, collection, read))
    parts.push(sql)
    lookups[table] = index
  }

  // asset_finance_types is [vi, en, structure, weight] — structure sits where weight
  // usually does, so it is built directly rather than through lookupTable().
  const afIndex: Lookup = new Map()
  const afSeen = new Set<string>()
  const afRows: SqlValue[][] = []
  for (const a of vi.ASSETS) {
    const [nameVi, nameEn, structure, weight] = a.ty
    if (afSeen.has(nameVi)) continue
    afSeen.add(nameVi)
    const id = afRows.length + 1
    afIndex.set(nameVi, id)
    afRows.push([id, nameVi, nameEn, structure, weight])
  }
  parts.push(
    insertRows('asset_finance_types', ['id', 'name_vi', 'name_en', 'structure', 'weight'], afRows),
  )
  lookups.asset_finance_types = afIndex

  return { sql: parts.join('\n'), lookups, portCodeByName }
}
