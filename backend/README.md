# NEPSE Scraper Backend

Node.js backend that scrapes **daily NEPSE stock prices and sector indices** from `sharesansar.com` once per day, stores them in SQLite, and exposes a simple read API. Built for learning purposes.

## Why ShareSansar (and not nepsealpha.com)?

`nepsealpha.com` is behind Cloudflare + Inertia.js — doable but fragile. ShareSansar serves clean HTML tables and a documented DataTables AJAX endpoint, which is much simpler to parse. Same underlying NEPSE data.

## Stack

- **Node 18+ / Express** — API server
- **axios + cheerio** — scraping
- **better-sqlite3** — storage (single file, no external DB)
- **node-cron** — daily schedule at 18:00 Asia/Kathmandu

## Run locally

```bash
npm install
npm start          # starts API + cron + initial scrape if DB is empty
npm run scrape     # one-off manual scrape
```

Server defaults to `http://localhost:3000`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Lists all endpoints |
| GET | `/health` | Health check |
| GET | `/api/status` | Last scrape run info |
| GET | `/api/prices/latest` | Latest day's prices for every symbol |
| GET | `/api/prices/date/:YYYY-MM-DD` | All prices on a specific date |
| GET | `/api/prices/symbol/:symbol?limit=30` | History of one symbol (newest first) |
| GET | `/api/prices/symbol/:symbol?date=YYYY-MM-DD` | One symbol on one date |
| GET | `/api/prices/dates` | Every date with data |
| GET | `/api/sectors/latest` | Latest snapshot of all sector indices |
| GET | `/api/sectors/date/:YYYY-MM-DD` | Sector indices on a date |
| GET | `/api/sectors` | List of sectors (id + name) |
| GET | `/api/sectors/:id?limit=30` | History of one sector index |
| POST | `/api/scrape` | Trigger a scrape now. If `SCRAPE_TOKEN` env var is set, must send header `X-Scrape-Token: <token>` |

### Example

```bash
curl http://localhost:3000/api/prices/symbol/NABIL?limit=7
curl http://localhost:3000/api/sectors/latest
```

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/nepse.db` | SQLite file path |
| `CRON_SCHEDULE` | `0 18 * * 0-4` | Cron (NPT). Sun-Thu at 6pm — NEPSE trading days |
| `SCRAPE_ON_BOOT` | `true` | Run a scrape at startup when DB is empty |
| `SCRAPE_TOKEN` | *(unset)* | If set, `POST /api/scrape` requires this token in `X-Scrape-Token` header |

## Deploy to Render

The `render.yaml` is ready. Steps:

1. Push this repo to GitHub.
2. In Render, **New +** → **Blueprint** → point to your repo. It reads `render.yaml` and creates a web service with a 1 GB persistent disk at `/var/data` (SQLite lives there so it survives redeploys).
3. Wait for build + deploy. The first request triggers the initial scrape automatically.

**Important about Render free tier:** the service sleeps after 15 min idle. That's fine here because the cron only wakes it once a day — but if nothing hits the cron at exactly 18:00 NPT, Render won't wake the service to run it. Two options:
- Ping `/health` from an external cron (e.g. cron-job.org) a minute before the scrape window, **or**
- Use Render's paid plan where the service doesn't sleep.

## How it works

1. **`src/scrapers/stockPrices.js`** — `GET` `/today-share-price`, parses `#headFixed` table with cheerio.
2. **`src/scrapers/sectorIndices.js`** — `GET` `/indices-sub-indices` JSON AJAX endpoint for each of the 18 NEPSE sector `index_id` values, keeping the newest entry per sector.
3. **`src/db.js`** — SQLite with upsert statements keyed on `(trade_date, symbol)` / `(trade_date, index_id)` so re-running the same day overwrites cleanly.
4. **`src/cron.js`** — schedules `runScrape` daily in Asia/Kathmandu.
5. **`src/server.js`** — Express API + boots cron + runs an initial scrape if DB is empty.

## Notes / things to improve later

- Respect ShareSansar's ToS if you deploy publicly. This is for learning.
- There's no rate-limiter on the public read API. Add `express-rate-limit` if you expose it widely.
- If you want BS dates (Nepali calendar) alongside AD, store a second column — conversion libs exist on npm.
