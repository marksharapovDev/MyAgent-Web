import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createLogger } from '@my-agent/shared';

import { initQueue } from './queue/index.js';
import { initWorkers } from './workers/index.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { taskRoutes } from './routes/tasks.js';
import { projectRoutes } from './routes/projects.js';
import { planRoutes } from './routes/plans.js';
import { webhookRoutes } from './routes/webhooks.js';
import { healthRoutes } from './routes/health.js';
import { wsHandler } from './ws/handler.js';

const log = createLogger('server');

async function main(): Promise<void> {
  const app = express();
  const server = createServer(app);

  // ── WebSocket (Desktop real-time) ──────────────────────────────────────────
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', wsHandler);
  log.info('WebSocket server attached at /ws');

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(rateLimiter);
  app.use(authMiddleware);

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use('/health', healthRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/webhooks', webhookRoutes);  // has its own auth (HMAC)

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  // ── Queue & workers ────────────────────────────────────────────────────────
  await initQueue();
  await initWorkers();

  // ── Listen ─────────────────────────────────────────────────────────────────
  const port = Number(process.env['PORT'] ?? 3001);
  server.listen(port, () => {
    log.info(`Server listening on port ${port}`, {
      env: process.env['NODE_ENV'] ?? 'development',
    });
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    log.info(`Received ${signal}, shutting down...`);
    server.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
