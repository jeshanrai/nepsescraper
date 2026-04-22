const axios = require('axios');
const { sources, userAgent, sectorIndices } = require('../config');

function toNumber(v) {
  if (v == null) return null;
  const cleaned = String(v).replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function nptDateYMD(offsetDays = 0) {
  const now = new Date();
  const npt = new Date(now.getTime() + (5 * 60 + 45) * 60 * 1000);
  npt.setUTCDate(npt.getUTCDate() + offsetDays);
  return npt.toISOString().slice(0, 10);
}

async function fetchIndex(indexId, from, to) {
  const url = sources.indicesAjax;
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': userAgent,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
    params: {
      draw: 1,
      start: 0,
      length: 50,
      index_id: indexId,
      from,
      to,
    },
    timeout: 30_000,
  });
  return data?.data ?? [];
}

async function scrapeSectorIndices() {
  // Pull the last 10 NPT days and keep the newest entry per index_id.
  // This is resilient to weekends/holidays when the cron fires.
  const from = nptDateYMD(-10);
  const to = nptDateYMD(0);

  const rows = [];
  for (const { id, name } of sectorIndices) {
    try {
      const raw = await fetchIndex(id, from, to);
      if (!raw.length) continue;

      const newest = raw.reduce((a, b) =>
        a.published_date > b.published_date ? a : b
      );

      rows.push({
        trade_date: newest.published_date,
        index_id:   id,
        index_name: name,
        open:       toNumber(newest.open),
        high:       toNumber(newest.high),
        low:        toNumber(newest.low),
        close:      toNumber(newest.current),
        change_abs: toNumber(newest.change_),
        change_pct: toNumber(newest.per_change),
        turnover:   toNumber(newest.turnover),
      });
    } catch (err) {
      // Don't let one failing index kill the rest.
      console.error(`[sector] index_id=${id} failed:`, err.message);
    }
  }

  const tradeDate = rows.length
    ? rows.reduce((a, b) => (a.trade_date > b.trade_date ? a : b)).trade_date
    : to;

  return { tradeDate, rows };
}

module.exports = { scrapeSectorIndices };
