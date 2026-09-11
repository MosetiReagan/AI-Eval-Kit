/**
 * AI Eval Kit - Core Type Definitions
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown> | string;
}

export interface AgentStep {
  step: number;
  action?: string;
  input?: unknown;
  output?: unknown;
  tool_calls?: ToolCall[];
  latencyMs?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface PricingConfig {
  inputPerMillionTokens?: number;
  outputPerMillionTokens?: number;
}

export interface EvalInput {
  message?: string;
  messages?: ChatMessage[];
  context?: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
  [key: string]: unknown;
}

export interface EvalOutput {
  output: string;
  raw?: unknown;
  tool_calls?: ToolCall[];
  steps?: AgentStep[];
  latencyMs?: number;
  tokenUsage?: TokenUsage;
  cost?: number;
  metadata?: Record<string, unknown>;
}

export interface ExpectedTools {
  required?: string[];
  forbidden?: string[];
  maxCalls?: number;
  sequence?: string[];
}

export interface EvalExpected {
  exact?: string;
  contains?: string | string[];
  regex?: string;
  jsonSchema?: Record<string, unknown>;
  criteria?: string[];
  tools?: ExpectedTools;
  [key: string]: unknown;
}

export interface TestCase {
  id: string;
  input: EvalInput | string;
  expected?: EvalExpected;
  context?: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface Dataset {
  name: string;
  description?: string;
  cases: TestCase[];
  metadata?: Record<string, unknown>;
}

export interface EvaluationResult {
  score: number; // Normalized 0 to 1
  passed: boolean;
  reason?: string;
  metrics?: Record<string, number>;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface EvaluatorContext {
  input: EvalInput;
  expected?: EvalExpected;
  actual: EvalOutput;
  context?: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  provider?: any;
  options?: Record<string, unknown>;
}

export interface EvaluatorDefinition {
  name: string;
  description?: string;
  evaluate(context: EvaluatorContext): Promise<EvaluationResult> | EvaluationResult;
}

export interface EvalTarget {
  name: string;
  run(input: EvalInput): Promise<EvalOutput>;
}

export type ErrorCode =
  | 'EVALUATION_FAILED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_OUTPUT'
  | 'INVALID_DATASET'
  | 'CONFIGURATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'REGRESSION_ERROR'
  | 'UNKNOWN_ERROR';

export interface EvalErrorDetail {
  code: ErrorCode;
  message: string;
  stack?: string;
  retriesExhausted?: boolean;
}

export interface TestCaseResult {
  id: string;
  case: TestCase;
  output?: EvalOutput;
  passed: boolean;
  score: number;
  latencyMs: number;
  cost: number;
  tokenUsage?: TokenUsage;
  evaluatorResults: Record<string, EvaluationResult>;
  error?: EvalErrorDetail;
}

export interface LatencyStats {
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

export interface EvaluationRun {
  id: string;
  projectName: string;
  evaluationName: string;
  timestamp: string;
  durationMs: number;
  targetName: string;
  modelName?: string;
  providerName?: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  overallScore: number;
  evaluatorScores: Record<string, number>;
  latencyStats: LatencyStats;
  totalTokens: TokenUsage;
  totalCost: number;
  cases: TestCaseResult[];
  metadata?: Record<string, unknown>;
}

export interface CaseRegression {
  id: string;
  baselinePassed: boolean;
  currentPassed: boolean;
  baselineScore: number;
  currentScore: number;
  reason?: string;
}

export interface RegressionComparison {
  baselineId: string;
  currentId: string;
  baselineScore: number;
  currentScore: number;
  scoreDrop: number;
  baselineLatencyMs: number;
  currentLatencyMs: number;
  latencyIncreasePct: number;
  baselineCost: number;
  currentCost: number;
  costIncreasePct: number;
  baselineFailures: number;
  currentFailures: number;
  hasRegression: boolean;
  violations: string[];
  caseRegressions: CaseRegression[];
}

export interface RegressionThresholds {
  maxScoreDrop?: number; // e.g. 0.05 for 5% drop
  maxLatencyIncrease?: number; // e.g. 0.20 for 20% increase
  maxCostIncrease?: number; // e.g. 0.30 for 30% increase
  maxFailureIncrease?: number; // absolute number of additional failures allowed
}

export interface EvaluatorConfig {
  name: string;
  weight?: number;
  options?: Record<string, unknown>;
}

export interface EvaluationSpec {
  name: string;
  dataset: string;
  target?: string;
  evaluators: (string | EvaluatorConfig)[];
  threshold?: {
    score?: number;
    passRate?: number;
  };
  models?: string[];
  prompts?: { name: string; file?: string; template?: string }[];
  regression?: RegressionThresholds;
  runner?: RunnerOptions;
  cache?: { enabled?: boolean; ttlMs?: number };
}

export interface RunnerOptions {
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  rateLimitPerMinute?: number;
  stopOnFailure?: boolean;
}

export interface ProjectConfig {
  project: {
    name: string;
    version?: string;
    description?: string;
  };
  providers?: Record<string, ProviderConfig>;
  evaluations: EvaluationSpec[];
  regression?: RegressionThresholds;
  runner?: RunnerOptions;
  cache?: { enabled?: boolean; ttlMs?: number };
  pricing?: Record<string, PricingConfig>;
}

export interface ProviderConfig {
  type: 'openai' | 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama' | 'http' | 'mock' | string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  seed?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
}
