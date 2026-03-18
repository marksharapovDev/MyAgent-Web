import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { createLogger } from '@my-agent/shared';
import type { StateMachine } from '../state/machine.js';
import type { ApiClient } from '../api/client.js';
import type { DiscussionSession } from '@my-agent/core';
import { kb } from '../keyboards/inline.js';

const log = createLogger('message-handler');

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
}

async function replyWithOptionalKeyboard(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  if (keyboard) {
    await ctx.reply(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(text);
  }
}

export async function handleMessage(
  ctx: Context,
  state: StateMachine,
  api: ApiClient,
  createSession: (userId: number, projectId: string) => DiscussionSession,
): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  if (!userId || !text) return;

  const stateData = await state.get(userId);

  log.debug('Message received', { userId, state: stateData.state, textLen: text.length });

  switch (stateData.state) {
    case 'idle': {
      if (!stateData.projectId) {
        await ctx.reply(
          'У тебя нет активного проекта. Выбери или создай:',
          { reply_markup: kb.start() },
        );
        return;
      }
      await state.transition(userId, 'discussing', { projectId: stateData.projectId });
      const session = createSession(userId, stateData.projectId);
      const response = await session.send(text);
      await replyWithOptionalKeyboard(ctx, response.text, response.isTaskClear ? kb.confirmTask() : undefined);
      break;
    }

    case 'discussing': {
      if (stateData.discussionId === 'new_project') {
        await handleNewProjectFlow(ctx, userId, text, state, api);
        return;
      }
      if (stateData.discussionId?.startsWith('new_project:')) {
        await handleNewProjectFlow(ctx, userId, text, state, api);
        return;
      }

      if (!stateData.projectId) {
        await ctx.reply('Сначала выбери проект:', { reply_markup: kb.start() });
        return;
      }

      const session = createSession(userId, stateData.projectId);
      const response = await session.send(text);
      await replyWithOptionalKeyboard(ctx, response.text, response.isTaskClear ? kb.confirmTask() : undefined);
      break;
    }

    case 'reviewing': {
      if (!stateData.projectId) return;
      await state.transition(userId, 'executing');
      await ctx.reply('⏳ Вношу правки...');
      // TODO: send feedback to the running task
      break;
    }

    case 'executing': {
      await ctx.reply(
        '⏳ Задача сейчас выполняется. Подождать или отменить?',
        { reply_markup: kb.cancelExecuting() },
      );
      break;
    }

    case 'autopilot': {
      await ctx.reply('🤖 Автопилот активен. Принял сообщение, учту при следующем чекпоинте.');
      break;
    }

    case 'planning': {
      if (!stateData.projectId) return;
      const session = createSession(userId, stateData.projectId);
      const response = await session.send(text);
      await replyWithOptionalKeyboard(ctx, response.text, response.isTaskClear ? kb.confirmTask() : undefined);
      break;
    }
  }
}

async function handleNewProjectFlow(
  ctx: Context,
  userId: number,
  text: string,
  state: StateMachine,
  api: ApiClient,
): Promise<void> {
  const stateData = await state.get(userId);

  if (stateData.discussionId === 'new_project') {
    const slug = slugify(text);
    await state.transition(userId, 'discussing', {
      discussionId: `new_project:brief:${encodeURIComponent(text)}:${slug}`,
    });
    await ctx.reply('Отлично. Опиши в двух словах что нужно сделать?');
    return;
  }

  if (stateData.discussionId?.startsWith('new_project:brief:')) {
    const parts = stateData.discussionId.split(':');
    const projectName = decodeURIComponent(parts[2] ?? '');
    const slug = parts[3] ?? slugify(projectName);

    await state.transition(userId, 'discussing', {
      discussionId: `new_project:stack:${encodeURIComponent(projectName)}:${slug}:${encodeURIComponent(text)}`,
    });
    await ctx.reply(
      'Понял. Стек по умолчанию — Next.js + Tailwind + Supabase.\nПодходит или нужно что-то другое?',
      {
        reply_markup: new InlineKeyboard()
          .text('✅ Подходит', 'stack:ok')
          .text('⚙️ Изменить стек', 'stack:change'),
      },
    );
    return;
  }

  if (stateData.discussionId?.startsWith('new_project:stack:')) {
    const parts = stateData.discussionId.split(':');
    const projectName = decodeURIComponent(parts[2] ?? '');
    const slug = parts[3] ?? slugify(projectName);

    try {
      const project = await api.createProject({ name: projectName, slug });
      // Clear discussionId by transitioning without it
      await state.set(userId, { state: 'idle', projectId: project.id, updatedAt: new Date().toISOString() });
      await ctx.reply(
        `Проект «${projectName}» создан!\n🆔 slug: ${slug}\n📋 Бриф сохранён\n\nНачинаем работу? Что делаем первым?`,
      );
    } catch {
      await ctx.reply('⚠️ Не удалось создать проект. Попробуй ещё раз.');
    }
  }
}
