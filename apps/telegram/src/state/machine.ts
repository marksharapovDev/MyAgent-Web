import { Redis } from 'ioredis';
import { createLogger } from '@my-agent/shared';

const log = createLogger('state-machine');

export type BotState =
  | 'idle'
  | 'discussing'
  | 'planning'
  | 'autopilot'
  | 'executing'
  | 'reviewing';

export interface StateData {
  state: BotState;
  projectId?: string;
  taskId?: string;
  discussionId?: string;
  updatedAt: string;
}

const STATE_TTL_SEC = 3600; // 1 hour, then auto-reset to idle

export class StateMachine {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(userId: number): string {
    return `bot:state:${userId}`;
  }

  async get(userId: number): Promise<StateData> {
    const raw = await this.redis.get(this.key(userId));
    if (!raw) {
      return { state: 'idle', updatedAt: new Date().toISOString() };
    }
    return JSON.parse(raw) as StateData;
  }

  async set(userId: number, data: Partial<StateData> & { state: BotState }): Promise<void> {
    const current = await this.get(userId);
    const next: StateData = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.setex(this.key(userId), STATE_TTL_SEC, JSON.stringify(next));
    log.debug('State updated', { userId, state: next.state });
  }

  async transition(
    userId: number,
    to: BotState,
    extra?: Omit<StateData, 'state' | 'updatedAt'>,
  ): Promise<void> {
    await this.set(userId, { state: to, ...extra });
  }

  async reset(userId: number): Promise<void> {
    const fresh: StateData = { state: 'idle', updatedAt: new Date().toISOString() };
    await this.redis.setex(this.key(userId), STATE_TTL_SEC, JSON.stringify(fresh));
    log.debug('State reset to idle', { userId });
  }

  async getState(userId: number): Promise<BotState> {
    const data = await this.get(userId);
    return data.state;
  }
}
