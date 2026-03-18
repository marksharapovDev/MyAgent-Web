import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '@my-agent/shared';

const log = createLogger('auth');

const SKIP_PATHS = new Set(['/health', '/webhooks/vercel', '/webhooks/github']);

function shouldSkip(path: string): boolean {
  if (SKIP_PATHS.has(path)) return true;
  if (path.startsWith('/webhooks/')) return true;
  return false;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkip(req.path)) {
    next();
    return;
  }

  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    log.error('JWT_SECRET is not set');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch (err) {
    log.warn('Invalid token', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
