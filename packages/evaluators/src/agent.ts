import { EvaluationResult, EvaluatorContext, ToolCall } from "@ai-eval/core";
import { defineEvaluator } from "./types.js";

export interface ToolAssertion {
  type:
    | "tool_called"
    | "tool_not_called"
    | "max_tool_calls"
    | "tool_sequence"
    | "tool_argument";
  tool?: string;
  value?: number;
  sequence?: string[];
  argumentKey?: string;
  expectedValue?: unknown;
}

export const toolCallEvaluator = defineEvaluator({
  name: "tool_call",
  description:
    "Evaluates agent tool calling behavior including required tools, forbidden tools, sequences, and argument validity",
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    // Collect all tool calls from output directly or from steps
    let toolCalls: ToolCall[] = ctx.actual.tool_calls ?? [];
    if (toolCalls.length === 0 && ctx.actual.steps) {
      for (const step of ctx.actual.steps) {
        if (step.tool_calls) {
          toolCalls.push(...step.tool_calls);
        }
      }
    }

    const calledToolNames = toolCalls.map((t) => t.name);

    // Retrieve expected tools configuration
    const toolsConfig = ctx.expected?.tools ?? {};
    const requiredTools = toolsConfig.required ?? [];
    const forbiddenTools = toolsConfig.forbidden ?? [];
    const maxCalls = toolsConfig.maxCalls;
    const expectedSequence = toolsConfig.sequence;

    // Also support assertions list
    const assertions =
      (ctx.options?.assertions as ToolAssertion[]) ??
      (ctx.expected?.assertions as ToolAssertion[]) ??
      [];

    const errors: string[] = [];
    let checksRun = 0;
    let checksPassed = 0;

    // Check required tools
    for (const req of requiredTools) {
      checksRun++;
      if (calledToolNames.includes(req)) {
        checksPassed++;
      } else {
        errors.push(`Required tool "${req}" was not called`);
      }
    }

    // Check forbidden tools
    for (const forb of forbiddenTools) {
      checksRun++;
      if (!calledToolNames.includes(forb)) {
        checksPassed++;
      } else {
        errors.push(`Forbidden tool "${forb}" was invoked`);
      }
    }

    // Check max tool calls
    if (maxCalls !== undefined) {
      checksRun++;
      if (toolCalls.length <= maxCalls) {
        checksPassed++;
      } else {
        errors.push(
          `Exceeded max tool calls: expected <= ${maxCalls}, actual = ${toolCalls.length}`,
        );
      }
    }

    // Check tool sequence
    if (expectedSequence && expectedSequence.length > 0) {
      checksRun++;
      let seqIndex = 0;
      for (const name of calledToolNames) {
        if (name === expectedSequence[seqIndex]) {
          seqIndex++;
        }
      }
      if (seqIndex === expectedSequence.length) {
        checksPassed++;
      } else {
        errors.push(
          `Expected tool sequence [${expectedSequence.join(" -> ")}] was not satisfied. Actual: [${calledToolNames.join(" -> ")}]`,
        );
      }
    }

    // Process explicit assertions
    for (const assertion of assertions) {
      checksRun++;
      switch (assertion.type) {
        case "tool_called":
          if (assertion.tool && calledToolNames.includes(assertion.tool)) {
            checksPassed++;
          } else {
            errors.push(
              `Assertion failed: tool "${assertion.tool}" was not called`,
            );
          }
          break;

        case "tool_not_called":
          if (assertion.tool && !calledToolNames.includes(assertion.tool)) {
            checksPassed++;
          } else {
            errors.push(
              `Assertion failed: forbidden tool "${assertion.tool}" was called`,
            );
          }
          break;

        case "max_tool_calls":
          if (
            assertion.value !== undefined &&
            toolCalls.length <= assertion.value
          ) {
            checksPassed++;
          } else {
            errors.push(
              `Assertion failed: tool calls ${toolCalls.length} exceeded max ${assertion.value}`,
            );
          }
          break;

        case "tool_sequence":
          if (assertion.sequence) {
            let idx = 0;
            for (const name of calledToolNames) {
              if (name === assertion.sequence[idx]) idx++;
            }
            if (idx === assertion.sequence.length) {
              checksPassed++;
            } else {
              errors.push(`Assertion failed: tool sequence was not observed`);
            }
          }
          break;

        case "tool_argument":
          if (assertion.tool && assertion.argumentKey) {
            const targetCall = toolCalls.find((t) => t.name === assertion.tool);
            if (!targetCall) {
              errors.push(
                `Assertion failed: tool "${assertion.tool}" was not called`,
              );
            } else {
              const args =
                typeof targetCall.arguments === "object"
                  ? (targetCall.arguments as Record<string, unknown>)
                  : {};
              const actualVal = args[assertion.argumentKey];
              if (
                JSON.stringify(actualVal) ===
                JSON.stringify(assertion.expectedValue)
              ) {
                checksPassed++;
              } else {
                errors.push(
                  `Tool "${assertion.tool}" arg "${assertion.argumentKey}": expected ${JSON.stringify(assertion.expectedValue)}, got ${JSON.stringify(actualVal)}`,
                );
              }
            }
          }
          break;
      }
    }

    const passed = errors.length === 0;
    const score = checksRun > 0 ? checksPassed / checksRun : passed ? 1 : 0;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `Agent tool evaluation passed (${checksPassed}/${checksRun} assertions satisfied)`
        : `Agent assertions failed: ${errors.join("; ")}`,
      metadata: {
        calledTools: calledToolNames,
        totalCalls: toolCalls.length,
        errors,
      },
    };
  },
});
