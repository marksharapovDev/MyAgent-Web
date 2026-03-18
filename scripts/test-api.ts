#!/usr/bin/env tsx
/**
 * scripts/test-api.ts
 *
 * Smoke-test for apps/server:
 *   1. Generate JWT token
 *   2. GET  /health
 *   3. POST /api/tasks
 *   4. GET  /api/tasks/:id
 *
 * Usage:
 *   JWT_SECRET=your-secret pnpm test:api
 *   JWT_SECRET=your-secret SERVER_URL=http://localhost:3001 pnpm test:api
 */

import jwt from 'jsonwebtoken';

// ── Config ────────────────────────────────────────────────────────────────────

const SERVER_URL = process.env['SERVER_URL'] ?? 'http://localhost:3001';
const JWT_SECRET = process.env['JWT_SECRET'];
const USER_ID    = '00000000-0000-0000-0000-000000000099';  // test user
const PROJECT_ID = '00000000-0000-0000-0000-000000000001';  // matches seed.sql

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`;

function pass(label: string): void { console.log(`  ${GREEN('✓')} ${label}`); }
function fail(label: string): void { console.log(`  ${RED('✗')} ${label}`); }
function info(label: string): void { console.log(`  ${DIM(label)}`); }

interface TestResult {
  name: string;
  ok: boolean;
  detail?: string;
}

async function step(
  results: TestResult[],
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  process.stdout.write(`\n${BOLD(name)}\n`);
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    fail(detail);
    results.push({ name, ok: false, detail });
  }
}

async function request<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const url = `${SERVER_URL}${path}`;
  info(`${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const data = await res.json() as T;
  info(`→ ${res.status} ${JSON.stringify(data)}`);

  return { status: res.status, data };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(BOLD('\n=== API Smoke Test ==='));
  console.log(DIM(`Server: ${SERVER_URL}\n`));

  const results: TestResult[] = [];
  let token = '';
  let taskId = '';

  // 1. Generate JWT
  await step(results, '1. Generate JWT token', async () => {
    if (!JWT_SECRET) {
      throw new Error(
        'JWT_SECRET env var is required.\n' +
        '  Usage: JWT_SECRET=your-secret pnpm test:api',
      );
    }

    token = jwt.sign({ userId: USER_ID }, JWT_SECRET, { expiresIn: '1h' });
    pass(`userId: ${USER_ID}`);
    info(`token:  ${token.slice(0, 40)}…`);
  });

  // 2. Health check
  await step(results, '2. GET /health', async () => {
    const { status, data } = await request<Record<string, string>>(
      'GET', '/health', token,
    );

    if (status !== 200 && status !== 503) {
      throw new Error(`Unexpected HTTP status ${status}`);
    }

    for (const [key, val] of Object.entries(data)) {
      if (val === 'ok') {
        pass(`${key}: ok`);
      } else if (val === 'unknown') {
        console.log(`  ${YELLOW('~')} ${key}: unknown (not configured yet)`);
      } else {
        fail(`${key}: ${val}`);
      }
    }

    if (data['server'] !== 'ok') throw new Error('server check failed');
  });

  // 3. Create task
  await step(results, '3. POST /api/tasks', async () => {
    const payload = {
      projectId: PROJECT_ID,
      type: 'general',
      priority: 0,
      source: 'api',
      claudeModel: 'sonnet',
      input: {
        message: 'Smoke-test task from scripts/test-api.ts',
        timestamp: new Date().toISOString(),
      },
    };

    const { status, data } = await request<{
      status: string;
      taskId: string;
      type: string;
    }>('POST', '/api/tasks', token, payload);

    if (status !== 202) {
      throw new Error(`Expected 202, got ${status} — ${JSON.stringify(data)}`);
    }
    if (!data.taskId) throw new Error('No taskId in response');

    taskId = data.taskId;
    pass(`status:  ${data.status}`);
    pass(`taskId:  ${taskId}`);
    pass(`type:    ${data.type}`);
  });

  // 4. Poll task status
  await step(results, '4. GET /api/tasks/:id', async () => {
    if (!taskId) throw new Error('No taskId from step 3 — skipping');

    const { status, data } = await request<{
      taskId: string;
      type: string;
      status: string;
      progress: unknown;
      createdAt: string;
      failedReason: string | null;
    }>('GET', `/api/tasks/${taskId}`, token);

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}`);
    }

    pass(`taskId:      ${data.taskId}`);
    pass(`type:        ${data.type}`);
    pass(`status:      ${data.status}`);
    pass(`progress:    ${JSON.stringify(data.progress)}`);
    pass(`createdAt:   ${data.createdAt}`);

    if (data.failedReason) {
      fail(`failedReason: ${data.failedReason}`);
    }
  });

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const total  = results.length;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(BOLD(`Results: ${passed}/${total} passed`));

  for (const r of results) {
    const icon = r.ok ? GREEN('✓') : RED('✗');
    const detail = !r.ok && r.detail ? ` — ${r.detail}` : '';
    console.log(`  ${icon} ${r.name}${detail}`);
  }

  if (passed < total) {
    console.log(`\n${RED('Some steps failed.')}`);
    console.log(DIM('Make sure the server is running:'));
    console.log(DIM('  docker compose up -d redis'));
    console.log(DIM('  pnpm --filter @my-agent/server dev'));
    process.exit(1);
  }

  console.log(`\n${GREEN('All steps passed!')}`);
}

main().catch((err) => {
  console.error(RED(`\nFatal: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
