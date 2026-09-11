# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-09-11

### Added

- **Core Engine:**
  - Robust Zod-backed project and evaluation configuration loader (`ai-eval.yaml`, `ai-eval.json`).
  - Safe environment variable interpolation (`${VAR}`, `${VAR:-default}`).
  - Response caching with SHA-256 key hashing and code-change invalidation.
  - Baseline management and regression detection engine (score degradation, latency increase, cost increase, failure increase).
  - Pricing registry with built-in token cost estimation for leading LLMs and custom overrides.
  - Multi-worker concurrent evaluation runner with timeouts, exponential backoff retries, and progress callbacks.
  - Automated secret redaction and HTML escaping for report security.
- **Provider Adapters:**
  - Deterministic `MockProvider` with regex rules, latency simulation, and error induction (zero API keys needed).
  - `OpenAICompatibleProvider` for OpenAI, Groq, DeepSeek, vLLM, and gateway endpoints.
  - `AnthropicProvider` supporting Messages API and tool-calling.
  - `GeminiProvider` for Google Gemini models.
  - `OllamaProvider` for local offline models.
  - `HttpProvider` for custom REST microservices.
- **Evaluators:**
  - Deterministic: `exact_match`, `contains`, `regex`.
  - Structured data: `json_validity`, `json_schema`.
  - Semantic: `semantic_similarity` (provider embeddings + local token vector fallback).
  - Quality & Judges: `llm_judge` (structured criteria scoring), `criteria` evaluator.
  - Groundedness: `hallucination` detection against context.
  - RAG: `rag_context_relevance`, `rag_context_recall`, `rag_answer_relevance`, `rag_citation`.
  - Agents: `tool_call` evaluator (required, forbidden, sequences, argument assertions).
- **Dataset System:**
  - Support for YAML, JSON, JSONL, CSV, and TypeScript datasets.
  - Dataset filtering by tags, case IDs, text search, and seeded pseudo-random sampling.
  - Dataset validation and structural diagnostics.
- **Reporters:**
  - Beautiful Terminal reporter with color-coded badges, progress, and failure explorer.
  - Machine-readable JSON reporter.
  - GitHub PR-ready Markdown reporter with collapsible failure cards.
  - JUnit XML reporter for CI/CD pipelines.
  - Standalone, interactive HTML report with metrics cards and filtering.
- **CLI (`ai-eval`):**
  - Commands: `init`, `test`, `run`, `validate`, `baseline`, `compare`, `report`, `history`, `dataset`, `evaluator`, `provider`, `doctor`, `dashboard`.
- **Local Dashboard:**
  - Lightweight built-in dashboard server serving interactive UI and REST API.
- **SDK:**
  - Programmatic API `evaluate()`, `compareModels()`, `defineEvaluator()`, `defineTarget()`.
