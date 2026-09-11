import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { z } from "zod";
import { ProjectConfig } from "./types.js";
import { ConfigurationError } from "./errors.js";

export const PricingConfigSchema = z.object({
  inputPerMillionTokens: z.number().nonnegative().optional(),
  outputPerMillionTokens: z.number().nonnegative().optional(),
});

export const ProviderConfigSchema = z.object({
  type: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  seed: z.number().optional(),
  maxTokens: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
  options: z.record(z.unknown()).optional(),
});

export const EvaluatorConfigSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    weight: z.number().positive().optional(),
    options: z.record(z.unknown()).optional(),
  }),
]);

export const RegressionThresholdsSchema = z.object({
  maxScoreDrop: z.number().min(0).max(1).optional(),
  maxLatencyIncrease: z.number().min(0).optional(),
  maxCostIncrease: z.number().min(0).optional(),
  maxFailureIncrease: z.number().int().nonnegative().optional(),
});

export const RunnerOptionsSchema = z.object({
  concurrency: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryDelayMs: z.number().int().nonnegative().optional(),
  rateLimitPerMinute: z.number().int().positive().optional(),
  stopOnFailure: z.boolean().optional(),
});

export const EvaluationSpecSchema = z.object({
  name: z.string(),
  dataset: z.string(),
  target: z.string().optional(),
  evaluators: z.array(EvaluatorConfigSchema).min(1),
  threshold: z
    .object({
      score: z.number().min(0).max(1).optional(),
      passRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
  models: z.array(z.string()).optional(),
  prompts: z
    .array(
      z.object({
        name: z.string(),
        file: z.string().optional(),
        template: z.string().optional(),
      }),
    )
    .optional(),
  regression: RegressionThresholdsSchema.optional(),
  runner: RunnerOptionsSchema.optional(),
  cache: z
    .object({
      enabled: z.boolean().optional(),
      ttlMs: z.number().positive().optional(),
    })
    .optional(),
});

export const ProjectConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
  }),
  providers: z.record(ProviderConfigSchema).optional(),
  evaluations: z.array(EvaluationSpecSchema),
  regression: RegressionThresholdsSchema.optional(),
  runner: RunnerOptionsSchema.optional(),
  cache: z
    .object({
      enabled: z.boolean().optional(),
      ttlMs: z.number().positive().optional(),
    })
    .optional(),
  pricing: z.record(PricingConfigSchema).optional(),
});

/**
 * Interpolates environment variables in the format ${VAR} or ${VAR:-default}
 */
export function interpolateEnvVars(content: string): string {
  return content.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    const [varName, defaultValue] = expression.split(":-");
    const val = process.env[varName.trim()];
    if (val !== undefined && val !== "") {
      return val;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return "";
  });
}

/**
 * Finds config file in directory
 */
export function findConfigFile(cwd: string = process.cwd()): string | null {
  const candidates = ["ai-eval.yaml", "ai-eval.yml", "ai-eval.json"];
  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Loads and validates configuration file
 */
export function loadConfig(
  configPath?: string,
  cwd: string = process.cwd(),
): ProjectConfig {
  const resolvedPath = configPath
    ? path.resolve(cwd, configPath)
    : findConfigFile(cwd);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new ConfigurationError(
      `Configuration file not found. Looked in ${cwd} for ai-eval.yaml, ai-eval.yml, or ai-eval.json.`,
    );
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(resolvedPath, "utf8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigurationError(`Failed to read configuration file: ${msg}`);
  }

  const interpolated = interpolateEnvVars(rawContent);

  let parsed: unknown;
  try {
    if (resolvedPath.endsWith(".json")) {
      parsed = JSON.parse(interpolated);
    } else {
      parsed = yaml.parse(interpolated);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigurationError(`Malformed configuration file syntax: ${msg}`);
  }

  const parseResult = ProjectConfigSchema.safeParse(parsed);
  if (!parseResult.success) {
    const formattedErrors = parseResult.error.errors
      .map((e) => `  - ${e.path.join(".") || "root"}: ${e.message}`)
      .join("\n");
    throw new ConfigurationError(
      `Configuration validation failed:\n${formattedErrors}`,
    );
  }

  return parseResult.data as ProjectConfig;
}
