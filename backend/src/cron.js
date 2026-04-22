const cron = require('node-cron');
const { cronSchedule, cronTimezone } = require('./config');
const { runScrape } = require('./runScrape');

function startCron() {
  if (!cron.validate(cronSchedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${cronSchedule}`);
  }

  const task = cron.schedule(
    cronSchedule,
    () => {
      runScrape().catch((err) => console.error('[cron] scrape error:', err));
    },
    { timezone: cronTimezone }
  );

  console.log(`[cron] scheduled "${cronSchedule}" (${cronTimezone})`);
  return task;
}

module.exports = { startCron };
