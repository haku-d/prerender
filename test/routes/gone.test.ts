import { test } from 'node:test'
import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { build } from '../helper'
import { md5 } from '../../src/utils/hash'

test('gone GET: marks url as gone → creates marker file, returns 200', async (t) => {
  const app = await build(t)

  const staticDir = app.config.STATIC_SITE_DIR
  const fullUrl = `${app.config.SITE_URL}/to-be-gone`
  const markerPath = path.join(staticDir, 'gone', `${md5(fullUrl)}.html`)
  t.after(() => fs.rmSync(markerPath, { force: true }))

  const res = await app.inject({ method: 'GET', url: '/gone/to-be-gone' })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(fs.existsSync(markerPath), 'gone marker file should be created')
})

test('gone DELETE: unmarks url → removes marker file, returns 200', async (t) => {
  const app = await build(t)

  const staticDir = app.config.STATIC_SITE_DIR
  const fullUrl = `${app.config.SITE_URL}/to-be-ungone`
  const goneDir = path.join(staticDir, 'gone')
  const markerPath = path.join(goneDir, `${md5(fullUrl)}.html`)

  // Pre-create the marker so DELETE has something to remove
  fs.mkdirSync(goneDir, { recursive: true })
  fs.writeFileSync(markerPath, '', 'utf-8')
  t.after(() => fs.rmSync(markerPath, { force: true }))

  const res = await app.inject({ method: 'DELETE', url: '/gone/to-be-ungone' })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(!fs.existsSync(markerPath), 'gone marker file should be removed')
})

test('gone DELETE: non-existent url → 404', async (t) => {
  const app = await build(t)

  const res = await app.inject({ method: 'DELETE', url: '/gone/does-not-exist-xyz' })
  assert.strictEqual(res.statusCode, 404)
  assert.deepStrictEqual(JSON.parse(res.payload), { status: 404 })
})
