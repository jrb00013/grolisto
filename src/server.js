import { createApp } from './app.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info('grolisto_listening', {
    port: config.port,
    env: config.nodeEnv,
    base: config.publicBaseUrl || `http://localhost:${config.port}`,
  });
});
