import {
  ChatMessage,
  ProviderError,
  AuthenticationError,
  RateLimitError,
  redactSecrets,
  InvalidOutputError,
} from "@ai-eval/core";
import { Provider, ProviderCallOptions, ProviderResponse } from "./types.js";

export interface GeminiOptions {
  name?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class GeminiProvider implements Provider {
  public readonly name: string;
  public readonly model: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(options: GeminiOptions = {}) {
    this.name = options.name ?? "gemini";
    this.model = options.model ?? "gemini-1.5-flash";
    this.baseUrl = (
      options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  async chat(
    messages: ChatMessage[],
    options?: ProviderCallOptions,
  ): Promise<ProviderResponse> {
    if (!messages || messages.length === 0) {
      throw new InvalidOutputError(
        `${this.name}: messages array must not be empty`,
      );
    }
    const startTime = Date.now();
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey ?? ""}`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        ...(options?.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
        ...(options?.maxTokens !== undefined
          ? { maxOutputTokens: options.maxTokens }
          : {}),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(
        `Gemini network error: ${redactSecrets(msg)}`,
        undefined,
        true,
      );
    }

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 400 && text.includes("API_KEY_INVALID")) {
        throw new AuthenticationError(
          `Gemini API key is invalid: ${redactSecrets(text)}`,
        );
      }
      if (response.status === 429) {
        throw new RateLimitError(`Gemini rate limited: ${redactSecrets(text)}`);
      }
      throw new ProviderError(
        `Gemini error (${response.status}): ${redactSecrets(text)}`,
        response.status,
      );
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text ?? "";

    const metadata = data.usageMetadata;
    return {
      output: textPart,
      latencyMs: Date.now() - startTime,
      tokenUsage: metadata
        ? {
            inputTokens: metadata.promptTokenCount ?? 0,
            outputTokens: metadata.candidatesTokenCount ?? 0,
            totalTokens: metadata.totalTokenCount ?? 0,
          }
        : undefined,
      raw: data,
    };
  }
}
