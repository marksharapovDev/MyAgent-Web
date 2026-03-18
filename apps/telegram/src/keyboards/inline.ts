import { InlineKeyboard } from 'grammy';

export const kb = {
  /** After design generation */
  designReview(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Отлично', 'design:approve')
      .text('✏️ Правки', 'design:edit')
      .text('🔄 С нуля', 'design:redo');
  },

  /** After code generation */
  codeReview(): InlineKeyboard {
    return new InlineKeyboard()
      .text('👁 Diff', 'code:diff')
      .text('✅ Merge', 'code:merge')
      .text('✏️ Правки', 'code:edit');
  },

  /** Task spec confirmation */
  confirmTask(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Всё верно, делай', 'task:confirm')
      .text('✏️ Ещё кое-что', 'task:edit');
  },

  /** Deploy target */
  deployTarget(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔵 Vercel (preview)', 'deploy:vercel')
      .text('🔴 VPS (production)', 'deploy:vps');
  },

  /** Production deploy confirmation */
  confirmProdDeploy(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Да, деплой на прод', 'deploy:prod:confirm')
      .text('❌ Отмена', 'deploy:prod:cancel');
  },

  /** After deploy */
  afterDeploy(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📤 Ссылка клиенту', 'deploy:share')
      .text('🔴 На прод', 'deploy:vps')
      .text('⏭ Готово', 'deploy:done');
  },

  /** Start screen */
  start(): InlineKeyboard {
    return new InlineKeyboard()
      .text('➕ Создать проект', 'project:new')
      .text('📂 Мои проекты', 'project:list');
  },

  /** Project selection - dynamic, built from list */
  projectList(projects: Array<{ id: string; name: string; isActive: boolean }>): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const p of projects) {
      const icon = p.isActive ? '🟢' : '⚪';
      kb.text(`${icon} ${p.name}`, `project:select:${p.id}`).row();
    }
    kb.text('➕ Создать новый', 'project:new');
    return kb;
  },

  /** Stack confirmation during /new */
  stackConfirm(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Подходит', 'stack:ok')
      .text('⚙️ Изменить стек', 'stack:change');
  },

  /** Cancel confirmation during executing */
  cancelExecuting(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Да, отменить', 'cancel:confirm')
      .text('Нет, пусть работает', 'cancel:abort');
  },

  /** Cancel during reviewing */
  cancelReviewing(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔄 Заново', 'review:redo')
      .text('✏️ Изменить задачу', 'review:edit')
      .text('🗑 Пропустить', 'review:skip');
  },

  /** Autopilot controls */
  autopilotControls(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✏️ Изменить план', 'plan:edit')
      .text('🔍 Детальный', 'plan:detail')
      .text('⏸ Пауза', 'plan:pause');
  },

  /** After pause */
  afterPause(): InlineKeyboard {
    return new InlineKeyboard()
      .text('▶️ Продолжить', 'autopilot:resume')
      .text('📋 План', 'plan:show');
  },

  /** Error retry */
  errorRetry(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔄 Повторить сейчас', 'error:retry')
      .text('⏭ Отмена', 'error:cancel');
  },

  /** Long running task */
  longRunning(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⏭ Продолжать ждать', 'task:wait')
      .text('❌ Отменить', 'task:cancel');
  },

  /** Deploy error */
  deployError(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔧 Починить автоматически', 'deploy:fix')
      .text('📋 Показать лог', 'deploy:log')
      .text('↩️ Откатить', 'deploy:rollback');
  },
};
