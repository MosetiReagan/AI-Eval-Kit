import { describe, it, expect } from 'vitest';
import { EvalRunner, ResponseCache, HistoryManager, ProviderError, AuthenticationError, RateLimiter } from '@ai-eval/core';
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

  it('evicts least-recently-used cache entries when maxEntries is exceeded', async () => {
    const tmpDir = path.resolve(__dirname, '../.tmp-cache-lru-test');
    fs.mkdirSync(tmpDir, { recursive: true });

    // Cache with maxEntries = 2
    const cache = new ResponseCache(tmpDir, true, 2);
    const k1 = cache.generateKey(['item-1']);
    const k2 = cache.generateKey(['item-2']);
    const k3 = cache.generateKey(['item-3']);

    cache.set(k1, { output: 'out-1' });
    await new Promise((r) => setTimeout(r, 20));
    cache.set(k2, { output: 'out-2' });
    await new Promise((r) => setTimeout(r, 20));

    // Access k1 to make k2 the least recently used
    expect(cache.get(k1)?.output).toBe('out-1');
    await new Promise((r) => setTimeout(r, 20));

    // Adding 3rd item must evict k2 (oldest mtime)
    cache.set(k3, { output: 'out-3' });

    expect(cache.get(k1)?.output).toBe('out-1');
    expect(cache.get(k3)?.output).toBe('out-3');
    expect(cache.get(k2)).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prunes history runs when maxRuns is exceeded and supports clear', async () => {
    const tmpDir = path.resolve(__dirname, '../.tmp-history-test');
    fs.mkdirSync(tmpDir, { recursive: true });

    const history = new HistoryManager(tmpDir, 2); // maxRuns = 2
    const makeRun = (id: string, timeOffsetMs: number) => ({
      id,
      projectName: 'p',
      evaluationName: 'e',
      timestamp: new Date(Date.now() + timeOffsetMs).toISOString(),
      durationMs: 100,
      targetName: 't',
      totalCases: 1,
      passedCases: 1,
      failedCases: 0,
      overallScore: 1,
      evaluatorScores: {},
      latencyStats: { avgMs: 10, medianMs: 10, p95Ms: 10, p99Ms: 10, minMs: 10, maxMs: 10 },
      totalTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalCost: 0,
      cases: [],
    });

    history.saveRun(makeRun('run-1', -2000));
    history.saveRun(makeRun('run-2', -1000));
    history.saveRun(makeRun('run-3', 0));

    // Only 2 newest runs should remain
    const runs = history.listRuns();
    expect(runs.length).toBe(2);
    expect(runs.map((r) => r.id)).toEqual(['run-3', 'run-2']);
    expect(history.getRun('run-1')).toBeNull();

    // Clear all runs
    const cleared = history.clear();
    expect(cleared).toBe(2);
    expect(history.listRuns().length).toBe(0);

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

  it('RateLimiter throttles execution rate', async () => {
    // 1200 per minute = 20 per second = 50ms interval
    const limiter = new RateLimiter(1200, 1);
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    // With 1 initial token, the 2 subsequent acquires must wait at least ~80ms
    expect(elapsed).toBeGreaterThanOrEqual(70);
  });

  it('enforces rateLimitPerMinute in EvalRunner.run', async () => {
    const runner = new EvalRunner();
    const timestamps: number[] = [];
    const target = {
      name: 'rate-limited-target',
      async run() {
        timestamps.push(Date.now());
        return { output: 'ok' };
      },
    };

    const dataset = {
      name: 'rate-limit-ds',
      cases: [
        { id: 'c1', input: 'test1' },
        { id: 'c2', input: 'test2' },
      ],
    };

    // 1200 RPM = 50ms per token, initialTokens = 1 -> 2nd case waits ~50ms
    await runner.run({
      projectName: 'test',
      evaluationName: 'test',
      target,
      dataset,
      evaluators: [],
      runnerOptions: { concurrency: 2, rateLimitPerMinute: 1200 },
    });

    expect(timestamps.length).toBe(2);
    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(35);
  });
});
