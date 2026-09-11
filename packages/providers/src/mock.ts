import { ChatMessage, ProviderError } from '@ai-eval/core';
import { Provider, ProviderCallOptions, ProviderResponse } from './types.js';

export interface MockRule {
  match: string | RegExp | ((messages: ChatMessage[]) => boolean);
  response: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> | string }>;
  latencyMs?: number;
  shouldFail?: boolean;
  failureCode?: number;
  failureMessage?: string;
}

export interface MockProviderOptions {
  name?: string;
  model?: string;
  defaultResponse?: string;
  rules?: MockRule[];
  defaultLatencyMs?: number;
}

export class MockProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private defaultResponse: string;
  private rules: MockRule[];
  private defaultLatencyMs: number;

  constructor(options: MockProviderOptions = {}) {
    this.name = options.name ?? 'mock';
    this.model = options.model ?? 'mock-model';
    this.defaultResponse = options.defaultResponse ?? 'Mock response';
    this.rules = options.rules ?? [];
    this.defaultLatencyMs = options.defaultLatencyMs ?? 10;
  }

  addRule(rule: MockRule): this {
    this.rules.push(rule);
    return this;
  }

  async chat(messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const lastMessage = messages[messages.length - 1]?.content ?? '';

    let matchedRule: MockRule | undefined;
    for (const rule of this.rules) {
      if (typeof rule.match === 'string' && lastMessage.includes(rule.match)) {
        matchedRule = rule;
        break;
      }
      if (rule.match instanceof RegExp && rule.match.test(lastMessage)) {
        matchedRule = rule;
        break;
      }
      if (typeof rule.match === 'function' && rule.match(messages)) {
        matchedRule = rule;
        break;
      }
    }

    const latency = matchedRule?.latencyMs ?? this.defaultLatencyMs;
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }

    if (matchedRule?.shouldFail) {
      throw new ProviderError(
        matchedRule.failureMessage ?? 'Simulated mock provider failure',
        matchedRule.failureCode ?? 500,
        true
      );
    }

    const output = matchedRule ? matchedRule.response : this.defaultResponse;
    const toolCalls = matchedRule?.toolCalls?.map((tc) => ({
      name: tc.name,
      arguments: tc.arguments,
    }));

    // Generate deterministic simulated token usage
    const inputLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const inputTokens = Math.max(1, Math.ceil(inputLength / 4));
    const outputTokens = Math.max(1, Math.ceil(output.length / 4));

    return {
      output,
      toolCalls,
      latencyMs: Date.now() - startTime,
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      raw: {
        mock: true,
        matched: Boolean(matchedRule),
        options,
      },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Generate deterministic normalized mock embeddings of length 128
    return texts.map((text) => {
      const vec: number[] = new Array(128).fill(0);
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const index = (charCode * 7 + i * 13) % 128;
        vec[index] = (vec[index] ?? 0) + 1;
      }
      // Normalize vector
      const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vec.map((v) => Number((v / mag).toFixed(6)));
    });
  }
}
