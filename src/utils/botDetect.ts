const BOT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /google-inspectiontool/i, name: 'Google-InspectionTool' },
  { pattern: /adsbot-google/i,         name: 'AdsBot-Google' },
  { pattern: /googlebot/i,             name: 'Googlebot' },
  { pattern: /bingbot/i,               name: 'Bingbot' },
  { pattern: /duckduckbot/i,           name: 'DuckDuckBot' },
  { pattern: /baiduspider/i,           name: 'Baiduspider' },
  { pattern: /yandexbot/i,             name: 'YandexBot' },
  { pattern: /slurp/i,                 name: 'Yahoo! Slurp' },
  { pattern: /applebot/i,              name: 'Applebot' },
  { pattern: /ahrefsbot/i,             name: 'AhrefsBot' },
  { pattern: /semrushbot/i,            name: 'SemrushBot' },
  { pattern: /mj12bot/i,               name: 'MJ12bot' },
  { pattern: /bot|crawler|spider/i,    name: 'Unknown Bot' },
]

/**
 * Returns a human-readable bot name when the User-Agent belongs to a known
 * search engine or crawler, or null for regular browser traffic.
 */
export function detectBot(userAgent: string): string | null {
  if (!userAgent) return null
  for (const { pattern, name } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return name
  }
  return null
}
