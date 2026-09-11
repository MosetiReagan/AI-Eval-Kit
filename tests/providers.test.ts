import { describe, it, expect } from 'vitest';
import { MockProvider, defaultProviderRegistry } from '@ai-eval/providers';

describe('Providers System', () => {
  it('MockProvider returns deterministic responses matching rules', async () => {
    const mock = new MockProvider({ defaultResponse: 'Default fallback' });
    mock.addRule({
      match: 'refund',
      response: 'Refund processed for 30 days',
      toolCalls: [{ name: 'process_refund', arguments: { amount: 100 } }],
    });

    const resp1 = await mock.chat([{ role: 'user', content: 'I want a refund please' }]);
    expect(resp1.output).toBe('Refund processed for 30 days');
    expect(resp1.toolCalls?.length).toBe(1);
    expect(resp1.toolCalls?.[0]?.name).toBe('process_refund');

    const resp2 = await mock.chat([{ role: 'user', content: 'What is your address?' }]);
    expect(resp2.output).toBe('Default fallback');
  });

  it('MockProvider simulates latency, token usage, and errors', async () => {
    const mock = new MockProvider({ defaultLatencyMs: 5 });
    mock.addRule({
      match: 'fail-now',
      response: '',
      shouldFail: true,
      failureMessage: 'Rate limit simulation',
      failureCode: 429,
    });

    await expect(mock.chat([{ role: 'user', content: 'fail-now' }])).rejects.toThrow('Rate limit simulation');
  });

  it('MockProvider generates deterministic embeddings', async () => {
    const mock = new MockProvider();
    const [emb1, emb2] = await mock.embed(['Text A', 'Text B']);
    expect(emb1?.length).toBe(128);
    expect(emb2?.length).toBe(128);
  });

  it('ProviderRegistry manages and creates providers', () => {
    const mock = new MockProvider({ name: 'custom-mock' });
    defaultProviderRegistry.register(mock);
    expect(defaultProviderRegistry.has('custom-mock')).toBe(true);
    expect(defaultProviderRegistry.get('custom-mock')?.name).toBe('custom-mock');
  });
});
