import { describe, it, expect } from 'vitest';
import { redactSecrets, redactObject, safeResolvePath, escapeHtml } from '@ai-eval/core';

describe('Security & Redaction', () => {
  it('redacts OpenAI, Anthropic, Bearer tokens, and secrets from strings', () => {
    const raw = 'Bearer sk-ant-api03-1234567890abcdef1234567890 and sk-proj-123456789012345678901234';
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain('sk-ant-api03');
    expect(redacted).not.toContain('sk-proj-');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts nested keys like apiKey, password, secret in objects', () => {
    const payload = {
      user: 'alice',
      credentials: {
        apiKey: 'super-secret-key',
        password: 'password123',
      },
      headers: {
        authorization: 'Bearer secret_token',
      },
    };

    const redacted = redactObject(payload);
    expect(redacted.credentials.apiKey).toBe('[REDACTED]');
    expect(redacted.credentials.password).toBe('[REDACTED]');
    expect(redacted.headers.authorization).toBe('[REDACTED]');
    expect(redacted.user).toBe('alice');
  });

  it('prevents path traversal attacks when allowEscape is false', () => {
    const baseDir = '/workspace/project';
    expect(() => {
      safeResolvePath(baseDir, '../../etc/passwd');
    }).toThrow('Path traversal detected');
  });

  it('escapes dangerous HTML characters', () => {
    const dangerous = '<script>alert("xss")</script> & "quotes"';
    const escaped = escapeHtml(dangerous);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
  });
});
