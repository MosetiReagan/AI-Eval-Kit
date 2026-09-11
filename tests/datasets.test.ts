import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadDataset, filterDataset, validateAndAnalyzeDataset, parseCsvDataset, parseJsonlDataset } from '@ai-eval/datasets';

describe('Dataset System', () => {
  it('loads YAML datasets correctly', async () => {
    const datasetPath = path.resolve(__dirname, '../fixtures/simple-llm/dataset.yaml');
    const ds = await loadDataset(datasetPath);
    expect(ds.name).toBe('simple-llm-dataset');
    expect(ds.cases.length).toBe(2);
    expect(ds.cases[0]?.id).toBe('greet-01');
  });

  it('parses CSV datasets correctly', () => {
    const csvContent = `id,prompt,expected,tags\ncase-1,"Hello world","Hello","tagA;tagB"\ncase-2,"What is AI?","Artificial Intelligence","tagA"`;
    const ds = parseCsvDataset(csvContent, 'test-csv');
    expect(ds.cases.length).toBe(2);
    expect(ds.cases[0]?.id).toBe('case-1');
    expect(ds.cases[0]?.tags).toEqual(['tagA', 'tagB']);
  });

  it('parses JSONL datasets correctly', () => {
    const jsonlContent = `{"id":"jsonl-1","input":"First prompt","expected":"First expected"}\n{"id":"jsonl-2","input":"Second prompt"}`;
    const ds = parseJsonlDataset(jsonlContent, 'test-jsonl');
    expect(ds.cases.length).toBe(2);
    expect(ds.cases[0]?.id).toBe('jsonl-1');
  });

  it('filters dataset by tags and case IDs', () => {
    const mockDataset = {
      name: 'filter-test',
      cases: [
        { id: 'c1', input: 'hi', tags: ['billing', 'prod'] },
        { id: 'c2', input: 'bye', tags: ['support'] },
        { id: 'c3', input: 'refund', tags: ['billing'] },
      ],
    };

    const tagged = filterDataset(mockDataset, { tags: ['billing'] });
    expect(tagged.cases.length).toBe(2);
    expect(tagged.cases.map(c => c.id)).toEqual(['c1', 'c3']);

    const byId = filterDataset(mockDataset, { caseIds: ['c2'] });
    expect(byId.cases.length).toBe(1);
    expect(byId.cases[0]?.id).toBe('c2');
  });

  it('samples dataset with limit and seed', () => {
    const mockDataset = {
      name: 'sample-test',
      cases: Array.from({ length: 10 }, (_, i) => ({ id: `c${i + 1}`, input: `Input ${i + 1}` })),
    };

    const sampled = filterDataset(mockDataset, { limit: 3, random: true, seed: 1234 });
    expect(sampled.cases.length).toBe(3);
  });

  it('validates dataset and produces analysis stats', () => {
    const mockDataset = {
      name: 'stats-test',
      cases: [
        { id: 'case-1', input: 'Hello', expected: { contains: 'Hello' }, tags: ['t1'] },
        { id: 'case-1', input: 'Duplicate', tags: ['t1', 't2'] },
      ],
    };
    const stats = validateAndAnalyzeDataset(mockDataset);
    expect(stats.totalCases).toBe(2);
    expect(stats.warnings.some(w => w.includes('Duplicate case id'))).toBe(true);
    expect(stats.warnings.some(w => w.includes('does not specify expected'))).toBe(true);
  });
});
