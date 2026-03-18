import type { CallbackQueryContext, Context } from 'grammy';
import { createLogger } from '@my-agent/shared';
import type { StateMachine } from '../state/machine.js';
import type { ApiClient } from '../api/client.js';
import { kb } from '../keyboards/inline.js';

const log = createLogger('callback');

export function registerCallbacks(
  bot: { callbackQuery: (pattern: string | RegExp, handler: (ctx: CallbackQueryContext<Context>) => Promise<void>) => void },
  state: StateMachine,
  api: ApiClient,
): void {

  // ── Project ──────────────────────────────────────────────────────────────────
  bot.callbackQuery('project:new', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.transition(userId, 'discussing', { discussionId: 'new_project' });
    await ctx.editMessageText('Создаём новый проект. Как он называется?');
  });

  bot.callbackQuery('project:list', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    try {
      const projects = await api.listProjects();
      const stateData = await state.get(userId);
      const mapped = projects.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.id === stateData.projectId,
      }));
      await ctx.editMessageText('Выбери проект:', { reply_markup: kb.projectList(mapped) });
    } catch (err) {
      log.error('List projects error', { err });
      await ctx.editMessageText('⚠️ Не удалось загрузить проекты.');
    }
  });

  bot.callbackQuery(/^project:select:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    const projectId = ctx.match[1];
    if (!projectId) return;
    try {
      const project = await api.getProject(projectId);
      await state.transition(userId, 'idle', { projectId });
      await ctx.editMessageText(
        `Переключился на «${project.name}»\n\nЧто делаем?`,
      );
    } catch (err) {
      log.error('Select project error', { err });
      await ctx.editMessageText('⚠️ Не удалось переключить проект.');
    }
  });

  // ── Stack ────────────────────────────────────────────────────────────────────
  bot.callbackQuery('stack:ok', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      'Стек подтверждён: Next.js + Tailwind + Supabase.\n\nКак назовём проект?',
    );
  });

  bot.callbackQuery('stack:change', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Опиши какой стек хочешь использовать.');
  });

  // ── Task confirm ─────────────────────────────────────────────────────────────
  bot.callbackQuery('task:confirm', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.editMessageText('⚠️ Нет активного проекта.');
      return;
    }
    await state.transition(userId, 'executing');
    await ctx.editMessageText('⏳ Запускаю выполнение задачи...');
  });

  bot.callbackQuery('task:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Что нужно изменить в задаче?');
  });

  // ── Design review ────────────────────────────────────────────────────────────
  bot.callbackQuery('design:approve', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.reset(userId);
    await ctx.editMessageText('Дизайн одобрен ✅\n\nЧто дальше?');
  });

  bot.callbackQuery('design:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Опиши что изменить.');
  });

  bot.callbackQuery('design:redo', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.transition(userId, 'executing');
    await ctx.editMessageText('⏳ Переделываю с нуля...');
  });

  // ── Code review ──────────────────────────────────────────────────────────────
  bot.callbackQuery('code:diff', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📝 Diff будет показан после подключения Git-инструмента.');
  });

  bot.callbackQuery('code:merge', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.reset(userId);
    await ctx.editMessageText('Merged в main ✅\n\nЗадеплоить обновление?', {
      reply_markup: kb.deployTarget(),
    });
  });

  bot.callbackQuery('code:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Опиши что нужно изменить в коде.');
  });

  // ── Deploy ───────────────────────────────────────────────────────────────────
  bot.callbackQuery('deploy:vercel', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.editMessageText('⚠️ Нет активного проекта.');
      return;
    }
    await state.transition(userId, 'executing');
    try {
      await api.createTask({
        projectId: stateData.projectId,
        type: 'deploy',
        input: { target: 'vercel' },
      });
      await ctx.editMessageText('⏳ Деплою на Vercel...');
    } catch (err) {
      log.error('Deploy task error', { err });
      await ctx.editMessageText('❌ Не удалось запустить деплой.', {
        reply_markup: kb.errorRetry(),
      });
    }
  });

  bot.callbackQuery('deploy:vps', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '⚠️ Деплой на продакшен.\n\nЭто НЕОБРАТИМО. Текущая версия будет заменена. Бэкап будет создан автоматически.\n\nПодтверждаешь?',
      { reply_markup: kb.confirmProdDeploy() },
    );
  });

  bot.callbackQuery('deploy:prod:confirm', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.editMessageText('⚠️ Нет активного проекта.');
      return;
    }
    await state.transition(userId, 'executing');
    try {
      await api.createTask({
        projectId: stateData.projectId,
        type: 'deploy',
        input: { target: 'vps' },
      });
      await ctx.editMessageText('⏳ Деплою на VPS...');
    } catch (err) {
      log.error('Prod deploy error', { err });
      await ctx.editMessageText('❌ Не удалось запустить деплой.', {
        reply_markup: kb.deployError(),
      });
    }
  });

  bot.callbackQuery('deploy:prod:cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Деплой отменён.');
  });

  bot.callbackQuery('deploy:done', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Готово!');
  });

  // ── Cancel ───────────────────────────────────────────────────────────────────
  bot.callbackQuery('cancel:confirm', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.reset(userId);
    await ctx.editMessageText('Задача отменена. Что дальше?');
  });

  bot.callbackQuery('cancel:abort', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Продолжаю выполнение.');
  });

  // ── Review ───────────────────────────────────────────────────────────────────
  bot.callbackQuery('review:redo', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.transition(userId, 'executing');
    await ctx.editMessageText('⏳ Переделываю...');
  });

  bot.callbackQuery('review:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Опиши что изменить.');
  });

  bot.callbackQuery('review:skip', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.reset(userId);
    await ctx.editMessageText('Пропущено. Что дальше?');
  });

  // ── Plan ─────────────────────────────────────────────────────────────────────
  bot.callbackQuery('plan:pause', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '⏸ Автопилот на паузе.\nТекущая задача будет завершена. Новые задачи не начнутся.',
      { reply_markup: kb.afterPause() },
    );
  });

  bot.callbackQuery('plan:detail', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('🔍 Детальный режим включён. Буду показывать каждый шаг.');
  });

  bot.callbackQuery('autopilot:resume', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.transition(userId, 'autopilot');
    await ctx.editMessageText('▶️ Автопилот возобновлён.');
  });

  bot.callbackQuery('plan:show', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('/plan');
  });

  // ── Error ────────────────────────────────────────────────────────────────────
  bot.callbackQuery('error:retry', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('⏳ Повторяю...');
  });

  bot.callbackQuery('error:cancel', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCallbackQuery();
    await state.reset(userId);
    await ctx.editMessageText('Отменено.');
  });
}
