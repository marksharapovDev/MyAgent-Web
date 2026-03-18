import type { CommandContext, Context } from 'grammy';
import { createLogger } from '@my-agent/shared';
import type { StateMachine } from '../state/machine.js';
import type { ApiClient } from '../api/client.js';
import { kb } from '../keyboards/inline.js';

const log = createLogger('commands');

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
}

export function registerCommands(
  bot: { command: (cmd: string, handler: (ctx: CommandContext<Context>) => Promise<void>) => void },
  state: StateMachine,
  api: ApiClient,
): void {
  // /start
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await state.reset(userId);
    await ctx.reply(
      'Привет! Я твой агент для веб-разработки.\n\nДля начала работы создай первый проект или выбери существующий.',
      { reply_markup: kb.start() },
    );
  });

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🤖 Команды:\n\n` +
      `/project — выбрать проект\n` +
      `/new — создать проект\n` +
      `/status — статус задач и деплоев\n` +
      `/plan — план проекта\n` +
      `/autopilot — режим автопилот\n` +
      `/detail — детальный режим\n` +
      `/pause — пауза автопилота\n` +
      `/resume — продолжить\n` +
      `/cancel — отменить текущее\n\n` +
      `Или просто напиши/скажи что нужно сделать.`,
    );
  });

  // /project
  bot.command('project', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    try {
      const projects = await api.listProjects();
      const stateData = await state.get(userId);
      const mapped = projects.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.id === stateData.projectId,
      }));
      await ctx.reply('Выбери проект:', { reply_markup: kb.projectList(mapped) });
    } catch (err) {
      log.error('Failed to list projects', { err });
      await ctx.reply('⚠️ Не удалось загрузить проекты. Попробуй ещё раз.');
    }
  });

  // /new
  bot.command('new', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await state.transition(userId, 'discussing', { discussionId: 'new_project' });
    await ctx.reply('Создаём новый проект. Как он называется?');
  });

  // /status
  bot.command('status', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.reply('У тебя нет активного проекта. Выбери:', {
        reply_markup: kb.start(),
      });
      return;
    }
    try {
      const [project, tasks] = await Promise.all([
        api.getProject(stateData.projectId),
        api.listTasks(stateData.projectId),
      ]);

      const taskLines = tasks.slice(0, 5).map((t) => {
        const icon = t.status === 'done' ? '✅' : t.status === 'running' ? '🔄' : '⏳';
        return `${icon} ${t.type} — ${t.status}`;
      });

      const text =
        `📊 Статус «${project.name}»\n\n` +
        (taskLines.length > 0 ? taskLines.join('\n') : 'Задач пока нет.') +
        `\n\nЧто делаем?`;

      await ctx.reply(text);
    } catch (err) {
      log.error('Status error', { err });
      await ctx.reply('⚠️ Не удалось получить статус.');
    }
  });

  // /plan
  bot.command('plan', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.reply('У тебя нет активного проекта.', { reply_markup: kb.start() });
      return;
    }
    try {
      const plan = await api.getActivePlan(stateData.projectId);
      if (!plan) {
        await ctx.reply('📋 Для этого проекта ещё нет плана.\n\nНапиши что нужно сделать, чтобы я составил план.');
        return;
      }
      await ctx.reply(
        `📋 План проекта\n\nСтатус: ${plan.status}\nЭтапов: ${plan.phases.length}`,
        { reply_markup: kb.autopilotControls() },
      );
    } catch (err) {
      log.error('Plan error', { err });
      await ctx.reply('⚠️ Не удалось загрузить план.');
    }
  });

  // /autopilot
  bot.command('autopilot', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const stateData = await state.get(userId);
    if (!stateData.projectId) {
      await ctx.reply('У тебя нет активного проекта.', { reply_markup: kb.start() });
      return;
    }
    await state.transition(userId, 'autopilot');
    await ctx.reply(
      '🤖 Переключился в автопилот.\nПродолжаю работу по плану, вернусь на чекпоинтах.',
    );
  });

  // /detail
  bot.command('detail', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const currentState = await state.getState(userId);
    if (currentState !== 'autopilot' && currentState !== 'executing') {
      await ctx.reply('Детальный режим доступен во время выполнения.');
      return;
    }
    await ctx.reply(
      '🔍 Переключился в детальный режим.\nБуду показывать каждый шаг.',
    );
  });

  // /pause
  bot.command('pause', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const currentState = await state.getState(userId);
    if (currentState !== 'autopilot') {
      await ctx.reply('Автопилот сейчас не активен.');
      return;
    }
    await ctx.reply(
      '⏸ Автопилот на паузе.\nТекущая задача будет завершена. Новые задачи не начнутся.',
      { reply_markup: kb.afterPause() },
    );
  });

  // /resume
  bot.command('resume', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await state.transition(userId, 'autopilot');
    await ctx.reply('▶️ Автопилот возобновлён.');
  });

  // /cancel
  bot.command('cancel', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const currentState = await state.getState(userId);

    switch (currentState) {
      case 'discussing':
        await state.reset(userId);
        await ctx.reply('Обсуждение отменено. Что дальше?');
        break;
      case 'executing': {
        await ctx.reply(
          `⚠️ Задача сейчас выполняется.\nОтменить?`,
          { reply_markup: kb.cancelExecuting() },
        );
        break;
      }
      case 'reviewing':
        await ctx.reply(
          'Результат отклонён. Начинаем заново или меняем задачу?',
          { reply_markup: kb.cancelReviewing() },
        );
        break;
      default:
        await state.reset(userId);
        await ctx.reply('Отменено. Что дальше?');
    }
  });
}
