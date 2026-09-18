import postgres from "postgres"

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/finsight"
const sql = postgres(databaseUrl, { max: 1 })

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1
const pad = (value) => String(value).padStart(2, "0")
const dateFrom = `${year}-${pad(month)}-01`
const dateTo = now.toISOString().slice(0, 10)
const yearMonth = `${year}-${pad(month)}`

try {
  const [homepageSummary] = await sql`
    select
      coalesce(sum(case when t.amount > 0 and c.type = 'income' then t.amount else 0 end), 0)::float8 as "totalIncome",
      coalesce(sum(case when t.amount > 0 then t.amount else 0 end), 0)::float8 as "totalMoneyIn",
      abs(coalesce(sum(case when t.amount < 0 then t.amount else 0 end), 0))::float8 as "totalExpenses",
      count(*)::int as count
    from transactions t
    left join categories c on c.id = t.category_id
    where t.booking_date >= ${dateFrom}
      and t.booking_date <= ${dateTo}
  `

  const monthlyCashFlow = await sql`
    select
      to_char(t.booking_date::date, 'YYYY-MM') as month,
      coalesce(sum(case when t.amount > 0 and c.type = 'income' then t.amount else 0 end), 0)::float8 as income,
      coalesce(sum(case when t.amount > 0 then t.amount else 0 end), 0)::float8 as "moneyIn",
      abs(coalesce(sum(case when t.amount < 0 then t.amount else 0 end), 0))::float8 as expenses,
      coalesce(sum(t.amount), 0)::float8 as net,
      count(*)::int as count
    from transactions t
    left join categories c on c.id = t.category_id
    where t.booking_date >= ${dateFrom}
      and t.booking_date <= ${dateTo}
    group by 1
    order by 1
  `

  const positiveByCategory = await sql`
    select
      coalesce(c.name, 'Uncategorised') as category,
      coalesce(c.type, 'unknown') as type,
      count(*)::int as count,
      sum(t.amount)::float8 as total
    from transactions t
    left join categories c on c.id = t.category_id
    where t.booking_date >= ${dateFrom}
      and t.booking_date <= ${dateTo}
      and t.amount > 0
    group by c.name, c.type
    order by total desc
  `

  const positiveTransactions = await sql`
    select
      booking_date as date,
      amount::float8,
      currency,
      coalesce(creditor_name, debtor_name, description, 'Unknown') as party,
      description,
      coalesce(c.name, 'Uncategorised') as category,
      coalesce(c.type, 'unknown') as category_type
    from transactions t
    left join categories c on c.id = t.category_id
    where t.booking_date >= ${dateFrom}
      and t.booking_date <= ${dateTo}
      and t.amount > 0
    order by booking_date, amount desc
  `

  const allApril = await sql`
    select
      count(*)::int as count,
      min(booking_date) as first_date,
      max(booking_date) as last_date,
      sum(case when amount > 0 then 1 else 0 end)::int as positive_count
    from transactions
    where to_char(booking_date::date, 'YYYY-MM') = ${yearMonth}
  `

  console.log(
    JSON.stringify(
      {
        dateFrom,
        dateTo,
        homepageSummary,
        monthlyCashFlow,
        positiveByCategory,
        positiveTransactions,
        monthPresence: allApril[0],
      },
      null,
      2,
    ),
  )
} finally {
  await sql.end({ timeout: 5 })
}
