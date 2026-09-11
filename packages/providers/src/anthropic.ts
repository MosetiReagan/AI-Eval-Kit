import { ChatMessage, ProviderError, AuthenticationError, RateLimitError, redactSecrets } from '@ai-eval/core';
import { Provider, ProviderCallOptions, ProviderResponse } from './types.js';

export interface AnthropicOptions {
  name?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class AnthropicProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private apiKey?: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  constructor(options: AnthropicOptions = {}) {
    this.name = options.name ?? 'anthropic';
    this.model = options.model ?? 'claude-3-5-sonnet-20241022';
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.customHeaders = options.headers ?? {};
  }

  async chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...this.customHeaders,
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 1024,
      messages: nonSystemMessages,
      ...(systemMessage ? { system: systemMessage } : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    if (options?.tools && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 60000);

      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
      });
      clearTimeout(timeout);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`Network request to Anthropic failed: ${redactSecrets(msg)}`, undefined, true);
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(`Anthropic auth failed: ${redactSecrets(errText)}`);
      }
      if (response.status === 429) {
        throw new RateLimitError(`Anthropic rate limit: ${redactSecrets(errText)}`);
      }
      throw new ProviderError(`Anthropic error (${response.status}): ${redactSecrets(errText)}`, response.status);
    }

    const data = (await response.json()) as any;
    let output = '';
    const toolCalls: any[] = [];

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          output += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input,
          });
        }
      }
    }

    const usage = data.usage;
    return {
      output,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      latencyMs: Date.now() - startTime,
      tokenUsage: usage
        ? {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        : undefined,
      raw: data,
    };
  }
}
