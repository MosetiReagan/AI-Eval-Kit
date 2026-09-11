import { describe, it, expect } from 'vitest';
import { EvalRunner, ResponseCache, ProviderError, AuthenticationError } from '@ai-eval/core';
import { exactMatchEvaluator, containsEvaluator } from '@ai-eval/evaluators';
import { MockProvider } from '@ai-eval/providers';
import fs from 'node:fs';
import path from 'node:path';

describe('EvalRunner & Caching', () => {
  it('executes test cases and computes scores and stats', async () => {
    const runner = new EvalRunner();
    const mockProvider = new MockProvider();
    mockProvider.addRule({ match: 'q1', response: 'answer1' });
    mockProvider.addRule({ match: 'q2', response: 'wrong' });

    const target = {
      name: 'mock-target',
      async run(input: any) {
        const res = await mockProvider.chat([{ role: 'user', content: input.message }]);
        return { output: res.output, tokenUsage: res.tokenUsage, latencyMs: res.latencyMs };
      },
    };

    const dataset = {
      name: 'runner-test-dataset',
      cases: [
        { id: 'c1', input: 'q1', expected: { exact: 'answer1' } },
        { id: 'c2', input: 'q2', expected: { exact: 'answer2' } },
      ],
    };

    const run = await runner.run({
      projectName: 'test-project',
      evaluationName: 'test-eval',
      target,
      dataset,
      evaluators: [
        { definition: exactMatchEvaluator, weight: 1 },
        { definition: containsEvaluator, weight: 1 },
      ],
    });

    expect(run.totalCases).toBe(2);
    expect(run.passedCases).toBe(1);
    expect(run.failedCases).toBe(1);
    expect(run.overallScore).toBe(0.5);
    expect(run.latencyStats.avgMs).toBeGreaterThanOrEqual(0);
  });

  it('caches target responses to avoid recomputation', async () => {
    const tmpDir = path.resolve(__dirname, '../.tmp-cache-test');
    fs.mkdirSync(tmpDir, { recursive: true });

    const cache = new ResponseCache(tmpDir, true);
    const key = cache.generateKey(['target-a', 'input-1']);

    cache.set(key, { output: 'cached output value', latencyMs: 5 });
    const cached = cache.get(key);
    expect(cached?.output).toBe('cached output value');

    cache.clear();
    expect(cache.get(key)).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('does not retry non-retryable ProviderError or AuthenticationError', async () => {
    const runner = new EvalRunner();
    let callCount = 0;
    const target = {
      name: 'fail-target',
      async run() {
        callCount++;
        throw new AuthenticationError('Bad API Key');
      },
    };

    const dataset = {
      name: 'fail-ds',
      cases: [{ id: 'c1', input: 'test' }],
    };

    await runner.run({
      projectName: 'test',
      evaluationName: 'test',
      target,
      dataset,
      evaluators: [],
      runnerOptions: { retries: 3 },
    });

    expect(callCount).toBe(1); // Should not retry auth errors
  });
  it('halts all concurrent workers when stopOnFailure is true', async () => {
    const runner = new EvalRunner();
    let runsCount = 0;
    const target = {
      name: 'stop-target',
      async run() {
        runsCount++;
        return { output: runsCount === 1 ? 'wrong' : 'correct' };
      },
    };

    const dataset = {
      name: 'stop-ds',
      cases: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        input: `test ${i + 1}`,
        expected: { exact: 'correct' },
      })),
    };

    const run = await runner.run({
      projectName: 'test',
      evaluationName: 'test',
      target,
      dataset,
      evaluators: [{ definition: exactMatchEvaluator, weight: 1 }],
      runnerOptions: { concurrency: 4, stopOnFailure: true },
    });

    expect(run.stopReason).toBe('failure');
    expect(run.skippedCases).toBeGreaterThan(0);
  });
});
