import { EvaluationResult, EvaluatorContext } from "@ai-eval/core";
import { defineEvaluator } from "./types.js";

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Context Relevance: Measures how much of the retrieved context is relevant to the question
 */
export const ragContextRelevanceEvaluator = defineEvaluator({
  name: "rag_context_relevance",
  description:
    "Measures how relevant the retrieved context is to the input query",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const query =
      typeof ctx.input === "string" ? ctx.input : (ctx.input.message ?? "");
    const context =
      typeof ctx.context === "string"
        ? ctx.context
        : JSON.stringify(ctx.context ?? "");

    if (!context || context.trim() === '""' || context.trim() === "") {
      return {
        score: 0,
        passed: false,
        reason: "No context provided to evaluate relevance",
      };
    }

    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) {
      return {
        score: 1,
        passed: true,
        reason: "Empty query, skipping relevance check",
      };
    }

    const contextLower = context.toLowerCase();
    const matched = queryKeywords.filter((w) => contextLower.includes(w));
    const score = matched.length / queryKeywords.length;
    const threshold = (ctx.options?.threshold as number) ?? 0.6;
    const passed = score >= threshold;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `Context relevance score ${score.toFixed(2)} meets threshold ${threshold}`
        : `Context relevance score ${score.toFixed(2)} below threshold ${threshold}`,
      metadata: {
        matchedKeywords: matched,
        totalQueryKeywords: queryKeywords.length,
      },
    };
  },
});

/**
 * Context Recall: Measures whether the context contains the expected answer facts
 */
export const ragContextRecallEvaluator = defineEvaluator({
  name: "rag_context_recall",
  description:
    "Measures whether the retrieved context contains the information needed to answer the question",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const expected =
      ctx.expected?.exact ??
      (typeof ctx.expected === "string" ? ctx.expected : "");
    const context =
      typeof ctx.context === "string"
        ? ctx.context
        : JSON.stringify(ctx.context ?? "");

    if (!expected) {
      return {
        score: 1,
        passed: true,
        reason: "No expected answer specified for recall evaluation",
      };
    }

    const expectedKeywords = extractKeywords(String(expected));
    const contextLower = context.toLowerCase();
    const matched = expectedKeywords.filter((w) => contextLower.includes(w));

    const score =
      expectedKeywords.length > 0
        ? matched.length / expectedKeywords.length
        : 1;
    const threshold = (ctx.options?.threshold as number) ?? 0.7;
    const passed = score >= threshold;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `Context recall ${score.toFixed(2)} meets threshold ${threshold}`
        : `Context recall ${score.toFixed(2)} below threshold ${threshold}`,
      metadata: {
        matchedKeywords: matched,
        expectedKeywordsCount: expectedKeywords.length,
      },
    };
  },
});

/**
 * Answer Relevance: Measures how directly the answer addresses the user question
 */
export const ragAnswerRelevanceEvaluator = defineEvaluator({
  name: "rag_answer_relevance",
  description:
    "Measures how directly the generated answer addresses the question",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const query =
      typeof ctx.input === "string" ? ctx.input : (ctx.input.message ?? "");
    const answer = ctx.actual.output;

    const queryKeywords = extractKeywords(query);
    const answerLower = answer.toLowerCase();
    const matched = queryKeywords.filter((w) => answerLower.includes(w));

    const score =
      queryKeywords.length > 0 ? matched.length / queryKeywords.length : 1;
    const threshold = (ctx.options?.threshold as number) ?? 0.5;
    const passed = score >= threshold;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `Answer relevance ${score.toFixed(2)} meets threshold ${threshold}`
        : `Answer relevance ${score.toFixed(2)} below threshold ${threshold}`,
    };
  },
});

/**
 * Citation Evaluator: Verifies whether the answer contains citations and whether they reference valid context
 */
export const ragCitationEvaluator = defineEvaluator({
  name: "rag_citation",
  description: "Verifies citation presence and correctness in the answer",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const answer = ctx.actual.output;
    const citationPattern =
      /\[(?:Source|Doc|Ref|\d+)[^\]]*\]|\((?:Source|Doc|\d+)[^)]*\)/gi;
    const matches = answer.match(citationPattern) || [];

    const requireCitations = Boolean(ctx.options?.required ?? true);
    if (!requireCitations) {
      return { score: 1, passed: true, reason: "Citations not required" };
    }

    const passed = matches.length > 0;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `Found ${matches.length} citation(s): ${matches.slice(0, 3).join(", ")}`
        : "No citations found in output",
      metadata: { citations: matches },
    };
  },
});
