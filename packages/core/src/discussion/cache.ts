import { createLogger } from '@my-agent/shared';
import type { ConversationMessage } from '@my-agent/shared';

const log = createLogger('dialog-cache');

const CACHE_TTL_SEC = 86_400; // 24 hours

/** Minimal Redis interface required by DialogCache — satisfied by ioredis and compatible clients. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class DialogCache {
  private readonly redis: RedisLike;

  constructor(redis: RedisLike) {
    this.redis = redis;
  }

  private key(userId: number, projectId: string): string {
    return `discussion:${userId}:${projectId}`;
  }

  async get(userId: number, projectId: string): Promise<ConversationMessage[]> {
    const raw = await this.redis.get(this.key(userId, projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationMessage[];
  }

  async append(
    userId: number,
    projectId: string,
    message: ConversationMessage,
  ): Promise<void> {
    const messages = await this.get(userId, projectId);
    messages.push(message);
    await this.redis.setex(
      this.key(userId, projectId),
      CACHE_TTL_SEC,
      JSON.stringify(messages),
    );
    log.debug('Message appended to cache', { userId, projectId, role: message.role });
  }

  async set(
    userId: number,
    projectId: string,
    messages: ConversationMessage[],
  ): Promise<void> {
    await this.redis.setex(
      this.key(userId, projectId),
      CACHE_TTL_SEC,
      JSON.stringify(messages),
    );
  }

  async clear(userId: number, projectId: string): Promise<void> {
    await this.redis.del(this.key(userId, projectId));
    log.debug('Dialog cache cleared', { userId, projectId });
  }

  async getAll(userId: number, projectId: string): Promise<string> {
    const messages = await this.get(userId, projectId);
    return messages
      .map((m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
      .join('\n\n');
  }
}
