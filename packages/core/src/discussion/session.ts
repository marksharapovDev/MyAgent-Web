import { ClaudeClient } from '../claude-client.js';
import { discussionSystemPrompt } from '../prompts/discussion.js';
import { createLogger } from '@my-agent/shared';
import type { DialogCache } from './cache.js';

const log = createLogger('discussion-session');

export interface DiscussionMetadata {
  isTaskClear: boolean;
  taskType: 'design' | 'code' | 'deploy' | 'general' | null;
  confidence: number;
}

export interface DiscussionResponse {
  text: string;
  isTaskClear: boolean;
  metadata: DiscussionMetadata;
}

const METADATA_RE = /<metadata>([\s\S]*?)<\/metadata>/;

function parseMetadata(content: string): { text: string; metadata: DiscussionMetadata } {
  const match = METADATA_RE.exec(content);
  const defaultMeta: DiscussionMetadata = {
    isTaskClear: false,
    taskType: null,
    confidence: 0.5,
  };

  if (!match) {
    return { text: content.trim(), metadata: defaultMeta };
  }

  const text = content.replace(METADATA_RE, '').trim();
  try {
    const metadata = JSON.parse(match[1] ?? '{}') as DiscussionMetadata;
    return { text, metadata };
  } catch {
    return { text, metadata: defaultMeta };
  }
}

export class DiscussionSession {
  private readonly userId: number;
  private readonly projectId: string;
  private readonly cache: DialogCache;
  private readonly claude: ClaudeClient;

  // Lazily loaded project context — set via setContext() before first send
  private projectBrief = '';
  private projectStyleguide = '';

  constructor(userId: number, projectId: string, cache: DialogCache) {
    this.userId = userId;
    this.projectId = projectId;
    this.cache = cache;
    this.claude = new ClaudeClient();
  }

  setContext(brief: string, styleguide: string): void {
    this.projectBrief = brief;
    this.projectStyleguide = styleguide;
  }

  async send(userMessage: string): Promise<DiscussionResponse> {
    log.debug('Sending message to discussion session', {
      userId: this.userId,
      projectId: this.projectId,
    });

    // Append user message to cache
    await this.cache.append(this.userId, this.projectId, {
      role: 'user',
      content: userMessage,
    });

    // Get full history
    const history = await this.cache.get(this.userId, this.projectId);

    const systemPrompt = discussionSystemPrompt({
      projectBrief: this.projectBrief || 'Контекст проекта не загружен.',
      projectStyleguide: this.projectStyleguide || 'Стилегайд не задан.',
    });

    const response = await this.claude.complete(history, {
      model: 'sonnet',
      maxTokens: 1024,
      systemPrompt,
    });

    // Append assistant response to cache
    await this.cache.append(this.userId, this.projectId, {
      role: 'assistant',
      content: response.content,
    });

    const { text, metadata } = parseMetadata(response.content);

    return {
      text,
      isTaskClear: metadata.isTaskClear,
      metadata,
    };
  }

  async getHistory() {
    return this.cache.get(this.userId, this.projectId);
  }

  async clear(): Promise<void> {
    await this.cache.clear(this.userId, this.projectId);
  }
}
