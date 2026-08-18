/** Minimal SQL literal/statement writer for producing an importable .sql file. */

export type SqlValue = string | number | boolean | null | Date | object

/** Postgres string literal with standard-conforming single-quote doubling. */
export function lit(v: SqlValue): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number cannot be written to SQL: ${v}`)
    return String(v)
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return `'${v.toISOString().slice(0, 10)}'`
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

/**
 * Multi-row INSERT, chunked so no single statement grows unwieldy for psql.
 * Column order is fixed by `columns`; every row must supply the same arity.
 */
export function insertRows(
  table: string,
  columns: string[],
  rows: SqlValue[][],
  chunkSize = 500,
): string {
  if (rows.length === 0) return `-- ${table}: no rows\n`
  const cols = columns.map((c) => `"${c}"`).join(', ')
  const out: string[] = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values = chunk
      .map((r) => {
        if (r.length !== columns.length) {
          throw new Error(
            `${table}: row has ${r.length} values but ${columns.length} columns declared`,
          )
        }
        return `  (${r.map(lit).join(', ')})`
      })
      .join(',\n')
    out.push(`INSERT INTO "${table}" (${cols}) VALUES\n${values};`)
  }
  return `-- ${table}: ${rows.length} rows\n${out.join('\n')}\n`
}

export function section(title: string): string {
  return `\n-- ${'='.repeat(72)}\n-- ${title}\n-- ${'='.repeat(72)}\n`
}

/**
 * Identity columns are GENERATED ALWAYS, so explicit ids need an OVERRIDING clause.
 * Used where the prototype's ordering must be preserved across tables that join by id.
 */
export function insertRowsOverriding(
  table: string,
  columns: string[],
  rows: SqlValue[][],
  chunkSize = 500,
): string {
  return insertRows(table, columns, rows, chunkSize).replace(
    /VALUES\n/g,
    'OVERRIDING SYSTEM VALUE VALUES\n',
  )
}
