import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

// Analytics query API tests.
// When DATABASE_URL is not configured, the analytics plugin registers a no-op
// decorator that returns empty arrays for all queries. Tests verify the endpoint
// contract (shape and status) in both cases.

test('GET /analytics/summary → 200 with expected shape (no-db baseline)', async (t) => {
  const app = await build(t)

  const res = await app.inject({ method: 'GET', url: '/analytics/summary' })
  assert.strictEqual(res.statusCode, 200)

  const body = JSON.parse(res.payload)
  assert.ok(typeof body.total === 'number', 'total should be a number')
  assert.ok(typeof body.uniquePages === 'number', 'uniquePages should be a number')
  assert.ok(Array.isArray(body.byBot), 'byBot should be an array')
  assert.ok(Array.isArray(body.byCacheStatus), 'byCacheStatus should be an array')
})

test('GET /analytics/summary?from=&to= → 200 (date filters do not throw)', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/analytics/summary?from=2026-01-01&to=2026-12-31',
  })
  assert.strictEqual(res.statusCode, 200)
})

test('GET /analytics/pages → 200 with array response', async (t) => {
  const app = await build(t)

  const res = await app.inject({ method: 'GET', url: '/analytics/pages' })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(Array.isArray(JSON.parse(res.payload)), 'response should be an array')
})

test('GET /analytics/pages?limit=10&bot=Googlebot → 200', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/analytics/pages?limit=10&bot=Googlebot',
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(Array.isArray(JSON.parse(res.payload)))
})

test('GET /analytics/bots → 200 with array response', async (t) => {
  const app = await build(t)

  const res = await app.inject({ method: 'GET', url: '/analytics/bots' })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(Array.isArray(JSON.parse(res.payload)), 'response should be an array')
})

test('GET /analytics/bots?from=&to= → 200 (date filters do not throw)', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/analytics/bots?from=2026-01-01&to=2026-12-31',
  })
  assert.strictEqual(res.statusCode, 200)
})
