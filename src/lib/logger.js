const levels = { debug: 10, info: 20, warn: 30, error: 40 };

function level() {
  const name = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return levels[name] ?? levels.info;
}

function log(sev, msg, meta) {
  if ((levels[sev] ?? 99) < level()) return;
  const line = {
    t: new Date().toISOString(),
    level: sev,
    msg,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  };
  const out = sev === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};
