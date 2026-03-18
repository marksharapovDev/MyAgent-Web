import { Router } from 'express';
import { z } from 'zod';
import { createLogger, CreateTaskInputSchema } from '@my-agent/shared';
import { taskQueue } from '../queue/index.js';
import { AppError } from '../middleware/error.js';

const log = createLogger('routes/tasks');

export const taskRoutes = Router();

// POST /api/tasks — enqueue a new task
taskRoutes.post('/', async (req, res, next) => {
  try {
    const body = CreateTaskInputSchema.parse(req.body);

    const job = await taskQueue.add(body.type, {
      projectId: body.projectId,
      planTaskId: body.planTaskId,
      type: body.type,
      source: body.source ?? 'api',
      userId: req.userId,
      input: body.input,
    }, {
      priority: body.priority ?? 0,
    });

    log.info('Task enqueued', { jobId: job.id, type: body.type, projectId: body.projectId });

    res.status(202).json({
      status: 'queued',
      taskId: job.id,
      type: body.type,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, `Validation error: ${err.errors.map((e) => e.message).join(', ')}`));
      return;
    }
    next(err);
  }
});

// GET /api/tasks/:id — get task status from queue
taskRoutes.get('/:id', async (req, res, next) => {
  try {
    const jobId = req.params['id'];
    if (!jobId) {
      next(new AppError(400, 'Missing task id'));
      return;
    }

    const job = await taskQueue.getJob(jobId);
    if (!job) {
      next(new AppError(404, `Task ${jobId} not found`));
      return;
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({
      taskId: job.id,
      type: job.name,
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks?project_id=xxx — list jobs (lightweight, queue-level)
taskRoutes.get('/', async (req, res, next) => {
  try {
    // TODO Week 3: query from Supabase tasks table for richer filtering
    // For now return active jobs from BullMQ
    const [waiting, active, completed, failed] = await Promise.all([
      taskQueue.getWaiting(),
      taskQueue.getActive(),
      taskQueue.getCompleted(0, 20),
      taskQueue.getFailed(0, 20),
    ]);

    const all = [...waiting, ...active, ...completed, ...failed];
    const projectId = req.query['project_id'] as string | undefined;

    const filtered = projectId
      ? all.filter((j) => j.data.projectId === projectId)
      : all;

    res.json(
      filtered.map((j) => ({
        taskId: j.id,
        type: j.name,
        projectId: j.data.projectId,
        createdAt: new Date(j.timestamp).toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});
