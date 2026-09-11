import path from 'node:path';

/**
 * Common regex patterns for API keys and credentials
 */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /sk-[A-Za-z0-9\-_]{20,}/g, // OpenAI style
  /sk-ant-[A-Za-z0-9\-_]{20,}/g, // Anthropic style
  /AIza[0-9A-Za-z\-_]{35}/g, // Google API key style
  /ghp_[A-Za-z0-9]{36}/g, // GitHub token
  /xox[baprs]-[A-Za-z0-9\-]+/g, // Slack token
  /"(apiKey|api_key|token|secret|password|authorization)"\s*:\s*"[^"]+"/gi,
];

/**
 * Get known secret values from current environment variables
 */
function getEnvSecrets(): string[] {
  const secrets: string[] = [];
  const sensitiveKeys = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'AUTH', 'CREDENTIAL'];

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 6) continue;
    const upperKey = key.toUpperCase();
    if (sensitiveKeys.some((pattern) => upperKey.includes(pattern))) {
      secrets.push(value);
    }
  }
  return secrets;
}

/**
 * Redacts secrets, tokens, and authorization headers from text
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // Redact matches from patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith('bearer ')) {
        return 'Bearer [REDACTED]';
      }
      if (match.includes(':')) {
        return match.replace(/:\s*"[^"]+"/, ': "[REDACTED]"');
      }
      return '[REDACTED]';
    });
  }

  // Redact exact env var secrets
  const envSecrets = getEnvSecrets();
  for (const secret of envSecrets) {
    if (sanitized.includes(secret)) {
      sanitized = sanitized.replaceAll(secret, '[REDACTED]');
    }
  }

  return sanitized;
}

/**
 * Deeply redact secrets in any object or array
 */
export function redactObject<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return redactSecrets(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('auth')
      ) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactObject(val);
      }
    }
    return result as T;
  }
  return input;
}

/**
 * Prevent directory traversal attacks by validating that resolved path is inside target dir
 */
export function safeResolvePath(baseDir: string, relativeOrAbsolutePath: string, allowEscape = true): string {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(baseDir, relativeOrAbsolutePath);
  if (!allowEscape && !resolved.startsWith(normalizedBase)) {
    throw new Error(`Path traversal detected: "${relativeOrAbsolutePath}" resolves outside "${baseDir}"`);
  }
  return resolved;
}

/**
 * Basic HTML escaping for report rendering
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
