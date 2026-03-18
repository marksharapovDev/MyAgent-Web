import { Router } from 'express';

export const projectRoutes = Router();

// TODO Week 2: implement full CRUD
// POST   /api/projects
// GET    /api/projects
// GET    /api/projects/:id
// PUT    /api/projects/:id
// DELETE /api/projects/:id
// GET    /api/projects/:id/docs
// PUT    /api/projects/:id/docs

projectRoutes.get('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});
