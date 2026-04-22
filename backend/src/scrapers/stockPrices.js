const axios = require('axios');
const cheerio = require('cheerio');
const { sources, userAgent } = require('../config');

function toNumber(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseTradeDate($) {
  // ShareSansar prints "As of YYYY-MM-DD" or a date badge near the table.
  const headerText = $('body').text();
  const m = headerText.match(/As of\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);
  if (m) return m[1];

  const m2 = headerText.match(/(\d{4}-\d{2}-\d{2})/);
  if (m2) return m2[1];

  // Fallback: today in NPT (UTC+5:45).
  const now = new Date();
  const npt = new Date(now.getTime() + (5 * 60 + 45) * 60 * 1000);
  return npt.toISOString().slice(0, 10);
}

async function scrapeStockPrices() {
  const { data: html } = await axios.get(sources.todaySharePrice, {
    headers: { 'User-Agent': userAgent, Accept: 'text/html' },
    timeout: 30_000,
  });

  const $ = cheerio.load(html);
  const tradeDate = parseTradeDate($);

  const rows = [];
  $('#headFixed tbody tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
    // Column order from the HTML thead (confirmed during probe):
    // 0 S.No | 1 Symbol | 2 Conf | 3 Open | 4 High | 5 Low | 6 Close | 7 LTP
    // 8 Close-LTP | 9 Close-LTP% | 10 VWAP | 11 Vol | 12 Prev.Close | 13 Turnover
    // 14 Trans | 15 Diff | 16 Range | 17 Diff% | 18 Range% | 19 VWAP%
    // 20 120Days | 21 180Days | 22 52W High | 23 52W Low
    if (cells.length < 24) return;

    const symbol = cells[1];
    if (!symbol) return;

    rows.push({
      trade_date:   tradeDate,
      symbol,
      open:         toNumber(cells[3]),
      high:         toNumber(cells[4]),
      low:          toNumber(cells[5]),
      close:        toNumber(cells[6]),
      ltp:          toNumber(cells[7]),
      vwap:         toNumber(cells[10]),
      volume:       toNumber(cells[11]),
      prev_close:   toNumber(cells[12]),
      turnover:     toNumber(cells[13]),
      transactions: toNumber(cells[14]),
      diff_pct:     toNumber(cells[17]),
      high_52w:     toNumber(cells[22]),
      low_52w:      toNumber(cells[23]),
    });
  });

  return { tradeDate, rows };
}

module.exports = { scrapeStockPrices };
