import { Router } from 'express';
import { createLogger } from '@my-agent/shared';

const log = createLogger('routes/webhooks');

export const webhookRoutes = Router();

// POST /webhooks/vercel
webhookRoutes.post('/vercel', (req, res) => {
  // TODO Week 3: verify HMAC signature, handle deployment.succeeded / deployment.failed
  log.info('Vercel webhook received', { type: (req.body as Record<string, unknown>)['type'] });
  res.status(200).send('ok');
});

// POST /webhooks/github
webhookRoutes.post('/github', (req, res) => {
  // TODO Week 3: verify X-Hub-Signature-256, handle push / pull_request events
  log.info('GitHub webhook received', { event: req.headers['x-github-event'] });
  res.status(200).send('ok');
});
