import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@my-agent/shared';

const log = createLogger('error-handler');

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.retryable && { retry: true }),
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  log.error(`Unhandled error on ${req.method} ${req.path}`, { message, stack });

  // Surface AI/DB errors with appropriate codes
  if (message.toLowerCase().includes('anthropic') || message.toLowerCase().includes('claude')) {
    res.status(502).json({ error: 'AI service unavailable', retry: true });
    return;
  }

  if (message.toLowerCase().includes('supabase') || message.toLowerCase().includes('postgres')) {
    res.status(503).json({ error: 'Database error', retry: true });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env['NODE_ENV'] === 'development' && { detail: message }),
  });
}
