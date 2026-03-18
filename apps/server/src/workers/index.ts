import { createLogger } from '@my-agent/shared';

const log = createLogger('workers');

// Workers are registered here and started alongside the server.
// Actual job processing logic lives in pipelines (packages/core) — Week 3.
export async function initWorkers(): Promise<void> {
  log.info('Workers initialised (skeleton — no processors registered yet)');

  // TODO Week 3: register design / code / deploy workers
  // import { Worker } from 'bullmq';
  // import { redis } from '../queue/index.js';
  //
  // const designWorker = new Worker('tasks', async (job) => { ... }, {
  //   connection: redis,
  //   concurrency: 1,
  // });
}
