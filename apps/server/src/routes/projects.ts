import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '@my-agent/shared';
import { getSupabase } from '../lib/supabase.js';
import { AppError } from '../middleware/error.js';

const log = createLogger('routes/projects');

export const projectRoutes = Router();

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  stack: z.record(z.unknown()).optional(),
  repoUrl: z.string().url().optional(),
  vercelId: z.string().optional(),
  vpsConfig: z.record(z.unknown()).optional(),
});

// GET /api/projects
projectRoutes.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const status = req.query['status'] as string | undefined;

    let query = supabase
      .from('projects')
      .select('id, name, slug, status, stack, repo_url, vercel_id, vps_config, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to list projects', { error: error.message });
      throw new AppError(503, `Database error: ${error.message}`);
    }

    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id
projectRoutes.get('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    if (!id) {
      next(new AppError(400, 'Missing project id'));
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, slug, status, stack, repo_url, vercel_id, vps_config, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        next(new AppError(404, `Project ${id} not found`));
        return;
      }
      log.error('Failed to get project', { id, error: error.message });
      throw new AppError(503, `Database error: ${error.message}`);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
projectRoutes.post('/', async (req, res, next) => {
  try {
    const body = CreateProjectSchema.parse(req.body);
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: body.name,
        slug: body.slug,
        status: 'active',
        stack: body.stack ?? {},
        ...(body.repoUrl !== undefined && { repo_url: body.repoUrl }),
        ...(body.vercelId !== undefined && { vercel_id: body.vercelId }),
        vps_config: body.vpsConfig ?? {},
      })
      .select('id, name, slug, status, stack, repo_url, vercel_id, vps_config, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        next(new AppError(409, `Project with slug "${body.slug}" already exists`));
        return;
      }
      log.error('Failed to create project', { error: error.message });
      throw new AppError(503, `Database error: ${error.message}`);
    }

    log.info('Project created', { id: data.id, slug: data.slug });
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, `Validation error: ${err.errors.map((e) => e.message).join(', ')}`));
      return;
    }
    next(err);
  }
});
