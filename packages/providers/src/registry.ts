import { ProviderConfig } from "@ai-eval/core";
import { Provider } from "./types.js";
import { MockProvider } from "./mock.js";
import { OpenAICompatibleProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";
import { HttpProvider } from "./http.js";

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider): this {
    this.providers.set(provider.name.toLowerCase(), provider);
    return this;
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }

  createFromConfig(name: string, config: ProviderConfig): Provider {
    const type = config.type.toLowerCase();
    let provider: Provider;

    switch (type) {
      case "mock":
        provider = new MockProvider({
          name,
          model: config.model ?? "mock-model",
        });
        break;

      case "openai":
      case "openai-compatible":
        provider = new OpenAICompatibleProvider({
          name,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          headers: config.headers,
        });
        break;

      case "anthropic":
        provider = new AnthropicProvider({
          name,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          headers: config.headers,
        });
        break;

      case "gemini":
      case "google":
        provider = new GeminiProvider({
          name,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        });
        break;

      case "ollama":
        provider = new OllamaProvider({
          name,
          baseUrl: config.baseUrl,
          model: config.model,
        });
        break;

      case "http":
        if (!config.baseUrl) {
          throw new Error(
            `HTTP provider '${name}' requires baseUrl (the endpoint URL).`,
          );
        }
        provider = new HttpProvider({
          name,
          url: config.baseUrl,
          model: config.model,
          headers: config.headers,
        });
        break;

      default:
        // Default to OpenAI-compatible if baseUrl is provided
        if (config.baseUrl) {
          provider = new OpenAICompatibleProvider({
            name,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
            headers: config.headers,
          });
        } else {
          throw new Error(
            `Unknown provider type '${config.type}' for provider '${name}'`,
          );
        }
    }

    this.register(provider);
    return provider;
  }
}

export const defaultProviderRegistry = new ProviderRegistry();
// Register default mock provider
defaultProviderRegistry.register(new MockProvider());
