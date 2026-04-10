# prerender

A self-hosted prerender service for JavaScript-heavy single-page applications (SPAs). It intercepts requests from SEO bots and crawlers, serves pre-rendered HTML from a disk cache, and uses headless Chromium (via Puppeteer) to render pages on demand.

---

## How It Works

1. **Nginx** inspects the incoming `User-Agent`. If it matches a known bot (Googlebot, Bingbot, Twitterbot, etc.), the request is proxied to this service on port `8830`.
2. The service checks a **disk cache** directory for a pre-rendered `.html` file keyed by the MD5 hash of the canonical URL.
3. On a **cache miss** (or after the TTL expires), the service launches a headless Chromium tab via Puppeteer, waits for the page to fully hydrate, and saves the minified HTML to disk.
4. The rendered HTML is returned to the bot with appropriate headers.
5. A **scheduled job** crawls the site's XML sitemap and pre-warms the cache for all URLs.
6. Bot request events are persisted to **PostgreSQL** and exposed via an analytics API.

---

## Installation

### Step 1 — Start the prerender service

Clone the repository:

```bash
git clone https://github.com/haku-d/prerender.git
cd prerender
```

Create a `.env` file:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
SITE_URL=https://your-site.com
STATIC_SITE_DIR=/data/prerender
DATABASE_URL=postgresql://prerender:secret@postgres:5432/prerender
POSTGRES_PASSWORD=secret
```

The `docker-compose.yml` includes three services:

| Service | Description | Port | Required |
|---|---|---|---|
| `prerender` | The prerender service | `8830` (internal) | yes |
| `postgres` | PostgreSQL 16 | internal | no (analytics only) |
| `prerender-ui` | Admin dashboard ([haku-d/prerender-ui](https://github.com/haku-d/prerender-ui)) | `6996` → `4000` | no |

Start the services:

```bash
docker compose up -d
```

DB migrations run automatically on startup. Remove `postgres` and `prerender-ui` from `docker-compose.yml` if you don't need analytics or the dashboard.

### Step 2 — Configure Nginx

Add the configuration from `nginx.conf` to your Nginx setup to route bot traffic to the prerender service:

- A `map` block identifies bot User-Agents via `$prerender_ua`.
- URLs matching static asset extensions (`.js`, `.css`, `.png`, etc.) are never prerendered.
- Bot requests are rewritten to `/prerender-proxy` and proxied to `http://prerender_backend` (port `8830`).
- The `X-Prerender: 1` header prevents re-entrant prerender loops.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript |
| HTTP framework | Fastify 5 |
| Headless browser | Puppeteer Core + Chromium (Alpine) |
| Database | PostgreSQL 16 |
| DB migrations | dbmate |
| Scheduler | toad-scheduler |
| HTML minification | html-minifier-terser |
| Monitoring | New Relic |
| Package manager | pnpm |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PUPPETEER_EXECUTABLE_PATH` | yes | — | Path to the Chromium binary (e.g. `/usr/bin/chromium-browser`) |
| `SITE_URL` | yes | — | Canonical site URL used to normalise cache keys (e.g. `https://example.com`) |
| `STATIC_SITE_DIR` | yes | — | Absolute path to the directory where pre-rendered HTML files are stored |
| `DATABASE_URL` | no | — | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/dbname`). Analytics are disabled when omitted. |
| `CACHE_TTL_SECONDS` | no | `43200` | Seconds before a cached file is considered stale (default 12 hours) |
| `EXECUTE_JOB_ON_START` | no | `false` | Set to `true` to trigger a full sitemap crawl immediately on startup |
| `PORT` | no | `8830` | HTTP port the service listens on |

Create a `.env` file in the project root for local development:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
SITE_URL=https://example.com
STATIC_SITE_DIR=/tmp/prerender-site
DATABASE_URL=postgresql://prerender:secret@localhost:5432/prerender
CACHE_TTL_SECONDS=43200
EXECUTE_JOB_ON_START=false
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Chromium installed locally (or set `PUPPETEER_EXECUTABLE_PATH` to a Docker-managed binary)
- PostgreSQL 16 (optional — only needed for analytics)
- [dbmate](https://github.com/amacneil/dbmate) for running migrations

### Install dependencies

```bash
pnpm install
```

### Run database migrations

```bash
pnpm run db:migrate
```

### Start in development mode

Starts TypeScript in watch mode alongside the Fastify server with auto-reload:

```bash
pnpm run dev
```

### Start in production mode

Compiles TypeScript then starts the server:

```bash
pnpm run start
```

### Run tests

```bash
pnpm run test
```

Coverage reports are written to `coverage/`.

---

## API Reference

All requests are unauthenticated. The service is intended to be deployed on a private network behind Nginx.

### `GET /*`

Main prerender endpoint. Accepts the full site URL as the path (e.g. `GET /https://example.com/products/business-cards`).

- Returns cached HTML if available and not expired.
- Triggers an on-demand Puppeteer render on cache miss, saves to disk, and returns the result.
- Returns `410 Gone` if the URL has been marked as gone.
- Returns `301 Redirect` if a redirect mapping exists for the URL.

### `GET /hit/*`

Force-renders a URL, overwrites the cache entry, and returns the new HTML. Useful for cache invalidation after a page update.

```
GET /hit/https://example.com/products/business-cards
```

### `GET /gone/*`

Marks a URL as permanently gone. Subsequent requests to `/*` for this URL will return `410`.

```
GET /gone/https://example.com/old-page
```

### `DELETE /gone/*`

Removes the gone marker for a URL.

```
DELETE /gone/https://example.com/old-page
```

### `GET /redirect/*`

Stores a `301` redirect mapping from one URL to another. Subsequent requests to `/*` for `<url1>` will redirect to `<url2>`.

```
GET /redirect/https://example.com/old-path/https://example.com/new-path
```

### `GET /analytics/summary`

Returns bot request statistics from the PostgreSQL database.

Query parameters (both optional):

| Param | Format | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Start of date range (inclusive) |
| `to` | `YYYY-MM-DD` | End of date range (inclusive) |

Example response:

```json
{
  "total": 1240,
  "uniquePages": 87,
  "byBot": [{ "botName": "googlebot", "count": 640 }],
  "byCacheStatus": [{ "cacheStatus": "hit", "count": 980 }]
}
```

---

## Cache

- Cache files are stored in `STATIC_SITE_DIR` as `<md5(fullUrl)>.html`.
- Gone markers are stored as empty files under `STATIC_SITE_DIR/gone/`.
- Redirect mappings are stored as JSON files under `STATIC_SITE_DIR/redirects/`.
- Cache is considered stale after `CACHE_TTL_SECONDS` seconds (default 12 hours).
- Stale cache entries are re-rendered on the next request and updated in the background.

---

## Database Schema

The `bot_requests` table records every bot hit:

| Column | Type | Description |
|---|---|---|
| `id` | integer | Primary key |
| `requested_at` | timestamptz | Request timestamp |
| `url` | text | Full canonical URL |
| `path` | text | URL path only |
| `bot_name` | text | Detected bot name |
| `user_agent` | text | Raw User-Agent header |
| `cache_status` | text | `hit`, `miss`, `stale`, `gone`, `redirect` |
| `http_status` | integer | HTTP status code returned |
| `render_duration_ms` | integer | Puppeteer render time in ms (null for cache hits) |

Migrations are managed by dbmate and located in `db/migrations/`.
