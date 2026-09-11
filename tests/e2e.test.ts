import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { evaluate, defineTarget } from 'ai-eval-kit';

describe('End-to-End Programmatic Evaluation', () => {
  it('runs complete evaluation with mock target and dataset', async () => {
    const datasetPath = path.resolve(__dirname, '../fixtures/simple-llm/dataset.yaml');

    const target = defineTarget('test-target', async (input) => {
      const msg = input.message || '';
      if (msg.includes('Hello')) {
        return { output: 'Hello there!' };
      }
      if (msg.includes('2+2')) {
        return { output: '4' };
      }
      return { output: 'default' };
    });

    const result = await evaluate({
      target,
      dataset: datasetPath,
      evaluators: ['exact_match', 'contains'],
      projectName: 'e2e-project',
      evaluationName: 'e2e-eval',
    });

    expect(result.run.totalCases).toBe(2);
    expect(result.run.overallScore).toBeGreaterThanOrEqual(0.5);
    expect(result.run.evaluatorScores['exact_match']).toBeDefined();
    expect(result.run.evaluatorScores['contains']).toBeDefined();
  });
});
