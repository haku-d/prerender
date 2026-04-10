import { FastifyPluginAsync } from 'fastify'
import path from 'path'
import { writeFile } from 'fs/promises'
import { md5 } from '../utils/hash'

const hit: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Params: { '*': string } }>('/hit/*', async function (request, reply) {
    const rawParam = request.params['*']

    // Normalise origin to SITE_URL so cache keys are consistent (www vs non-www)
    const parsed = new URL(
      rawParam.startsWith('http') ? rawParam : `${fastify.config.SITE_URL}/${rawParam}`
    )
    const relativePath = (parsed.pathname + parsed.search) || '/'
    const fullUrl = `${fastify.config.SITE_URL}${relativePath}`

    try {
      const html = await fastify.renderUrl(relativePath)
      const filePath = path.join(fastify.config.STATIC_SITE_DIR, `${md5(fullUrl)}.html`)
      await writeFile(filePath, html, 'utf-8')
      return reply.header('Content-Type', 'text/html').send(html)
    } catch (err: any) {
      fastify.log.error(`Force render failed for ${fullUrl}: ${err.message}`)
      return reply.status(410).send({ status: 410 })
    }
  })
}

export default hit
