import { FastifyPluginAsync } from 'fastify'
import fs from 'fs'
import path from 'path'
import { md5 } from '../utils/hash'

const gone: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Params: { '*': string } }>('/gone/*', async function (request, reply) {
    const rawParam = request.params['*']
    const parsed = new URL(
      rawParam.startsWith('http') ? rawParam : `${fastify.config.SITE_URL}/${rawParam}`
    )
    const fullUrl = `${fastify.config.SITE_URL}${(parsed.pathname + parsed.search) || '/'}`

    const goneDir = path.join(fastify.config.STATIC_SITE_DIR, 'gone')
    fs.mkdirSync(goneDir, { recursive: true })

    const markerPath = path.join(goneDir, `${md5(fullUrl)}.html`)
    fs.writeFileSync(markerPath, '', 'utf-8')

    fastify.log.info(`Marked as gone: ${fullUrl}`)
    return reply.send({ status: 200 })
  })

  fastify.delete<{ Params: { '*': string } }>('/gone/*', async function (request, reply) {
    const rawParam = request.params['*']
    const parsed = new URL(
      rawParam.startsWith('http') ? rawParam : `${fastify.config.SITE_URL}/${rawParam}`
    )
    const fullUrl = `${fastify.config.SITE_URL}${(parsed.pathname + parsed.search) || '/'}`

    const markerPath = path.join(fastify.config.STATIC_SITE_DIR, 'gone', `${md5(fullUrl)}.html`)

    if (!fs.existsSync(markerPath)) {
      return reply.status(404).send({ status: 404 })
    }

    fs.unlinkSync(markerPath)
    fastify.log.info(`Unmarked as gone: ${fullUrl}`)
    return reply.send({ status: 200 })
  })
}

export default gone
