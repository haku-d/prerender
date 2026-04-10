import { FastifyPluginAsync } from 'fastify'
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { md5 } from '../utils/hash';
import { detectBot } from '../utils/botDetect';

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/*', async function (request, reply) {
    const rawUrl = request.url;
    const userAgent = request.headers['user-agent'] ?? '';
    const botName = detectBot(userAgent);

    // Parse the incoming URL (may be '/https://...' or '/path') then normalise the
    // origin to SITE_URL so www/non-www variants share the same cache key.
    const parsed = new URL(
      rawUrl.startsWith('/http') ? rawUrl.slice(1) : `${fastify.config.SITE_URL}${rawUrl}`
    );
    const relativePath = (parsed.pathname + parsed.search) || '/';
    const fullUrl = `${fastify.config.SITE_URL}${relativePath}`;
    const filePath = path.join(fastify.config.STATIC_SITE_DIR, `${md5(fullUrl)}.html`)

    // Check if URL is marked as gone → return 410 immediately
    const gonePath = path.join(fastify.config.STATIC_SITE_DIR, 'gone', `${md5(fullUrl)}.html`)
    if (fs.existsSync(gonePath)) {
      if (botName) {
        fastify.analytics.record({
          url: fullUrl, path: parsed.pathname, botName, userAgent,
          cacheStatus: 'gone', httpStatus: 410, renderDurationMs: null,
        })
      }
      return reply.status(410).send({ status: 410 })
    }

    // Check if URL has a stored redirect mapping → return 301
    const redirectPath = path.join(fastify.config.STATIC_SITE_DIR, 'redirects', `${md5(fullUrl)}.json`)
    if (fs.existsSync(redirectPath)) {
      const { to } = JSON.parse(await readFile(redirectPath, 'utf-8')) as { to: string }
      if (botName) {
        fastify.analytics.record({
          url: fullUrl, path: parsed.pathname, botName, userAgent,
          cacheStatus: 'redirect', httpStatus: 301, renderDurationMs: null,
        })
      }
      return reply.redirect(to, 301)
    }

    const cacheStat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    const cacheExpired = cacheStat
      ? Date.now() - cacheStat.mtimeMs > fastify.config.CACHE_TTL_SECONDS * 1000
      : true;

    if (cacheExpired) {
      const missStatus = cacheStat ? 'expired' : 'miss';
      fastify.log.info(`Cache ${missStatus}: ${filePath} | url: ${fullUrl}`);
      const renderStart = Date.now();
      try {
        const html = await fastify.renderUrl(relativePath);
        const renderDurationMs = Date.now() - renderStart;
        if (botName) {
          fastify.analytics.record({
            url: fullUrl, path: parsed.pathname, botName, userAgent,
            cacheStatus: missStatus, httpStatus: 200, renderDurationMs,
          })
        }
        return reply
          .header('Content-Type', 'text/html')
          .send(html);
      } catch (err: any) {
        fastify.log.error(`Live render failed for ${fullUrl}: ${err.message}`);
        if (botName) {
          fastify.analytics.record({
            url: fullUrl, path: parsed.pathname, botName, userAgent,
            cacheStatus: missStatus, httpStatus: 410, renderDurationMs: Date.now() - renderStart,
          })
        }
        return reply.status(410).send({ status: 410 });
      }
    }

    fastify.log.info(`Return cached content at ${filePath}`)
    const html = await readFile(filePath, 'utf-8');
    if (botName) {
      fastify.analytics.record({
        url: fullUrl, path: parsed.pathname, botName, userAgent,
        cacheStatus: 'hit', httpStatus: 200, renderDurationMs: null,
      })
    }
    reply
      .header('Content-Type', 'text/html')
      .send(html);
  })
}

export default root
