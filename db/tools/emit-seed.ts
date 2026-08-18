import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBilingual } from './prototype-data'
import { buildCatalog } from './seed-catalog'
import { buildEntities } from './seed-entities'
import { buildFinanceCompliance } from './seed-finance-compliance'
import { buildReference } from './seed-reference'

/**
 * Writes db/out/seed.sql — every row of ui-2.html's dataset as portable INSERTs.
 * Run after db/out/schema.sql has been applied.
 */
const OUT_DIR = join(process.cwd(), 'db', 'out')

function main() {
  const started = Date.now()
  const bi = loadBilingual()

  const reference = buildReference(bi)
  const catalog = buildCatalog(bi)
  const entities = buildEntities({ vi: bi.vi, lookups: reference.lookups })
  const financeCompliance = buildFinanceCompliance({ vi: bi.vi, lookups: reference.lookups })

  const header = `--
-- VLX seed data — generated from ui-2.html, do not edit by hand.
-- Regenerate with: pnpm db:seed
--
-- Apply order:  schema.sql  ->  seed.sql
-- Inserts are ordered so every foreign key resolves without deferred constraints.
SET client_encoding = 'UTF8';
BEGIN;
`

  /**
   * nav_groups and cdp_merge_queue are GENERATED ALWAYS AS IDENTITY and were inserted
   * with explicit ids via OVERRIDING SYSTEM VALUE, which does not advance the sequence.
   * Without this the first application insert into either table fails on a duplicate PK.
   */
  const footer = `
SELECT setval(pg_get_serial_sequence('nav_groups', 'id'),      COALESCE(MAX(id), 1)) FROM nav_groups;
SELECT setval(pg_get_serial_sequence('cdp_merge_queue', 'id'), COALESCE(MAX(id), 1)) FROM cdp_merge_queue;

COMMIT;
`

  mkdirSync(OUT_DIR, { recursive: true })
  const sql = [header, reference.sql, catalog, entities, financeCompliance, footer].join('\n')
  const path = join(OUT_DIR, 'seed.sql')
  writeFileSync(path, sql, 'utf8')

  const statements = (sql.match(/^INSERT INTO/gm) ?? []).length
  console.log(
    `seed.sql written: ${(sql.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${statements} INSERT statements, ${Date.now() - started} ms`,
  )
}

main()
