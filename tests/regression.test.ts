import { describe, it, expect } from "vitest";
import { BaselineManager, EvaluationRun } from "@ai-eval/core";

describe("Baseline & Regression Detection", () => {
  const mockBaselineRun: EvaluationRun = {
    id: "base-001",
    projectName: "test-project",
    evaluationName: "eval-1",
    timestamp: new Date().toISOString(),
    durationMs: 1200,
    targetName: "app-v1",
    totalCases: 10,
    passedCases: 9,
    failedCases: 1,
    overallScore: 0.95,
    evaluatorScores: { exact_match: 0.95 },
    latencyStats: {
      avgMs: 100,
      medianMs: 95,
      p95Ms: 140,
      p99Ms: 150,
      minMs: 50,
      maxMs: 160,
    },
    totalTokens: { inputTokens: 500, outputTokens: 500, totalTokens: 1000 },
    totalCost: 0.002,
    cases: [
      {
        id: "c1",
        case: { id: "c1", input: "test" },
        passed: true,
        score: 1,
        latencyMs: 100,
        cost: 0.0002,
        evaluatorResults: {},
      },
      {
        id: "c2",
        case: { id: "c2", input: "test" },
        passed: true,
        score: 1,
        latencyMs: 100,
        cost: 0.0002,
        evaluatorResults: {},
      },
    ],
  };

  it("detects score drop regression exceeding threshold", () => {
    const currentRun: EvaluationRun = {
      ...mockBaselineRun,
      id: "current-001",
      overallScore: 0.88, // 7% drop from 0.95
      passedCases: 7,
      failedCases: 3,
      cases: [
        {
          id: "c1",
          case: { id: "c1", input: "test" },
          passed: true,
          score: 1,
          latencyMs: 100,
          cost: 0.0002,
          evaluatorResults: {},
        },
        {
          id: "c2",
          case: { id: "c2", input: "test" },
          passed: false,
          score: 0.5,
          latencyMs: 100,
          cost: 0.0002,
          evaluatorResults: {},
        },
      ],
    };

    const manager = new BaselineManager();
    const comparison = manager.compare(currentRun, mockBaselineRun, {
      maxScoreDrop: 0.03,
    });

    expect(comparison.hasRegression).toBe(true);
    expect(comparison.scoreDrop).toBeCloseTo(0.07, 2);
    expect(comparison.violations.length).toBeGreaterThan(0);
    expect(comparison.violations[0]).toContain("Overall score dropped");
    expect(comparison.caseRegressions.length).toBe(1);
    expect(comparison.caseRegressions[0]?.id).toBe("c2");
  });

  it("passes regression check when within thresholds", () => {
    const currentRun: EvaluationRun = {
      ...mockBaselineRun,
      id: "current-002",
      overallScore: 0.94, // 1% drop (within 3% threshold)
    };

    const manager = new BaselineManager();
    const comparison = manager.compare(currentRun, mockBaselineRun, {
      maxScoreDrop: 0.03,
    });
    expect(comparison.hasRegression).toBe(false);
    expect(comparison.violations.length).toBe(0);
  });
});
