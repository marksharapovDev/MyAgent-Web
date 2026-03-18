# 01 — Архитектура

## Файловая структура (monorepo)

```
my-agent/
├── package.json                  # pnpm workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── docker-compose.yml
│
├── docs/                         # Документация агента (эти файлы)
│   ├── OVERVIEW.md
│   ├── 01-architecture.md
│   ├── 02-prompts.md
│   ├── 03-telegram-ux.md
│   ├── 04-design-pipeline.md
│   ├── 05-autopilot.md
│   └── 06-backend.md
│
├── packages/
│   ├── core/                     # Мозг агента
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── claude-client.ts      # Обёртка Claude API (Sonnet/Opus)
│   │   │   ├── task-router.ts        # Классификация задач
│   │   │   ├── context-manager.ts    # Сборка контекста для промптов
│   │   │   ├── discussion/
│   │   │   │   ├── session.ts            # DiscussionSession
│   │   │   │   ├── cache.ts             # Локальный кэш диалога (Redis)
│   │   │   │   └── crystallizer.ts      # Сжатие диалога в ТЗ
│   │   │   ├── planner/
│   │   │   │   ├── project-planner.ts   # Создание плана из ТЗ
│   │   │   │   ├── autopilot.ts         # Выполнение плана
│   │   │   │   ├── checkpoint.ts        # Логика чекпоинтов
│   │   │   │   └── plan-modifier.ts     # Изменение плана на лету
│   │   │   ├── pipelines/
│   │   │   │   ├── design.pipeline.ts   # HTML генерация + Puppeteer
│   │   │   │   ├── code.pipeline.ts     # Генерация кода + Git
│   │   │   │   └── deploy.pipeline.ts   # Деплой Vercel / VPS
│   │   │   ├── prompts/
│   │   │   │   ├── system.ts            # Базовый системный промпт
│   │   │   │   ├── discussion.ts        # Фаза обсуждения
│   │   │   │   ├── crystallizer.ts      # Сжатие в ТЗ
│   │   │   │   ├── planner.ts           # Создание плана проекта
│   │   │   │   ├── autopilot.ts         # Управление автопилотом
│   │   │   │   ├── design.ts            # Генерация дизайна
│   │   │   │   ├── design-feedback.ts   # Цикл правок дизайна
│   │   │   │   ├── code.ts              # Генерация кода
│   │   │   │   ├── deploy.ts            # Деплой
│   │   │   │   └── router.ts            # Классификация задач
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── tools/                    # Интеграции
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── git.tool.ts           # simple-git
│   │   │   ├── vercel.tool.ts        # Vercel API
│   │   │   ├── puppeteer.tool.ts     # Headless Chrome → скриншоты
│   │   │   ├── supabase.tool.ts      # Supabase CRUD
│   │   │   ├── filesystem.tool.ts    # Чтение/запись файлов
│   │   │   ├── vps.tool.ts           # SSH-деплой
│   │   │   └── stt.tool.ts           # Speech-to-Text (Deepgram)
│   │   └── package.json
│   │
│   └── shared/                   # Общие типы и утилиты
│       ├── src/
│       │   ├── types/
│       │   │   ├── task.ts           # Task, TaskStatus, TaskType
│       │   │   ├── project.ts        # Project, ProjectConfig
│       │   │   ├── plan.ts           # ProjectPlan, Phase, PlanTask
│       │   │   ├── message.ts        # Message (unified)
│       │   │   └── design.ts         # DesignRequest, DesignResult
│       │   ├── validation/
│       │   │   └── schemas.ts        # Zod-схемы
│       │   └── utils/
│       │       ├── logger.ts
│       │       └── retry.ts
│       └── package.json
│
├── apps/
│   ├── server/                   # API-сервер
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── plans.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── ws/
│   │   │   │   └── handler.ts        # WebSocket (Desktop)
│   │   │   ├── queue/
│   │   │   │   └── index.ts          # BullMQ setup
│   │   │   ├── workers/
│   │   │   │   └── index.ts          # Design/Code/Deploy workers
│   │   │   ├── services/
│   │   │   │   └── notifier.ts       # Telegram + Desktop уведомления
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       ├── rate-limiter.ts
│   │   │       └── error.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── telegram/                 # Telegram-бот
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── bot.ts               # grammY init
│   │   │   ├── handlers/
│   │   │   │   ├── message.ts
│   │   │   │   ├── voice.ts          # Голосовые → STT → текст
│   │   │   │   ├── photo.ts          # Референсы
│   │   │   │   ├── commands.ts        # /project /new /status /deploy /plan и др.
│   │   │   │   └── callback.ts        # Inline-кнопки
│   │   │   ├── keyboards/
│   │   │   │   └── inline.ts
│   │   │   └── state/
│   │   │       └── machine.ts         # State machine бота
│   │   └── package.json
│   │
│   └── desktop/                  # Electron (неделя 4)
│       ├── src/
│       │   ├── main/
│       │   │   └── index.ts
│       │   └── renderer/
│       │       ├── App.tsx
│       │       ├── pages/
│       │       │   ├── Chat.tsx
│       │       │   ├── Projects.tsx
│       │       │   └── Design.tsx
│       │       └── components/
│       │           ├── MessageBubble.tsx
│       │           ├── ProjectCard.tsx
│       │           ├── VoiceInput.tsx
│       │           └── DictationOverlay.tsx
│       ├── electron-builder.yml
│       └── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_projects.sql
│   │   ├── 002_tasks.sql
│   │   ├── 003_context_docs.sql
│   │   ├── 004_design_versions.sql
│   │   ├── 005_conversation_history.sql
│   │   └── 006_project_plans.sql
│   └── seed.sql
│
└── config/
    ├── eslint.config.js
    └── tsconfig.json
```

---

## Схема базы данных

### projects
```sql
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'active',       -- active | paused | completed
  stack       JSONB DEFAULT '{}',          -- {"framework":"next","css":"tailwind",...}
  repo_url    TEXT,
  vercel_id   TEXT,
  vps_config  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### context_docs
```sql
CREATE TABLE context_docs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL,                -- brief | styleguide | architecture | notes
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536),                -- pgvector для семантического поиска
  version     INT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### tasks
```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id),
  plan_task_id  TEXT,                       -- Ссылка на задачу в ProjectPlan
  type          TEXT NOT NULL,              -- design | code | deploy | general
  status        TEXT DEFAULT 'pending',     -- pending | running | review | done | failed
  priority      INT DEFAULT 0,
  input         JSONB NOT NULL,
  output        JSONB,
  source        TEXT DEFAULT 'telegram',
  claude_model  TEXT DEFAULT 'sonnet',
  tokens_used   INT DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
```

### design_versions
```sql
CREATE TABLE design_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES projects(id),
  version        INT NOT NULL,
  variant        INT DEFAULT 1,             -- для мульти-вариантности
  html_code      TEXT NOT NULL,
  screenshot_url TEXT,
  feedback       TEXT,
  status         TEXT DEFAULT 'pending',    -- pending | approved | rejected
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### conversation_history
```sql
CREATE TABLE conversation_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id),
  task_id     UUID REFERENCES tasks(id),
  role        TEXT NOT NULL,                -- user | assistant | system
  content     TEXT NOT NULL,
  source      TEXT DEFAULT 'telegram',
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### project_plans
```sql
CREATE TABLE project_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  version     INT NOT NULL DEFAULT 1,
  plan        JSONB NOT NULL,               -- Полная структура ProjectPlan
  status      TEXT DEFAULT 'active',        -- active | completed | archived
  mode        TEXT DEFAULT 'autopilot',     -- autopilot | detail
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## Переменные окружения (.env)

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ALLOWED_USERS=your_telegram_id

# Vercel
VERCEL_TOKEN=...
VERCEL_TEAM_ID=...

# VPS (клиентские сайты)
VPS_HOST=...
VPS_USER=...
VPS_SSH_KEY_PATH=...

# Voice / STT
DEEPGRAM_API_KEY=...

# Server
PORT=3001
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
NODE_ENV=development
```

---

## План реализации

### Неделя 1: Фундамент
- [ ] Monorepo (pnpm workspaces)
- [ ] packages/shared — типы, Zod-схемы
- [ ] packages/core — ClaudeClient, TaskRouter, ContextManager
- [ ] supabase/ — миграции, seed
- [ ] apps/server — Express + POST /tasks + health check
- [ ] Redis + BullMQ базовая очередь
- [ ] Тестирование через curl

### Неделя 2: Telegram + обсуждение
- [ ] apps/telegram — grammY, хэндлеры, state machine
- [ ] DiscussionSession + кэш в Redis
- [ ] TaskCrystallizer
- [ ] Голосовые сообщения (Deepgram)
- [ ] Inline-кнопки, основные команды
- [ ] Интеграция бота с сервером

### Неделя 3: Пайплайны + автопилот
- [ ] DesignPipeline — генерация + Puppeteer + скриншоты
- [ ] Мульти-вариантность дизайна
- [ ] CodePipeline — генерация + Git
- [ ] DeployPipeline — Vercel + VPS
- [ ] ProjectPlanner + AutoPilot (базовый)
- [ ] packages/tools — все интеграции
- [ ] Тестирование полного цикла

### Неделя 4: Desktop + продакшен
- [ ] apps/desktop — Electron скелет
- [ ] Чат + WebSocket
- [ ] Streaming диктовка (Deepgram)
- [ ] Панель проектов
- [ ] Docker-compose для production
- [ ] Деплой сервера + бота на VPS
