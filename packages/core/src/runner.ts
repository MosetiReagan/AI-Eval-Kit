import crypto from 'node:crypto';
import {
  Dataset,
  EvalInput,
  EvalOutput,
  EvalTarget,
  EvaluationResult,
  EvaluationRun,
  EvaluatorContext,
  EvaluatorDefinition,
  RunnerOptions,
  TestCase,
  TestCaseResult,
  TokenUsage,
} from './types.js';
import { calculateLatencyStats } from './stats.js';
import { PricingRegistry } from './pricing.js';
import { ResponseCache } from './cache.js';
import { TimeoutError, ProviderError, AuthenticationError, InvalidOutputError, InvalidDatasetError } from './errors.js';

export interface EvaluatorInstance {
  definition: EvaluatorDefinition;
  weight: number;
  options?: Record<string, unknown>;
}

export interface RunExecutionOptions {
  projectName: string;
  evaluationName: string;
  target: EvalTarget;
  dataset: Dataset;
  evaluators: EvaluatorInstance[];
  modelName?: string;
  providerName?: string;
  targetVersion?: string;
  runnerOptions?: RunnerOptions;
  pricingRegistry?: PricingRegistry;
  cache?: ResponseCache;
  onProgress?: (completed: number, total: number, currentCase: TestCaseResult) => void;
}

export class EvalRunner {
  private async executeWithTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const controller = new AbortController();
    if (!timeoutMs || timeoutMs <= 0) {
      return fn(controller.signal);
    }

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError(`Target execution exceeded timeout of ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(controller.signal), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async executeWithRetries<T>(
    fn: () => Promise<T>,
    retries = 0,
    retryDelayMs = 500
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: unknown) {
        attempt++;
        // Do not retry non-retryable errors
        if (err instanceof ProviderError && !err.isRetryable) {
          throw err;
        }
        if (err instanceof AuthenticationError) {
          throw err;
        }
        if (err instanceof InvalidOutputError || err instanceof InvalidDatasetError) {
          throw err;
        }
        if (attempt > retries) {
          throw err;
        }
        // Exponential backoff with jitter
        const delay = retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private normalizeInput(input: EvalInput | string): EvalInput {
    if (typeof input === 'string') {
      return { message: input };
    }
    return input;
  }

  async runTestCase(
    testCase: TestCase,
    target: EvalTarget,
    evaluators: EvaluatorInstance[],
    options: {
      runnerOptions?: RunnerOptions;
      pricingRegistry?: PricingRegistry;
      cache?: ResponseCache;
      modelName?: string;
      targetVersion?: string;
    }
  ): Promise<TestCaseResult> {
    const input = this.normalizeInput(testCase.input);
    const pricing = options.pricingRegistry ?? new PricingRegistry();
    const startTime = Date.now();

    let output: EvalOutput | undefined;
    let targetError: Error | undefined;

    // Check cache
    let cacheKey: string | undefined;
    if (options.cache) {
      cacheKey = options.cache.generateKey([
        target.name,
        options.targetVersion ?? '1',
        options.modelName,
        input,
      ]);
      const cachedOutput = options.cache.get(cacheKey);
      if (cachedOutput) {
        output = cachedOutput;
      }
    }

    if (!output) {
      try {
        const timeoutMs = options.runnerOptions?.timeoutMs ?? 30000;
        const retries = options.runnerOptions?.retries ?? 0;
        const retryDelayMs = options.runnerOptions?.retryDelayMs ?? 500;

        output = await this.executeWithRetries(
          () => this.executeWithTimeout((signal) => target.run({ ...input, signal }), timeoutMs),
          retries,
          retryDelayMs
        );

        if (options.cache && cacheKey) {
          options.cache.set(cacheKey, output);
        }
      } catch (err: unknown) {
        targetError = err instanceof Error ? err : new Error(String(err));
      }
    }

    const durationMs = Date.now() - startTime;
    const latencyMs = output?.latencyMs ?? durationMs;

    const tokenUsage: TokenUsage = output?.tokenUsage ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    const cost = output?.cost ?? pricing.calculateCost(options.modelName, tokenUsage);

    const evaluatorResults: Record<string, EvaluationResult> = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let allEvaluatorsPassed = true;

    if (targetError) {
      for (const ev of evaluators) {
        evaluatorResults[ev.definition.name] = {
          score: 0,
          passed: false,
          reason: `Target error: ${targetError.message}`,
          error: targetError.message,
        };
      }
      return {
        id: testCase.id,
        case: testCase,
        output,
        passed: false,
        score: 0,
        latencyMs,
        cost,
        tokenUsage,
        evaluatorResults,
        error: {
          code: targetError instanceof ProviderError ? 'PROVIDER_ERROR' : 'EVALUATION_FAILED',
          message: targetError.message,
          stack: targetError.stack,
        },
      };
    }

    const evalOutput = output ?? { output: '' };

    for (const ev of evaluators) {
      try {
        const ctx: EvaluatorContext = {
          input,
          expected: testCase.expected,
          actual: evalOutput,
          context: testCase.context,
          metadata: testCase.metadata,
          options: ev.options,
        };

        const result = await ev.definition.evaluate(ctx);
        evaluatorResults[ev.definition.name] = result;

        const weight = ev.weight > 0 ? ev.weight : 1;
        totalWeightedScore += (result.score ?? 0) * weight;
        totalWeight += weight;

        if (!result.passed) {
          allEvaluatorsPassed = false;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        evaluatorResults[ev.definition.name] = {
          score: 0,
          passed: false,
          reason: `Evaluator runtime error: ${msg}`,
          error: msg,
        };
        const weight = ev.weight > 0 ? ev.weight : 1;
        totalWeight += weight;
        allEvaluatorsPassed = false;
      }
    }

    const caseScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return {
      id: testCase.id,
      case: testCase,
      output: evalOutput,
      passed: allEvaluatorsPassed,
      score: Number(caseScore.toFixed(4)),
      latencyMs,
      cost,
      tokenUsage,
      evaluatorResults,
    };
  }

  async run(options: RunExecutionOptions): Promise<EvaluationRun> {
    const startTime = Date.now();
    const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const cases = options.dataset.cases;
    const concurrency = Math.max(1, options.runnerOptions?.concurrency ?? 5);

    const caseResults: TestCaseResult[] = [];
    let completedCount = 0;

    // Queue worker pool
    let currentIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
      while (currentIndex < cases.length) {
        const index = currentIndex++;
        const testCase = cases[index];
        if (!testCase) break;

        const result = await this.runTestCase(testCase, options.target, options.evaluators, {
          runnerOptions: options.runnerOptions,
          pricingRegistry: options.pricingRegistry,
          cache: options.cache,
          modelName: options.modelName,
          targetVersion: options.targetVersion,
        });

        caseResults[index] = result;
        completedCount++;
        options.onProgress?.(completedCount, cases.length, result);

        if (options.runnerOptions?.stopOnFailure && !result.passed) {
          break;
        }
      }
    });

    await Promise.all(workers);

    // Filter out undefined in case of stopOnFailure
    const finalCases = caseResults.filter((c): c is TestCaseResult => Boolean(c));

    // Aggregate statistics
    const passedCases = finalCases.filter((c) => c.passed).length;
    const failedCases = finalCases.length - passedCases;
    const latencies = finalCases.map((c) => c.latencyMs);
    const latencyStats = calculateLatencyStats(latencies);

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const c of finalCases) {
      totalCost += c.cost;
      if (c.tokenUsage) {
        totalInputTokens += c.tokenUsage.inputTokens;
        totalOutputTokens += c.tokenUsage.outputTokens;
      }
    }

    // Evaluator score averages
    const evaluatorScores: Record<string, number> = {};
    for (const ev of options.evaluators) {
      const name = ev.definition.name;
      const scores = finalCases
        .map((c) => c.evaluatorResults[name]?.score)
        .filter((s): s is number => typeof s === 'number');
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      evaluatorScores[name] = Number(avg.toFixed(4));
    }

    // Overall score
    const totalScore = finalCases.reduce((sum, c) => sum + c.score, 0);
    const overallScore = finalCases.length > 0 ? Number((totalScore / finalCases.length).toFixed(4)) : 0;

    return {
      id: runId,
      projectName: options.projectName,
      evaluationName: options.evaluationName,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      targetName: options.target.name,
      modelName: options.modelName,
      providerName: options.providerName,
      totalCases: finalCases.length,
      passedCases,
      failedCases,
      overallScore,
      evaluatorScores,
      latencyStats,
      totalTokens: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      totalCost: Number(totalCost.toFixed(6)),
      cases: finalCases,
    };
  }
}
