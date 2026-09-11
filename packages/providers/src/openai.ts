import { ChatMessage, ProviderError, AuthenticationError, RateLimitError, redactSecrets , InvalidOutputError } from '@ai-eval/core';
import { Provider, ProviderCallOptions, ProviderResponse } from './types.js';

export interface OpenAICompatibleOptions {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  headers?: Record<string, string>;
}

export class OpenAICompatibleProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private baseUrl: string;
  private apiKey?: string;
  private customHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleOptions = {}) {
    this.name = options.name ?? 'openai-compatible';
    this.model = options.model ?? 'gpt-4o-mini';
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.customHeaders = options.headers ?? {};
  }

  async chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse> {
    if (!messages || messages.length === 0) {
      throw new InvalidOutputError(`${this.name}: messages array must not be empty`);
    }
    const startTime = Date.now();
    const url = `${this.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
      })),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      ...(options?.tools ? { tools: options.tools } : {}),
      ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
    };

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
      throw new ProviderError(`Network request to ${url} failed: ${redactSecrets(msg)}`, undefined, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(`Authentication failed with provider ${this.name}: ${redactSecrets(errorText)}`);
      }
      if (response.status === 429) {
        throw new RateLimitError(`Rate limit exceeded for provider ${this.name}: ${redactSecrets(errorText)}`);
      }
      throw new ProviderError(
        `Provider ${this.name} responded with status ${response.status}: ${redactSecrets(errorText)}`,
        response.status,
        response.status >= 500
      );
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];
    const message = choice?.message;
    const output = message?.content ?? '';

    const toolCalls = message?.tool_calls?.map((tc: any) => {
      let args = tc.function?.arguments;
      try {
        if (typeof args === 'string') {
          args = JSON.parse(args);
        }
      } catch {
        // Keep string if unparseable
      }
      return {
        id: tc.id,
        name: tc.function?.name ?? '',
        arguments: args,
      };
    });

    const usage = data.usage;
    return {
      output,
      toolCalls,
      latencyMs: Date.now() - startTime,
      tokenUsage: usage
        ? {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          }
        : undefined,
      raw: data,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embeddings`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderError(`Embeddings failed: ${redactSecrets(err)}`, res.status);
    }

    const json = (await res.json()) as any;
    return json.data.map((item: any) => item.embedding);
  }
}
