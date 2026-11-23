import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import healthRouter from './routes/health.js';
import storesRouter from './routes/stores.js';
import planRouter from './routes/plan.js';
import chatRouter from './routes/chat.js';
import prefsRouter from './routes/prefs.js';
import authRouter from './routes/auth.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(requestId);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  app.use('/api/health', healthRouter);
  app.use('/api/stores', storesRouter);
  app.use('/api/plan', planRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/prefs', prefsRouter);
  app.use('/api/auth', authRouter);

  app.use((err, _req, res, _next) => {
    logger.error('request_error', { err: String(err?.message || err) });
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

export default createApp;
