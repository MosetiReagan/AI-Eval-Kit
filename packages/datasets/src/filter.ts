import { Dataset, TestCase } from '@ai-eval/core';

export interface DatasetFilterOptions {
  tags?: string[];
  caseIds?: string[];
  search?: string;
  limit?: number;
  random?: boolean;
  seed?: number;
}

/**
 * Deterministic pseudo-random number generator
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function filterDataset(dataset: Dataset, options: DatasetFilterOptions = {}): Dataset {
  let cases: TestCase[] = [...dataset.cases];

  // Filter by tags (matches if any tag matches)
  if (options.tags && options.tags.length > 0) {
    const requiredTags = options.tags.map((t) => t.toLowerCase());
    cases = cases.filter((c) => {
      const caseTags = (c.tags ?? []).map((t) => t.toLowerCase());
      return requiredTags.some((rt) => caseTags.includes(rt));
    });
  }

  // Filter by case IDs
  if (options.caseIds && options.caseIds.length > 0) {
    const requiredIds = options.caseIds.map((id) => id.toLowerCase());
    cases = cases.filter((c) => requiredIds.includes(c.id.toLowerCase()));
  }

  // Filter by search string
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    cases = cases.filter((c) => {
      const inputStr = typeof c.input === 'string' ? c.input : JSON.stringify(c.input);
      return c.id.toLowerCase().includes(searchLower) || inputStr.toLowerCase().includes(searchLower);
    });
  }

  // Random shuffle or slice
  if (options.random && options.limit && options.limit < cases.length) {
    const rng = seededRandom(options.seed ?? 42);
    const shuffled = [...cases];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    cases = shuffled.slice(0, options.limit);
  } else if (options.limit && options.limit < cases.length) {
    cases = cases.slice(0, options.limit);
  }

  return {
    ...dataset,
    cases,
  };
}
