import {
  EvaluationRun,
  RegressionComparison,
  redactObject,
} from "@ai-eval/core";
import { Reporter, ReporterOutputOptions } from "./types.js";

export class JsonReporter implements Reporter {
  public readonly name = "json";

  format(
    run: EvaluationRun,
    regression?: RegressionComparison,
    _options?: ReporterOutputOptions,
  ): string {
    const payload = {
      run,
      regression:
        regression && regression.baselineId !== "none" ? regression : null,
      generatedAt: new Date().toISOString(),
    };

    const sanitized = redactObject(payload);
    return JSON.stringify(sanitized, null, 2);
  }
}
