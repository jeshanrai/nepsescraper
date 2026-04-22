const express = require('express');
const cors = require('cors');

const { port } = require('./config');
const { db } = require('./db');
const { startCron } = require('./cron');
const { runScrape } = require('./runScrape');
const pricesRouter = require('./routes/prices');
const sectorsRouter = require('./routes/sectors');
const { scrapeOnBoot } = require('./config');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'NEPSE Scraper API',
    source: 'sharesansar.com',
    endpoints: {
      health:           'GET /health',
      latestPrices:     'GET /api/prices/latest',
      pricesByDate:     'GET /api/prices/date/:YYYY-MM-DD',
      symbolHistory:    'GET /api/prices/symbol/:symbol?limit=30',
      symbolOnDate:     'GET /api/prices/symbol/:symbol?date=YYYY-MM-DD',
      tradeDates:       'GET /api/prices/dates',
      latestSectors:    'GET /api/sectors/latest',
      sectorsByDate:    'GET /api/sectors/date/:YYYY-MM-DD',
      sectorList:       'GET /api/sectors',
      sectorHistory:    'GET /api/sectors/:id?limit=30',
      lastRun:          'GET /api/status',
      triggerScrape:    'POST /api/scrape (header X-Scrape-Token if SCRAPE_TOKEN is set)',
      everything:       'GET /data — latest prices + sectors in one payload',
    },
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/data', (_req, res) => {
  const latestPriceDate = db
    .prepare(`SELECT trade_date FROM stock_prices ORDER BY trade_date DESC LIMIT 1`)
    .get();
  const latestSectorDate = db
    .prepare(`SELECT trade_date FROM sector_indices ORDER BY trade_date DESC LIMIT 1`)
    .get();

  const prices = latestPriceDate
    ? db.prepare(`SELECT * FROM stock_prices WHERE trade_date = ? ORDER BY symbol`)
        .all(latestPriceDate.trade_date)
    : [];
  const sectors = latestSectorDate
    ? db.prepare(`SELECT * FROM sector_indices WHERE trade_date = ? ORDER BY index_id`)
        .all(latestSectorDate.trade_date)
    : [];

  res.json({
    prices: {
      trade_date: latestPriceDate?.trade_date ?? null,
      count: prices.length,
      data: prices,
    },
    sectors: {
      trade_date: latestSectorDate?.trade_date ?? null,
      count: sectors.length,
      data: sectors,
    },
  });
});

app.get('/api/status', (_req, res) => {
  const row = db
    .prepare(
      `SELECT id, started_at, finished_at, status, prices_count, indices_count, error
         FROM scrape_runs ORDER BY id DESC LIMIT 1`
    )
    .get();
  res.json({ lastRun: row ?? null });
});

app.post('/api/scrape', async (req, res) => {
  const token = process.env.SCRAPE_TOKEN;
  if (token && req.get('X-Scrape-Token') !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const out = await runScrape();
    res.json({
      ok: true,
      prices: { date: out.prices.tradeDate, count: out.prices.rows.length },
      sectors: { date: out.indices.tradeDate, count: out.indices.rows.length },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use('/api/prices', pricesRouter);
app.use('/api/sectors', sectorsRouter);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

app.listen(port, async () => {
  console.log(`[api] listening on :${port}`);
  startCron();

  if (scrapeOnBoot) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM stock_prices`).get();
    if (row.c === 0) {
      console.log('[boot] DB empty — running initial scrape');
      runScrape().catch((err) => console.error('[boot] scrape failed:', err));
    }
  }
});
