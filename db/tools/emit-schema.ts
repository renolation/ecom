import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Writes db/out/schema.sql — the drizzle-kit migration, wrapped in a transaction
 * and rewritten as a single importable DDL file.
 *
 * drizzle-kit emits statements separated by its own `--> statement-breakpoint`
 * marker; those markers are stripped so the file is plain psql input.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations')
const OUT_DIR = join(process.cwd(), 'db', 'out')

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    throw new Error('No migration found — run `pnpm db:generate` first.')
  }

  const body = files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
    .replace(/-->\s*statement-breakpoint/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const sql = `--
-- VLX schema — generated from db/schema/*.ts, do not edit by hand.
-- Regenerate with: pnpm db:generate && pnpm db:schema
--
-- Apply order:  schema.sql  ->  seed.sql
-- Target: PostgreSQL 17
--
SET client_encoding = 'UTF8';
BEGIN;

${body}

COMMIT;
`

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'schema.sql'), sql, 'utf8')

  const tables = (sql.match(/CREATE TABLE/g) ?? []).length
  const types = (sql.match(/CREATE TYPE/g) ?? []).length
  const indexes = (sql.match(/CREATE (?:UNIQUE )?INDEX/g) ?? []).length
  console.log(
    `schema.sql written: ${tables} tables, ${types} enum types, ${indexes} indexes, ` +
      `${(sql.length / 1024).toFixed(0)} KB (from ${files.length} migration file(s))`,
  )
}

main()
