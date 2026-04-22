const { scrapeStockPrices } = require('./scrapers/stockPrices');
const { scrapeSectorIndices } = require('./scrapers/sectorIndices');
const { savePrices, saveIndices, startRun, endRun } = require('./db');

async function runScrape() {
  const runId = startRun();
  const t0 = Date.now();
  console.log(`[scrape] run #${runId} started`);

  try {
    const [prices, indices] = await Promise.all([
      scrapeStockPrices(),
      scrapeSectorIndices(),
    ]);

    if (prices.rows.length) savePrices(prices.rows);
    if (indices.rows.length) saveIndices(indices.rows);

    endRun({
      id: runId,
      status: 'success',
      pricesCount: prices.rows.length,
      indicesCount: indices.rows.length,
    });

    console.log(
      `[scrape] run #${runId} ok — ${prices.rows.length} prices (${prices.tradeDate}), ` +
      `${indices.rows.length} indices (${indices.tradeDate}) in ${Date.now() - t0}ms`
    );
    return { prices, indices };
  } catch (err) {
    endRun({ id: runId, status: 'error', error: err.message });
    console.error(`[scrape] run #${runId} failed:`, err);
    throw err;
  }
}

if (require.main === module) {
  runScrape()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runScrape };
