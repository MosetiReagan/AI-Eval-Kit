import { EvaluatorContext, EvaluationResult, EvaluatorDefinition } from '@ai-eval/core';

export type EvaluatorFn = (context: EvaluatorContext) => Promise<EvaluationResult> | EvaluationResult;

export interface DefineEvaluatorOptions {
  name: string;
  description?: string;
  evaluate: EvaluatorFn;
}

export function defineEvaluator(options: DefineEvaluatorOptions): EvaluatorDefinition {
  return {
    name: options.name,
    description: options.description,
    evaluate: options.evaluate,
  };
}
