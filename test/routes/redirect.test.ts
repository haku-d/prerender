import { test } from 'node:test'
import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { build } from '../helper'
import { md5 } from '../../src/utils/hash'

test('redirect GET: stores mapping json and returns 200', async (t) => {
  const app = await build(t)

  const staticDir = app.config.STATIC_SITE_DIR

  const url1 = `${app.config.SITE_URL}/old-page`
  const url2 = `${app.config.SITE_URL}/new-page`
  const mappingPath = path.join(staticDir, 'redirects', `${md5(url1)}.json`)
  t.after(() => fs.rmSync(mappingPath, { force: true }))

  const res = await app.inject({ url: `/redirect/${url1}/${url2}` })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(fs.existsSync(mappingPath), 'redirect mapping file should be created')

  const stored = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))
  assert.strictEqual(stored.to, url2)
})

test('redirect GET: invalid format (no second url) → 400', async (t) => {
  const app = await build(t)

  const res = await app.inject({ url: '/redirect/not-a-url' })
  assert.strictEqual(res.statusCode, 400)
  assert.ok(JSON.parse(res.payload).error)
})
