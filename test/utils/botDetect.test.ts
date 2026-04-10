import { test } from 'node:test'
import * as assert from 'node:assert'
import { detectBot } from '../../src/utils/botDetect'

test('detectBot: returns null for a regular browser User-Agent', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  assert.strictEqual(detectBot(ua), null)
})

test('detectBot: returns null for an empty string', () => {
  assert.strictEqual(detectBot(''), null)
})

test('detectBot: identifies Googlebot', () => {
  const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  assert.strictEqual(detectBot(ua), 'Googlebot')
})

test('detectBot: identifies Google-InspectionTool (not misidentified as Googlebot)', () => {
  const ua = 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)'
  assert.strictEqual(detectBot(ua), 'Google-InspectionTool')
})

test('detectBot: identifies AdsBot-Google', () => {
  const ua = 'AdsBot-Google (+http://www.google.com/adsbot.html)'
  assert.strictEqual(detectBot(ua), 'AdsBot-Google')
})

test('detectBot: identifies Bingbot', () => {
  const ua = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
  assert.strictEqual(detectBot(ua), 'Bingbot')
})

test('detectBot: identifies DuckDuckBot (not caught by generic bot pattern first)', () => {
  const ua = 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)'
  assert.strictEqual(detectBot(ua), 'DuckDuckBot')
})

test('detectBot: identifies YandexBot', () => {
  const ua = 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'
  assert.strictEqual(detectBot(ua), 'YandexBot')
})

test('detectBot: identifies AhrefsBot', () => {
  const ua = 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'
  assert.strictEqual(detectBot(ua), 'AhrefsBot')
})

test('detectBot: identifies SemrushBot', () => {
  const ua = 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'
  assert.strictEqual(detectBot(ua), 'SemrushBot')
})

test('detectBot: identifies generic crawler via catch-all', () => {
  const ua = 'MyCrawler/1.0 (+http://example.com/crawler)'
  assert.strictEqual(detectBot(ua), 'Unknown Bot')
})

test('detectBot: identifies generic spider via catch-all', () => {
  const ua = 'MyCustomSpider/2.0'
  assert.strictEqual(detectBot(ua), 'Unknown Bot')
})

test('detectBot: is case-insensitive', () => {
  assert.strictEqual(detectBot('GOOGLEBOT/2.1'), 'Googlebot')
  assert.strictEqual(detectBot('BingBot/2.0'), 'Bingbot')
})
