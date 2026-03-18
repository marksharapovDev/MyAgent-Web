# Design Pipeline — техническая реализация

## Обзор

Весь пайплайн: кристаллизованное ТЗ → код → HTML-обёртка → Puppeteer → скриншот → отправка.
Время: 30-60 секунд от задачи до скриншота в Telegram.

---

## Шаг 1: Сборка контекста

ContextManager загружает из Supabase только то, что нужно для дизайна:

```typescript
// packages/core/src/context-manager.ts

async function buildDesignContext(projectId: string, task: CrystallizedTask): Promise<DesignContext> {
  // 1. Бриф проекта (название, описание, целевая аудитория)
  const brief = await db
    .from('context_docs')
    .select('content')
    .eq('project_id', projectId)
    .eq('doc_type', 'brief')
    .single();

  // 2. Стилегайд (цвета, шрифты, настроение)
  const styleguide = await db
    .from('context_docs')
    .select('content')
    .eq('project_id', projectId)
    .eq('doc_type', 'styleguide')
    .single();

  // 3. Список существующих страниц (для консистентности header/footer)
  const existingPages = await db
    .from('context_docs')
    .select('title, content')
    .eq('project_id', projectId)
    .eq('doc_type', 'architecture');

  // 4. Если есть референс-фото — URL из Supabase Storage
  const references = task.requirements
    .filter(r => r.includes('http') || r.includes('reference'));

  return {
    brief: brief?.content || '',
    styleguide: styleguide?.content || '',
    existingPages: existingPages?.map(p => p.content).join('\n---\n') || '',
    references,
    task,
  };
}
```

**Что попадает в контекст (пример):**

```
Бриф: Пекарня "Хлеб&Соль", крафтовый хлеб и выпечка.
Адрес: ул. Пушкина 15, Москва. Тел: +7 (999) 123-45-67
Целевая: 25-45 лет, ценят натуральность и качество.

Стилегайд:
- Шрифт заголовков: Playfair Display
- Шрифт текста: Inter
- Основной цвет: #2D1810 (тёмно-коричневый)
- Фон: #F5F0EB (тёплый беж)
- Акцент: #1B4332 (тёмно-зелёный)
- Настроение: тёплый, уютный, крафтовый

Существующие страницы:
- Главная: hero + о нас + популярные товары + отзывы
- О нас: история + команда + ценности
```

---

## Шаг 2: Claude генерирует React/HTML

```typescript
// packages/core/src/pipelines/design.pipeline.ts

async function generateDesign(context: DesignContext): Promise<string> {
  const prompt = buildDesignPrompt(context);

  // Выбор модели: Opus для сложных лейаутов, Sonnet для простых
  const model = context.task.execution.estimated_complexity === 'high'
    ? 'claude-opus-4-20250514'
    : 'claude-sonnet-4-20250514';

  const response = await claude.call(model, {
    system: DESIGN_SYSTEM_PROMPT,  // Промпт из agent-prompts.md (5a)
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
  });

  // Извлекаем код из ответа (между ```tsx и ```)
  const code = extractCodeBlock(response.content);

  return code;
}
```

**Что Claude генерирует (пример):**

```tsx
export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {/* Header — точная копия с главной */}
      <header className="bg-[#2D1810] text-white py-4">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <h1 className="font-['Playfair_Display'] text-2xl">Хлеб&Соль</h1>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="/" className="hover:text-[#F5F0EB]/80">Главная</a>
            <a href="/about" className="hover:text-[#F5F0EB]/80">О нас</a>
            <a href="/catalog" className="hover:text-[#F5F0EB]/80">Каталог</a>
            <a href="/contacts" className="text-[#F5F0EB] font-medium">Контакты</a>
          </nav>
        </div>
      </header>

      {/* Контент */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="font-['Playfair_Display'] text-4xl text-[#2D1810] mb-8">
          Контакты
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Карта */}
          <div className="bg-gray-200 rounded-xl h-[400px] flex items-center
                          justify-center text-gray-500">
            Яндекс.Карта — ул. Пушкина 15
          </div>

          {/* Форма + инфо */}
          <div className="space-y-6">
            {/* Контактная информация */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-medium text-[#2D1810] mb-4">Как нас найти</h3>
              <p className="text-gray-600">ул. Пушкина 15, Москва</p>
              <p className="text-gray-600">+7 (999) 123-45-67</p>
              <p className="text-gray-600">hello@hlebisol.ru</p>
            </div>

            {/* Часы работы */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-medium text-[#2D1810] mb-4">Часы работы</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Пн — Пт</span><span>07:00 — 21:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Сб — Вс</span><span>08:00 — 20:00</span>
                </div>
              </div>
            </div>

            {/* Форма */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-medium text-[#2D1810] mb-4">Напишите нам</h3>
              <div className="space-y-3">
                <input placeholder="Ваше имя"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200
                             focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332]
                             outline-none transition" />
                <input placeholder="Email"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200
                             focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332]
                             outline-none transition" />
                <textarea placeholder="Сообщение" rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200
                             focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332]
                             outline-none transition resize-none" />
                <button className="w-full bg-[#1B4332] text-white py-2 rounded-lg
                                   hover:bg-[#1B4332]/90 transition font-medium">
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2D1810] text-white/70 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          © 2026 Хлеб&Соль. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
```

---

## Шаг 3: Сборка HTML-обёртки

Claude генерирует React-компонент, но Puppeteer рендерит обычный HTML.
Нужна обёртка, которая превращает компонент в полноценную HTML-страницу.

```typescript
// packages/tools/src/puppeteer.tool.ts

function wrapInHTML(reactCode: string, styleguide: StyleguideConfig): string {
  // Извлекаем шрифты из стилегайда
  const fonts = styleguide.fonts || ['Inter'];
  const googleFontsUrl = fonts
    .map(f => f.replace(' ', '+'))
    .join('&family=');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=${googleFontsUrl}&display=swap"
        rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['${fonts[0]}', 'system-ui', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${fonts[0]}', system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root">${convertReactToStaticHTML(reactCode)}</div>
</body>
</html>`;
}
```

**Важный нюанс: `convertReactToStaticHTML`.**
React-код с JSX нельзя напрямую вставить в HTML. Есть два подхода:

```typescript
// Подход A: Просить Claude генерировать чистый HTML (проще для MVP)
// В design prompt указываем: "Генерируй HTML с Tailwind, не React"

// Подход B: Рендерить React через ReactDOMServer (правильнее)
import { renderToStaticMarkup } from 'react-dom/server';
// Но это требует компиляции JSX → нужен esbuild/babel на сервере

// РЕКОМЕНДАЦИЯ для MVP: подход A (чистый HTML)
// Переключиться на B когда компоненты станут интерактивными
```

**Рекомендация для MVP:** просить Claude генерировать чистый HTML + Tailwind
вместо React JSX. Это убирает шаг компиляции и упрощает пайплайн.
В design prompt меняем "React functional component" на "HTML с Tailwind".
Когда дизайн одобрен — отдельным шагом конвертируем в React-компонент
для проекта.

---

## Шаг 4: Puppeteer рендерит скриншоты

```typescript
// packages/tools/src/puppeteer.tool.ts

import puppeteer, { Browser } from 'puppeteer';

class PuppeteerTool {
  private browser: Browser | null = null;

  // Один инстанс браузера — переиспользуется между задачами
  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',  // для Docker/VPS
          '--font-render-hinting=none', // чистый рендер шрифтов
        ],
      });
    }
    return this.browser;
  }

  async screenshot(html: string, options: ScreenshotOptions): Promise<ScreenshotResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Desktop скриншот
      await page.setViewport({ width: 1440, height: 900 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Ждём загрузки шрифтов
      await page.evaluate(() => document.fonts.ready);

      // Ждём загрузки изображений (если есть)
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
              img.onload = img.onerror = resolve;
            }))
        );
      });

      // Полная высота страницы (не только viewport)
      const desktopScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        encoding: 'binary',
      });

      // Mobile скриншот
      await page.setViewport({ width: 375, height: 812 });
      // Небольшая задержка для перестроения Tailwind responsive
      await new Promise(resolve => setTimeout(resolve, 500));

      const mobileScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        encoding: 'binary',
      });

      return { desktopScreenshot, mobileScreenshot };

    } finally {
      await page.close(); // Закрываем страницу, но не браузер
    }
  }
}
```

**Настройки для качественных скриншотов:**

```typescript
// Для Retina-качества (опционально, файлы будут в 2x тяжелее)
await page.setViewport({
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,  // 2x разрешение
});

// Для длинных страниц — ограничиваем высоту скриншота
const MAX_HEIGHT = 5000; // px
const body = await page.$('body');
const { height } = await body!.boundingBox()!;

if (height > MAX_HEIGHT) {
  // Делаем скриншот только первого экрана + уведомляем
  await page.screenshot({
    clip: { x: 0, y: 0, width: 1440, height: MAX_HEIGHT },
  });
  // + "Страница длиннее 5000px, показываю первую часть"
}
```

---

## Шаг 5: Сохранение и отправка

```typescript
// packages/core/src/pipelines/design.pipeline.ts

async function saveAndSend(
  screenshots: ScreenshotResult,
  task: Task,
  version: number,
  htmlCode: string,
): Promise<void> {

  // 1. Сохраняем скриншоты в Supabase Storage
  const desktopUrl = await supabase.storage
    .from('screenshots')
    .upload(
      `${task.project_id}/${task.id}/v${version}-desktop.png`,
      screenshots.desktopScreenshot,
      { contentType: 'image/png', upsert: true }
    );

  const mobileUrl = await supabase.storage
    .from('screenshots')
    .upload(
      `${task.project_id}/${task.id}/v${version}-mobile.png`,
      screenshots.mobileScreenshot,
      { contentType: 'image/png', upsert: true }
    );

  // 2. Сохраняем версию дизайна в БД
  await supabase.from('design_versions').insert({
    task_id: task.id,
    project_id: task.project_id,
    version,
    html_code: htmlCode,
    screenshot_url: desktopUrl.data?.path,
    status: 'pending',
  });

  // 3. Отправляем в Telegram (или Desktop через WebSocket)
  if (task.source === 'telegram') {
    await telegram.sendPhoto(task.user_id, desktopUrl.publicUrl, {
      caption: `🎨 Дизайн v${version} — Desktop (1440px)`,
    });
    await telegram.sendPhoto(task.user_id, mobileUrl.publicUrl, {
      caption: `📱 Mobile (375px)`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Отлично', callback_data: `design:approve:${task.id}` },
            { text: '✏️ Правки', callback_data: `design:revise:${task.id}` },
            { text: '🔄 С нуля', callback_data: `design:redo:${task.id}` },
          ]
        ]
      }
    });
  }

  if (task.source === 'desktop') {
    websocket.send(task.user_id, {
      type: 'design_ready',
      taskId: task.id,
      version,
      screenshots: {
        desktop: desktopUrl.publicUrl,
        mobile: mobileUrl.publicUrl,
      },
      htmlCode, // Desktop может показать live preview
    });
  }
}
```

---

## Шаг 6: Цикл правок

```typescript
// Когда пользователь нажимает "✏️ Правки" и отправляет текст/голос

async function handleDesignFeedback(
  taskId: string,
  feedback: string, // уже транскрибированный текст
): Promise<void> {

  // 1. Загружаем текущую версию
  const currentVersion = await supabase
    .from('design_versions')
    .select('*')
    .eq('task_id', taskId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  // 2. Сохраняем фидбек
  await supabase
    .from('design_versions')
    .update({
      feedback,
      status: 'rejected',
    })
    .eq('id', currentVersion.id);

  // 3. Claude модифицирует код (используем Design Feedback Prompt)
  const updatedCode = await claude.fast(
    buildFeedbackPrompt(currentVersion.html_code, feedback)
  );

  // 4. Повторяем шаги 3-5 (обёртка → скриншот → отправка)
  const html = wrapInHTML(updatedCode, styleguide);
  const screenshots = await puppeteer.screenshot(html);
  await saveAndSend(
    screenshots,
    task,
    currentVersion.version + 1,
    updatedCode
  );
}
```

**Правки быстрее первой генерации** (~20-30 сек вместо 30-60),
потому что Claude получает уже готовый код и точечный фидбек,
а не генерирует с нуля.

---

## Шаг 7: Финализация (одобрение)

```typescript
// Когда пользователь нажимает "✅ Отлично"

async function approveDesign(taskId: string): Promise<void> {

  // 1. Обновляем статус
  const approved = await supabase
    .from('design_versions')
    .update({ status: 'approved' })
    .eq('task_id', taskId)
    .order('version', { ascending: false })
    .limit(1)
    .select()
    .single();

  // 2. Конвертируем HTML → React-компонент (если нужно)
  const reactCode = await claude.fast(
    `Преобразуй этот HTML в React functional component с TypeScript.
     Сохрани все стили и структуру. Используй 'use client' если
     есть интерактивные элементы.

     ${approved.html_code}`
  );

  // 3. Сохраняем файл в проект через Git
  await git.checkout(project.repo_path, 'main');
  await git.createBranch(project.repo_path, `design/${task.slug}`);

  await fs.writeFile(
    `${project.repo_path}/app/${task.slug}/page.tsx`,
    reactCode
  );

  await git.add(project.repo_path, '.');
  await git.commit(
    project.repo_path,
    `feat: add ${task.title} page design`
  );
  await git.push(project.repo_path);

  // 4. Автоматический preview-деплой на Vercel
  // (Vercel подхватит пуш в ветку автоматически, если настроен)

  // 5. Обновляем задачу
  await supabase.from('tasks').update({
    status: 'done',
    output: {
      approved_version: approved.version,
      branch: `design/${task.slug}`,
      preview_url: `https://${project.slug}-git-design-${task.slug}.vercel.app`,
    },
    completed_at: new Date(),
  }).eq('id', taskId);

  // 6. Уведомляем
  await telegram.sendMessage(task.user_id,
    `✅ Дизайн «${task.title}» одобрен и сохранён!

     📁 Ветка: design/${task.slug}
     🔗 Preview: https://${project.slug}-git-design-${task.slug}.vercel.app

     Что дальше?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔀 Merge в main', callback_data: `git:merge:${taskId}` },
            { text: '🚀 Деплой', callback_data: `deploy:${project.id}` },
          ]
        ]
      }
    }
  );
}
```

---

## Оптимизация: Puppeteer pool

На VPS один инстанс Puppeteer может быть медленным.
Для ускорения — пул из 2-3 вкладок:

```typescript
class PuppeteerPool {
  private pages: Page[] = [];
  private available: Page[] = [];

  async init(poolSize: number = 2) {
    const browser = await puppeteer.launch({ /* ... */ });
    for (let i = 0; i < poolSize; i++) {
      const page = await browser.newPage();
      this.pages.push(page);
      this.available.push(page);
    }
  }

  async acquire(): Promise<Page> {
    if (this.available.length === 0) {
      // Ждём пока освободится
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (this.available.length > 0) {
            clearInterval(interval);
            resolve(this.available.pop()!);
          }
        }, 100);
      });
    }
    return this.available.pop()!;
  }

  release(page: Page) {
    this.available.push(page);
  }
}
```

---

## Docker-настройка для Puppeteer на VPS

```dockerfile
# Dockerfile.server
FROM node:20-slim

# Puppeteer зависимости
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Русские шрифты (важно для корректного рендера)
RUN apt-get update && apt-get install -y \
    fonts-noto-sans \
    fonts-noto-serif \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY . .
RUN npm ci --production

CMD ["node", "dist/index.js"]
```

---

## Сводка по файлам pipeline

| Файл | Ответственность |
|------|----------------|
| `design.pipeline.ts` | Оркестрация всего цикла |
| `context-manager.ts` | Сборка контекста из Supabase |
| `claude-client.ts` | Вызов Claude API |
| `puppeteer.tool.ts` | HTML → скриншоты |
| `supabase.tool.ts` | Сохранение скриншотов и версий |
| `git.tool.ts` | Коммит одобренного кода |
| `vercel.tool.ts` | Preview-деплой |

Весь pipeline — ~300 строк кода (без промптов).

---

## Большие задачи: TaskDecomposer

Когда задача сложная ("сделай весь сайт"), она не идёт напрямую
в один pipeline. Вместо этого — декомпозиция.

### Новые файлы в packages/core

```
packages/core/src/
  ├── decomposer/
  │   ├── task-decomposer.ts     # Разбивка на подзадачи
  │   ├── execution-plan.ts      # План выполнения с зависимостями
  │   └── plan-runner.ts         # Последовательное выполнение плана
  ├── monitoring/
  │   ├── stats-collector.ts     # Сбор статистики
  │   └── progress-tracker.ts    # Прогресс выполнения
```

### Как работает TaskDecomposer

```typescript
class TaskDecomposer {
  // Используем Opus — декомпозиция требует глубокого понимания
  async decompose(task: CrystallizedTask, context: ProjectContext): Promise<ExecutionPlan> {
    const response = await this.claude.deep(
      decomposerPrompt(task, context)
    );

    return response as ExecutionPlan;
  }
}

// Промпт для декомпозиции
const decomposerPrompt = (task, context) => `
Разбей эту задачу на последовательные подзадачи.

## Задача
${JSON.stringify(task)}

## Контекст проекта
${context}

## Правила декомпозиции

1. Каждая подзадача должна быть атомарной — один pipeline за раз
   (design ИЛИ code ИЛИ deploy, не всё вместе)

2. Порядок имеет значение — указывай зависимости.
   Стилегайд → Главная → Остальные страницы → Бэкенд → Деплой

3. Каждой подзадаче назначь checkpoint-тип:
   - "checkpoint" — агент останавливается и ждёт одобрения
     (для ключевых решений: стилегайд, первая страница, деплой на прод)
   - "auto" — выполняет и идёт дальше без остановки
     (для типовых задач после одобренного шаблона)

4. Для design-подзадач с типом "auto": агент использует
   одобренный стилегайд и одобренные страницы как референс,
   генерирует дизайн и сразу коммитит без ревью.
   Ты всегда можешь просмотреть и дать правки потом.

5. Оцени сложность и примерное время каждой подзадачи.

## Формат ответа (JSON)

{
  "plan_title": "Сайт для автосервиса «Молния»",
  "estimated_total_time": "2-3 часа",
  "estimated_total_cost": "$3-8",
  "subtasks": [
    {
      "order": 1,
      "title": "Стилегайд",
      "type": "design",
      "checkpoint": "checkpoint",
      "depends_on": [],
      "description": "Определить цвета, шрифты, стиль компонентов",
      "estimated_time": "5 мин",
      "estimated_cost": "$0.30"
    },
    {
      "order": 2,
      "title": "Главная страница",
      "type": "design",
      "checkpoint": "checkpoint",
      "depends_on": [1],
      "description": "Hero, услуги, преимущества, CTA",
      "estimated_time": "10 мин",
      "estimated_cost": "$0.50"
    },
    {
      "order": 3,
      "title": "Страница «О нас»",
      "type": "design",
      "checkpoint": "auto",
      "depends_on": [2],
      "description": "История, команда — по шаблону главной",
      "estimated_time": "5 мин",
      "estimated_cost": "$0.30"
    }
  ]
}
`;
```

### ExecutionPlan — выполнение плана

```typescript
class PlanRunner {
  async run(plan: ExecutionPlan): Promise<void> {
    // Сохраняем план в БД
    await this.savePlan(plan);

    for (const subtask of plan.subtasks) {
      // Проверяем зависимости
      const depsReady = await this.checkDependencies(subtask.depends_on);
      if (!depsReady) {
        throw new Error(`Dependencies not met for ${subtask.title}`);
      }

      // Обновляем прогресс
      await this.updateProgress(plan.id, subtask.order, 'running');
      await this.notify(`⏳ Выполняю: ${subtask.title} (${subtask.order}/${plan.subtasks.length})`);

      // Выполняем через соответствующий pipeline
      const result = await this.executePipeline(subtask);

      if (subtask.checkpoint === 'checkpoint') {
        // Останавливаемся и ждём одобрения
        await this.updateProgress(plan.id, subtask.order, 'review');
        await this.notifyWithResult(result, subtask);

        // Ждём callback от Telegram / Desktop
        const approval = await this.waitForApproval(subtask.id);

        if (approval.action === 'revise') {
          // Цикл правок — как обычно
          await this.handleRevisions(subtask, approval.feedback);
        } else if (approval.action === 'redo') {
          // Переделать подзадачу с нуля
          subtask.order--; // Повторяем текущий шаг
          continue;
        }
        // approval.action === 'approve' → продолжаем
      } else {
        // auto — просто логируем и идём дальше
        await this.updateProgress(plan.id, subtask.order, 'done');
        await this.notify(`✅ Автоматически: ${subtask.title}`);
      }
    }

    // План завершён
    await this.notify(`🎉 Все задачи выполнены! Итого: ${plan.subtasks.length} подзадач`);
  }
}
```

### Как это выглядит в Telegram

```
Ты:  "Сделай полный сайт для автосервиса Молния — 
      главная, услуги, прайс, контакты, запись на ТО"

      → Фаза обсуждения (уточнения)...
      → Подтверждение

Бот: "📋 Составил план из 8 подзадач:

      1. 🎨 Стилегайд — 5 мин ⏸ checkpoint
      2. 🎨 Главная — 10 мин ⏸ checkpoint
      3. 🎨 Услуги — 5 мин ▶️ auto
      4. 🎨 Прайс-лист — 5 мин ▶️ auto
      5. 🎨 Контакты — 5 мин ▶️ auto
      6. 💻 Supabase + форма записи — 15 мин ⏸ checkpoint
      7. 💻 SEO + метатеги — 5 мин ▶️ auto
      8. 🚀 Деплой на Vercel — 5 мин ⏸ checkpoint

      ⏱ Общее время: ~1 час
      💰 Примерная стоимость API: ~$4

      Начинаю?"

      [✅ Запустить план] [✏️ Изменить] [📋 Подробнее]

Ты:  ✅

      (агент работает, ты занимаешься своими делами)

Бот: "⏳ [1/8] Генерирую стилегайд..."

      (3 минуты)

Бот: [скриншот палитры и типографики]
      "🎨 Стилегайд готов. Цвета: синий + оранжевый,
      шрифт: Montserrat. Одобряешь?"

      [✅ Ок] [✏️ Правки]

Ты:  ✅

Бот: "⏳ [2/8] Генерирую главную страницу..."

      (5 минут — ты пьёшь кофе)

Бот: [скриншот desktop + mobile]
      "🎨 Главная готова. Одобряешь?"

      [✅ Ок] [✏️ Правки]

Ты:  ✅

Бот: "⏳ [3/8] Услуги — auto...
      ✅ [3/8] Услуги готовы
      ⏳ [4/8] Прайс — auto...
      ✅ [4/8] Прайс готов
      ⏳ [5/8] Контакты — auto...
      ✅ [5/8] Контакты готовы

      Три страницы сгенерированы автоматически 
      по одобренному стилю. Можешь посмотреть
      preview потом."

      (ты даже не заметил — ушло 10 минут)

Бот: "⏳ [6/8] Настраиваю Supabase + форму записи..."

      (10 минут)

Бот: "💻 Готово:
      • Таблица bookings в Supabase
      • Форма записи с валидацией
      • Email уведомление о новой записи

      Проверь preview: https://molniya-xxx.vercel.app/booking"

      [✅ Ок] [✏️ Правки]
```

---

## Мониторинг и статистика

### Новая таблица: execution_plans

```sql
CREATE TABLE execution_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id),
  title         TEXT NOT NULL,
  status        TEXT DEFAULT 'running',  -- running | paused | done | failed
  total_subtasks INT NOT NULL,
  completed      INT DEFAULT 0,
  total_tokens   INT DEFAULT 0,
  total_cost     DECIMAL(10,4) DEFAULT 0,
  total_time_ms  INT DEFAULT 0,          -- суммарное время выполнения
  plan_data      JSONB NOT NULL,         -- полный ExecutionPlan
  created_at     TIMESTAMPTZ DEFAULT now(),
  completed_at   TIMESTAMPTZ
);
```

### Новая таблица: task_stats (аналитика)

```sql
CREATE TABLE task_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES tasks(id),
  project_id    UUID REFERENCES projects(id),
  pipeline_type TEXT NOT NULL,           -- design | code | deploy
  model_used    TEXT NOT NULL,           -- sonnet | opus
  tokens_input  INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  cost_usd      DECIMAL(10,6) DEFAULT 0,
  duration_ms   INT DEFAULT 0,
  revision_count INT DEFAULT 0,         -- сколько раз были правки
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### Что ты видишь в статистике

```typescript
// Пример данных для dashboard

{
  // За текущий месяц
  "month": {
    "tasks_completed": 47,
    "total_cost": "$38.50",
    "time_saved_estimate": "~60 часов",  // грубая оценка
    "tokens_used": 2_400_000,
    "avg_revisions_per_design": 1.3,     // в среднем 1.3 итерации
    "most_expensive_task": "Каталог продукции ($2.10)",
  },

  // По проектам
  "projects": [
    {
      "name": "Хлеб&Соль",
      "tasks": 23,
      "cost": "$18.20",
      "status": "production",
      "pages_completed": 5,
    },
    {
      "name": "Автосервис Молния",
      "tasks": 24,
      "cost": "$20.30",
      "status": "development",
      "pages_completed": 8,
    }
  ],

  // Breakdown по типам
  "by_type": {
    "design": { "count": 28, "cost": "$22.00", "avg_time": "45 сек" },
    "code":   { "count": 15, "cost": "$12.00", "avg_time": "30 сек" },
    "deploy": { "count": 4,  "cost": "$4.50",  "avg_time": "60 сек" },
  }
}
```

### Telegram-команда /stats

```
Ты:  /stats

Бот: "📊 Статистика за март 2026

      Задач выполнено: 47
      💰 Потрачено на API: $38.50
      ⏱ Среднее время задачи: 42 сек
      🔄 Среднее кол-во правок: 1.3

      По проектам:
      • Хлеб&Соль: $18.20 (23 задачи)
      • Молния: $20.30 (24 задачи)

      [📈 Подробнее] [📅 За другой период]"
```

---

## Масштабирование — план роста

### v2 (месяцы 2-3): Очередь задач + параллелизм

MVP выполняет одну задачу за раз. Для v2:

```typescript
// Заменяем простой "while" на BullMQ
import { Queue, Worker } from 'bullmq';

const taskQueue = new Queue('tasks', { connection: redis });

// Worker обрабатывает задачи из очереди
const worker = new Worker('tasks', async (job) => {
  const { task, projectId } = job.data;
  await pipeline.execute(task, projectId);
}, {
  connection: redis,
  concurrency: 2,  // 2 задачи параллельно
});
```

Это позволяет:
- Выполнять auto-подзадачи параллельно (если нет зависимостей)
- Принимать новые задачи пока текущая выполняется
- Retry при ошибках
- Приоритизация (срочные задачи первыми)

### v3 (месяцы 4-6): Новые сферы через plugin-систему

```typescript
// Каждая сфера — отдельный пакет в monorepo
packages/
  ├── core/           # Общий мозг
  ├── domain-web/     # Веб-разработка (то что есть сейчас)
  ├── domain-finance/ # Финансы (NEW)
  │   ├── tools/
  │   │   ├── bank-api.tool.ts
  │   │   └── sheets.tool.ts
  │   ├── prompts/
  │   │   └── finance.ts
  │   └── pipelines/
  │       ├── budget.pipeline.ts
  │       └── report.pipeline.ts
  ├── domain-health/  # Здоровье (NEW)
  └── domain-calendar/# Календарь (NEW)
```

Router определяет домен → домен имеет свои pipelines,
промпты и tools. Core остаётся общим.

### Что не нужно менять при масштабировании

Вся текущая архитектура уже готова к росту:
- **Supabase** масштабируется автоматически
- **Monorepo** — новый домен = новый package
- **Telegram/Desktop** — Router перенаправляет в нужный домен
- **Промпты** — каждый домен имеет свои
- **БД** — таблицы tasks и context_docs работают для любого домена
