import OpenAI from 'openai';
import { createLogger, retry, isRetryableHttpError } from '@my-agent/shared';
import type { ConversationMessage } from '@my-agent/shared';

const log = createLogger('claude-client');

export type ModelAlias = 'sonnet' | 'opus' | 'haiku';

const MODEL_IDS: Record<ModelAlias, string> = {
  sonnet: 'anthropic/claude-sonnet-4',
  opus: 'anthropic/claude-opus-4',
  haiku: 'anthropic/claude-haiku-4.5',
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
  private readonly client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['POLZA_API_KEY'];
    if (!key) {
      throw new Error('POLZA_API_KEY is required');
    }
    const baseURL = process.env['POLZA_BASE_URL'] ?? 'https://polza.ai/api/v1';
    this.client = new OpenAI({ apiKey: key, baseURL });
  }

  async complete(
    messages: ConversationMessage[],
    options: ClaudeRequestOptions = {},
  ): Promise<ClaudeResponse> {
    const model = MODEL_IDS[options.model ?? 'sonnet'];
    const maxTokens = options.maxTokens ?? 4096;

    log.debug('Sending request', { model, messageCount: messages.length, maxTokens });

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt !== undefined) {
      chatMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      chatMessages.push({ role: m.role, content: m.content });
    }

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      messages: chatMessages,
    };

    if (options.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    const response = await retry(
      () => this.client.chat.completions.create(params),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: isRetryableHttpError,
      },
    );

    const content = response.choices[0]?.message.content ?? '';

    const result: ClaudeResponse = {
      content,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      model: response.model,
      stopReason: response.choices[0]?.finish_reason ?? 'stop',
    };

    log.info('Response received', {
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
    const model = MODEL_IDS[options.model ?? 'sonnet'];

    log.debug('Starting streaming request', { model });

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt !== undefined) {
      chatMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      chatMessages.push({ role: m.role, content: m.content });
    }

    const stream = await this.client.chat.completions.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta.content;
      if (delta) {
        yield { delta, done: false };
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
