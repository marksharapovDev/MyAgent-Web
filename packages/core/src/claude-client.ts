import Anthropic from '@anthropic-ai/sdk';
import { createLogger, retry, isRetryableHttpError } from '@my-agent/shared';
import type { ConversationMessage } from '@my-agent/shared';

const log = createLogger('claude-client');

export type ModelAlias = 'sonnet' | 'opus' | 'haiku';

const MODEL_IDS: Record<ModelAlias, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

export interface ClaudeRequestOptions {
  model?: ModelAlias;
  maxTokens?: number;
  systemPrompt?: string;
  temperature?: number;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async complete(
    messages: ConversationMessage[],
    options: ClaudeRequestOptions = {},
  ): Promise<ClaudeResponse> {
    const modelId = MODEL_IDS[options.model ?? 'sonnet'];
    const maxTokens = options.maxTokens ?? 4096;

    log.debug('Sending request to Claude', {
      model: modelId,
      messageCount: messages.length,
      maxTokens,
    });

    const response = await retry(
      () =>
        this.client.messages.create({
          model: modelId,
          max_tokens: maxTokens,
          system: options.systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...(options.temperature !== undefined && {
            temperature: options.temperature,
          }),
        }),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: isRetryableHttpError,
      },
    );

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const result: ClaudeResponse = {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
      stopReason: response.stop_reason ?? 'end_turn',
    };

    log.info('Claude response received', {
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      stopReason: result.stopReason,
    });

    return result;
  }

  async *stream(
    messages: ConversationMessage[],
    options: ClaudeRequestOptions = {},
  ): AsyncGenerator<StreamChunk> {
    const modelId = MODEL_IDS[options.model ?? 'sonnet'];

    log.debug('Starting streaming request', { model: modelId });

    const stream = this.client.messages.stream({
      model: modelId,
      max_tokens: options.maxTokens ?? 4096,
      system: options.systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { delta: event.delta.text, done: false };
      }
    }

    yield { delta: '', done: true };
  }

  async simpleComplete(
    prompt: string,
    options: ClaudeRequestOptions = {},
  ): Promise<string> {
    const response = await this.complete(
      [{ role: 'user', content: prompt }],
      options,
    );
    return response.content;
  }
}
