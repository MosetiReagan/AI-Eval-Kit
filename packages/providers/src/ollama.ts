import { ChatMessage, ProviderError, redactSecrets , InvalidOutputError } from '@ai-eval/core';
import { Provider, ProviderCallOptions, ProviderResponse } from './types.js';

export interface OllamaOptions {
  name?: string;
  baseUrl?: string;
  model?: string;
}

export class OllamaProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private baseUrl: string;

  constructor(options: OllamaOptions = {}) {
    this.name = options.name ?? 'ollama';
    this.model = options.model ?? 'llama3';
    this.baseUrl = (options.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
  }

  async chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse> {
    if (!messages || messages.length === 0) {
      throw new InvalidOutputError(`${this.name}: messages array must not be empty`);
    }
    const startTime = Date.now();
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model: this.model,
      stream: false,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.seed !== undefined ? { seed: options.seed } : {}),
        ...(options?.maxTokens !== undefined ? { num_predict: options.maxTokens } : {}),
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(
        `Failed to connect to Ollama at ${this.baseUrl}. Is Ollama running? Error: ${redactSecrets(msg)}`,
        undefined,
        true
      );
    }

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderError(`Ollama returned error status ${res.status}: ${redactSecrets(err)}`, res.status);
    }

    const data = (await res.json()) as any;
    const output = data.message?.content ?? '';

    return {
      output,
      latencyMs: Date.now() - startTime,
      tokenUsage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      raw: data,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!res.ok) {
        throw new ProviderError(`Ollama embedding failed with status ${res.status}`);
      }

      const json = (await res.json()) as any;
      embeddings.push(json.embedding);
    }
    return embeddings;
  }
}
