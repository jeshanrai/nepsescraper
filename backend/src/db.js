const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { dbPath } = require('./config');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_prices (
    trade_date   TEXT NOT NULL,
    symbol       TEXT NOT NULL,
    open         REAL,
    high         REAL,
    low          REAL,
    close        REAL,
    ltp          REAL,
    vwap         REAL,
    volume       REAL,
    prev_close   REAL,
    turnover     REAL,
    transactions INTEGER,
    diff_pct     REAL,
    high_52w     REAL,
    low_52w      REAL,
    scraped_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (trade_date, symbol)
  );

  CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices(symbol);
  CREATE INDEX IF NOT EXISTS idx_stock_prices_date   ON stock_prices(trade_date);

  CREATE TABLE IF NOT EXISTS sector_indices (
    trade_date  TEXT NOT NULL,
    index_id    INTEGER NOT NULL,
    index_name  TEXT NOT NULL,
    open        REAL,
    high        REAL,
    low         REAL,
    close       REAL,
    change_abs  REAL,
    change_pct  REAL,
    turnover    REAL,
    scraped_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (trade_date, index_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sector_indices_date ON sector_indices(trade_date);

  CREATE TABLE IF NOT EXISTS scrape_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at  TEXT,
    status       TEXT NOT NULL,
    prices_count INTEGER,
    indices_count INTEGER,
    error        TEXT
  );
`);

const upsertPrice = db.prepare(`
  INSERT INTO stock_prices (
    trade_date, symbol, open, high, low, close, ltp, vwap,
    volume, prev_close, turnover, transactions, diff_pct, high_52w, low_52w
  ) VALUES (
    @trade_date, @symbol, @open, @high, @low, @close, @ltp, @vwap,
    @volume, @prev_close, @turnover, @transactions, @diff_pct, @high_52w, @low_52w
  )
  ON CONFLICT(trade_date, symbol) DO UPDATE SET
    open         = excluded.open,
    high         = excluded.high,
    low          = excluded.low,
    close        = excluded.close,
    ltp          = excluded.ltp,
    vwap         = excluded.vwap,
    volume       = excluded.volume,
    prev_close   = excluded.prev_close,
    turnover     = excluded.turnover,
    transactions = excluded.transactions,
    diff_pct     = excluded.diff_pct,
    high_52w     = excluded.high_52w,
    low_52w      = excluded.low_52w,
    scraped_at   = datetime('now')
`);

const upsertIndex = db.prepare(`
  INSERT INTO sector_indices (
    trade_date, index_id, index_name, open, high, low, close,
    change_abs, change_pct, turnover
  ) VALUES (
    @trade_date, @index_id, @index_name, @open, @high, @low, @close,
    @change_abs, @change_pct, @turnover
  )
  ON CONFLICT(trade_date, index_id) DO UPDATE SET
    index_name = excluded.index_name,
    open       = excluded.open,
    high       = excluded.high,
    low        = excluded.low,
    close      = excluded.close,
    change_abs = excluded.change_abs,
    change_pct = excluded.change_pct,
    turnover   = excluded.turnover,
    scraped_at = datetime('now')
`);

const insertRun = db.prepare(`
  INSERT INTO scrape_runs (status) VALUES ('running')
`);

const finishRun = db.prepare(`
  UPDATE scrape_runs
     SET finished_at = datetime('now'),
         status = @status,
         prices_count = @prices_count,
         indices_count = @indices_count,
         error = @error
   WHERE id = @id
`);

function savePrices(rows) {
  const tx = db.transaction((list) => {
    for (const r of list) upsertPrice.run(r);
  });
  tx(rows);
}

function saveIndices(rows) {
  const tx = db.transaction((list) => {
    for (const r of list) upsertIndex.run(r);
  });
  tx(rows);
}

function startRun() {
  return insertRun.run().lastInsertRowid;
}

function endRun({ id, status, pricesCount, indicesCount, error }) {
  finishRun.run({
    id,
    status,
    prices_count: pricesCount ?? null,
    indices_count: indicesCount ?? null,
    error: error ?? null,
  });
}

module.exports = { db, savePrices, saveIndices, startRun, endRun };
