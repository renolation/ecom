import { execFileSync } from 'node:child_process'

/**
 * Imports db/out/*.sql into a throwaway Postgres 17 container and asserts the result.
 *
 * Row counts come from ui-2.html; a mismatch means the extraction desynchronised,
 * not that the expectation is stale — investigate before changing a number here.
 *
 * Usage: pnpm db:verify           (creates and removes the container)
 *        KEEP=1 pnpm db:verify    (leaves it running for manual inspection)
 */
const CONTAINER = 'vlx-verify'
const IMAGE = 'postgres:17-alpine'
const DB = 'vlx'

const EXPECTED_ROWS: Record<string, number> = {
  // Master
  members: 128,
  fleet_assets: 100,
  products: 139,
  // Trading
  offers: 320,
  rfqs: 106,
  bids: 671,
  rate_cards: 416,
  voyages: 104,
  // Operations
  shipments: 146,
  documents: 168,
  disputes: 94,
  // Finance
  letters_of_credit: 104,
  finance_applications: 118,
  credit_exposures: 104,
  settlements: 124,
  asset_finance_deals: 98,
  // Compliance
  aml_alerts: 112,
  abuse_flags: 36,
  agent_runs: 126,
  consent_grants: 7,
  // Market
  index_points: 240,
  index_lane_stats: 8,
  index_lane_points: 320,
  // CDP
  cdp_accounts: 128,
  cdp_merge_queue: 8,
  cdp_merge_records: 19,
  // Reference (spot checks — the ones with a fixed, known size)
  corridors: 3,
  lanes: 8,
  carriers: 6,
  ai_agents: 7,
  sandbox_programs: 8,
  personas: 6,
  product_industries: 4,
  product_groups: 12,
  commodity_types: 8,
  equipment_types: 4,
  service_modes: 3,
  shipment_statuses: 8,
  campaigns: 10,
  consent_purposes: 7,
  licence_matrix: 8,
  decision_rights: 11,
}

/** Each must return zero rows. */
const CONSISTENCY: Array<[string, string]> = [
  ['corridor_id agrees with lane on shipments', `
    SELECT count(*) FROM shipments s JOIN lanes l ON l.code = s.lane_code
    WHERE s.corridor_id <> l.corridor_id`],
  ['corridor_id agrees with lane on rfqs', `
    SELECT count(*) FROM rfqs r JOIN lanes l ON l.code = r.lane_code
    WHERE r.corridor_id <> l.corridor_id`],
  ['corridor_id agrees with lane on rate_cards', `
    SELECT count(*) FROM rate_cards rc JOIN lanes l ON l.code = rc.lane_code
    WHERE rc.corridor_id <> l.corridor_id`],
  ['bid lane matches its rfq lane', `
    SELECT count(*) FROM bids b JOIN rfqs r ON r.id = b.rfq_id
    WHERE b.lane_code <> r.lane_code`],
  ['partner products all carry a partner name', `
    SELECT count(*) FROM products WHERE (source = 'out') <> (partner_name IS NOT NULL)`],
  ['every product is anchored to exactly one of lane or site', `
    SELECT count(*) FROM products WHERE (lane_code IS NULL) = (site_vi IS NULL)`],
  ['direct offers have no transhipment port', `
    SELECT count(*) FROM offers WHERE is_direct <> (transhipment_port IS NULL)`],
  ['offer price components sum to price', `
    SELECT count(*) FROM offers WHERE base + thc + bunker + doc_fee <> price`],
  ['rate card remaining identity holds', `
    SELECT count(*) FROM rate_cards WHERE remaining <> capacity - sold`],
  ['exposures only for members with a limit', `
    SELECT count(*) FROM credit_exposures e JOIN members m ON m.id = e.member_id
    WHERE m.credit_limit_m_vnd <= 0`],
  /**
   * Catches the C1 class of bug: the two-pass extraction silently returning Vietnamese
   * in name_en. Every one of these tables has genuinely distinct vi/en text in the
   * prototype, so any row where the two match means the label was never recovered.
   */
  /*
   * Catches the C1 class of bug — the extraction silently writing Vietnamese into
   * name_en. Some individual labels are genuinely identical across languages
   * (acronyms like AIS/VGM, and 'eB/L', 'Packing list', 'C/O Form B'), so the test is
   * that each table recovered English SOMEWHERE, not that every row differs.
   * Under the C1 bug all 11 of these tables had zero distinct rows.
   */
  ['every derived lookup recovered its English labels', `
    SELECT count(*) FROM (
      SELECT 'rfq_scopes' t, count(*) FILTER (WHERE name_vi <> name_en) d FROM rfq_scopes
      UNION ALL SELECT 'dispute_issue_types', count(*) FILTER (WHERE name_vi <> name_en) FROM dispute_issue_types
      UNION ALL SELECT 'aml_alert_types',     count(*) FILTER (WHERE name_vi <> name_en) FROM aml_alert_types
      UNION ALL SELECT 'agent_actions',       count(*) FILTER (WHERE name_vi <> name_en) FROM agent_actions
      UNION ALL SELECT 'abuse_types',         count(*) FILTER (WHERE name_vi <> name_en) FROM abuse_types
      UNION ALL SELECT 'cdp_segments',        count(*) FILTER (WHERE name_vi <> name_en) FROM cdp_segments
      UNION ALL SELECT 'cdp_nba_actions',     count(*) FILTER (WHERE name_vi <> name_en) FROM cdp_nba_actions
      UNION ALL SELECT 'lc_types',            count(*) FILTER (WHERE name_vi <> name_en) FROM lc_types
      UNION ALL SELECT 'lc_steps',            count(*) FILTER (WHERE name_vi <> name_en) FROM lc_steps
      UNION ALL SELECT 'asset_finance_types', count(*) FILTER (WHERE name_vi <> name_en) FROM asset_finance_types
      UNION ALL SELECT 'evidence_sources',    count(*) FILTER (WHERE name_vi <> name_en) FROM evidence_sources
      UNION ALL SELECT 'settlement_triggers', count(*) FILTER (WHERE name_vi <> name_en) FROM settlement_triggers
      UNION ALL SELECT 'collateral_types',    count(*) FILTER (WHERE name_vi <> name_en) FROM collateral_types
      UNION ALL SELECT 'document_types',      count(*) FILTER (WHERE name_vi <> name_en) FROM document_types
    ) x WHERE d = 0`],
  /** Catches C2: lc_steps ordinals must be the prototype's canonical order. */
  ['lc_steps ordinals follow filed → settled', `
    SELECT count(*) FROM lc_steps
    WHERE (ordinal = 0 AND name_en <> 'Application filed')
       OR (ordinal = 1 AND name_en <> 'Issued by bank')
       OR (ordinal = 5 AND name_en <> 'Settled')`],
  ['document_type codes are ASCII slugs', `
    SELECT count(*) FROM document_types WHERE code !~ '^[a-z0-9-]+$'`],
]

/** Nav badge counts the sidebar renders (ui-2.html:495/512/514/525/526). */
const BADGES: Array<[string, string]> = [
  ['rfq_closing', `SELECT count(*) FROM rfqs WHERE status_code='open' AND closes_in_days <= 3`],
  ['rfq_open', `SELECT count(*) FROM rfqs WHERE status_code='open'`],
  ['fleet_attention', `SELECT count(*) FROM fleet_assets WHERE cert_days < 45 OR maint_due_days < 21`],
  ['kyb_pending', `SELECT count(*) FROM members WHERE kyb_status_code <> 'done'`],
  ['aml_high', `SELECT count(*) FROM aml_alerts WHERE severity_code='high' AND status_code IN ('open','review')`],
]

const docker = (args: string[], input?: string) =>
  execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const psql = (sql: string) =>
  docker(['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql]).trim()

function up() {
  try { docker(['rm', '-f', CONTAINER]) } catch { /* not running */ }
  docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=verify',
    '-e', `POSTGRES_DB=${DB}`, '-p', '55432:5432', IMAGE])
  for (let i = 0; i < 60; i++) {
    try {
      docker(['exec', CONTAINER, 'pg_isready', '-U', 'postgres'])
      return
    } catch {
      execFileSync('sleep', ['1'])
    }
  }
  throw new Error('Postgres container did not become ready within 60s')
}

function down() {
  if (process.env.KEEP) {
    console.log(`\nContainer ${CONTAINER} left running on localhost:55432 (KEEP=1).`)
    return
  }
  try { docker(['rm', '-f', CONTAINER]) } catch { /* already gone */ }
}

function importFile(local: string, remote: string) {
  docker(['cp', local, `${CONTAINER}:${remote}`])
  // ON_ERROR_STOP makes psql exit non-zero, which execFileSync turns into a throw.
  docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', remote])
}

function main() {
  let failures = 0
  const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`) }
  const pass = (msg: string) => console.log(`  ok    ${msg}`)

  up()
  try {
    console.log('Importing schema.sql …')
    importFile('db/out/schema.sql', '/tmp/schema.sql')
    console.log('Importing seed.sql …')
    importFile('db/out/seed.sql', '/tmp/seed.sql')

    console.log('\nRow counts')
    for (const [table, expected] of Object.entries(EXPECTED_ROWS)) {
      const actual = Number(psql(`SELECT count(*) FROM "${table}"`))
      if (actual === expected) pass(`${table} = ${actual}`)
      else fail(`${table} = ${actual}, expected ${expected}`)
    }

    console.log('\nConsistency (each must be 0)')
    for (const [label, sql] of CONSISTENCY) {
      const actual = Number(psql(sql))
      if (actual === 0) pass(label)
      else fail(`${label} → ${actual} offending row(s)`)
    }

    console.log('\nNav badge counts')
    for (const [label, sql] of BADGES) console.log(`  ${label.padEnd(16)} ${psql(sql)}`)

    console.log('\nProduct split')
    console.log(psql(`SELECT source || ': ' || count(*) FROM products GROUP BY source ORDER BY source`))
  } finally {
    down()
  }

  console.log(failures === 0 ? '\nPASS — all checks green' : `\nFAIL — ${failures} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
