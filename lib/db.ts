import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

/**
 * Single pooled connection, reused across hot reloads in development so `next dev`
 * does not exhaust Postgres connections on every file change.
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
    global.__vlxPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
  }
  return global.__vlxPool
}

export const db = drizzle(pool(), { schema })
export { schema }
