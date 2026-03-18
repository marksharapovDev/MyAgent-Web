# CLAUDE.md — Персональный AI-агент

## Что это за проект

Персональный AI-агент для веб-разработки. Telegram-бот + Desktop (Electron)
+ бэкенд-сервер. Помогает создавать сайты для малого бизнеса: дизайн → код → деплой.

## Документация

Полная архитектура, промпты, UX и технические решения описаны в `docs/`:

- `docs/OVERVIEW.md` — карта проекта, стек, стоимость
- `docs/01-architecture.md` — файловая структура, схема БД, план по неделям
- `docs/02-prompts.md` — все промпты агента (8 штук)
- `docs/03-telegram-ux.md` — команды, сценарии, state machine
- `docs/04-design-pipeline.md` — Puppeteer, скриншоты, цикл правок
- `docs/05-autopilot.md` — режимы работы, ProjectPlan, масштабирование
- `docs/06-backend.md` — Express, BullMQ, WebSocket, Docker

**Перед написанием кода — читай соответствующий doc-файл.**

## Стек

- Monorepo: pnpm workspaces
- Язык: TypeScript (strict)
- Бэкенд: Node.js + Express + BullMQ + Redis
- БД: Supabase (PostgreSQL + Storage)
- Telegram: grammY
- Desktop: Electron + React (позже)
- AI: Claude API (Anthropic)
- Дизайн: HTML/Tailwind → Puppeteer → скриншот
- Голос: Deepgram STT

## Структура monorepo

```
packages/core     — мозг агента (Claude API, pipelines, discussion, planner)
packages/tools    — интеграции (Git, Vercel, Puppeteer, Supabase, STT)
packages/shared   — типы, валидация, утилиты
apps/server       — Express API + WebSocket + BullMQ workers
apps/telegram     — Telegram-бот (grammY)
apps/desktop      — Electron (неделя 4)
supabase/         — миграции БД
```

## Конвенции

- TypeScript strict, no `any` (используй `unknown`)
- Именование файлов: kebab-case (claude-client.ts, design.pipeline.ts)
- Именование переменных/функций: camelCase
- Именование типов/интерфейсов: PascalCase
- Промпты хранятся в `packages/core/src/prompts/` как template literal функции
- Каждый tool в `packages/tools/` — класс с методами
- Логирование через `packages/shared/src/utils/logger.ts`
- Валидация входных данных через Zod
- Все API-ключи через process.env, никогда не хардкод

## Текущий этап

Неделя 1: Фундамент
- Инициализация monorepo
- packages/shared (типы)
- packages/core (ClaudeClient, TaskRouter)
- supabase миграции
- apps/server (базовый Express)
