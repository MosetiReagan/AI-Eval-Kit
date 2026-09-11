import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EvalOutput } from './types.js';

interface CacheEntry {
  key: string;
  output: EvalOutput;
  timestamp: number;
  ttlMs?: number;
}

export class ResponseCache {
  private cacheDir: string;
  private enabled: boolean;

  constructor(baseDir: string = process.cwd(), enabled = true) {
    this.cacheDir = path.join(baseDir, '.eval', 'cache');
    this.enabled = enabled;
    if (this.enabled) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {
        // Ignore directory creation errors
      }
    }
  }

  generateKey(components: unknown[]): string {
    const serialized = JSON.stringify(components);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  get(key: string): EvalOutput | null {
    if (!this.enabled) return null;
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const entry: CacheEntry = JSON.parse(content);

      if (entry.ttlMs && Date.now() - entry.timestamp > entry.ttlMs) {
        fs.unlinkSync(filePath);
        return null;
      }

      return entry.output;
    } catch {
      return null;
    }
  }

  set(key: string, output: EvalOutput, ttlMs?: number): void {
    if (!this.enabled) return;
    const filePath = path.join(this.cacheDir, `${key}.json`);

    try {
      const entry: CacheEntry = {
        key,
        output,
        timestamp: Date.now(),
        ttlMs,
      };
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
    } catch {
      // Ignore write errors in cache
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch {
      // Ignore errors
    }
  }
}
