import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
});

export const EvalInputSchema = z.union([
  z.string(),
  z.object({
    message: z.string().optional(),
    messages: z.array(ChatMessageSchema).optional(),
    context: z.union([z.string(), z.record(z.unknown())]).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).passthrough(),
]);

export const ExpectedToolsSchema = z.object({
  required: z.array(z.string()).optional(),
  forbidden: z.array(z.string()).optional(),
  maxCalls: z.number().int().nonnegative().optional(),
  sequence: z.array(z.string()).optional(),
});

export const EvalExpectedSchema = z.union([
  z.string(),
  z.object({
    exact: z.string().optional(),
    contains: z.union([z.string(), z.array(z.string())]).optional(),
    regex: z.string().optional(),
    jsonSchema: z.record(z.unknown()).optional(),
    criteria: z.array(z.string()).optional(),
    tools: ExpectedToolsSchema.optional(),
  }).passthrough(),
]);

export const TestCaseSchema = z.object({
  id: z.string(),
  input: EvalInputSchema,
  expected: EvalExpectedSchema.optional(),
  context: z.union([z.string(), z.record(z.unknown())]).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export const DatasetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  cases: z.array(TestCaseSchema),
  metadata: z.record(z.unknown()).optional(),
});
