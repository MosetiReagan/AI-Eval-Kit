import { EvaluationResult, EvaluatorContext } from "@ai-eval/core";
import { defineEvaluator } from "./types.js";
import { extractJsonFromText } from "./json.js";

export const llmJudgeEvaluator = defineEvaluator({
  name: "llm_judge",
  description:
    "Uses an LLM as an impartial judge to score responses against criteria",
  evaluate: async (ctx: EvaluatorContext): Promise<EvaluationResult> => {
    const criteria = (ctx.options?.criteria as string[]) ?? [
      "correctness",
      "relevance",
      "helpfulness",
    ];
    const scale = (ctx.options?.scale as "1-5" | "0-1") ?? "1-5";
    const threshold =
      (ctx.options?.threshold as number) ?? (scale === "1-5" ? 3.5 : 0.7);

    const inputPrompt =
      typeof ctx.input === "string"
        ? ctx.input
        : (ctx.input.message ?? JSON.stringify(ctx.input));

    const expectedStr = ctx.expected
      ? JSON.stringify(ctx.expected)
      : "Not specified";
    const actualStr = ctx.actual.output;
    const contextStr = ctx.context ? JSON.stringify(ctx.context) : "None";

    const judgePrompt = `You are an expert evaluation judge. Score the following AI response based on the criteria.

CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

INPUT / PROMPT:
${inputPrompt}

CONTEXT:
${contextStr}

EXPECTED OUTPUT:
${expectedStr}

ACTUAL OUTPUT:
${actualStr}

Respond ONLY with valid JSON with the following structure:
{
  "score": <number between ${scale === "1-5" ? "1 and 5" : "0 and 1"}>,
  "passed": <boolean>,
  "reason": "<clear explanation for your score>",
  "criteriaScores": {
    ${criteria.map((c) => `"${c}": <number>`).join(",\n    ")}
  }
}`;

    if (!ctx.provider || typeof ctx.provider.chat !== "function") {
      return {
        score: 0,
        passed: false,
        reason:
          "LLM judge requires a configured provider with chat capability. No provider supplied.",
        metadata: { skipped: true, error: "NO_PROVIDER" },
      };
    }

    try {
      const judgeResponse = await ctx.provider.chat([
        {
          role: "system",
          content:
            "You are an objective AI evaluation judge. Always respond with strict JSON.",
        },
        { role: "user", content: judgePrompt },
      ]);

      const extracted = extractJsonFromText(judgeResponse.output);
      if (
        extracted.success &&
        extracted.data &&
        typeof extracted.data === "object"
      ) {
        const data = extracted.data as Record<string, unknown>;
        const rawScore = Number(data.score ?? 0);
        const normalizedScore = scale === "1-5" ? rawScore / 5 : rawScore;
        const passed = Boolean(data.passed ?? rawScore >= threshold);

        return {
          score: Math.max(0, Math.min(1, Number(normalizedScore.toFixed(4)))),
          passed,
          reason: String(data.reason ?? "Scored by LLM judge"),
          metrics: (data.criteriaScores as Record<string, number>) ?? undefined,
          metadata: { rawScore, scale, judgeOutput: judgeResponse.output },
        };
      }

      return {
        score: 0,
        passed: false,
        reason: "LLM judge returned malformed or unparseable JSON output",
        metadata: { judgeOutput: judgeResponse.output },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        score: 0,
        passed: false,
        reason: `LLM Judge execution error: ${msg}`,
        error: msg,
      };
    }
  },
});

export const criteriaEvaluator = defineEvaluator({
  name: "criteria",
  description:
    "Evaluates output against custom natural-language criteria rules",
  evaluate: async (ctx: EvaluatorContext): Promise<EvaluationResult> => {
    const criteria =
      (ctx.options?.criteria as string[]) ?? ctx.expected?.criteria ?? [];

    if (!criteria || criteria.length === 0) {
      return {
        score: 1,
        passed: true,
        reason: "No criteria specified to evaluate",
      };
    }

    const actual = ctx.actual.output;
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];

    // Check each criterion
    for (const crit of criteria) {
      const critLower = crit.toLowerCase();
      // Simple heuristic rules for offline / fast evaluation
      if (
        critLower.includes("not invent") ||
        critLower.includes("not hallucinate")
      ) {
        passedCriteria.push(crit);
      } else if (critLower.includes("concise")) {
        if (actual.split(/\s+/).length <= 150) {
          passedCriteria.push(crit);
        } else {
          failedCriteria.push(crit);
        }
      } else if (
        critLower.includes("must contain") ||
        critLower.includes("must include")
      ) {
        const keyword = crit
          .split(/must (?:contain|include)/i)[1]
          ?.trim()
          .replace(/['"]/g, "");
        if (keyword && actual.toLowerCase().includes(keyword.toLowerCase())) {
          passedCriteria.push(crit);
        } else {
          failedCriteria.push(crit);
        }
      } else {
        failedCriteria.push(crit);
      }
    }

    const score =
      criteria.length > 0 ? passedCriteria.length / criteria.length : 1;
    const passed = failedCriteria.length === 0;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `All ${criteria.length} criteria satisfied`
        : `Violated criteria: ${failedCriteria.join("; ")}`,
      metadata: { passedCriteria, failedCriteria },
    };
  },
});
