import { Dataset } from "@ai-eval/core";

export interface DatasetStats {
  totalCases: number;
  tagsCount: Record<string, number>;
  hasExpectedCount: number;
  hasContextCount: number;
  inputTypes: {
    string: number;
    chatMessages: number;
    object: number;
  };
  warnings: string[];
}

export function validateAndAnalyzeDataset(dataset: Dataset): DatasetStats {
  const warnings: string[] = [];
  const tagsCount: Record<string, number> = {};
  let hasExpectedCount = 0;
  let hasContextCount = 0;
  const inputTypes = {
    string: 0,
    chatMessages: 0,
    object: 0,
  };

  const idSet = new Set<string>();

  for (const c of dataset.cases) {
    if (idSet.has(c.id)) {
      warnings.push(`Duplicate case id detected: "${c.id}"`);
    } else {
      idSet.add(c.id);
    }

    if (c.tags) {
      for (const t of c.tags) {
        tagsCount[t] = (tagsCount[t] ?? 0) + 1;
      }
    }

    if (c.expected) {
      hasExpectedCount++;
    } else {
      warnings.push(
        `Case "${c.id}" does not specify expected output or assertions`,
      );
    }

    if (c.context) {
      hasContextCount++;
    }

    if (typeof c.input === "string") {
      inputTypes.string++;
    } else if (c.input && Array.isArray(c.input.messages)) {
      inputTypes.chatMessages++;
    } else {
      inputTypes.object++;
    }
  }

  return {
    totalCases: dataset.cases.length,
    tagsCount,
    hasExpectedCount,
    hasContextCount,
    inputTypes,
    warnings,
  };
}
