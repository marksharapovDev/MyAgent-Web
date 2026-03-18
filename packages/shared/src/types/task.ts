export type TaskType = 'design' | 'code' | 'deploy' | 'general';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'review'
  | 'done'
  | 'failed';

export type TaskSource = 'telegram' | 'desktop' | 'api';

export type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

export interface Task {
  id: string;
  projectId: string;
  planTaskId?: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  source: TaskSource;
  claudeModel: ClaudeModel;
  tokensUsed: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateTaskInput {
  projectId: string;
  planTaskId?: string;
  type: TaskType;
  priority?: number;
  input: Record<string, unknown>;
  source?: TaskSource;
  claudeModel?: ClaudeModel;
}
