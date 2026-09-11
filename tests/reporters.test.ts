import { describe, it, expect } from 'vitest';
import { TerminalReporter, JsonReporter, MarkdownReporter, JunitReporter, HtmlReporter } from '@ai-eval/reporters';
import { EvaluationRun } from '@ai-eval/core';

describe('Reporters Suite', () => {
  const mockRun: EvaluationRun = {
    id: 'run-rep-01',
    projectName: 'support-agent',
    evaluationName: 'customer-support',
    timestamp: new Date().toISOString(),
    durationMs: 1500,
    targetName: 'support-target',
    totalCases: 2,
    passedCases: 1,
    failedCases: 1,
    overallScore: 0.85,
    evaluatorScores: { exact_match: 1.0, contains: 0.7 },
    latencyStats: { avgMs: 120, medianMs: 120, p95Ms: 150, p99Ms: 150, minMs: 90, maxMs: 150 },
    totalTokens: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    totalCost: 0.0015,
    cases: [
      {
        id: 'case-1',
        case: { id: 'case-1', input: 'Hello' },
        passed: true,
        score: 1.0,
        latencyMs: 90,
        cost: 0.0007,
        evaluatorResults: { exact_match: { score: 1, passed: true } },
      },
      {
        id: 'case-2',
        case: { id: 'case-2', input: 'Refund please' },
        passed: false,
        score: 0.7,
        latencyMs: 150,
        cost: 0.0008,
        output: { output: 'No refunds allowed' },
        evaluatorResults: { contains: { score: 0.7, passed: false, reason: 'Missing 30 days' } },
      },
    ],
  };

  it('TerminalReporter outputs formatted text with scores', () => {
    const reporter = new TerminalReporter();
    const output = reporter.format(mockRun);
    expect(output).toContain('AI Eval Kit');
    expect(output).toContain('support-agent');
    expect(output).toContain('exact_match');
    expect(output).toContain('Failed Cases Explorer');
  });

  it('JsonReporter generates parseable JSON', () => {
    const reporter = new JsonReporter();
    const jsonStr = reporter.format(mockRun);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.run.id).toBe('run-rep-01');
    expect(parsed.run.overallScore).toBe(0.85);
  });

  it('MarkdownReporter generates GitHub markdown table', () => {
    const reporter = new MarkdownReporter();
    const md = reporter.format(mockRun);
    expect(md).toContain('# AI Evaluation Report');
    expect(md).toContain('| Metric | Value |');
    expect(md).toContain('`exact_match`');
    expect(md).toContain('<details>');
  });

  it('JunitReporter outputs valid XML', () => {
    const reporter = new JunitReporter();
    const xml = reporter.format(mockRun);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites name="ai-eval" tests="2" failures="1"');
    expect(xml).toContain('<testcase classname="customer-support" name="case-1"');
  });

  it('HtmlReporter generates self-contained HTML', () => {
    const reporter = new HtmlReporter();
    const html = reporter.format(mockRun);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AI Eval Kit Report');
    expect(html).toContain('case-1');
    expect(html).toContain('filterCases');
  });
});
