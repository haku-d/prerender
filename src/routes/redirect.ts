import { FastifyPluginAsync } from 'fastify'
import fs from 'fs'
import path from 'path'
import { writeFile } from 'fs/promises'
import { md5 } from '../utils/hash'

const redirect: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Params: { '*': string } }>('/redirect/*', async function (request, reply) {
    const wildcard = request.params['*']

    // Expect wildcard to be `<url1>/<url2>` where both are absolute URLs.
    // Split by finding where the second http(s):// scheme begins.
    const match = wildcard.match(/^(https?:\/\/.+?)\/(https?:\/\/.+)$/)
    if (!match) {
      return reply.status(400).send({ error: 'Invalid format. Expected /redirect/<url1>/<url2>' })
    }
    const [, rawUrl1, url2] = match
    // Normalise url1 origin to SITE_URL so the cache key is consistent
    const parsed1 = new URL(rawUrl1)
    const url1 = `${fastify.config.SITE_URL}${(parsed1.pathname + parsed1.search) || '/'}`

    const redirectDir = path.join(fastify.config.STATIC_SITE_DIR, 'redirects')
    fs.mkdirSync(redirectDir, { recursive: true })

    const mappingPath = path.join(redirectDir, `${md5(url1)}.json`)
    await writeFile(mappingPath, JSON.stringify({ to: url2 }), 'utf-8')

    fastify.log.info(`Stored redirect: ${url1} → ${url2}`)
    return reply.send({ status: 200 })
  })
}

export default redirect
