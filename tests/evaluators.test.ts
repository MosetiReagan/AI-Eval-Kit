import { describe, it, expect } from "vitest";
import {
  exactMatchEvaluator,
  containsEvaluator,
  regexEvaluator,
  jsonValidityEvaluator,
  jsonSchemaEvaluator,
  semanticSimilarityEvaluator,
  hallucinationEvaluator,
  ragContextRelevanceEvaluator,
  ragContextRecallEvaluator,
  ragCitationEvaluator,
  toolCallEvaluator,
  criteriaEvaluator,
  llmJudgeEvaluator,
} from "@ai-eval/evaluators";

describe("Built-in Evaluators", () => {
  it("exact_match evaluator matches strings with normalization", async () => {
    const res1 = await exactMatchEvaluator.evaluate({
      input: "test",
      expected: { exact: "Hello World" },
      actual: { output: "  hello world!  " },
      options: { ignoreCase: true, trim: true, ignorePunctuation: true },
    });
    expect(res1.passed).toBe(true);
    expect(res1.score).toBe(1);

    const res2 = await exactMatchEvaluator.evaluate({
      input: "test",
      expected: { exact: "Hello World" },
      actual: { output: "Goodbye World" },
    });
    expect(res2.passed).toBe(false);
    expect(res2.score).toBe(0);
  });

  it("contains evaluator verifies substrings and array of strings", async () => {
    const res = await containsEvaluator.evaluate({
      input: "test",
      expected: { contains: ["refund", "30 days"] },
      actual: { output: "You can claim a refund within 30 days." },
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);

    const partial = await containsEvaluator.evaluate({
      input: "test",
      expected: { contains: ["refund", "free shipping"] },
      actual: { output: "You can claim a refund." },
    });
    expect(partial.passed).toBe(false);
    expect(partial.score).toBe(0.5);
  });

  it("regex evaluator checks pattern matching and inversion", async () => {
    const match = await regexEvaluator.evaluate({
      input: "test",
      expected: { regex: "^[0-9]+$" },
      actual: { output: "12345" },
    });
    expect(match.passed).toBe(true);

    const inverted = await regexEvaluator.evaluate({
      input: "test",
      options: { pattern: "error", flags: "i", invert: true },
      actual: { output: "Operation succeeded without flaws." },
    });
    expect(inverted.passed).toBe(true);
  });

  it("json_validity extracts and parses JSON correctly", async () => {
    const markdownJson =
      'Here is your data:\n```json\n{"status": "ok", "code": 200}\n```\nHope that helps!';
    const res = await jsonValidityEvaluator.evaluate({
      input: "test",
      actual: { output: markdownJson },
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);

    const invalid = await jsonValidityEvaluator.evaluate({
      input: "test",
      actual: { output: "Just raw text with { unclosed brace" },
    });
    expect(invalid.passed).toBe(false);
  });

  it("json_schema validates structured output against definitions", async () => {
    const jsonOutput = JSON.stringify({ name: "Bob", age: 25, active: true });
    const res = await jsonSchemaEvaluator.evaluate({
      input: "test",
      actual: { output: jsonOutput },
      expected: {
        jsonSchema: {
          required: ["name", "age"],
          properties: { name: { type: "string" }, age: { type: "number" } },
        },
      },
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);
  });

  it("semantic_similarity evaluates similarity", async () => {
    const res = await semanticSimilarityEvaluator.evaluate({
      input: "test",
      expected: { exact: "The quick brown fox jumps over the lazy dog" },
      actual: { output: "A quick brown fox leaps over a lazy dog" },
      options: { threshold: 0.5 },
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBeGreaterThan(0.5);
  });

  it("hallucination evaluator flags ungrounded statements", async () => {
    const context =
      "Apollo 11 landed on the Moon on July 20, 1969. Neil Armstrong was commander.";
    const grounded = await hallucinationEvaluator.evaluate({
      input: "test",
      context,
      actual: {
        output:
          "Neil Armstrong was the commander during the Apollo 11 Moon landing in July 1969.",
      },
      options: { threshold: 0.7 },
    });
    expect(grounded.passed).toBe(true);

    const hallucinated = await hallucinationEvaluator.evaluate({
      input: "test",
      context,
      actual: {
        output:
          "Apollo 11 landed on Mars with a crew of five astronauts including Elon Musk.",
      },
      options: { threshold: 0.7 },
    });
    expect(hallucinated.passed).toBe(false);
  });

  it("rag metrics evaluate context relevance, recall, and citations", async () => {
    const relevance = await ragContextRelevanceEvaluator.evaluate({
      input: "Where is the Eiffel Tower located?",
      context:
        "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
      actual: { output: "" },
    });
    expect(relevance.passed).toBe(true);

    const recall = await ragContextRecallEvaluator.evaluate({
      input: "Where is the Eiffel Tower located?",
      context: "The Eiffel Tower is located in Paris, France.",
      expected: { exact: "Paris, France" },
      actual: { output: "" },
    });
    expect(recall.passed).toBe(true);

    const citation = await ragCitationEvaluator.evaluate({
      input: "test",
      actual: { output: "According to [Doc 1], Paris is the capital." },
    });
    expect(citation.passed).toBe(true);
  });

  it("tool_call evaluator asserts required, forbidden tools, and sequences", async () => {
    const res = await toolCallEvaluator.evaluate({
      input: "lookup",
      expected: {
        tools: {
          required: ["search_customer"],
          forbidden: ["delete_customer"],
          maxCalls: 2,
        },
      },
      actual: {
        output: "Looking up customer",
        tool_calls: [{ name: "search_customer", arguments: { id: 1 } }],
      },
    });
    expect(res.passed).toBe(true);

    const forbiddenFailed = await toolCallEvaluator.evaluate({
      input: "lookup",
      expected: {
        tools: {
          required: ["search_customer"],
          forbidden: ["delete_customer"],
        },
      },
      actual: {
        output: "Deleted customer",
        tool_calls: [
          { name: "search_customer", arguments: { id: 1 } },
          { name: "delete_customer", arguments: { id: 1 } },
        ],
      },
    });
    expect(forbiddenFailed.passed).toBe(false);
  });

  it("criteria and llm_judge evaluators honestly report provider requirements", async () => {
    const critRes = await criteriaEvaluator.evaluate({
      input: "Summarize policy",
      actual: { output: "Returns are accepted within 30 days." },
      expected: { criteria: ["Must be concise", "Must contain 30 days"] },
    });
    expect(critRes.passed).toBe(true);

    // Unverifiable criterion fails honestly
    const unverifiedCrit = await criteriaEvaluator.evaluate({
      input: "test",
      actual: { output: "response" },
      expected: { criteria: ["Must evoke profound philosophical inspiration"] },
    });
    expect(unverifiedCrit.passed).toBe(false);

    // llmJudgeEvaluator honestly fails when no provider is supplied
    const judgeRes = await llmJudgeEvaluator.evaluate({
      input: "test",
      actual: { output: "Valid response generated by model" },
      options: { criteria: ["correctness", "relevance"] },
    });
    expect(judgeRes.passed).toBe(false);
    expect(judgeRes.score).toBe(0);
    expect(judgeRes.reason).toContain("requires a configured provider");
  });
});
