import { PricingConfig, TokenUsage } from './types.js';

// Default model pricing in USD per 1M tokens (input / output)
const DEFAULT_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },

  // Anthropic
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku': { input: 0.8, output: 4.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },

  // Google Gemini
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },

  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },

  // Local / Free / Mock
  'ollama': { input: 0.0, output: 0.0 },
  'mock': { input: 0.0, output: 0.0 },
};

export class PricingRegistry {
  private customPricing: Map<string, PricingConfig> = new Map();

  constructor(customPricingConfig?: Record<string, PricingConfig>) {
    if (customPricingConfig) {
      for (const [model, config] of Object.entries(customPricingConfig)) {
        this.customPricing.set(model.toLowerCase(), config);
      }
    }
  }

  registerPricing(model: string, config: PricingConfig): void {
    this.customPricing.set(model.toLowerCase(), config);
  }

  getPricing(modelName?: string): { inputPerMillion: number; outputPerMillion: number } {
    if (!modelName) {
      return { inputPerMillion: 0, outputPerMillion: 0 };
    }

    const normalized = modelName.toLowerCase();

    // Check custom pricing first
    if (this.customPricing.has(normalized)) {
      const custom = this.customPricing.get(normalized)!;
      return {
        inputPerMillion: custom.inputPerMillionTokens ?? 0,
        outputPerMillion: custom.outputPerMillionTokens ?? 0,
      };
    }

    // Check known default models
    for (const [key, price] of Object.entries(DEFAULT_MODEL_PRICING)) {
      if (normalized.includes(key)) {
        return {
          inputPerMillion: price.input,
          outputPerMillion: price.output,
        };
      }
    }

    return { inputPerMillion: 0, outputPerMillion: 0 };
  }

  calculateCost(modelName?: string, usage?: TokenUsage): number {
    if (!usage) return 0;
    const pricing = this.getPricing(modelName);
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
    return Number((inputCost + outputCost).toFixed(6));
  }
}
