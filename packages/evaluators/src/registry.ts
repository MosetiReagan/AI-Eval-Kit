import { EvaluatorDefinition } from '@ai-eval/core';
import { exactMatchEvaluator, containsEvaluator, regexEvaluator } from './deterministic.js';
import { jsonValidityEvaluator, jsonSchemaEvaluator } from './json.js';
import { semanticSimilarityEvaluator } from './similarity.js';
import { llmJudgeEvaluator, criteriaEvaluator } from './llm_judge.js';
import { hallucinationEvaluator } from './hallucination.js';
import {
  ragContextRelevanceEvaluator,
  ragContextRecallEvaluator,
  ragAnswerRelevanceEvaluator,
  ragCitationEvaluator,
} from './rag.js';
import { toolCallEvaluator } from './agent.js';

export class EvaluatorRegistry {
  private evaluators: Map<string, EvaluatorDefinition> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    const builtins: EvaluatorDefinition[] = [
      exactMatchEvaluator,
      containsEvaluator,
      regexEvaluator,
      jsonValidityEvaluator,
      jsonSchemaEvaluator,
      semanticSimilarityEvaluator,
      llmJudgeEvaluator,
      criteriaEvaluator,
      hallucinationEvaluator,
      ragContextRelevanceEvaluator,
      ragContextRecallEvaluator,
      ragAnswerRelevanceEvaluator,
      ragCitationEvaluator,
      toolCallEvaluator,
    ];

    for (const evaluator of builtins) {
      this.register(evaluator);
    }
  }

  register(evaluator: EvaluatorDefinition): this {
    this.evaluators.set(evaluator.name.toLowerCase(), evaluator);
    return this;
  }

  get(name: string): EvaluatorDefinition | undefined {
    return this.evaluators.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.evaluators.has(name.toLowerCase());
  }

  list(): EvaluatorDefinition[] {
    return Array.from(this.evaluators.values());
  }
}

export const defaultEvaluatorRegistry = new EvaluatorRegistry();
