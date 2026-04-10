import { test } from 'node:test'
import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { build } from '../helper'
import { md5 } from '../../src/utils/hash'

test('cache miss: live render succeeds → 200 with html', async (t) => {
  const app = await build(t)

  // Stub renderUrl to return synthetic HTML (no browser needed in tests)
  ;(app as any).renderUrl = async (_url: string) => '<html><body>rendered</body></html>'

  const res = await app.inject({ url: '/some-page' })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'text/html')
  assert.ok(res.payload.includes('rendered'))
})

test('cache miss: live render fails → 410', async (t) => {
  const app = await build(t)

  ;(app as any).renderUrl = async (_url: string) => {
    throw new Error('browser unavailable')
  }

  const res = await app.inject({ url: '/missing-page' })
  assert.strictEqual(res.statusCode, 410)
  assert.deepStrictEqual(JSON.parse(res.payload), { status: 410 })
})

test('cache hit: serves file without calling renderUrl', async (t) => {
  const app = await build(t)

  let renderCalled = false
  ;(app as any).renderUrl = async (_url: string) => {
    renderCalled = true
    return ''
  }

  // Write a fake cached file that the route will find
  const staticDir = app.config.STATIC_SITE_DIR
  const fullUrl = `${app.config.SITE_URL}/cached-page`
  const cachedFile = path.join(staticDir, `${md5(fullUrl)}.html`)
  fs.mkdirSync(staticDir, { recursive: true })
  fs.writeFileSync(cachedFile, '<html>cached</html>', 'utf-8')
  t.after(() => fs.rmSync(cachedFile, { force: true }))

  const res = await app.inject({ url: '/cached-page' })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.payload.includes('cached'))
  assert.strictEqual(renderCalled, false)
})

test('gone url: root route returns 410 without rendering', async (t) => {
  const app = await build(t)

  let renderCalled = false
  ;(app as any).renderUrl = async (_url: string) => {
    renderCalled = true
    return ''
  }

  const staticDir = app.config.STATIC_SITE_DIR
  const fullUrl = `${app.config.SITE_URL}/gone-page`
  const goneDir = path.join(staticDir, 'gone')
  const markerPath = path.join(goneDir, `${md5(fullUrl)}.html`)
  fs.mkdirSync(goneDir, { recursive: true })
  fs.writeFileSync(markerPath, '', 'utf-8')
  t.after(() => fs.rmSync(markerPath, { force: true }))

  const res = await app.inject({ url: '/gone-page' })
  assert.strictEqual(res.statusCode, 410)
  assert.deepStrictEqual(JSON.parse(res.payload), { status: 410 })
  assert.strictEqual(renderCalled, false)
})

test('redirect url: root route returns 301 with Location header', async (t) => {
  const app = await build(t)

  ;(app as any).renderUrl = async (_url: string) => ''

  const staticDir = app.config.STATIC_SITE_DIR

  const url1 = `${app.config.SITE_URL}/old-page`
  const url2 = `${app.config.SITE_URL}/new-page`
  const redirectDir = path.join(staticDir, 'redirects')
  const mappingPath = path.join(redirectDir, `${md5(url1)}.json`)
  fs.mkdirSync(redirectDir, { recursive: true })
  fs.writeFileSync(mappingPath, JSON.stringify({ to: url2 }), 'utf-8')
  t.after(() => fs.rmSync(mappingPath, { force: true }))

  const res = await app.inject({ url: '/old-page', followRedirects: false } as any)
  assert.strictEqual(res.statusCode, 301)
  assert.strictEqual(res.headers['location'], url2)
})

