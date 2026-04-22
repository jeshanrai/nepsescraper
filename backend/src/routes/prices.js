const express = require('express');
const { db } = require('../db');

const router = express.Router();

const latestDateStmt = db.prepare(
  `SELECT trade_date FROM stock_prices ORDER BY trade_date DESC LIMIT 1`
);

const pricesByDateStmt = db.prepare(
  `SELECT * FROM stock_prices WHERE trade_date = ? ORDER BY symbol ASC`
);

const priceBySymbolDateStmt = db.prepare(
  `SELECT * FROM stock_prices WHERE symbol = ? AND trade_date = ?`
);

const historyBySymbolStmt = db.prepare(
  `SELECT * FROM stock_prices WHERE symbol = ?
   ORDER BY trade_date DESC LIMIT ?`
);

const datesStmt = db.prepare(
  `SELECT DISTINCT trade_date FROM stock_prices ORDER BY trade_date DESC LIMIT 365`
);

// GET /api/prices/latest -> latest day's full snapshot
router.get('/latest', (_req, res) => {
  const latest = latestDateStmt.get();
  if (!latest) return res.json({ trade_date: null, count: 0, data: [] });
  const rows = pricesByDateStmt.all(latest.trade_date);
  res.json({ trade_date: latest.trade_date, count: rows.length, data: rows });
});

// GET /api/prices/date/:date  (YYYY-MM-DD)
router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const rows = pricesByDateStmt.all(date);
  res.json({ trade_date: date, count: rows.length, data: rows });
});

// GET /api/prices/symbol/:symbol[?date=YYYY-MM-DD&limit=30]
router.get('/symbol/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (req.query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const row = priceBySymbolDateStmt.get(symbol, req.query.date);
    return res.json({ symbol, trade_date: req.query.date, data: row ?? null });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 365);
  const rows = historyBySymbolStmt.all(symbol, limit);
  res.json({ symbol, count: rows.length, data: rows });
});

// GET /api/prices/dates -> available trade dates
router.get('/dates', (_req, res) => {
  const rows = datesStmt.all().map((r) => r.trade_date);
  res.json({ count: rows.length, dates: rows });
});

module.exports = router;
