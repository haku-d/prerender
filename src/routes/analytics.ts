import { FastifyPluginAsync } from 'fastify'

interface QueryFilters {
  from?: string
  to?: string
}

/** Converts a YYYY-MM-DD date string to the start of that day (UTC). */
function toStartOfDay(date: string): string {
  return `${date}T00:00:00.000Z`
}

/** Converts a YYYY-MM-DD date string to the end of that day (UTC). */
function toEndOfDay(date: string): string {
  return `${date}T23:59:59.999Z`
}

function buildWhere(filters: QueryFilters, values: unknown[]): string {
  const conditions: string[] = []
  if (filters.from) {
    values.push(toStartOfDay(filters.from))
    conditions.push(`requested_at >= $${values.length}`)
  }
  if (filters.to) {
    values.push(toEndOfDay(filters.to))
    conditions.push(`requested_at <= $${values.length}`)
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /analytics/summary
  // Returns total request count, unique page count, breakdown by bot and cache status.
  // Query params: from (ISO date), to (ISO date)
  fastify.get('/analytics/summary', async (request) => {
    const { from, to } = request.query as QueryFilters
    const values: unknown[] = []
    const where = buildWhere({ from, to }, values)

    const [totals] = await fastify.analytics.query<{ total: string; unique_pages: string }>(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT path) AS unique_pages
       FROM bot_requests ${where}`,
      values
    )

    const byBot = await fastify.analytics.query<{ bot_name: string; count: string }>(
      `SELECT bot_name, COUNT(*) AS count
       FROM bot_requests ${where}
       GROUP BY bot_name
       ORDER BY count DESC`,
      values
    )

    const byCacheStatus = await fastify.analytics.query<{ cache_status: string; count: string }>(
      `SELECT cache_status, COUNT(*) AS count
       FROM bot_requests ${where}
       GROUP BY cache_status
       ORDER BY count DESC`,
      values
    )

    return {
      total: Number(totals?.total ?? 0),
      uniquePages: Number(totals?.unique_pages ?? 0),
      byBot: byBot.map((r) => ({ botName: r.bot_name, count: Number(r.count) })),
      byCacheStatus: byCacheStatus.map((r) => ({
        cacheStatus: r.cache_status,
        count: Number(r.count),
      })),
    }
  })

  // GET /analytics/pages
  // Returns top pages by hit count.
  // Query params: from, to, limit (default 50, max 500), bot
  fastify.get('/analytics/pages', async (request) => {
    const { from, to, limit = '50', bot } = request.query as QueryFilters & {
      limit?: string
      bot?: string
    }

    const values: unknown[] = []
    const conditions: string[] = []

    if (from) { values.push(toStartOfDay(from)); conditions.push(`requested_at >= $${values.length}`) }
    if (to)   { values.push(toEndOfDay(to));     conditions.push(`requested_at <= $${values.length}`) }
    if (bot)  { values.push(bot);                conditions.push(`bot_name = $${values.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(Math.min(Math.max(1, Number(limit) || 50), 500))

    const rows = await fastify.analytics.query<{
      path: string
      count: string
      last_requested_at: string
    }>(
      `SELECT path, COUNT(*) AS count, MAX(requested_at) AS last_requested_at
       FROM bot_requests ${where}
       GROUP BY path
       ORDER BY count DESC
       LIMIT $${values.length}`,
      values
    )

    return rows.map((r) => ({
      path: r.path,
      count: Number(r.count),
      lastRequestedAt: r.last_requested_at,
    }))
  })

  // GET /analytics/bots
  // Returns request count per bot identity.
  // Query params: from, to
  fastify.get('/analytics/bots', async (request) => {
    const { from, to } = request.query as QueryFilters
    const values: unknown[] = []
    const where = buildWhere({ from, to }, values)

    const rows = await fastify.analytics.query<{
      bot_name: string
      count: string
      last_requested_at: string
    }>(
      `SELECT bot_name, COUNT(*) AS count, MAX(requested_at) AS last_requested_at
       FROM bot_requests ${where}
       GROUP BY bot_name
       ORDER BY count DESC`,
      values
    )

    return rows.map((r) => ({
      botName: r.bot_name,
      count: Number(r.count),
      lastRequestedAt: r.last_requested_at,
    }))
  })
}

export default analyticsRoutes
