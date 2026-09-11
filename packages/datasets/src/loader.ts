import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { Dataset, TestCase, InvalidDatasetError } from '@ai-eval/core';
import { DatasetSchema } from './schema.js';

/**
 * Robust CSV row parser supporting quoted strings and commas
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCsvDataset(content: string, datasetName: string): Dataset {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new InvalidDatasetError('CSV dataset must contain a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/['"]/g, ''));
  const idIdx = headers.indexOf('id');
  const inputIdx = headers.indexOf('input') !== -1 ? headers.indexOf('input') : headers.indexOf('prompt');
  const expectedIdx = headers.indexOf('expected');
  const contextIdx = headers.indexOf('context');
  const tagsIdx = headers.indexOf('tags');

  if (inputIdx === -1) {
    throw new InvalidDatasetError('CSV dataset must contain an "input" or "prompt" column header');
  }

  const cases: TestCase[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const id = idIdx !== -1 && values[idIdx] ? values[idIdx]! : `case-${String(i).padStart(3, '0')}`;
    const inputVal = values[inputIdx] ?? '';
    const expectedVal = expectedIdx !== -1 && values[expectedIdx] ? values[expectedIdx] : undefined;
    const contextVal = contextIdx !== -1 && values[contextIdx] ? values[contextIdx] : undefined;
    const tagsVal = tagsIdx !== -1 && values[tagsIdx] ? values[tagsIdx]!.split(';').map((t) => t.trim()) : undefined;

    cases.push({
      id,
      input: inputVal,
      expected: expectedVal ? { exact: expectedVal, contains: expectedVal } : undefined,
      context: contextVal,
      tags: tagsVal,
    });
  }

  return {
    name: datasetName,
    cases,
  };
}

export function parseJsonlDataset(content: string, datasetName: string): Dataset {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const cases: TestCase[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]!);
      const id = parsed.id ? String(parsed.id) : `case-${String(i + 1).padStart(3, '0')}`;
      cases.push({
        id,
        input: parsed.input ?? parsed.prompt ?? '',
        expected: parsed.expected,
        context: parsed.context,
        metadata: parsed.metadata,
        tags: parsed.tags,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InvalidDatasetError(`Failed to parse JSONL line ${i + 1}: ${msg}`);
    }
  }

  return {
    name: datasetName,
    cases,
  };
}

export async function loadDataset(filePath: string, cwd: string = process.cwd()): Promise<Dataset> {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new InvalidDatasetError(`Dataset file not found: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const baseName = path.basename(resolvedPath, ext);

  // Handle TypeScript / JavaScript files
  if (['.ts', '.js', '.mjs'].includes(ext)) {
    try {
      const imported = await import(`file://${resolvedPath}`);
      const dataset = imported.default || imported.dataset || imported;
      const parsed = DatasetSchema.parse(dataset);
      return parsed as Dataset;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InvalidDatasetError(`Failed to load dataset from JS/TS file: ${msg}`);
    }
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');

  if (ext === '.csv') {
    return parseCsvDataset(rawContent, baseName);
  }

  if (ext === '.jsonl') {
    return parseJsonlDataset(rawContent, baseName);
  }

  let parsed: any;
  try {
    if (ext === '.json') {
      parsed = JSON.parse(rawContent);
    } else {
      parsed = yaml.parse(rawContent);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new InvalidDatasetError(`Failed to parse dataset syntax in ${path.basename(resolvedPath)}: ${msg}`);
  }

  // Support both raw array of cases or full object { name, cases: [...] }
  if (Array.isArray(parsed)) {
    parsed = {
      name: baseName,
      cases: parsed.map((c, i) => ({
        id: c.id ?? `case-${String(i + 1).padStart(3, '0')}`,
        input: c.input ?? c.prompt ?? '',
        expected: c.expected,
        context: c.context,
        metadata: c.metadata,
        tags: c.tags,
      })),
    };
  } else if (!parsed.name) {
    parsed.name = baseName;
  }

  if (Array.isArray(parsed.cases)) {
    parsed.cases = parsed.cases.map((c: any, i: number) => ({
      id: c.id ? String(c.id) : `case-${String(i + 1).padStart(3, '0')}`,
      input: c.input ?? c.prompt ?? '',
      expected: c.expected,
      context: c.context,
      metadata: c.metadata,
      tags: c.tags,
    }));
  }

  const validation = DatasetSchema.safeParse(parsed);
  if (!validation.success) {
    const errors = validation.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new InvalidDatasetError(`Dataset validation failed for ${path.basename(resolvedPath)}:\n${errors}`);
  }

  return validation.data as Dataset;
}
