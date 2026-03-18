export { ClaudeClient } from './claude-client.js';
export type {
  ModelAlias,
  ClaudeRequestOptions,
  ClaudeResponse,
  StreamChunk,
} from './claude-client.js';

export { DiscussionSession } from './discussion/session.js';
export type { DiscussionResponse, DiscussionMetadata } from './discussion/session.js';

export { DialogCache } from './discussion/cache.js';

export { TaskCrystallizer } from './discussion/crystallizer.js';
export type { CrystallizerResult, CrystallizedTask, ExecutionParams } from './discussion/crystallizer.js';
