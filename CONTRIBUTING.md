# Contributing to AI Eval Kit

Thank you for contributing to AI Eval Kit! We welcome bug fixes, documentation improvements, new evaluators, and provider adapters.

## Development Workflow

1. **Prerequisites:**
   - Node.js >= 20.0.0
   - pnpm >= 9.0.0

2. **Clone and Install:**

   ```bash
   git clone https://github.com/reagan/ai-eval-kit.git
   cd ai-eval-kit
   pnpm install
   ```

3. **Build Packages:**

   ```bash
   pnpm build
   ```

4. **Run Test Suite:**

   ```bash
   pnpm test
   ```

5. **Adding Evaluators:**
   - Add new evaluators under `packages/evaluators/src/`.
   - Implement the `defineEvaluator` interface returning structured `{ score, passed, reason, metadata }`.
   - Register in `EvaluatorRegistry`.
   - Add test coverage in `tests/evaluators.test.ts`.

6. **Adding Provider Adapters:**
   - Implement the `Provider` interface under `packages/providers/src/`.
   - Register in `ProviderRegistry`.
   - Add test cases in `tests/providers.test.ts`.

7. **Submitting Changes:**
   - Open a pull request against the `main` branch with a clear description of the problem and solution.
   - Ensure all CI tests pass.
