import { test } from 'node:test'
import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { build } from '../helper'
import { md5 } from '../../src/utils/hash'

test('hit: force render succeeds → 200 with html and writes cache file', async (t) => {
  const app = await build(t)

  ;(app as any).renderUrl = async (_url: string) => '<html><body>hit-rendered</body></html>'

  const staticDir = app.config.STATIC_SITE_DIR
  const fullUrl = `${app.config.SITE_URL}/some-page`
  const cachedFile = path.join(staticDir, `${md5(fullUrl)}.html`)
  t.after(() => fs.rmSync(cachedFile, { force: true }))

  const res = await app.inject({ url: '/hit/some-page' })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'text/html')
  assert.ok(res.payload.includes('hit-rendered'))
  assert.ok(fs.existsSync(cachedFile), 'cache file should be written after hit')
})

test('hit: force render fails → 410', async (t) => {
  const app = await build(t)

  ;(app as any).renderUrl = async (_url: string) => {
    throw new Error('browser unavailable')
  }

  const res = await app.inject({ url: '/hit/broken-page' })
  assert.strictEqual(res.statusCode, 410)
  assert.deepStrictEqual(JSON.parse(res.payload), { status: 410 })
})
