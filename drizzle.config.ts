import type { Config } from 'drizzle-kit'

/**
 * Drizzle generates DDL only — this project never migrates a live database.
 * `pnpm db:all` turns the generated migration into db/out/schema.sql,
 * which the user imports into their own Postgres 17 instance.
 */
export default {
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/vlx',
  },
  verbose: true,
  strict: true,
} satisfies Config
