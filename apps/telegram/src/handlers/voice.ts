import type { Context } from 'grammy';
import { createLogger } from '@my-agent/shared';
import type { StateMachine } from '../state/machine.js';
import type { DiscussionSession } from '@my-agent/core';

const log = createLogger('voice-handler');

export async function handleVoice(
  ctx: Context,
  state: StateMachine,
  getSession: (userId: number, projectId: string) => DiscussionSession,
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const voice = ctx.message?.voice;
  if (!voice) return;

  // Download voice file from Telegram
  const file = await ctx.getFile();
  const fileUrl = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;

  log.debug('Voice message received', { userId, fileId: voice.file_id, duration: voice.duration });

  // STT transcription placeholder — Week 3: integrate Deepgram
  // For now, prompt the user to type instead
  const stateData = await state.get(userId);

  if (process.env['DEEPGRAM_API_KEY']) {
    // TODO Week 3: implement Deepgram STT
    // const text = await transcribeWithDeepgram(fileUrl);
    // Then route to message handler with `text`
    await ctx.reply('🎤 Голосовые сообщения будут поддержаны в следующей версии. Напиши текстом.');
  } else {
    await ctx.reply('🎤 Голосовые сообщения пока не настроены. Напиши текстом.');
  }
}
