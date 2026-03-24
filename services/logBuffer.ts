/**
 * LogBuffer – In-memory ring buffer that intercepts console output.
 *
 * Must be imported/initialized BEFORE any other module logs anything
 * so that every message is captured from the start.
 */

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface LogEntry {
  /** ISO-8601 timestamp */
  ts: string;
  /** Severity level */
  level: LogLevel;
  /** The original log message */
  message: string;
}

const DEFAULT_MAX_ENTRIES = 2000;

class LogBuffer {
  private entries: LogEntry[] = [];
  private maxEntries: number;
  private installed = false;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /**
   * Monkey-patch console.log / .info / .warn / .error / .debug
   * so every call is also pushed into the ring buffer.
   */
  public install(): void {
    if (this.installed) return;
    this.installed = true;

    const levels: LogLevel[] = ["log", "info", "warn", "error", "debug"];

    for (const level of levels) {
      const original = (console as any)[level].bind(console);

      (console as any)[level] = (...args: any[]) => {
        // Call the real console method first (keeps Docker / PM2 log files working)
        original(...args);

        // Build a single string from the arguments
        const message = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
          .join(" ");

        this.push(level, message);
      };
    }
  }

  /** Add an entry to the ring buffer */
  private push(level: LogLevel, message: string): void {
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift(); // drop oldest
    }
    this.entries.push({
      ts: new Date().toISOString(),
      level,
      message,
    });
  }

  /** Return the last `n` entries (default = all), optionally filtered */
  public getEntries(options?: {
    last?: number;
    level?: LogLevel;
    search?: string;
  }): LogEntry[] {
    let result = this.entries;

    if (options?.level) {
      result = result.filter((e) => e.level === options.level);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter((e) => e.message.toLowerCase().includes(q));
    }
    if (options?.last && options.last > 0) {
      result = result.slice(-options.last);
    }
    return result;
  }

  /** Total entries currently in the buffer */
  public get size(): number {
    return this.entries.length;
  }

  /** Clear the buffer */
  public clear(): void {
    this.entries = [];
  }
}

// ── Singleton ────────────────────────────────────────────────
export const logBuffer = new LogBuffer();
