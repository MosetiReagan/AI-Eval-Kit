# AI Eval Kit

> Open-source evaluations, regression testing, and benchmarking for AI applications.

[![CI](https://github.com/reagan/ai-eval-kit/actions/workflows/test.yml/badge.svg)](https://github.com/reagan/ai-eval-kit/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

**AI Eval Kit** is a developer-first, local-first framework for evaluating LLM applications, agents, prompts, RAG pipelines, and AI workflows using datasets, deterministic checks, LLM-as-a-judge evaluators, model comparisons, and CI/CD regression testing.

It is **unit tests + integration tests + benchmarks** designed specifically for AI systems.

```text
Create evaluation dataset
        ↓
Define evaluator
        ↓
Run AI application
        ↓
Collect outputs
        ↓
Score outputs
        ↓
Compare against baseline
        ↓
Detect regressions
        ↓
Generate report
        ↓
Pass/fail CI
```

---

## Why AI Evaluations Matter

AI applications are increasingly built into production systems, but developers still lack an engineering workflow for answering critical questions:

- **Is the new model actually better?**
- **Did the latest prompt change make responses worse?**
- **Did a code change break an agent workflow?**
- **Which model performs best for this dataset?**
- **Which model is cheapest while maintaining quality?**
- **Are agents following tool instructions reliably?**
- **Is RAG retrieving the right context without hallucinating?**
- **Did the latest pull request introduce an AI regression?**

AI Eval Kit answers these questions objectively and reproducibly in local development and continuous integration.

---

## Features

- 🚀 **Local First & Offline Capable:** Runs entirely from your terminal without requiring a hosted SaaS account or database.
- 🛡️ **Regression Detection:** Establish performance baselines and automatically fail CI if scores drop, latency spikes, or failure counts increase.
- 🤖 **Agent Evaluations:** Evaluate tool calls, forbidden tools, call sequences, arguments, and multi-step actions.
- 🔍 **RAG Metrics:** Measure context relevance, context recall, answer relevance, groundedness, and citation integrity.
- ⚖️ **LLM-as-a-Judge & Heuristics:** Impartial AI judges with structured JSON scoring, plus fast deterministic checks.
- 📊 **Multi-Model Benchmarking:** Compare accuracy, latency, token usage, and cost across models side-by-side.
- 📋 **Multi-Format Reporting:** Terminal UI, GitHub PR Markdown, self-contained HTML reports, JSON, and JUnit XML.
- 🔒 **Security-First:** Automatic secret redaction for API keys, authorization headers, and path traversal protection.

---

## Installation

Install globally via npm or pnpm:

```bash
npm install -g ai-eval
```

Or install locally in your project:

```bash
npm install --save-dev ai-eval-kit
```

---

## Quick Start (30 Seconds)

Initialize a new evaluation project in your current repository:

```bash
npx ai-eval init
```

This generates:

```text
├── ai-eval.yaml          # Project configuration & regression thresholds
├── evals/
│   ├── basic.yaml        # Support & query evaluation cases
│   ├── factuality.yaml   # Groundedness & fact verification cases
│   └── safety.yaml       # Prompt injection & security guardrail tests
├── src/
│   └── app.ts            # Example target AI application
└── reports/              # Generated HTML, Markdown & JUnit reports
```

Validate configuration:

```bash
npx ai-eval validate
```

Run evaluations:

```bash
npx ai-eval test
```

Establish your first baseline:

```bash
npx ai-eval baseline set
```

View the local visual dashboard:

```bash
npx ai-eval dashboard
```

---

## Configuration (`ai-eval.yaml`)

Configuration is validated using Zod and supports environment variable interpolation with fallbacks (`${API_KEY}` or `${PORT:-3000}`).

```yaml
project:
  name: customer-support-agent
  version: 1.0.0

providers:
  # Deterministic mock provider (zero API keys required)
  mock:
    type: mock
    model: mock-model

  # OpenAI or any OpenAI-compatible gateway
  openai:
    type: openai
    apiKey: ${OPENAI_API_KEY}
    model: gpt-4o-mini

  # Anthropic
  anthropic:
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    model: claude-3-5-sonnet-20241022

evaluations:
  - name: customer-support
    dataset: ./evals/basic.yaml
    target: ./src/app.ts
    evaluators:
      - exact_match
      - contains
      - semantic_similarity
    threshold:
      score: 0.85

regression:
  maxScoreDrop: 0.03 # Max allowed score degradation (3%)
  maxLatencyIncrease: 0.25 # Max allowed latency increase (25%)
  maxCostIncrease: 0.30 # Max allowed cost increase (30%)
  maxFailureIncrease: 0 # 0 additional failures allowed

runner:
  concurrency: 5
  retries: 1
  timeoutMs: 30000

cache:
  enabled: true
```

---

## Datasets

AI Eval Kit natively loads datasets from **YAML**, **JSON**, **JSONL**, **CSV**, and **TypeScript**.

### YAML Format

```yaml
name: customer-support
cases:
  - id: refund-policy
    input: "What is your refund policy?"
    expected:
      contains:
        - refund
        - 30 days
    tags: ["billing", "production"]

  - id: fact-founded
    input: "When was the company founded?"
    context: "Acme Corp was founded in 2021 in San Francisco."
    expected:
      contains: "2021"
    tags: ["facts"]
```

### Dataset CLI Commands

```bash
ai-eval dataset list
ai-eval dataset validate ./evals/basic.yaml
ai-eval dataset sample ./evals/basic.yaml 3
```

Filter test executions:

```bash
ai-eval test --tag=billing
ai-eval test --case=refund-policy
```

---

## Evaluators

AI Eval Kit includes 14 built-in evaluators covering deterministic, structured, quality, RAG, and agent capabilities.

| Evaluator               | Category      | Description                                                                               |
| :---------------------- | :------------ | :---------------------------------------------------------------------------------------- |
| `exact_match`           | Deterministic | Exact string comparison with optional case, trim, and punctuation normalization.          |
| `contains`              | Deterministic | Checks for single substring or array of required substrings.                              |
| `regex`                 | Deterministic | Evaluates output against a regular expression pattern.                                    |
| `json_validity`         | Structured    | Checks if output contains valid JSON (handles markdown code fences).                      |
| `json_schema`           | Structured    | Validates JSON output against required fields and schemas.                                |
| `semantic_similarity`   | Quality       | Embedding cosine similarity with local vector fallback for offline mode.                  |
| `llm_judge`             | Quality       | Multi-criteria evaluation using an LLM as judge with structured machine-readable scoring. |
| `criteria`              | Quality       | Evaluates natural language rules (e.g. conciseness, tone, required facts).                |
| `hallucination`         | Groundedness  | Checks whether statements made in output are supported by supplied context.               |
| `rag_context_relevance` | RAG           | Measures how relevant retrieved context is to user input.                                 |
| `rag_context_recall`    | RAG           | Measures whether context contains facts required for expected answer.                     |
| `rag_answer_relevance`  | RAG           | Measures how directly output addresses user input.                                        |
| `rag_citation`          | RAG           | Verifies citation presence and correctness (`[Doc 1]`, `[Source]`).                       |
| `tool_call`             | Agent         | Asserts tool execution, forbidden tools, argument schema, and sequences.                  |

---

## Agent Evaluation

Agent evaluation is a first-class citizen. Validate complex agent behavior and tool calls:

```yaml
cases:
  - id: customer-lookup
    input: "Find order history for customer cust_123"
    expected:
      tools:
        required:
          - search_customer
        forbidden:
          - delete_customer
          - transfer_funds
        sequence:
          - authenticate_session
          - search_customer
        maxCalls: 3
```

Targets return structured tool calls:

```typescript
return {
  output: "Found 2 orders for customer cust_123",
  tool_calls: [
    { name: "authenticate_session", arguments: { token: "..." } },
    { name: "search_customer", arguments: { id: "cust_123" } },
  ],
};
```

---

## Model Benchmarking

Compare different models across the same evaluation dataset:

```bash
ai-eval compare --models gpt-4o-mini,claude-3-5-haiku,mock-model
```

Output:

```text
Model                  Score        Pass Rate      Latency      Cost
----------------------------------------------------------------------
gpt-4o-mini            94.2%        92.0%          120ms        $0.0004
claude-3-5-haiku       91.8%        90.0%          110ms        $0.0003
mock-model             88.5%        85.0%          25ms         $0.0000
```

---

## Regression Testing & CI/CD

Establish a performance baseline:

```bash
ai-eval baseline set
```

Run in continuous integration:

```bash
ai-eval test --ci --baseline
```

If a score degrades beyond configured thresholds:

```text
 ✗ AI REGRESSION DETECTED

  • Overall score dropped by 6.7% (94.0% → 87.3%), exceeding max allowed drop of 3.0%
  • Average latency increased by 35.0% (120ms → 162ms), exceeding max allowed increase of 25.0%
  • Failure count increased by 2 (1 → 3), exceeding max allowed failure increase of 0

Failed Cases Explorer:
----------------------------------------------------
[Case: refund-policy]
  Input:    What is your refund policy?
  Expected: {"contains":["refund","30 days"]}
  Actual:   Sorry, I cannot help with that.
  Evaluator: contains (0.0%) - Missing expected terms: [refund, 30 days]

STATUS: FAILED
```

Exit codes:

- `0`: All evaluations passed & no regression detected.
- `1`: Test failure or regression threshold violated.
- `2`: Configuration or runtime error.

### GitHub Actions Workflow (`.github/workflows/test.yml`)

```yaml
name: AI Evaluations

on:
  pull_request:
    branches: [main]

jobs:
  ai-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10.23.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: npx ai-eval test --ci --baseline --format=markdown >> $GITHUB_STEP_SUMMARY
```

---

## Evaluation Run Diffs

Compare two evaluation runs or compare a run against your established baseline:

```bash
# Compare two specific runs
ai-eval diff run_1726050100_a1b2 run_1726050500_c3d4

# Compare latest run against baseline
ai-eval diff baseline latest

# Output as markdown or JSON
ai-eval diff baseline latest --format markdown --output reports/diff.md
```

Terminal output highlights score changes, evaluator deltas, test case improvements (🟢), and regressions (🔻):

```text
Evaluation Run Diff:
  Run 1 (Before): base-001 (9/11/2026)
  Run 2 (After):  run_1726050500 (9/11/2026)

Metric               Run 1          Run 2          Delta
------------------------------------------------------------
Overall Score        95.0%          98.0%          +3.0%
Pass Rate            90.0%          100.0%         +10.0%
Avg Latency          140ms          110ms          -30ms
Total Cost           $0.0020        $0.0018        -$0.0002

Evaluator Breakdown:
  exact_match        92.0%        ➔ 96.0%          +4.0%
  contains           98.0%        ➔ 100.0%         +2.0%

🟢 Improvements (1 cases):
  ✓ c2: was 0.0%, now 100.0% (PASSED)
```

---

## CLI Command Reference

| Command                  | Description                         | Key Options                                                                                                                                                            |
| :----------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-eval init [dir]`     | Initialize new evaluation project   | Scaffold example configs & dataset                                                                                                                                     |
| `ai-eval test [eval]`    | Run evaluations                     | `--ci`, `--baseline`, `--update-baseline`, `--evaluator <name>`, `--tag <tag>`, `--case <id>`, `--concurrency <n>`, `--no-cache`, `--format <type>`, `--output <file>` |
| `ai-eval validate`       | Validate configuration & datasets   | Checks schema, targets, evaluators                                                                                                                                     |
| `ai-eval diff <r1> <r2>` | Compare two runs side-by-side       | `--format <terminal\|json\|markdown>`, `--output <file>`, `--ci`                                                                                                       |
| `ai-eval baseline`       | View or establish baseline          | `show` (default), `set [runId]`, `clear`                                                                                                                               |
| `ai-eval compare`        | Compare multiple models             | `--models <list>`, `--eval <name>`                                                                                                                                     |
| `ai-eval report [runId]` | Generate standalone report          | `--format <html\|markdown\|json\|junit>`, `--output <file>`                                                                                                            |
| `ai-eval history`        | Show execution history              | `clear`, `prune --keep <n>`, `--clear`, `--prune <n>`                                                                                                                  |
| `ai-eval dataset`        | Manage evaluation datasets          | `list`, `validate <file>`, `sample <file> [n]`                                                                                                                         |
| `ai-eval evaluator`      | Inspect evaluators                  | `list`, `inspect <name>`                                                                                                                                               |
| `ai-eval provider`       | Test and inspect LLM providers      | `list`, `test <provider>`                                                                                                                                              |
| `ai-eval doctor`         | Diagnose environment & dependencies | Validates Node, API keys, paths                                                                                                                                        |
| `ai-eval dashboard`      | Launch local visual dashboard       | `--port <port>` (3000), `--host <host>` (127.0.0.1)                                                                                                                    |

---

## Reporting

Generate reports in multiple formats:

```bash
# Terminal (default)
ai-eval test

# GitHub PR Markdown
ai-eval test --format=markdown

# Self-contained HTML report
ai-eval report --format=html --output=reports/report.html

# Machine-readable JSON
ai-eval test --format=json

# JUnit XML for CI pipelines
ai-eval test --format=junit --output=reports/junit.xml
```

---

## Programmatic SDK

AI Eval Kit can be used programmatically in any Node.js / TypeScript project:

```typescript
import { evaluate, defineTarget } from "ai-eval-kit";

const target = defineTarget("my-agent", async (input) => {
  const response = await callMyAgent(input.message);
  return { output: response };
});

const result = await evaluate({
  target,
  dataset: "./evals/basic.yaml",
  evaluators: ["exact_match", "contains", "semantic_similarity"],
  baseline: true,
});

console.log(`Overall Score: ${(result.run.overallScore * 100).toFixed(1)}%`);
```

### Custom Evaluators

```typescript
import { defineEvaluator } from "ai-eval-kit";

export const sentimentEvaluator = defineEvaluator({
  name: "sentiment_positive",
  description: "Ensures tone is positive and professional",
  evaluate(context) {
    const text = context.actual.output.toLowerCase();
    const passed = text.includes("pleasure") || text.includes("happy to help");
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed ? "Positive tone detected" : "Lacks positive sign-off",
    };
  },
});
```

---

## Security & Privacy

- **Zero Secret Leaks:** API keys, Authorization headers (`Bearer ...`), and sensitive environment variables are automatically redacted from all CLI output, HTML reports, Markdown logs, and cache stores.
- **Local Processing:** Datasets and outputs remain on your machine. No telemetry or tracking servers are involved.
- **Offline Mode:** Built-in deterministic mock provider and local token similarity vector algorithms enable 100% offline evaluation without external network access.

---

## Architecture

```text
ai-eval-kit/
│
├── apps/
│   └── cli/             # CLI binary executable (ai-eval) & local dashboard server
│
├── packages/
│   ├── core/            # Config, types, baseline, regression engine, runner, cache, errors
│   ├── evaluators/      # Deterministic, RAG, agent, JSON, LLM-as-a-judge evaluators
│   ├── providers/       # Mock, OpenAI, Anthropic, Gemini, Ollama, HTTP adapters
│   ├── datasets/        # YAML, JSON, JSONL, CSV loaders, filtering, sampling
│   ├── reporters/       # Terminal, Markdown, HTML, JSON, JUnit XML reporters
│   └── sdk/             # High-level programmatic API (ai-eval-kit)
│
├── fixtures/            # Realistic test fixtures (agent, rag, structured-output, etc.)
├── tests/               # Automated unit, integration, and e2e test suite
└── .github/             # GitHub Actions CI workflow & issue templates
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full release history and release notes.

---

## License

MIT © 2026 AI Eval Kit Maintainers.
