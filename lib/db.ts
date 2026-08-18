import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

/**
 * Pooled connection, reused across hot reloads in development so `next dev` does not
 * open a fresh pool on every file change.
 *
 * The pool is deliberately small and quick to release. This app shares a Postgres
 * instance with several other DBiz services, and that server runs close to its
 * `max_connections` ceiling — holding idle connections here would take slots from
 * everyone else and eventually fail with `53300: too many clients already`.
 *
 * Every page issues ~13 queries via Promise.all; with a small pool they queue rather
 * than each grabbing a socket, which costs a few milliseconds and no correctness.
 */
declare global {
  // eslint-disable-next-line no-var
  var __vlxPool: Pool | undefined
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env, then import ' +
        'db/out/schema.sql and db/out/seed.sql into that database.',
    )
  }
  if (!global.__vlxPool) {
    global.__vlxPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      // Hand connections back quickly instead of parking them.
      idleTimeoutMillis: 10_000,
      // Fail fast and legibly when the server has no slots left.
      connectionTimeoutMillis: 5_000,
      // Makes this app identifiable in pg_stat_activity when the server fills up.
      application_name: 'vlx-app',
    })

    // A pool-level error would otherwise crash the process on an idle client drop.
    global.__vlxPool.on('error', (err) => {
      console.error('[db] idle client error:', err.message)
    })
  }
  return global.__vlxPool
}

export const db = drizzle(pool(), { schema })
export { schema }
