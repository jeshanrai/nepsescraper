const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nepse.db'),

  // NPT is UTC+5:45. node-cron runs in server TZ; we pin TZ explicitly.
  cronSchedule: process.env.CRON_SCHEDULE || '0 18 * * 0-4',
  cronTimezone: 'Asia/Kathmandu',

  // Run a scrape on startup if DB is empty. Useful for first Render deploy.
  scrapeOnBoot: process.env.SCRAPE_ON_BOOT !== 'false',

  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',

  sources: {
    todaySharePrice: 'https://www.sharesansar.com/today-share-price',
    indicesAjax: 'https://www.sharesansar.com/indices-sub-indices',
  },

  // index_id values from ShareSansar /indices-sub-indices dropdown.
  sectorIndices: [
    { id: 1,  name: 'Banking SubIndex' },
    { id: 2,  name: 'Development Bank Index' },
    { id: 3,  name: 'Finance Index' },
    { id: 4,  name: 'Float Index' },
    { id: 5,  name: 'Hotels And Tourism' },
    { id: 6,  name: 'HydroPower Index' },
    { id: 7,  name: 'Insurance' },
    { id: 8,  name: 'Life Insurance' },
    { id: 9,  name: 'Manufacturing And Processing' },
    { id: 10, name: 'Microfinance Index' },
    { id: 11, name: 'Mutual Fund' },
    { id: 12, name: 'NEPSE Index' },
    { id: 13, name: 'Non Life Insurance' },
    { id: 14, name: 'Others Index' },
    { id: 15, name: 'Sensitive Float Index' },
    { id: 16, name: 'Sensitive Index' },
    { id: 17, name: 'Trading Index' },
    { id: 18, name: 'Investment' },
  ],
};
