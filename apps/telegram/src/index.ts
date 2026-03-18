import { Bot } from 'grammy';
import { Redis } from 'ioredis';
import { createLogger } from '@my-agent/shared';
import { StateMachine } from './state/machine.js';
import { ApiClient } from './api/client.js';
import { DiscussionSession, DialogCache } from '@my-agent/core';
import { registerCommands } from './handlers/commands.js';
import { registerCallbacks } from './handlers/callback.js';
import { handleMessage } from './handlers/message.js';
import { handleVoice } from './handlers/voice.js';

const log = createLogger('telegram-bot');

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'];
if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');

const ALLOWED_USERS = (process.env['TELEGRAM_ALLOWED_USERS'] ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);

const redis = new Redis({
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: Number(process.env['REDIS_PORT'] ?? 6379),
  password: process.env['REDIS_PASSWORD'],
  lazyConnect: true,
});

const bot = new Bot(BOT_TOKEN);
const stateMachine = new StateMachine(redis);
const apiClient = new ApiClient();
const dialogCache = new DialogCache(redis);

function createSession(userId: number, projectId: string): DiscussionSession {
  return new DiscussionSession(userId, projectId, dialogCache);
}

// ── Allowed users filter ───────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userId)) {
    log.warn('Blocked unauthorized user', { userId });
    return; // silent ignore
  }
  await next();
});

// ── Commands ───────────────────────────────────────────────────────────────────
registerCommands(bot, stateMachine, apiClient);

// ── Callbacks ──────────────────────────────────────────────────────────────────
registerCallbacks(bot, stateMachine, apiClient);

// ── Messages ───────────────────────────────────────────────────────────────────
bot.on('message:text', async (ctx) => {
  await handleMessage(ctx, stateMachine, apiClient, createSession);
});

bot.on('message:voice', async (ctx) => {
  await handleVoice(ctx, stateMachine, createSession);
});

bot.on('message:photo', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const stateData = await stateMachine.get(userId);
  if (!stateData.projectId) {
    await ctx.reply('У тебя нет активного проекта.' );
    return;
  }
  // TODO Week 3: upload to Supabase Storage, pass URL to discussion
  await ctx.reply('📸 Фото получено. Передам в контекст задачи.');
});

// ── Error handler ──────────────────────────────────────────────────────────────
bot.catch((err) => {
  log.error('Bot error', { error: err.message, ctx: err.ctx?.update });
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await redis.connect();
  log.info('Redis connected');

  log.info('Starting bot with long polling', {
    allowedUsers: ALLOWED_USERS.length > 0 ? ALLOWED_USERS : 'all',
  });

  await bot.start({
    onStart: (info) => log.info('Bot started', { username: info.username }),
  });
}

main().catch((err) => {
  log.error('Fatal error', { err });
  process.exit(1);
});
