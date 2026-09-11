import fs from 'node:fs';
import path from 'node:path';
import {
  EvaluationRun,
  RegressionComparison,
  RegressionThresholds,
  CaseRegression,
} from './types.js';

export class BaselineManager {
  private baseDir: string;
  private baselinePath: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.baselinePath = path.join(this.baseDir, '.eval', 'baseline.json');
  }

  saveBaseline(run: EvaluationRun): void {
    const dir = path.dirname(this.baselinePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.baselinePath, JSON.stringify(run, null, 2), 'utf8');
  }

  getBaseline(): EvaluationRun | null {
    if (!fs.existsSync(this.baselinePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(this.baselinePath, 'utf8');
      return JSON.parse(content) as EvaluationRun;
    } catch {
      return null;
    }
  }

  compare(
    currentRun: EvaluationRun,
    baselineRun?: EvaluationRun | null,
    thresholds?: RegressionThresholds
  ): RegressionComparison {
    const baseline = baselineRun ?? this.getBaseline();

    if (!baseline) {
      return {
        baselineId: 'none',
        currentId: currentRun.id,
        baselineScore: currentRun.overallScore,
        currentScore: currentRun.overallScore,
        scoreDrop: 0,
        baselineLatencyMs: currentRun.latencyStats.avgMs,
        currentLatencyMs: currentRun.latencyStats.avgMs,
        latencyIncreasePct: 0,
        baselineCost: currentRun.totalCost,
        currentCost: currentRun.totalCost,
        costIncreasePct: 0,
        baselineFailures: currentRun.failedCases,
        currentFailures: currentRun.failedCases,
        hasRegression: false,
        violations: [],
        caseRegressions: [],
      };
    }

    const scoreDrop = Math.max(0, Number((baseline.overallScore - currentRun.overallScore).toFixed(4)));
    
    let latencyIncreasePct = 0;
    if (baseline.latencyStats.avgMs > 0) {
      latencyIncreasePct = Number(
        ((currentRun.latencyStats.avgMs - baseline.latencyStats.avgMs) / baseline.latencyStats.avgMs).toFixed(4)
      );
    }

    let costIncreasePct = 0;
    if (baseline.totalCost > 0) {
      costIncreasePct = Number(
        ((currentRun.totalCost - baseline.totalCost) / baseline.totalCost).toFixed(4)
      );
    }

    const baselineCaseMap = new Map(baseline.cases.map((c) => [c.id, c]));
    const caseRegressions: CaseRegression[] = [];

    for (const curCase of currentRun.cases) {
      const baseCase = baselineCaseMap.get(curCase.id);
      if (baseCase) {
        const passedRegressed = baseCase.passed && !curCase.passed;
        const scoreDropped = curCase.score < baseCase.score;
        if (passedRegressed || scoreDropped) {
          caseRegressions.push({
            id: curCase.id,
            baselinePassed: baseCase.passed,
            currentPassed: curCase.passed,
            baselineScore: baseCase.score,
            currentScore: curCase.score,
            reason: passedRegressed
              ? 'Passed in baseline, but failed in current run'
              : `Score dropped from ${(baseCase.score * 100).toFixed(1)}% to ${(curCase.score * 100).toFixed(1)}%`,
          });
        }
      }
    }

    const violations: string[] = [];

    const effectiveThresholds: RegressionThresholds = {
      maxScoreDrop: thresholds?.maxScoreDrop ?? 0.03, // default 3% max score drop
      maxLatencyIncrease: thresholds?.maxLatencyIncrease ?? 0.25, // default 25% max latency increase
      maxCostIncrease: thresholds?.maxCostIncrease ?? 0.30, // default 30% max cost increase
      maxFailureIncrease: thresholds?.maxFailureIncrease ?? 0,
    };

    if (effectiveThresholds.maxScoreDrop !== undefined && scoreDrop > effectiveThresholds.maxScoreDrop) {
      violations.push(
        `Overall score dropped by ${(scoreDrop * 100).toFixed(1)}% (${(baseline.overallScore * 100).toFixed(1)}% → ${(currentRun.overallScore * 100).toFixed(1)}%), exceeding max allowed drop of ${(effectiveThresholds.maxScoreDrop * 100).toFixed(1)}%`
      );
    }

    if (
      effectiveThresholds.maxLatencyIncrease !== undefined &&
      latencyIncreasePct > effectiveThresholds.maxLatencyIncrease
    ) {
      violations.push(
        `Average latency increased by ${(latencyIncreasePct * 100).toFixed(1)}% (${baseline.latencyStats.avgMs}ms → ${currentRun.latencyStats.avgMs}ms), exceeding max allowed increase of ${(effectiveThresholds.maxLatencyIncrease * 100).toFixed(1)}%`
      );
    }

    if (
      effectiveThresholds.maxCostIncrease !== undefined &&
      costIncreasePct > effectiveThresholds.maxCostIncrease
    ) {
      violations.push(
        `Total cost increased by ${(costIncreasePct * 100).toFixed(1)}% ($${baseline.totalCost} → $${currentRun.totalCost}), exceeding max allowed increase of ${(effectiveThresholds.maxCostIncrease * 100).toFixed(1)}%`
      );
    }

    const failureIncrease = currentRun.failedCases - baseline.failedCases;
    if (
      effectiveThresholds.maxFailureIncrease !== undefined &&
      failureIncrease > effectiveThresholds.maxFailureIncrease
    ) {
      violations.push(
        `Failure count increased by ${failureIncrease} (${baseline.failedCases} → ${currentRun.failedCases}), exceeding max allowed failure increase of ${effectiveThresholds.maxFailureIncrease}`
      );
    }

    return {
      baselineId: baseline.id,
      currentId: currentRun.id,
      baselineScore: baseline.overallScore,
      currentScore: currentRun.overallScore,
      scoreDrop,
      baselineLatencyMs: baseline.latencyStats.avgMs,
      currentLatencyMs: currentRun.latencyStats.avgMs,
      latencyIncreasePct,
      baselineCost: baseline.totalCost,
      currentCost: currentRun.totalCost,
      costIncreasePct,
      baselineFailures: baseline.failedCases,
      currentFailures: currentRun.failedCases,
      hasRegression: violations.length > 0,
      violations,
      caseRegressions,
    };
  }
}
