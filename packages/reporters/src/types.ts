import { EvaluationRun, RegressionComparison } from '@ai-eval/core';

export interface ReporterOutputOptions {
  verbose?: boolean;
  quiet?: boolean;
  outputFilePath?: string;
}

export interface Reporter {
  name: string;
  format(run: EvaluationRun, regression?: RegressionComparison, options?: ReporterOutputOptions): string;
  write?(run: EvaluationRun, regression?: RegressionComparison, options?: ReporterOutputOptions): Promise<void> | void;
}
