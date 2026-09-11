import { EvaluationResult, EvaluatorContext } from '@ai-eval/core';
import { defineEvaluator } from './types.js';

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

export const hallucinationEvaluator = defineEvaluator({
  name: 'hallucination',
  description: 'Evaluates whether claims made in the output are grounded in the supplied context',
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    let contextStr = '';
    if (typeof ctx.context === 'string') {
      contextStr = ctx.context;
    } else if (ctx.context && typeof ctx.context === 'object') {
      contextStr = JSON.stringify(ctx.context);
    }

    if (!contextStr) {
      return {
        score: 0.5,
        passed: true,
        reason: 'No context supplied to verify hallucinations against',
        metadata: { confidence: 0.2 },
      };
    }

    const sentences = splitIntoSentences(ctx.actual.output);
    if (sentences.length === 0) {
      return {
        score: 1,
        passed: true,
        reason: 'Output is empty; no claims made',
        metadata: { confidence: 1 },
      };
    }

    const contextLower = contextStr.toLowerCase();
    const supportedStatements: string[] = [];
    const unsupportedStatements: string[] = [];

    for (const sentence of sentences) {
      // Tokenize sentence into non-stopword keywords
      const words = sentence
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'will'].includes(w));

      if (words.length === 0) {
        supportedStatements.push(sentence);
        continue;
      }

      // Check how many key words exist in context
      const matches = words.filter((w) => contextLower.includes(w));
      const overlapRatio = matches.length / words.length;

      if (overlapRatio >= 0.5) {
        supportedStatements.push(sentence);
      } else {
        unsupportedStatements.push(sentence);
      }
    }

    const groundedScore = supportedStatements.length / sentences.length;
    const threshold = (ctx.options?.threshold as number) ?? 0.8;
    const passed = groundedScore >= threshold;

    return {
      score: Number(groundedScore.toFixed(4)),
      passed,
      reason: passed
        ? `Output is grounded in context (${supportedStatements.length}/${sentences.length} statements verified)`
        : `Potential hallucination detected: ${unsupportedStatements.length} statement(s) not found in context`,
      metadata: {
        groundedScore,
        supportedStatements,
        unsupportedStatements,
        methodology: 'keyword_overlap_sentence_verification',
        confidence: 0.85,
      },
    };
  },
});
