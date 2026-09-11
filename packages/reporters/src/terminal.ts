import pc from 'picocolors';
import { EvaluationRun, RegressionComparison } from '@ai-eval/core';
import { Reporter, ReporterOutputOptions } from './types.js';

export class TerminalReporter implements Reporter {
  public readonly name = 'terminal';

  format(run: EvaluationRun, regression?: RegressionComparison, options: ReporterOutputOptions = {}): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(pc.bold(pc.cyan('AI Eval Kit')));
    lines.push(pc.dim('----------------------------------------------------'));
    lines.push(`${pc.bold('Project:')}     ${run.projectName}`);
    lines.push(`${pc.bold('Evaluation:')}  ${run.evaluationName}`);
    lines.push(`${pc.bold('Target:')}      ${run.targetName}${run.modelName ? ` (${run.modelName})` : ''}`);
    lines.push(pc.dim('----------------------------------------------------'));
    lines.push('');

    // Evaluator scores
    lines.push(pc.bold('Evaluator Scores:'));
    for (const [name, score] of Object.entries(run.evaluatorScores)) {
      const pct = (score * 100).toFixed(1) + '%';
      const icon = score >= 0.8 ? pc.green('✓') : score >= 0.5 ? pc.yellow('⚠') : pc.red('✗');
      const scoreColored = score >= 0.8 ? pc.green(pct) : score >= 0.5 ? pc.yellow(pct) : pc.red(pct);
      lines.push(`  ${icon} ${name.padEnd(26)} ${scoreColored}`);
    }

    // Overall Score
    const overallPct = (run.overallScore * 100).toFixed(1) + '%';
    const overallColored =
      run.overallScore >= 0.8 ? pc.green(overallPct) : pc.red(overallPct);
    lines.push('');
    lines.push(`  ${pc.bold('Overall Score'.padEnd(28))} ${pc.bold(overallColored)}`);
    lines.push('');

    // Test cases summary
    lines.push(
      `  ${run.totalCases} cases  |  ${pc.green(`${run.passedCases} passed`)}  |  ${
        run.failedCases > 0 ? pc.red(`${run.failedCases} failed`) : pc.gray('0 failed')
      }`
    );
    lines.push(
      `  Latency: ${run.latencyStats.avgMs}ms avg (${run.latencyStats.p95Ms}ms p95)  |  Cost: $${run.totalCost.toFixed(4)}`
    );
    lines.push('');

    // Regression check
    if (regression && regression.baselineId !== 'none') {
      if (regression.hasRegression) {
        lines.push(pc.bgRed(pc.white(pc.bold(' ✗ AI REGRESSION DETECTED '))));
        lines.push('');
        for (const violation of regression.violations) {
          lines.push(`  ${pc.red('•')} ${violation}`);
        }
        lines.push('');
      } else {
        lines.push(pc.green('  ✓ No regression detected against baseline'));
        lines.push('');
      }
    }

    // Failed cases explorer
    if (run.failedCases > 0 && !options.quiet) {
      lines.push(pc.bold(pc.red('Failed Cases Explorer:')));
      lines.push(pc.dim('----------------------------------------------------'));

      const failedCases = run.cases.filter((c) => !c.passed);
      const displayCount = options.verbose ? failedCases.length : Math.min(5, failedCases.length);

      for (let i = 0; i < displayCount; i++) {
        const c = failedCases[i]!;
        lines.push(`${pc.bold(pc.yellow(`[Case: ${c.id}]`))}`);

        const inputStr = typeof c.case.input === 'string' ? c.case.input : c.case.input.message ?? JSON.stringify(c.case.input);
        lines.push(`  ${pc.dim('Input:')}    ${inputStr}`);

        if (c.case.expected) {
          lines.push(`  ${pc.dim('Expected:')} ${JSON.stringify(c.case.expected)}`);
        }

        const actualStr = c.output?.output ? c.output.output.replace(/\n/g, ' ') : 'No output';
        const truncatedActual = actualStr.length > 120 ? actualStr.slice(0, 117) + '...' : actualStr;
        lines.push(`  ${pc.dim('Actual:')}   ${truncatedActual}`);

        for (const [evName, res] of Object.entries(c.evaluatorResults)) {
          if (!res.passed) {
            lines.push(
              `  ${pc.red('Evaluator:')} ${evName} (${(res.score * 100).toFixed(1)}%) - ${res.reason ?? 'Failed'}`
            );
          }
        }
        lines.push('');
      }

      if (failedCases.length > displayCount) {
        lines.push(pc.dim(`  ... and ${failedCases.length - displayCount} more failed cases (use --verbose to see all)`));
        lines.push('');
      }
    }

    const finalStatus =
      run.failedCases === 0 && (!regression || !regression.hasRegression)
        ? pc.bold(pc.green('STATUS: PASSED'))
        : pc.bold(pc.red('STATUS: FAILED'));

    lines.push(finalStatus);
    lines.push('');

    return lines.join('\n');
  }
}
