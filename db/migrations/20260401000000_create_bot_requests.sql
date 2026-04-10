-- migrate:up
CREATE TABLE IF NOT EXISTS bot_requests (
    id                 SERIAL PRIMARY KEY,
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    url                TEXT NOT NULL,
    path               TEXT NOT NULL,
    bot_name           TEXT NOT NULL,
    user_agent         TEXT NOT NULL,
    cache_status       TEXT NOT NULL,
    http_status        INTEGER NOT NULL,
    render_duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bot_requests_path
    ON bot_requests (path);

CREATE INDEX IF NOT EXISTS idx_bot_requests_bot_name
    ON bot_requests (bot_name);

CREATE INDEX IF NOT EXISTS idx_bot_requests_requested_at
    ON bot_requests (requested_at);

-- migrate:down
DROP TABLE IF EXISTS bot_requests;
