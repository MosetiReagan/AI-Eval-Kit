import { extractJsonFromText } from "./json.js";
import { EvaluationResult, EvaluatorContext } from "@ai-eval/core";
import { defineEvaluator } from "./types.js";

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

export const hallucinationEvaluator = defineEvaluator({
  name: "hallucination",
  description:
    "Evaluates whether claims made in the output are grounded in the supplied context",
  evaluate: async (ctx: EvaluatorContext): Promise<EvaluationResult> => {
    let contextStr = "";
    if (typeof ctx.context === "string") {
      contextStr = ctx.context;
    } else if (ctx.context && typeof ctx.context === "object") {
      contextStr = JSON.stringify(ctx.context);
    }

    if (!contextStr) {
      return {
        score: 0.5,
        passed: true,
        reason: "No context supplied to verify hallucinations against",
        metadata: { confidence: 0.2 },
      };
    }

    const sentences = splitIntoSentences(ctx.actual.output);
    if (sentences.length === 0) {
      return {
        score: 1,
        passed: true,
        reason: "Output is empty; no claims made",
        metadata: { confidence: 1 },
      };
    }

    // If an LLM provider is configured, use rigorous LLM fact checking
    if (ctx.provider && typeof ctx.provider.chat === "function") {
      try {
        const prompt = `Given the following CONTEXT, check if each claim in the OUTPUT is strictly supported.
CONTEXT:
${contextStr}

OUTPUT:
${ctx.actual.output}

Respond strictly in JSON format:
{
  "groundedScore": <number 0.0 to 1.0>,
  "passed": <boolean>,
  "supportedStatements": ["statement 1", ...],
  "unsupportedStatements": ["hallucinated statement", ...]
}`;

        const resp = await ctx.provider.chat([
          {
            role: "system",
            content:
              "You are a strict hallucination detection auditor. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ]);

        const extracted = extractJsonFromText(resp.output);
        if (
          extracted.success &&
          extracted.data &&
          typeof extracted.data === "object"
        ) {
          const d = extracted.data as any;
          const score =
            typeof d.groundedScore === "number"
              ? d.groundedScore
              : d.passed
                ? 1
                : 0;
          return {
            score: Math.max(0, Math.min(1, Number(score.toFixed(4)))),
            passed: Boolean(d.passed ?? score >= 0.8),
            reason: d.passed
              ? "Output is grounded in context"
              : `Potential hallucination detected: ${(d.unsupportedStatements || []).length} ungrounded claims`,
            metadata: {
              supportedStatements: d.supportedStatements || [],
              unsupportedStatements: d.unsupportedStatements || [],
              methodology: "llm_fact_verification",
              confidence: 0.9,
            },
          };
        }
      } catch {
        // Fall back to heuristic check
      }
    }

    const contextLower = contextStr.toLowerCase();
    const supportedStatements: string[] = [];
    const unsupportedStatements: string[] = [];

    for (const sentence of sentences) {
      const words = sentence
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 3 &&
            !["this", "that", "with", "from", "have", "were", "will"].includes(
              w,
            ),
        );

      if (words.length === 0) {
        supportedStatements.push(sentence);
        continue;
      }

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
        methodology: "keyword_overlap_sentence_heuristic",
        confidence: 0.35,
      },
    };
  },
});
