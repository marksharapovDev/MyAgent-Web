import { Queue, QueueEvents } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { createLogger } from '@my-agent/shared';
import type { TaskType } from '@my-agent/shared';

const log = createLogger('queue');

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const parsed = new URL(redisUrl);

// Shared Redis instance for non-BullMQ use (ping, state machine, etc.)
export const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
redis.on('connect', () => log.info('Redis connected'));
redis.on('error', (err: Error) => log.error('Redis error', { message: err.message }));

// BullMQ gets plain connection options to avoid the dual-ioredis-version type conflict
const bullConnection = {
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  ...(parsed.password ? { password: parsed.password } : {}),
};

export interface TaskJobData {
  taskId?: string;
  planTaskId?: string;
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

export const taskQueue = new Queue<TaskJobData, TaskJobResult, string>('tasks', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const queueEvents = new QueueEvents('tasks', { connection: bullConnection });

export async function initQueue(): Promise<void> {
  await redis.ping();
  log.info('Task queue initialised');

  queueEvents.on('completed', ({ jobId }) => log.info('Job completed', { jobId }));
  queueEvents.on('failed', ({ jobId, failedReason }) => log.error('Job failed', { jobId, failedReason }));
  queueEvents.on('progress', ({ jobId, data }) => log.debug('Job progress', { jobId, progress: data }));
}
