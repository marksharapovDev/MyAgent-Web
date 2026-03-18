export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageSource = 'telegram' | 'desktop' | 'api';

export type MessageContentType = 'text' | 'image' | 'voice' | 'file';

export interface MessageContent {
  type: MessageContentType;
  text?: string;
  url?: string;
  mimeType?: string;
  durationSec?: number;
}

export interface Message {
  id: string;
  projectId?: string;
  taskId?: string;
  role: MessageRole;
  content: string;
  source: MessageSource;
  createdAt: Date;
}

export interface ConversationMessage {
  role: Extract<MessageRole, 'user' | 'assistant'>;
  content: string;
}
