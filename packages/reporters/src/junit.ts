import { EvaluationRun, RegressionComparison } from '@ai-eval/core';
import { Reporter, ReporterOutputOptions } from './types.js';

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class JunitReporter implements Reporter {
  public readonly name = 'junit';

  format(run: EvaluationRun, regression?: RegressionComparison, _options?: ReporterOutputOptions): string {
    const durationSec = (run.durationMs / 1000).toFixed(3);
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      `<testsuites name="ai-eval" tests="${run.totalCases}" failures="${run.failedCases}" errors="0" time="${durationSec}">`
    );
    lines.push(
      `  <testsuite name="${escapeXml(run.evaluationName)}" tests="${run.totalCases}" failures="${run.failedCases}" errors="0" time="${durationSec}" timestamp="${escapeXml(run.timestamp)}">`
    );

    for (const c of run.cases) {
      const caseTime = (c.latencyMs / 1000).toFixed(3);
      lines.push(
        `    <testcase classname="${escapeXml(run.evaluationName)}" name="${escapeXml(c.id)}" time="${caseTime}">`
      );

      if (!c.passed) {
        const failedEvaluators = Object.entries(c.evaluatorResults).filter(([_, r]) => !r.passed);
        const reason = failedEvaluators.map(([name, r]) => `${name}: ${r.reason ?? 'Failed'}`).join('; ');
        const details = `Input: ${JSON.stringify(c.case.input)}\nExpected: ${JSON.stringify(c.case.expected)}\nActual: ${c.output?.output ?? 'none'}`;
        lines.push(
          `      <failure message="${escapeXml(reason)}" type="AssertionError">${escapeXml(details)}</failure>`
        );
      }

      lines.push('    </testcase>');
    }

    if (regression?.hasRegression) {
      lines.push('    <testcase classname="regression" name="baseline-check" time="0.001">');
      lines.push(
        `      <failure message="AI Regression Detected" type="RegressionError">${escapeXml(regression.violations.join('\n'))}</failure>`
      );
      lines.push('    </testcase>');
    }

    lines.push('  </testsuite>');
    lines.push('</testsuites>');

    return lines.join('\n');
  }
}
