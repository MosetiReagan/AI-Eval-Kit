import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EvalOutput } from "./types.js";

interface CacheEntry {
  key: string;
  output: EvalOutput;
  timestamp: number;
  ttlMs?: number;
}

export class ResponseCache {
  private cacheDir: string;
  private enabled: boolean;
  private maxEntries: number;

  constructor(
    baseDir: string = process.cwd(),
    enabled = true,
    maxEntries = 1000,
  ) {
    this.cacheDir = path.join(baseDir, ".eval", "cache");
    this.enabled = enabled;
    this.maxEntries = maxEntries;
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
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  get(key: string): EvalOutput | null {
    if (!this.enabled) return null;
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const entry: CacheEntry = JSON.parse(content);

      if (entry.ttlMs && Date.now() - entry.timestamp > entry.ttlMs) {
        fs.unlinkSync(filePath);
        return null;
      }

      // Update access time for LRU tracking
      try {
        const now = new Date();
        fs.utimesSync(filePath, now, now);
      } catch {
        // Ignore utimes failures
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
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf8");

      if (this.maxEntries > 0) {
        this.prune(this.maxEntries);
      }
    } catch {
      // Ignore write errors in cache
    }
  }

  prune(maxEntries: number): number {
    if (!fs.existsSync(this.cacheDir)) return 0;
    try {
      const files = fs
        .readdirSync(this.cacheDir)
        .filter((f) => f.endsWith(".json"));
      if (files.length <= maxEntries) return 0;

      const fileStats = files.map((file) => {
        const p = path.join(this.cacheDir, file);
        return {
          path: p,
          mtime: fs.statSync(p).mtimeMs,
        };
      });

      // Sort ascending (oldest access time first)
      fileStats.sort((a, b) => a.mtime - b.mtime);

      const deleteCount = fileStats.length - maxEntries;
      let deleted = 0;
      for (let i = 0; i < deleteCount; i++) {
        try {
          fs.unlinkSync(fileStats[i]!.path);
          deleted++;
        } catch {
          // Ignore
        }
      }
      return deleted;
    } catch {
      return 0;
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
