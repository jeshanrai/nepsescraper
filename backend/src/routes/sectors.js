const express = require('express');
const { db } = require('../db');

const router = express.Router();

const latestDateStmt = db.prepare(
  `SELECT trade_date FROM sector_indices ORDER BY trade_date DESC LIMIT 1`
);

const sectorsByDateStmt = db.prepare(
  `SELECT * FROM sector_indices WHERE trade_date = ? ORDER BY index_id ASC`
);

const sectorHistoryStmt = db.prepare(
  `SELECT * FROM sector_indices WHERE index_id = ?
   ORDER BY trade_date DESC LIMIT ?`
);

const allSectorsStmt = db.prepare(
  `SELECT DISTINCT index_id, index_name FROM sector_indices ORDER BY index_id ASC`
);

// GET /api/sectors/latest
router.get('/latest', (_req, res) => {
  const latest = latestDateStmt.get();
  if (!latest) return res.json({ trade_date: null, count: 0, data: [] });
  const rows = sectorsByDateStmt.all(latest.trade_date);
  res.json({ trade_date: latest.trade_date, count: rows.length, data: rows });
});

// GET /api/sectors/date/:date
router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const rows = sectorsByDateStmt.all(date);
  res.json({ trade_date: date, count: rows.length, data: rows });
});

// GET /api/sectors/:id[?limit=30]
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id must be an integer' });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 365);
  const rows = sectorHistoryStmt.all(id, limit);
  res.json({ index_id: id, count: rows.length, data: rows });
});

// GET /api/sectors -> list sectors
router.get('/', (_req, res) => {
  res.json({ data: allSectorsStmt.all() });
});

module.exports = router;
