import { EvaluationResult, EvaluatorContext } from "@ai-eval/core";
import { defineEvaluator } from "./types.js";

export function extractJsonFromText(text: string): {
  success: boolean;
  data?: unknown;
  error?: string;
} {
  const trimmed = text.trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(trimmed);
    return { success: true, data: parsed };
  } catch {
    // Continue
  }

  // Try extracting from markdown ```json ... ``` code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      return { success: true, data: parsed };
    } catch {
      // Continue
    }
  }

  // Try extracting first { ... } or [ ... ]
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      return { success: true, data: parsed };
    } catch {
      // Continue
    }
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
      return { success: true, data: parsed };
    } catch {
      // Continue
    }
  }

  return { success: false, error: "Could not extract valid JSON from text" };
}

/**
 * Evaluates whether output contains valid parseable JSON
 */
export const jsonValidityEvaluator = defineEvaluator({
  name: "json_validity",
  description:
    "Checks whether the output is valid JSON or contains a parseable JSON block",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const extracted = extractJsonFromText(ctx.actual.output);
    return {
      score: extracted.success ? 1 : 0,
      passed: extracted.success,
      reason: extracted.success
        ? "Output contains valid JSON"
        : `Output is not valid JSON: ${extracted.error}`,
      metadata: { parsed: extracted.data },
    };
  },
});

/**
 * Validates parsed JSON against expected schema or required properties
 */
export const jsonSchemaEvaluator = defineEvaluator({
  name: "json_schema",
  description:
    "Validates JSON output against required fields or a schema definition",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const extracted = extractJsonFromText(ctx.actual.output);
    if (
      !extracted.success ||
      !extracted.data ||
      typeof extracted.data !== "object"
    ) {
      return {
        score: 0,
        passed: false,
        reason: "Output is not valid JSON, cannot validate schema",
      };
    }

    const schema =
      (ctx.options?.schema as Record<string, unknown>) ??
      ctx.expected?.jsonSchema;
    if (!schema) {
      return {
        score: 1,
        passed: true,
        reason: "No schema specified to validate against, JSON is valid",
      };
    }

    const requiredFields = (schema.required as string[]) ?? [];
    const properties =
      (schema.properties as Record<string, { type?: string }>) ?? {};
    const data = extracted.data as Record<string, unknown>;

    const missingFields: string[] = [];
    const typeMismatches: string[] = [];

    for (const field of requiredFields) {
      if (
        !(field in data) ||
        data[field] === undefined ||
        data[field] === null
      ) {
        missingFields.push(field);
      }
    }

    for (const [propName, propDef] of Object.entries(properties)) {
      if (propName in data && propDef.type) {
        const val = data[propName];
        const actualType = Array.isArray(val) ? "array" : typeof val;
        if (actualType !== propDef.type) {
          typeMismatches.push(
            `${propName}: expected ${propDef.type}, got ${actualType}`,
          );
        }
      }
    }

    const errors = [
      ...missingFields.map((f) => `Missing required field "${f}"`),
      ...typeMismatches,
    ];
    const passed = errors.length === 0;

    const totalChecks = requiredFields.length + Object.keys(properties).length;
    const passedChecks = Math.max(0, totalChecks - errors.length);
    const score = totalChecks > 0 ? passedChecks / totalChecks : passed ? 1 : 0;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? "JSON schema validation passed"
        : `Schema errors: ${errors.join(", ")}`,
      metadata: { missingFields, typeMismatches },
    };
  },
});
