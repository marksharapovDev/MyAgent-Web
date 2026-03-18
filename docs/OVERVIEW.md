# Персональный AI-агент — обзор проекта

## Что это

Персональный AI-агент для веб-разработки. Помогает создавать сайты
для малого и среднего бизнеса — от дизайна до деплоя.

Два интерфейса: Telegram-бот (мобильный, быстрый) и Desktop-приложение
(полноценное управление). Оба подключены к одному серверу-мозгу.

## Стек

- **Мозг**: Claude API (Sonnet для быстрых задач, Opus для сложных)
- **Бэкенд**: Node.js + Express + BullMQ + Redis
- **БД**: Supabase (PostgreSQL + Storage + Realtime)
- **Telegram**: grammY
- **Desktop**: Electron + React (неделя 4)
- **Дизайн**: Claude генерирует HTML/Tailwind → Puppeteer → скриншот
- **Голос**: Deepgram (STT для Telegram и Desktop)
- **Деплой агента**: зарубежный VPS (EU)
- **Деплой клиентских сайтов**: Vercel (preview) + российский VPS (production)
- **Клиентский стек**: Next.js (TS) + Tailwind + Supabase (варьируется)

## Как всё связано

```
Telegram ──→ ┐
              ├──→ Express API + WebSocket ──→ BullMQ Queue ──→ Workers
Desktop ───→ ┘          │                                        │
                         │                                   ┌───┴───┐
                    DiscussionSession                   Design  Code  Deploy
                    ProjectPlanner                      │       │      │
                    AutoPilot                       Puppeteer  Git   Vercel
                         │                              │       │    SSH
                    Claude API                     Screenshot  Commit Deploy
                         │
                      Supabase
                    (БД + Storage)
```

## Ключевые концепции

### Двухфазная обработка задач
1. **Discussion** — обсуждение деталей, уточняющие вопросы
2. **Execution** — выполнение кристаллизованного ТЗ

### Два режима работы
- **Автопилот** — большие куски работы, редкие чекины (каждые 30-60 мин)
- **Детальный** — каждый шаг с подтверждением

Переключение: `/autopilot` и `/detail` в любой момент.

### Жизненный цикл проекта
0. Создание проекта (ТЗ от клиента)
1. Планирование → ProjectPlan с этапами
2. Дизайн → варианты → правки → одобрение
3. Разработка → компоненты → логика → интеграции
4. Деплой → Vercel preview → VPS production
5. Поддержка → баги, доработки

### Гибкость
План можно менять на ходу. Нет жёсткой структуры —
всё решается по конкретному проекту.

## Документация (этот набор файлов)

| Файл | Что внутри |
|------|-----------|
| **OVERVIEW.md** (этот файл) | Карта проекта, как всё связано |
| **01-architecture.md** | Файловая структура, схема БД, .env, план по неделям |
| **02-prompts.md** | Все промпты агента (system, discussion, crystallizer, pipelines) |
| **03-telegram-ux.md** | Команды бота, сценарии, state machine, клавиатуры |
| **04-design-pipeline.md** | Puppeteer, скриншоты, цикл правок, мульти-варианты |
| **05-autopilot.md** | Режимы работы, ProjectPlan, масштабирование |
| **06-backend.md** | Express, API, BullMQ, WebSocket, Docker |

## С чего начать разработку

1. Прочитай **01-architecture.md** — пойми структуру
2. Создай monorepo, настрой pnpm workspaces
3. Начни с **packages/shared** (типы) → **packages/core** (ClaudeClient, TaskRouter)
4. Подними Redis + Supabase → **apps/server** (базовый API)
5. Подключи Telegram → **apps/telegram**
6. Реализуй Design Pipeline → протестируй полный цикл
7. Добавь AutoPilot и ProjectPlanner
8. Desktop — последним

## Стоимость (оценка)

| Компонент | $/мес |
|-----------|-------|
| VPS для агента (EU, 2-4GB) | $10-20 |
| Supabase (Free → Pro) | $0-25 |
| Claude API | $30-80 |
| Vercel Pro | $20 |
| Deepgram | $2-5 |
| **Итого** | **$62-150** |
