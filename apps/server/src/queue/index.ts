import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { createLogger } from '@my-agent/shared';
import type { TaskType } from '@my-agent/shared';

const log = createLogger('queue');

// Shared Redis connection for BullMQ
// maxRetriesPerRequest: null is required by BullMQ
export const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => log.info('Redis connected'));
redis.on('error', (err) => log.error('Redis error', { message: err.message }));

export interface TaskJobData {
  taskId?: string;
  projectId: string;
  type: TaskType;
  source: string;
  userId: string;
  input: Record<string, unknown>;
}

export interface TaskJobResult {
  type: TaskType;
  output: Record<string, unknown>;
}

export const taskQueue = new Queue<TaskJobData, TaskJobResult>('tasks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,       // 5 → 10 → 20 sec
    },
    timeout: 300_000,     // 5 min max per job
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const queueEvents = new QueueEvents('tasks', { connection: redis });

export async function initQueue(): Promise<void> {
  // Verify connection
  await redis.ping();
  log.info('Task queue initialised');

  queueEvents.on('completed', ({ jobId }) => {
    log.info('Job completed', { jobId });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    log.error('Job failed', { jobId, failedReason });
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    log.debug('Job progress', { jobId, progress: data });
  });
}
