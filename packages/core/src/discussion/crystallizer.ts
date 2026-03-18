import { ClaudeClient } from '../claude-client.js';
import { crystallizerPrompt } from '../prompts/discussion.js';
import { createLogger } from '@my-agent/shared';
import type { DialogCache } from './cache.js';

const log = createLogger('task-crystallizer');

export interface CrystallizedTask {
  type: 'design' | 'code' | 'deploy';
  title: string;
  description: string;
  requirements: string[];
  constraints: string[];
  acceptance_criteria: string[];
}

export interface ContextUpdate {
  should_update: boolean;
  updates: Array<{
    doc_type: 'styleguide' | 'architecture' | 'notes';
    action: 'add' | 'update';
    content: string;
  }>;
}

export interface ExecutionParams {
  model: 'sonnet' | 'opus';
  estimated_complexity: 'low' | 'medium' | 'high';
  tools_needed: string[];
  requires_confirmation_before_deploy: boolean;
}

export interface CrystallizerResult {
  task: CrystallizedTask;
  context_update: ContextUpdate;
  execution: ExecutionParams;
}

export class TaskCrystallizer {
  private readonly claude: ClaudeClient;
  private readonly cache: DialogCache;

  constructor(cache: DialogCache) {
    this.cache = cache;
    this.claude = new ClaudeClient();
  }

  async crystallize(
    userId: number,
    projectId: string,
    projectContext: string,
  ): Promise<CrystallizerResult> {
    log.info('Crystallizing dialog to task spec', { userId, projectId });

    const fullDialog = await this.cache.getAll(userId, projectId);

    const prompt = crystallizerPrompt({ fullDialog, projectContext });

    const response = await this.claude.simpleComplete(prompt, {
      model: 'sonnet',
      maxTokens: 2048,
      temperature: 0,
    });

    // Extract JSON from response (may have markdown fences)
    const jsonMatch = /\{[\s\S]*\}/.exec(response);
    if (!jsonMatch) {
      throw new Error('Crystallizer returned no JSON');
    }

    const result = JSON.parse(jsonMatch[0]) as CrystallizerResult;

    log.info('Task crystallized', {
      title: result.task.title,
      type: result.task.type,
      complexity: result.execution.estimated_complexity,
    });

    return result;
  }
}
