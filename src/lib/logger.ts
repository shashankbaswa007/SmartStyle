/**
 * Logger utility with log level filtering
 * Provides consistent logging format across the application
 * 
 * LOG_LEVEL environment variable:
 * - 'debug': All logs (debug, info, warn, error)
 * - 'info': Info, warn, error (default for development)
 * - 'warn': Warn and error only
 * - 'error': Error only (recommended for production)
 * - 'silent': No logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

class Logger {
  private level: LogLevel;
  private levelValue: number;

  constructor() {
    // Default to 'info' in development, 'error' in production
    const defaultLevel = process.env.NODE_ENV === 'production' ? 'error' : 'info';
    this.level = (process.env.LOG_LEVEL as LogLevel) || defaultLevel;
    this.levelValue = LOG_LEVELS[this.level] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.levelValue;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
    }
  }

  log(...args: unknown[]): void {
    if (this.shouldLog('info')) {
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set log level programmatically (useful for testing)
   */
  setLevel(level: LogLevel): void {
    this.level = level;
    this.levelValue = LOG_LEVELS[level];
  }
}

export const logger = new Logger();
