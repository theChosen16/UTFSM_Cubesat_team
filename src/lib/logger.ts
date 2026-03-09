/**
 * Production logging service for the USM CubeSat Team platform.
 *
 * Captures structured log entries (info, warn, error) and keeps them in memory
 * so they can be reviewed in the browser console or exported for diagnostics.
 *
 * Each entry includes a timestamp, severity level, message, and optional
 * contextual metadata, making it straightforward for CI/CD health-checks and
 * error-triage workflows to understand what happened and when.
 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

const MAX_LOG_ENTRIES = 200

class Logger {
  private entries: LogEntry[] = []

  private addEntry(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? this.sanitizeContext(context) : undefined,
    }

    this.entries.push(entry)

    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES)
    }

    // Mirror to the native console so browser DevTools still works as expected
    switch (level) {
      case 'info':
        console.info(`[CubeSat] ${message}`, context ?? '')
        break
      case 'warn':
        console.warn(`[CubeSat] ${message}`, context ?? '')
        break
      case 'error':
        console.error(`[CubeSat] ${message}`, context ?? '')
        break
    }
  }

  /** Serialize errors and strip circular references. */
  private sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(ctx)) {
      if (value instanceof Error) {
        sanitized[key] = { message: value.message, name: value.name, stack: value.stack }
      } else {
        try {
          JSON.stringify(value)
          sanitized[key] = value
        } catch {
          sanitized[key] = String(value)
        }
      }
    }
    return sanitized
  }

  info(message: string, context?: Record<string, unknown>) {
    this.addEntry('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.addEntry('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>) {
    this.addEntry('error', message, context)
  }

  /** Return all stored entries (most recent last). */
  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries
  }

  /** Return only error-level entries. */
  getErrors(): ReadonlyArray<LogEntry> {
    return this.entries.filter(e => e.level === 'error')
  }

  /** Clear the in-memory log buffer. */
  clear() {
    this.entries = []
  }

  /**
   * Export the current log buffer as a JSON string.
   * Useful for downloading diagnostics or sending to an external service.
   */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2)
  }
}

export const logger = new Logger()

// Expose the logger on `window` in non-production builds so it can be inspected
// from the browser console during development and staging.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__cubesat_logger = logger
}
