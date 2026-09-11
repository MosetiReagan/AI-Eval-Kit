import pc from "picocolors";
import { redactSecrets } from "./security.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamps?: boolean;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamps: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || (process.env.DEBUG ? "debug" : "info");
    this.prefix = options.prefix || "ai-eval";
    this.timestamps = options.timestamps || false;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    return LEVEL_ORDER[targetLevel] >= LEVEL_ORDER[this.level];
  }

  private formatMessage(msg: string): string {
    const time = this.timestamps
      ? pc.dim(`[${new Date().toISOString()}] `)
      : "";
    const prefix = pc.cyan(`[${this.prefix}] `);
    return `${time}${prefix}${redactSecrets(msg)}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.log(
        pc.gray(this.formatMessage(`DEBUG: ${message}`)),
        ...args.map((a) => (typeof a === "string" ? redactSecrets(a) : a)),
      );
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(
        this.formatMessage(message),
        ...args.map((a) => (typeof a === "string" ? redactSecrets(a) : a)),
      );
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(
        pc.yellow(this.formatMessage(`WARN: ${message}`)),
        ...args.map((a) => (typeof a === "string" ? redactSecrets(a) : a)),
      );
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(
        pc.red(this.formatMessage(`ERROR: ${message}`)),
        ...args.map((a) => (typeof a === "string" ? redactSecrets(a) : a)),
      );
    }
  }

  success(message: string): void {
    if (this.shouldLog("info")) {
      console.log(pc.green(`✓ ${redactSecrets(message)}`));
    }
  }
}

export const logger = new Logger();
