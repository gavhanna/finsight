import postgres from "postgres"

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ??
  "postgres://postgres:postgres@192.168.1.3:5432/finsight"
const targetUrl =
  process.env.TARGET_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/finsight"

const source = postgres(sourceUrl, { max: 1 })
const target = postgres(targetUrl, { max: 1 })

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`
const qualified = (schema, name) => `${quoteIdent(schema)}.${quoteIdent(name)}`

async function getTables() {
  return source`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `.then((rows) => rows.map((row) => row.table_name))
}

async function getColumns(table) {
  return source`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
    order by ordinal_position
  `.then((rows) => rows.map((row) => row.column_name))
}

async function copyRows(sql, table, rows, columns) {
  const batchSize = 500
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const params = []
    const values = batch
      .map((row) => {
        const placeholders = columns.map((column) => {
          params.push(row[column])
          return `$${params.length}`
        })
        return `(${placeholders.join(", ")})`
      })
      .join(", ")

    await sql.unsafe(
      `insert into ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) values ${values}`,
      params,
    )
  }
}

async function syncSequences() {
  const sequences = await source`
    select sequence_schema, sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
    order by sequence_name
  `

  for (const sequence of sequences) {
    const [{ last_value: lastValue, is_called: isCalled }] = await source.unsafe(
      `select last_value, is_called from ${qualified(sequence.sequence_schema, sequence.sequence_name)}`,
    )
    await target`select setval(${`${sequence.sequence_schema}.${sequence.sequence_name}`}, ${lastValue}, ${isCalled})`
  }
}

try {
  const tables = await getTables()

  await target.begin(async (sql) => {
    await sql.unsafe("set session_replication_role = replica")
    await sql.unsafe(`truncate table ${tables.map(quoteIdent).join(", ")} restart identity cascade`)

    for (const table of tables) {
      const rows = await source.unsafe(`select * from ${quoteIdent(table)}`)
      const columns = rows.length > 0 ? Object.keys(rows[0]) : await getColumns(table)
      await copyRows(sql, table, rows, columns)
      console.log(`${table}: ${rows.length}`)
    }

    await sql.unsafe("set session_replication_role = origin")
  })

  await syncSequences()

  const [sourceCount] = await source`select count(*)::int as count from transactions`
  const [targetCount] = await target`select count(*)::int as count from transactions`
  console.log(
    JSON.stringify(
      {
        copiedTables: tables.length,
        sourceTransactions: sourceCount.count,
        targetTransactions: targetCount.count,
      },
      null,
      2,
    ),
  )
} finally {
  await source.end({ timeout: 5 })
  await target.end({ timeout: 5 })
}
