import { EvaluationRun, RegressionComparison, escapeHtml } from '@ai-eval/core';
import { Reporter, ReporterOutputOptions } from './types.js';

export class MarkdownReporter implements Reporter {
  public readonly name = 'markdown';

  format(run: EvaluationRun, regression?: RegressionComparison, _options: ReporterOutputOptions = {}): string {
    const lines: string[] = [];

    const isPassed = run.failedCases === 0 && (!regression || !regression.hasRegression);
    const badge = isPassed ? '🟢 **PASSED**' : '🔴 **FAILED**';

    lines.push(`# AI Evaluation Report: ${run.evaluationName}`);
    lines.push('');
    lines.push(`**Status:** ${badge} | **Project:** ${run.projectName} | **Target:** ${run.targetName}`);
    lines.push(`**Date:** ${new Date(run.timestamp).toUTCString()}`);
    lines.push('');

    // Summary cards table
    lines.push('### Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| :--- | :--- |');
    lines.push(`| **Overall Score** | **${(run.overallScore * 100).toFixed(1)}%** |`);
    lines.push(`| **Test Cases** | ${run.totalCases} total (${run.passedCases} passed, ${run.failedCases} failed) |`);
    lines.push(`| **Pass Rate** | ${((run.passedCases / (run.totalCases || 1)) * 100).toFixed(1)}% |`);
    lines.push(`| **Latency (Avg / P95)** | ${run.latencyStats.avgMs}ms / ${run.latencyStats.p95Ms}ms |`);
    lines.push(`| **Total Tokens** | ${run.totalTokens.totalTokens.toLocaleString()} |`);
    lines.push(`| **Estimated Cost** | $${run.totalCost.toFixed(4)} |`);
    lines.push('');

    // Evaluator Scores Table
    lines.push('### Evaluator Breakdown');
    lines.push('');
    lines.push('| Evaluator | Score | Status |');
    lines.push('| :--- | :--- | :--- |');
    for (const [name, score] of Object.entries(run.evaluatorScores)) {
      const pct = `${(score * 100).toFixed(1)}%`;
      const statusIcon = score >= 0.8 ? '✅' : score >= 0.5 ? '⚠️' : '❌';
      lines.push(`| \`${name}\` | **${pct}** | ${statusIcon} |`);
    }
    lines.push('');

    // Regression Section
    if (regression && regression.baselineId !== 'none') {
      lines.push('### Regression Comparison (vs Baseline)');
      lines.push('');
      if (regression.hasRegression) {
        lines.push('> ⚠️ **AI Regression Detected**');
        lines.push('');
        for (const violation of regression.violations) {
          lines.push(`- ❌ ${violation}`);
        }
        lines.push('');
      } else {
        lines.push('> ✅ No regressions detected against baseline.');
        lines.push('');
      }
    }

    // Failed Cases Details
    const failedCases = run.cases.filter((c) => !c.passed);
    if (failedCases.length > 0) {
      lines.push('<details>');
      lines.push(`<summary><b>View ${failedCases.length} Failed Cases</b></summary>`);
      lines.push('');

      for (const c of failedCases) {
        lines.push(`#### Case \`${c.id}\``);
        const inputStr = typeof c.case.input === 'string' ? c.case.input : c.case.input.message ?? JSON.stringify(c.case.input);
        lines.push(`- **Input:** \`${escapeHtml(inputStr)}\``);
        if (c.case.expected) {
          lines.push(`- **Expected:** \`${escapeHtml(JSON.stringify(c.case.expected))}\``);
        }
        lines.push(`- **Actual:** \`${escapeHtml(c.output?.output ?? 'none')}\``);

        for (const [evName, res] of Object.entries(c.evaluatorResults)) {
          if (!res.passed) {
            lines.push(`- ❌ **${evName}**: ${(res.score * 100).toFixed(1)}% — ${escapeHtml(res.reason ?? 'Failed')}`);
          }
        }
        lines.push('');
      }

      lines.push('</details>');
      lines.push('');
    }

    lines.push('---');
    lines.push('*Generated automatically by [AI Eval Kit](https://github.com/reagan/ai-eval-kit)*');

    return lines.join('\n');
  }
}
