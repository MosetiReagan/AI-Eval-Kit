import { EvaluationResult, EvaluatorContext } from '@ai-eval/core';
import { defineEvaluator } from './types.js';

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fast local token-vector cosine similarity (fallback for offline mode)
 */
export function calculateLocalSimilarity(textA: string, textB: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const vocab = new Set([...tokensA, ...tokensB]);
  const vocabList = Array.from(vocab);

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const t of tokensA) freqA.set(t, (freqA.get(t) ?? 0) + 1);
  for (const t of tokensB) freqB.set(t, (freqB.get(t) ?? 0) + 1);

  const vecA = vocabList.map((w) => freqA.get(w) ?? 0);
  const vecB = vocabList.map((w) => freqB.get(w) ?? 0);

  return cosineSimilarity(vecA, vecB);
}

export const semanticSimilarityEvaluator = defineEvaluator({
  name: 'semantic_similarity',
  description: 'Evaluates semantic similarity between output and expected text using embeddings or local vector analysis',
  evaluate: async (ctx: EvaluatorContext): Promise<EvaluationResult> => {
    const expected =
      ctx.expected?.exact ??
      (typeof ctx.expected === 'string' ? ctx.expected : (ctx.expected?.contains as string));

    if (!expected) {
      return {
        score: 0,
        passed: false,
        reason: 'No expected text specified for semantic similarity evaluation',
      };
    }

    const actual = ctx.actual.output;
    const threshold = (ctx.options?.threshold as number) ?? 0.8;

    let score = 0;
    let method = 'local_token_vector';

    if (ctx.provider && typeof ctx.provider.embed === 'function') {
      try {
        const embeddings = await ctx.provider.embed([actual, String(expected)]);
        if (embeddings && embeddings.length === 2 && embeddings[0] && embeddings[1]) {
          score = cosineSimilarity(embeddings[0], embeddings[1]);
          method = 'provider_embedding';
        }
      } catch {
        score = calculateLocalSimilarity(actual, String(expected));
      }
    } else {
      score = calculateLocalSimilarity(actual, String(expected));
    }

    score = Math.max(0, Math.min(1, Number(score.toFixed(4))));
    const passed = score >= threshold;

    return {
      score,
      passed,
      reason: passed
        ? `Semantic similarity ${score} meets threshold ${threshold} (method: ${method})`
        : `Semantic similarity ${score} is below threshold ${threshold} (method: ${method})`,
      metadata: { method, threshold, similarity: score },
    };
  },
});
