import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { Pool, QueryResultRow } from 'pg'

export interface AnalyticsEvent {
  url: string
  path: string
  botName: string
  userAgent: string
  cacheStatus: 'hit' | 'miss' | 'expired' | 'gone' | 'redirect'
  httpStatus: number
  renderDurationMs: number | null
}

declare module 'fastify' {
  interface FastifyInstance {
    analytics: {
      record(event: AnalyticsEvent): void
      query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]>
    }
  }
}

const analyticsPlugin: FastifyPluginAsync = async (fastify) => {
  if (!fastify.config.DATABASE_URL) {
    fastify.log.warn('DATABASE_URL not set — analytics recording disabled')
    fastify.decorate('analytics', {
      record: (_event: AnalyticsEvent) => {},
      query: async <T extends QueryResultRow = QueryResultRow>(_sql: string, _values?: unknown[]): Promise<T[]> => [],
    })
    return
  }

  const pool = new Pool({ connectionString: fastify.config.DATABASE_URL })

  fastify.addHook('onClose', async () => {
    await pool.end()
  })

  fastify.decorate('analytics', {
    record(event: AnalyticsEvent): void {
      pool
        .query(
          `INSERT INTO bot_requests
             (url, path, bot_name, user_agent, cache_status, http_status, render_duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.url,
            event.path,
            event.botName,
            event.userAgent,
            event.cacheStatus,
            event.httpStatus,
            event.renderDurationMs,
          ]
        )
        .catch((err: Error) => fastify.log.error({ err }, 'analytics.record failed'))
    },

    async query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]> {
      const result = await pool.query<T>(sql, values as any[])
      return result.rows
    },
  })
}

export default fp(analyticsPlugin)
