import { Pool } from 'pg'

/**
 * Connectivity and content check against whatever DATABASE_URL points at.
 * Run after importing schema.sql + seed.sql into a new instance.
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set — copy .env.example to .env')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 })
  const q = async (sql: string) => (await pool.query(sql)).rows
  try {
    const [v] = await q('SELECT version()')
    console.log(String(v.version).split(',')[0])
    const [t] = await q(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`)
    console.log('tables:', t.n)
    if (t.n > 0) {
      const rows = await q(
        `SELECT relname || '=' || n_live_tup AS t FROM pg_stat_user_tables
         WHERE n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 10`,
      )
      console.log(rows.map((r) => r.t).join(' '))
    }
  } catch (e) {
    console.log('CONNECTION FAILED:', (e as Error).message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
