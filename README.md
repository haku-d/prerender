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

```mermaid
flowchart TD
    A([Incoming HTTP Request]) --> B[Nginx]

    B --> C{Bot User-Agent\nor static asset?}
    C -- "Regular user / static asset" --> D([Serve SPA normally])
    C -- "Known bot\ne.g. Googlebot" --> E[Proxy to Prerender\nservice :8830\nwith X-Prerender: 1]

    E --> F[Prerender Service\nFastify + Node.js]

    F --> G{URL marked\nas Gone?}
    G -- "Yes (.gone file)" --> H([410 Gone])

    G -- No --> I{Redirect\nmapping exists?}
    I -- "Yes (.json file)" --> J([301 Redirect])

    I -- No --> K{Disk cache\nhit & fresh?}
    K -- "Yes (within TTL)" --> L([Serve cached HTML\ncache: HIT])

    K -- "No (miss or expired)" --> M[Launch Puppeteer\nHeadless Chromium]
    M --> N[Navigate to SITE_URL\nwait for networkidle0\n& meta title hydration]
    N --> O[Extract & minify HTML\nhtml-minifier-terser]
    O --> P[Save to disk\nmd5 URL .html]
    P --> Q([Serve fresh HTML\ncache: MISS/EXPIRED])

    F --> R[(PostgreSQL\nAnalytics DB)]
    G --> R
    I --> R
    K --> R
    Q --> R

    subgraph Scheduler [Scheduled Cache Warmer]
        S[toad-scheduler\nperiodic job] --> T[Fetch XML Sitemap]
        T --> U[Render all URLs\nvia Puppeteer]
        U --> P
    end

    style D fill:#4a90d9,color:#fff
    style H fill:#e05c4b,color:#fff
    style J fill:#f5a623,color:#fff
    style L fill:#27ae60,color:#fff
    style Q fill:#27ae60,color:#fff
    style R fill:#8e44ad,color:#fff
    style Scheduler fill:#f9f9f9,stroke:#aaa
```

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
