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

type LogContext = Record<string, unknown>;

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

  private serializeError(error: unknown): unknown {
    if (!(error instanceof Error)) {
      return error;
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  private buildEntry(level: Exclude<LogLevel, 'silent'>, args: unknown[], context?: LogContext) {
    const now = new Date().toISOString();
    const normalizedArgs = args.map((arg) => this.serializeError(arg));

    const [first, ...rest] = normalizedArgs;
    const message = typeof first === 'string' ? first : 'Application log';
    const metadata = typeof first === 'string' ? rest : normalizedArgs;

    return {
      timestamp: now,
      level,
      message,
      metadata,
      context: context || {},
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private emit(level: Exclude<LogLevel, 'silent'>, args: unknown[], context?: LogContext): void {
    const entry = this.buildEntry(level, args, context);

    if (process.env.NODE_ENV === 'production') {
      const serialized = JSON.stringify(entry);
      if (level === 'error') console.error(serialized);
      else if (level === 'warn') console.warn(serialized);
      else if (level === 'debug') console.debug(serialized);
      else console.info(serialized);
      return;
    }

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const payload = Object.keys(entry.context).length > 0
      ? [...entry.metadata, { context: entry.context }]
      : entry.metadata;

    if (level === 'error') console.error(prefix, entry.message, ...payload);
    else if (level === 'warn') console.warn(prefix, entry.message, ...payload);
    else if (level === 'debug') console.debug(prefix, entry.message, ...payload);
    else console.info(prefix, entry.message, ...payload);
  }

  withContext(context: LogContext) {
    return {
      debug: (...args: unknown[]) => this.debugWithContext(context, ...args),
      log: (...args: unknown[]) => this.infoWithContext(context, ...args),
      info: (...args: unknown[]) => this.infoWithContext(context, ...args),
      warn: (...args: unknown[]) => this.warnWithContext(context, ...args),
      error: (...args: unknown[]) => this.errorWithContext(context, ...args),
      metric: (name: string, value: number, metricContext?: LogContext) =>
        this.metric(name, value, { ...context, ...(metricContext || {}) }),
    };
  }

  debugWithContext(context: LogContext, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.emit('debug', args, context);
    }
  }

  infoWithContext(context: LogContext, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      this.emit('info', args, context);
    }
  }

  warnWithContext(context: LogContext, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      this.emit('warn', args, context);
    }
  }

  errorWithContext(context: LogContext, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      this.emit('error', args, context);
    }
  }

  metric(name: string, value: number, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.emit('info', [`metric:${name}`, { value }], context);
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.emit('debug', args);
    }
  }

  log(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      this.emit('info', args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      this.emit('info', args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      this.emit('warn', args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      this.emit('error', args);
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
