import { Router } from 'express';

export const planRoutes = Router();

// TODO Week 3: implement plan management
// POST   /api/plans
// GET    /api/plans/:id
// PUT    /api/plans/:id
// POST   /api/plans/:id/start
// POST   /api/plans/:id/pause
// POST   /api/plans/:id/resume
// PUT    /api/plans/:id/mode

planRoutes.get('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});
