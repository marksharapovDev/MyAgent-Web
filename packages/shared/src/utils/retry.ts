import { createLogger } from './logger.js';

const log = createLogger('retry');

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffFactor: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let delayMs = opts.initialDelayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      log.warn(`Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delayMs}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delayMs);
      delayMs = Math.min(delayMs * opts.backoffFactor, opts.maxDelayMs);
    }
  }

  throw lastError;
}

export function isRetryableHttpError(error: unknown): boolean {
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}
