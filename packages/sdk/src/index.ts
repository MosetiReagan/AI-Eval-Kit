import {
  Dataset,
  EvalInput,
  EvalOutput,
  EvalRunner,
  EvalTarget,
  EvaluationRun,
  EvaluatorDefinition,
  PricingConfig,
  PricingRegistry,
  RegressionComparison,
  RegressionThresholds,
  RunnerOptions,
  BaselineManager,
  HistoryManager,
  ResponseCache,
} from '@ai-eval/core';
import { loadDataset } from '@ai-eval/datasets';
import {
  defaultEvaluatorRegistry,
} from '@ai-eval/evaluators';
import {
  Provider,
  defaultProviderRegistry,
} from '@ai-eval/providers';

export * from '@ai-eval/core';
export * from '@ai-eval/datasets';
export * from '@ai-eval/evaluators';
export * from '@ai-eval/providers';
export * from '@ai-eval/reporters';

export interface EvaluateOptions {
  target: EvalTarget | ((input: EvalInput) => Promise<EvalOutput | string>);
  dataset: Dataset | string;
  evaluators: (string | EvaluatorDefinition | { name: string; weight?: number; options?: Record<string, unknown> })[];
  projectName?: string;
  evaluationName?: string;
  modelName?: string;
  provider?: Provider | string;
  runnerOptions?: RunnerOptions;
  pricing?: Record<string, PricingConfig>;
  cache?: boolean;
  baseline?: boolean | string | EvaluationRun;
  thresholds?: RegressionThresholds;
  cwd?: string;
  onProgress?: (completed: number, total: number) => void;
}

export interface EvaluateResult {
  run: EvaluationRun;
  regression?: RegressionComparison;
}

/**
 * Helper to define an EvalTarget easily
 */
export function defineTarget(
  name: string,
  runFn: (input: EvalInput) => Promise<EvalOutput | string>
): EvalTarget {
  return {
    name,
    async run(input: EvalInput): Promise<EvalOutput> {
      const result = await runFn(input);
      if (typeof result === 'string') {
        return { output: result };
      }
      return result;
    },
  };
}

/**
 * Main programmatic evaluation function
 */
export async function evaluate(options: EvaluateOptions): Promise<EvaluateResult> {
  const cwd = options.cwd ?? process.cwd();

  // Resolve dataset
  let dataset: Dataset;
  if (typeof options.dataset === 'string') {
    dataset = await loadDataset(options.dataset, cwd);
  } else {
    dataset = options.dataset;
  }

  // Resolve target
  let target: EvalTarget;
  if (typeof options.target === 'function') {
    target = defineTarget('custom-target', options.target);
  } else {
    target = options.target;
  }

  // Resolve provider
  let providerInstance: Provider | undefined;
  if (typeof options.provider === 'string') {
    providerInstance = defaultProviderRegistry.get(options.provider);
  } else if (options.provider) {
    providerInstance = options.provider;
  }

  // Resolve evaluators
  const evaluatorInstances = options.evaluators.map((ev) => {
    if (typeof ev === 'string') {
      const def = defaultEvaluatorRegistry.get(ev);
      if (!def) {
        throw new Error(`Evaluator "${ev}" not found in registry`);
      }
      return { definition: def, weight: 1 };
    }

    if ('evaluate' in ev) {
      return { definition: ev, weight: 1 };
    }

    const def = defaultEvaluatorRegistry.get(ev.name);
    if (!def) {
      throw new Error(`Evaluator "${ev.name}" not found in registry`);
    }
    return { definition: def, weight: ev.weight ?? 1, options: ev.options };
  });

  // Setup pricing and cache
  const pricingRegistry = new PricingRegistry(options.pricing);
  const cache = options.cache !== false ? new ResponseCache(cwd, options.cache ?? true) : undefined;

  const runner = new EvalRunner();
  const run = await runner.run({
    projectName: options.projectName ?? 'ai-eval-project',
    evaluationName: options.evaluationName ?? dataset.name,
    target,
    dataset,
    evaluators: evaluatorInstances,
    modelName: options.modelName ?? providerInstance?.model,
    providerName: providerInstance?.name,
    runnerOptions: options.runnerOptions,
    pricingRegistry,
    cache,
    onProgress: (completed, total) => options.onProgress?.(completed, total),
  });

  // Save to history
  const history = new HistoryManager(cwd);
  history.saveRun(run);

  // Check baseline / regression
  const baselineManager = new BaselineManager(cwd);
  let regression: RegressionComparison | undefined;

  if (options.baseline) {
    let baseRun: EvaluationRun | null = null;
    if (typeof options.baseline === 'string') {
      baseRun = history.getRun(options.baseline);
    } else if (typeof options.baseline === 'object') {
      baseRun = options.baseline;
    } else {
      baseRun = baselineManager.getBaseline();
    }
    regression = baselineManager.compare(run, baseRun, options.thresholds);
  }

  return {
    run,
    regression,
  };
}

/**
 * Model benchmarking function: runs the same evaluation across multiple models
 */
export async function compareModels(options: {
  models: { model: string; provider: Provider }[];
  dataset: Dataset | string;
  evaluators: (string | EvaluatorDefinition)[];
  projectName?: string;
  runnerOptions?: RunnerOptions;
  cwd?: string;
}): Promise<Array<{ model: string; provider: string; run: EvaluationRun }>> {
  const results: Array<{ model: string; provider: string; run: EvaluationRun }> = [];

  for (const item of options.models) {
    const target: EvalTarget = {
      name: `${item.provider.name}:${item.model}`,
      async run(input: EvalInput): Promise<EvalOutput> {
        const messages = input.messages ?? [{ role: 'user', content: input.message ?? '' }];
        const resp = await item.provider.chat(messages);
        return {
          output: resp.output,
          tool_calls: resp.toolCalls,
          latencyMs: resp.latencyMs,
          tokenUsage: resp.tokenUsage,
          raw: resp.raw,
        };
      },
    };

    const res = await evaluate({
      target,
      dataset: options.dataset,
      evaluators: options.evaluators,
      modelName: item.model,
      provider: item.provider,
      projectName: options.projectName ?? 'model-benchmark',
      runnerOptions: options.runnerOptions,
      cwd: options.cwd,
    });

    results.push({
      model: item.model,
      provider: item.provider.name,
      run: res.run,
    });
  }

  return results;
}
