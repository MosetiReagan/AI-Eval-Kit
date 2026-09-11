# Security Policy

AI Eval Kit is designed and treated as security-sensitive developer and CI infrastructure.

## Trust Boundaries & Local Execution

1. **Local-First Processing:** AI Eval Kit does not transmit your dataset or evaluation outputs to third-party tracking services or hosted dashboards.
2. **Provider Interactions:** When running evaluations with configured external LLM providers (e.g. OpenAI, Anthropic, Google Gemini), prompts and context are sent directly to the specified provider endpoints over HTTPS.
3. **Secret Redaction:**
   - Authorization headers (`Bearer ...`), API keys (`sk-...`, `AIza...`, `ghp_...`), and environment variables matching sensitive patterns (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`) are automatically redacted from all terminal outputs, markdown logs, HTML reports, and JSON artifacts.
   - Secrets are never written to response caches or serialized run history.
4. **Path Traversal Protection:** Dataset resolution and report file generation are validated against path traversal attacks.
5. **Report Sanitization:** HTML report generation escapes unsafe HTML inputs and actual outputs to prevent Cross-Site Scripting (XSS).

## Reporting a Vulnerability

If you discover a security vulnerability within AI Eval Kit, please do not disclose it via a public GitHub issue.

Please report vulnerabilities privately to the maintainers at `security@ai-eval-kit.dev` or through GitHub Private Vulnerability Reporting. You will receive a response within 48 hours.
