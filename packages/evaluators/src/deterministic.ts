import { EvaluationResult, EvaluatorContext } from '@ai-eval/core';
import { defineEvaluator } from './types.js';

/**
 * Exact match evaluator
 */
export const exactMatchEvaluator = defineEvaluator({
  name: 'exact_match',
  description: 'Compares the output directly against the expected string',
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const expected = ctx.expected?.exact ?? (typeof ctx.expected === 'string' ? ctx.expected : undefined);
    if (expected === undefined) {
      return {
        score: 1,
        passed: true,
        reason: 'Skipped: No expected.exact or string value specified in test case',
      };
    }

    const options = ctx.options ?? {};
    let actual = ctx.actual.output;
    let target = String(expected);

    if (options.trim !== false) {
      actual = actual.trim();
      target = target.trim();
    }

    if (options.ignoreCase) {
      actual = actual.toLowerCase();
      target = target.toLowerCase();
    }

    if (options.ignorePunctuation) {
      actual = actual.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      target = target.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    }

    const passed = actual === target;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed ? 'Exact match matched' : `Expected "${target}", got "${actual}"`,
    };
  },
});

/**
 * Contains evaluator
 */
export const containsEvaluator = defineEvaluator({
  name: 'contains',
  description: 'Verifies that the output contains the required substring or strings',
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    let expected =
      ctx.expected?.contains ??
      ctx.expected?.exact ??
      (typeof ctx.expected === 'string' ? ctx.expected : undefined);

    if (!expected) {
      return {
        score: 1,
        passed: true,
        reason: 'Skipped: No expected substring or string specified in test case',
      };
    }

    const expectedList = Array.isArray(expected) ? expected : [expected];
    const options = ctx.options ?? {};
    const ignoreCase = options.ignoreCase ?? true;
    const mode = options.mode === 'any' ? 'any' : 'all';

    let actual = ctx.actual.output;
    if (ignoreCase) {
      actual = actual.toLowerCase();
    }

    const missing: string[] = [];
    const matched: string[] = [];

    for (const exp of expectedList) {
      const target = ignoreCase ? String(exp).toLowerCase() : String(exp);
      if (actual.includes(target)) {
        matched.push(String(exp));
      } else {
        missing.push(String(exp));
      }
    }

    const passed = mode === 'any' ? matched.length > 0 : missing.length === 0;
    const score = expectedList.length > 0 ? matched.length / expectedList.length : 1;

    return {
      score: Number(score.toFixed(4)),
      passed,
      reason: passed
        ? `Contains check passed (${matched.length}/${expectedList.length} matched)`
        : `Missing expected terms: [${missing.join(', ')}]`,
      metadata: { matched, missing },
    };
  },
});

/**
 * Regex evaluator
 */
export const regexEvaluator = defineEvaluator({
  name: 'regex',
  description: 'Evaluates output against a regular expression',
  evaluate: (ctx: EvaluatorContext): EvaluationResult => {
    const pattern = (ctx.options?.pattern as string) ?? ctx.expected?.regex;
    if (!pattern) {
      return {
        score: 1,
        passed: true,
        reason: 'Skipped: No pattern specified in expected.regex or evaluator options',
      };
    }

    const flags = (ctx.options?.flags as string) ?? '';
    const invert = Boolean(ctx.options?.invert);

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        score: 0,
        passed: false,
        reason: `Invalid regular expression: ${msg}`,
      };
    }

    const matched = regex.test(ctx.actual.output);
    const passed = invert ? !matched : matched;

    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `Output matched pattern /${pattern}/${flags}`
        : `Output failed to match pattern /${pattern}/${flags}`,
    };
  },
});
