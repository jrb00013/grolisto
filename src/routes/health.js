import { Router } from 'express';
import { config } from '../lib/config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'grolisto',
    env: config.nodeEnv,
    scotrMock: config.scotrUseMock,
    openRouterConfigured: Boolean(config.openRouterApiKey),
    qdrantUrl: config.qdrantUrl,
  });
});

export default router;
