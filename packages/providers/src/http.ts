import { ChatMessage, ProviderError, redactSecrets , InvalidOutputError } from '@ai-eval/core';
import { Provider, ProviderCallOptions, ProviderResponse } from './types.js';

export interface HttpProviderOptions {
  name?: string;
  url: string;
  model?: string;
  headers?: Record<string, string>;
  inputKey?: string;
  outputKey?: string;
}

export class HttpProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private url: string;
  private headers: Record<string, string>;
  private inputKey: string;
  private outputKey: string;

  constructor(options: HttpProviderOptions) {
    this.name = options.name ?? 'http';
    this.model = options.model ?? 'custom';
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.inputKey = options.inputKey ?? 'messages';
    this.outputKey = options.outputKey ?? 'output';
  }

  async chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse> {
    if (!messages || messages.length === 0) {
      throw new InvalidOutputError(`${this.name}: messages array must not be empty`);
    }
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      [this.inputKey]: messages,
      model: this.model,
      ...(options ?? {}),
    };

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(`HTTP provider request failed: ${redactSecrets(msg)}`, undefined, true);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderError(`HTTP provider returned status ${res.status}: ${redactSecrets(err)}`, res.status);
    }

    const json = (await res.json()) as any;
    let output = '';

    if (this.outputKey.includes('.')) {
      const keys = this.outputKey.split('.');
      let cur: any = json;
      for (const k of keys) {
        cur = cur?.[k];
      }
      output = typeof cur === 'string' ? cur : JSON.stringify(cur);
    } else {
      const val = json[this.outputKey];
      output = typeof val === 'string' ? val : (json.text ?? json.response ?? json.content ?? JSON.stringify(json));
    }

    return {
      output,
      latencyMs: Date.now() - startTime,
      raw: json,
    };
  }
}
