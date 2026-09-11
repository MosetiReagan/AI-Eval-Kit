import { describe, it, expect } from "vitest";
import path from "node:path";
import { interpolateEnvVars, loadConfig, PricingRegistry } from "@ai-eval/core";

describe("Configuration System", () => {
  it("interpolates environment variables with defaults", () => {
    process.env["TEST_AI_KEY"] = "secret-12345";
    const template =
      "key: ${TEST_AI_KEY}, fallback: ${MISSING_VAR:-default_val}";
    const result = interpolateEnvVars(template);
    expect(result).toBe("key: secret-12345, fallback: default_val");
  });

  it("loads and validates a valid ai-eval.yaml", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../fixtures/simple-llm/ai-eval.yaml",
    );
    const config = loadConfig(fixturePath);
    expect(config.project.name).toBe("simple-llm-fixture");
    expect(config.evaluations.length).toBe(1);
    expect(config.evaluations[0]?.name).toBe("greeting-eval");
  });

  it("throws ConfigurationError on missing file", () => {
    expect(() => loadConfig("non-existent-config.yaml")).toThrow();
  });

  it("PricingRegistry matches exact model and longest prefix correctly", () => {
    const registry = new PricingRegistry();
    const mini = registry.getPricing("gpt-4o-mini");
    expect(mini.inputPerMillion).toBe(0.15);
    expect(mini.outputPerMillion).toBe(0.6);

    const standard = registry.getPricing("gpt-4o");
    expect(standard.inputPerMillion).toBe(2.5);
    expect(standard.outputPerMillion).toBe(10.0);
  });
});
