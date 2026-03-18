import { Router } from 'express';
import { redis } from '../queue/index.js';

export const healthRoutes = Router();

healthRoutes.get('/', async (_req, res) => {
  type CheckStatus = 'ok' | 'error' | 'unknown';

  const checks: Record<string, CheckStatus> = {
    server: 'ok',
    redis: 'unknown',
    supabase: 'unknown', // TODO: check once Supabase is wired up
    claude: 'unknown',   // TODO: cache from periodic probe
    puppeteer: 'unknown',// TODO: pool readiness flag
  };

  try {
    await redis.ping();
    checks['redis'] = 'ok';
  } catch {
    checks['redis'] = 'error';
  }

  const healthy = checks['redis'] === 'ok';
  res.status(healthy ? 200 : 503).json(checks);
});
