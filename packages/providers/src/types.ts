import { ChatMessage, ToolCall, TokenUsage } from '@ai-eval/core';

export interface ProviderToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ProviderCallOptions {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  tools?: ProviderToolDefinition[];
  toolChoice?: string | Record<string, unknown>;
  responseFormat?: { type: 'text' | 'json_object' };
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  output: string;
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage;
  latencyMs?: number;
  raw?: unknown;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse>;
  embed?(texts: string[]): Promise<number[][]>;
}
