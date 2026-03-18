# Бэкенд — сервер, API, очередь задач

---

## Обзор

Один Express-сервер обрабатывает всё:
- REST API для Telegram-бота и Desktop
- WebSocket для real-time общения с Desktop
- BullMQ воркеры для фонового выполнения задач
- Cron для периодических задач (чистка, мониторинг)

Всё запускается одним `node dist/index.js` (или в Docker).

---

## Точка входа

```typescript
// apps/server/src/index.ts

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initQueue } from './queue';
import { initWorkers } from './workers';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { rateLimiter } from './middleware/rate-limiter';
import { taskRoutes } from './routes/tasks';
import { projectRoutes } from './routes/projects';
import { webhookRoutes } from './routes/webhooks';
import { planRoutes } from './routes/plans';
import { wsHandler } from './ws/handler';

const app = express();
const server = createServer(app);

// WebSocket для Desktop
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', wsHandler);

// Middleware
app.use(express.json({ limit: '10mb' })); // для скриншотов/файлов
app.use(rateLimiter);
app.use(authMiddleware);

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/plans', planRoutes);
app.use('/webhooks', webhookRoutes); // без auth — свои секреты

// Error handler (последний)
app.use(errorHandler);

// Инициализация очереди и воркеров
await initQueue();
await initWorkers();

server.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`);
});
```

---

## REST API — эндпоинты

### Tasks

```
POST   /api/tasks              — создать задачу (из TG-бота или Desktop)
GET    /api/tasks/:id          — статус задачи
GET    /api/tasks?project_id=  — список задач проекта
POST   /api/tasks/:id/feedback — отправить правки к результату
POST   /api/tasks/:id/approve  — одобрить результат
POST   /api/tasks/:id/cancel   — отменить задачу
```

```typescript
// apps/server/src/routes/tasks.ts

router.post('/', async (req, res) => {
  const { projectId, message, source, attachments } = req.body;

  // 1. Определяем: это новое сообщение или продолжение сессии?
  const session = await discussionManager.getOrCreate(
    req.userId,
    projectId
  );

  // 2. Если есть голосовое — транскрибируем
  let textMessage = message;
  if (attachments?.voice) {
    textMessage = await sttTool.transcribe(attachments.voice);
  }

  // 3. Обрабатываем через DiscussionSession
  const response = await session.handleMessage(textMessage);

  // 4. Если задача кристаллизована и подтверждена
  if (response.readyToExecute && req.body.confirmed) {
    const crystallized = await session.crystallize();

    // Добавляем в очередь
    const job = await taskQueue.add(crystallized.type, {
      task: crystallized,
      projectId,
      source,
    }, {
      priority: crystallized.execution.estimated_complexity === 'high' ? 1 : 2,
    });

    return res.json({
      status: 'queued',
      taskId: job.id,
      message: response.text,
    });
  }

  // 5. Иначе — возвращаем ответ обсуждения
  return res.json({
    status: 'discussing',
    message: response.text,
    metadata: response.metadata,
  });
});

router.post('/:id/feedback', async (req, res) => {
  const { feedback } = req.body;
  const taskId = req.params.id;

  // Определяем тип задачи и вызываем нужный обработчик
  const task = await db.from('tasks').select().eq('id', taskId).single();

  if (task.type === 'design') {
    // Добавляем правки в очередь с высоким приоритетом
    await taskQueue.add('design-revision', {
      taskId,
      feedback,
    }, { priority: 1 }); // правки = высокий приоритет
  }

  res.json({ status: 'revision_queued' });
});
```

### Projects

```
POST   /api/projects           — создать проект
GET    /api/projects           — список проектов
GET    /api/projects/:id       — детали проекта
PUT    /api/projects/:id       — обновить проект
DELETE /api/projects/:id       — удалить (soft delete)
GET    /api/projects/:id/docs  — документация проекта
PUT    /api/projects/:id/docs  — обновить документацию
```

### Plans

```
POST   /api/plans              — создать план проекта
GET    /api/plans/:id          — текущий план
PUT    /api/plans/:id          — обновить план
POST   /api/plans/:id/start    — запустить автопилот
POST   /api/plans/:id/pause    — пауза
POST   /api/plans/:id/resume   — возобновить
PUT    /api/plans/:id/mode     — переключить autopilot/detail
```

### Webhooks (без auth, с верификацией секрета)

```
POST   /webhooks/vercel        — Vercel deployment events
POST   /webhooks/github        — GitHub push/PR events
```

```typescript
// apps/server/src/routes/webhooks.ts

router.post('/vercel', async (req, res) => {
  // Верифицируем подпись
  if (!verifyVercelSignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const { type, payload } = req.body;

  if (type === 'deployment.succeeded') {
    // Уведомляем пользователя
    await notifier.send({
      message: `🚀 Деплой завершён: ${payload.url}`,
      url: payload.url,
    });
  }

  if (type === 'deployment.failed') {
    await notifier.send({
      message: `❌ Деплой провалился: ${payload.error}`,
      error: payload.error,
    });
  }

  res.status(200).send('ok');
});
```

---

## WebSocket — real-time для Desktop

```typescript
// apps/server/src/ws/handler.ts

import { WebSocket } from 'ws';

interface WSClient {
  ws: WebSocket;
  userId: string;
  projectId?: string;
}

const clients = new Map<string, WSClient>();

export function wsHandler(ws: WebSocket, req: any) {
  // Авторизация через query параметр
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  const userId = verifyJWT(token);
  if (!userId) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  clients.set(userId, { ws, userId });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());

    switch (msg.type) {
      case 'message':
        // Обработка сообщения (аналогично POST /api/tasks)
        const response = await handleMessage(userId, msg);
        ws.send(JSON.stringify(response));
        break;

      case 'select_project':
        clients.get(userId)!.projectId = msg.projectId;
        break;

      case 'set_mode':
        await autopilot.setMode(msg.planId, msg.mode);
        break;

      case 'voice_chunk':
        // Streaming audio для real-time диктовки
        // Перенаправляем в Deepgram WebSocket
        await sttStream.sendChunk(userId, msg.audio);
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
  });
}

// Функция для отправки уведомлений в Desktop
export function sendToDesktop(userId: string, data: any) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}
```

**Типы WebSocket-сообщений (сервер → клиент):**

```typescript
type WSServerMessage =
  | { type: 'discussion_response'; text: string; metadata: any }
  | { type: 'task_started'; taskId: string; title: string }
  | { type: 'task_progress'; taskId: string; progress: number; status: string }
  | { type: 'design_ready'; taskId: string; screenshots: { desktop: string; mobile: string }; htmlCode: string }
  | { type: 'code_ready'; taskId: string; files: FileChange[]; diff: string }
  | { type: 'deploy_ready'; taskId: string; url: string }
  | { type: 'error'; taskId: string; error: string }
  | { type: 'plan_update'; plan: ProjectPlan }
  | { type: 'stt_transcript'; text: string; isFinal: boolean }  // streaming диктовка
```

---

## Очередь задач — BullMQ

BullMQ работает поверх Redis. Каждый тип задачи — отдельная очередь
с отдельным воркером.

### Почему BullMQ, а не просто Supabase?

- **Приоритеты**: правки к дизайну важнее нового дизайна
- **Ретраи**: если Claude API упал — повторить через 30 сек
- **Прогресс**: воркер может сообщать % выполнения
- **Таймауты**: если задача висит > 5 мин — отменить
- **Concurrency**: не больше 1 задачи одновременно (MVP)

```typescript
// apps/server/src/queue/index.ts

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Основная очередь задач
export const taskQueue = new Queue('tasks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,             // 3 попытки
    backoff: {
      type: 'exponential',
      delay: 5000,           // 5 → 10 → 20 сек между попытками
    },
    timeout: 300000,          // 5 минут максимум на задачу
    removeOnComplete: 100,    // Хранить 100 последних
    removeOnFail: 50,
  },
});

// Слушаем события для уведомлений
const queueEvents = new QueueEvents('tasks', { connection: redis });

queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  const job = await taskQueue.getJob(jobId);
  if (!job) return;

  // Уведомляем через Telegram или Desktop
  await notifier.taskCompleted(job.data, JSON.parse(returnvalue));
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  const job = await taskQueue.getJob(jobId);
  if (!job) return;

  await notifier.taskFailed(job.data, failedReason);
});

queueEvents.on('progress', async ({ jobId, data }) => {
  const job = await taskQueue.getJob(jobId);
  if (!job) return;

  // Отправляем прогресс в Desktop через WebSocket
  sendToDesktop(job.data.userId, {
    type: 'task_progress',
    taskId: jobId,
    progress: data,
  });
});
```

### Воркеры

```typescript
// apps/server/src/workers/index.ts

import { Worker } from 'bullmq';

export async function initWorkers() {
  // Design воркер
  const designWorker = new Worker('tasks', async (job) => {
    if (job.name !== 'design' && job.name !== 'design-revision') return;

    if (job.name === 'design') {
      await job.updateProgress(10);

      // 1. Сборка контекста
      const context = await buildDesignContext(job.data.projectId, job.data.task);
      await job.updateProgress(20);

      // 2. Генерация (возможно несколько вариантов)
      const variants = job.data.task.variants || 1;
      const results = [];

      for (let i = 0; i < variants; i++) {
        const code = await generateDesign(context, i);
        await job.updateProgress(20 + (50 / variants) * (i + 1));

        // 3. Обёртка + скриншот
        const html = wrapInHTML(code, context.styleguide);
        const screenshots = await puppeteer.screenshot(html);
        await job.updateProgress(70 + (20 / variants) * (i + 1));

        // 4. Сохранение
        const urls = await saveScreenshots(screenshots, job.data);
        results.push({ code, screenshots: urls, variant: i + 1 });
      }

      // 5. Сохранение версий в БД
      for (const result of results) {
        await db.from('design_versions').insert({
          task_id: job.id,
          project_id: job.data.projectId,
          version: 1,
          html_code: result.code,
          screenshot_url: result.screenshots.desktop,
          status: 'pending',
        });
      }

      await job.updateProgress(100);
      return { type: 'design', variants: results };
    }

    if (job.name === 'design-revision') {
      // Правки — быстрый путь
      const { taskId, feedback } = job.data;
      await handleDesignFeedback(taskId, feedback);
      return { type: 'design_revision', taskId };
    }
  }, {
    connection: redis,
    concurrency: 1,  // Одна задача за раз (MVP)
    limiter: {
      max: 10,       // Не больше 10 задач в минуту
      duration: 60000,
    },
  });

  // Code воркер
  const codeWorker = new Worker('tasks', async (job) => {
    if (job.name !== 'code') return;

    await job.updateProgress(10);
    const context = await buildCodeContext(job.data.projectId, job.data.task);

    await job.updateProgress(30);
    const result = await generateCode(context);

    await job.updateProgress(60);

    // Записываем файлы + коммит
    for (const file of result.files) {
      await fs.writeFile(file.path, file.content);
    }

    await job.updateProgress(80);

    // Git operations
    await git.add(context.repoPath, '.');
    await git.commit(context.repoPath, result.git.commit_message);
    await git.push(context.repoPath);

    await job.updateProgress(100);
    return { type: 'code', files: result.files, git: result.git };
  }, {
    connection: redis,
    concurrency: 1,
  });

  // Deploy воркер
  const deployWorker = new Worker('tasks', async (job) => {
    if (job.name !== 'deploy') return;

    const { target, projectId } = job.data;

    if (target === 'vercel') {
      await job.updateProgress(20);
      const deployment = await vercelTool.deploy(projectId);
      await job.updateProgress(100);
      return { type: 'deploy', url: deployment.url };
    }

    if (target === 'vps') {
      await job.updateProgress(10);
      await vpsTool.backup(projectId);       // бэкап
      await job.updateProgress(30);
      await vpsTool.build(projectId);        // next build
      await job.updateProgress(60);
      await vpsTool.upload(projectId);       // scp
      await job.updateProgress(80);
      await vpsTool.restart(projectId);      // pm2 restart
      await job.updateProgress(90);
      const healthy = await vpsTool.healthCheck(projectId);
      if (!healthy) {
        await vpsTool.rollback(projectId);
        throw new Error('Health check failed, rolled back');
      }
      await job.updateProgress(100);
      return { type: 'deploy', target: 'vps', healthy: true };
    }
  }, {
    connection: redis,
    concurrency: 1,
  });

  return { designWorker, codeWorker, deployWorker };
}
```

---

## Notifier — единая система уведомлений

```typescript
// apps/server/src/services/notifier.ts

class Notifier {
  // Отправляет уведомление в нужный канал
  // на основе source задачи (telegram / desktop)
  async send(userId: string, source: string, message: NotificationPayload) {
    if (source === 'telegram') {
      await this.sendTelegram(userId, message);
    }

    // Desktop получает ВСЕГДА (если подключен) — дублируем
    this.sendDesktop(userId, message);
  }

  private async sendTelegram(userId: string, msg: NotificationPayload) {
    if (msg.screenshots) {
      // Отправляем медиагруппу (desktop + mobile скриншоты)
      await telegramBot.sendMediaGroup(userId, [
        { type: 'photo', media: msg.screenshots.desktop, caption: '🖥 Desktop' },
        { type: 'photo', media: msg.screenshots.mobile, caption: '📱 Mobile' },
      ]);
    }

    await telegramBot.sendMessage(userId, msg.text, {
      reply_markup: msg.keyboard || undefined,
    });
  }

  private sendDesktop(userId: string, msg: NotificationPayload) {
    sendToDesktop(userId, {
      type: 'notification',
      ...msg,
    });
  }

  // Шорткаты
  async taskCompleted(jobData: any, result: any) { /* ... */ }
  async taskFailed(jobData: any, error: string) { /* ... */ }
  async planPhaseCompleted(plan: ProjectPlan, phase: Phase) { /* ... */ }
}

export const notifier = new Notifier();
```

---

## Auth middleware

```typescript
// apps/server/src/middleware/auth.ts

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Вебхуки имеют свою авторизацию
  if (req.path.startsWith('/webhooks')) return next();

  // Health check
  if (req.path === '/health') return next();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

**Для MVP: один пользователь (ты).**
JWT генерируется один раз через CLI-скрипт и хранится
в .env Desktop-приложения и Telegram-бота.

```typescript
// scripts/generate-token.ts
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: 'your-uuid-here' },
  process.env.JWT_SECRET!,
  { expiresIn: '365d' } // на год, ты один пользователь
);
console.log('Your token:', token);
```

---

## Rate Limiter

```typescript
// apps/server/src/middleware/rate-limiter.ts

import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30,             // 30 запросов в минуту (щедро для одного пользователя)
  message: { error: 'Too many requests' },
  skip: (req) => req.path.startsWith('/webhooks'),
});
```

---

## Error Handler

```typescript
// apps/server/src/middleware/error.ts

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack);

  // Claude API ошибки
  if (err.message.includes('anthropic')) {
    return res.status(502).json({
      error: 'AI service unavailable',
      retry: true,
    });
  }

  // Supabase ошибки
  if (err.message.includes('supabase')) {
    return res.status(503).json({
      error: 'Database error',
      retry: true,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
```

---

## Docker Compose (локальная разработка)

```yaml
# docker-compose.yml

version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=development
    env_file:
      - .env
    depends_on:
      - redis
    volumes:
      - ./projects:/app/projects  # Клонированные репозитории

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  telegram-bot:
    build:
      context: .
      dockerfile: apps/telegram/Dockerfile
    env_file:
      - .env
    depends_on:
      - server

volumes:
  redis-data:
```

---

## Мониторинг и health check

```typescript
// apps/server/src/routes/health.ts

router.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    redis: 'unknown',
    supabase: 'unknown',
    claude: 'unknown',
    puppeteer: 'unknown',
  };

  // Redis
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch { checks.redis = 'error'; }

  // Supabase
  try {
    await db.from('projects').select('id').limit(1);
    checks.supabase = 'ok';
  } catch { checks.supabase = 'error'; }

  // Claude API (кэшируем, не проверяем каждый раз)
  checks.claude = claudeHealthCache.isHealthy ? 'ok' : 'error';

  // Puppeteer
  checks.puppeteer = puppeteerPool.isReady ? 'ok' : 'error';

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json(checks);
});
```

---

## Сводка: что запускается на сервере

| Процесс | Порт | Описание |
|---------|------|----------|
| Express + WS | 3001 | API-сервер + WebSocket |
| Redis | 6379 | Очередь задач + кэш сессий |
| Puppeteer | — | Headless Chrome (в том же процессе) |
| Telegram bot | — | Long polling (в том же процессе или отдельный) |

**Требования к VPS:**
- 2-4 GB RAM (Puppeteer ест ~500MB)
- 2 vCPU
- 20 GB SSD
- Ubuntu 22/24
- Стоимость: $10-20/мес (Hetzner, DigitalOcean, Contabo)
