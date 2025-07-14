import {
  LogLevel,
  LogLevelString,
  LogFormat,
  LogConfig,
  LoggerMeta,
  ExtendedLogEntry,
  TypeSafeLogger,
  LogFormatter,
  LogTransport,
  PerformanceTimer,
  LogLevelUtils,
  SafeJsonSerializer,
  TimestampUtils
} from './logger-types';

// Re-export types and utilities for external use
export { LogLevel, LogLevelUtils, SafeJsonSerializer, TimestampUtils } from './logger-types';
export type { 
  LogLevelString,
  LogFormat,
  LogConfig,
  LoggerMeta,
  ExtendedLogEntry,
  TypeSafeLogger,
  LogFormatter,
  LogTransport,
  PerformanceTimer
} from './logger-types';

/**
 * Simple console transport for development
 */
export class ConsoleTransport implements LogTransport {
  constructor(private useStderr = true) {}
  
  write(formattedMessage: string, _level: LogLevel): void {
    const output = this.useStderr ? console.error : console.log;
    output(formattedMessage);
  }
}

/**
 * JSON formatter for structured logging
 */
export class JsonFormatter implements LogFormatter {
  format(entry: ExtendedLogEntry): string {
    return SafeJsonSerializer.serialize(entry);
  }
}

/**
 * Simple text formatter for human-readable logs
 */
export class SimpleFormatter implements LogFormatter {
  constructor(
    private includeTimestamp = true,
    private includeLevel = true,
    private colorize = false
  ) {}
  
  format(entry: ExtendedLogEntry): string {
    const parts: string[] = [];
    
    if (this.includeTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }
    
    if (this.includeLevel) {
      const levelStr = this.colorize ? this.colorizeLevel(entry.level) : entry.level;
      parts.push(`[${levelStr}]`);
    }
    
    if (entry.context) {
      parts.push(`[${entry.context}]`);
    }
    
    parts.push(entry.message);
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      parts.push(SafeJsonSerializer.serialize(entry.meta));
    }
    
    return parts.join(' ');
  }
  
  private colorizeLevel(level: LogLevelString): string {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      HTTP: '\x1b[35m',  // Magenta
      VERBOSE: '\x1b[37m', // White
      DEBUG: '\x1b[32m', // Green
      SILLY: '\x1b[90m'  // Gray
    };
    
    const reset = '\x1b[0m';
    return `${colors[level] || ''}${level}${reset}`;
  }
}

/**
 * Type-safe logger implementation
 */
export class TypedLogger implements TypeSafeLogger {
  private config: LogConfig;
  private transports: LogTransport[];
  private formatters: Record<LogFormat, LogFormatter>;
  private contextMeta: Partial<LoggerMeta> = {};
  private performanceTimers = new Map<string, PerformanceTimer>();
  
  constructor(
    config: Partial<LogConfig> = {},
    transports: LogTransport[] = [new ConsoleTransport()],
    formatters?: Partial<Record<LogFormat, LogFormatter>>
  ) {
    this.config = {
      level: LogLevel.INFO,
      enableColors: process.env.NODE_ENV !== 'production',
      enableTimestamps: true,
      enableStackTrace: process.env.NODE_ENV !== 'production',
      outputStream: 'stderr',
      format: LogFormat.SIMPLE,
      ...config
    };
    
    this.transports = transports;
    this.formatters = {
      [LogFormat.SIMPLE]: new SimpleFormatter(
        this.config.enableTimestamps,
        true,
        this.config.enableColors
      ),
      [LogFormat.JSON]: new JsonFormatter(),
      [LogFormat.STRUCTURED]: new SimpleFormatter(true, true, false),
      ...formatters
    };
  }
  
  /**
   * Core logging method
   */
  log(level: LogLevelString, message: string, meta?: LoggerMeta): void {
    const numericLevel = LogLevel[level];
    
    if (!LogLevelUtils.shouldLog(numericLevel, this.config.level)) {
      return;
    }
    
    const entry = this.createLogEntry(level, message, meta);
    const formatter = this.formatters[this.config.format];
    const formattedMessage = formatter.format(entry);
    
    this.transports.forEach(transport => {
      transport.write(formattedMessage, numericLevel);
    });
  }
  
  /**
   * Standard log level methods
   */
  error(message: string, meta?: LoggerMeta): void {
    this.log('ERROR', message, meta);
  }
  
  warn(message: string, meta?: LoggerMeta): void {
    this.log('WARN', message, meta);
  }
  
  info(message: string, meta?: LoggerMeta): void {
    this.log('INFO', message, meta);
  }
  
  http(message: string, meta?: LoggerMeta): void {
    this.log('HTTP', message, meta);
  }
  
  verbose(message: string, meta?: LoggerMeta): void {
    this.log('VERBOSE', message, meta);
  }
  
  debug(message: string, meta?: LoggerMeta): void {
    this.log('DEBUG', message, meta);
  }
  
  silly(message: string, meta?: LoggerMeta): void {
    this.log('SILLY', message, meta);
  }
  
  /**
   * Enhanced error logging with automatic stack trace
   */
  logError(error: Error, message?: string, meta?: LoggerMeta): void {
    const errorMeta: LoggerMeta = {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: this.config.enableStackTrace ? error.stack : undefined
      },
      errorCode: (error as any).code,
      stackTrace: this.config.enableStackTrace ? error.stack : undefined
    };
    
    this.error(message || error.message, errorMeta);
  }
  
  /**
   * Performance timing
   */
  time(label: string): void {
    this.performanceTimers.set(label, {
      label,
      startTime: TimestampUtils.getHighResTimestamp(),
      startMemory: process.memoryUsage?.()?.heapUsed
    });
  }
  
  timeEnd(label: string, meta?: LoggerMeta): void {
    const timer = this.performanceTimers.get(label);
    if (!timer) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }
    
    const endTime = TimestampUtils.getHighResTimestamp();
    const duration = endTime - timer.startTime;
    const endMemory = process.memoryUsage?.()?.heapUsed;
    
    const performanceMeta: LoggerMeta = {
      ...meta,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memoryDelta: timer.startMemory && endMemory 
        ? endMemory - timer.startMemory 
        : undefined
    };
    
    this.debug(`Timer '${label}': ${duration.toFixed(2)}ms`, performanceMeta);
    this.performanceTimers.delete(label);
  }
  
  /**
   * Utility methods
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LogLevelUtils.shouldLog(level, this.config.level);
  }
  
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
  
  getLevel(): LogLevel {
    return this.config.level;
  }
  
  /**
   * Context management
   */
  withContext(context: string): TypeSafeLogger {
    const newLogger = new TypedLogger(this.config, this.transports, this.formatters);
    newLogger.contextMeta = { ...this.contextMeta, context };
    return newLogger;
  }
  
  withRequestId(requestId: string): TypeSafeLogger {
    const newLogger = new TypedLogger(this.config, this.transports, this.formatters);
    newLogger.contextMeta = { ...this.contextMeta, requestId };
    return newLogger;
  }
  
  /**
   * Cleanup
   */
  close(): void {
    this.performanceTimers.clear();
    this.transports.forEach(transport => {
      if (transport.close) {
        transport.close();
      }
    });
  }
  
  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: LogLevelString, 
    message: string, 
    meta?: LoggerMeta
  ): ExtendedLogEntry {
    return {
      timestamp: TimestampUtils.getISOTimestamp(),
      level,
      message,
      meta: this.mergeMeta(meta),
      context: this.contextMeta.context,
      requestId: this.contextMeta.requestId,
      userId: this.contextMeta.userId
    };
  }
  
  /**
   * Merge provided meta with context meta
   */
  private mergeMeta(meta?: LoggerMeta): LoggerMeta | undefined {
    if (!meta && Object.keys(this.contextMeta).length === 0) {
      return undefined;
    }
    
    return {
      ...this.contextMeta,
      ...meta
    };
  }
}

/**
 * Logger factory for creating configured logger instances
 */
export class LoggerFactory {
  private static defaultConfig: LogConfig = {
    level: LogLevel.INFO,
    enableColors: process.env.NODE_ENV !== 'production',
    enableTimestamps: true,
    enableStackTrace: process.env.NODE_ENV !== 'production',
    outputStream: 'stderr',
    format: LogFormat.SIMPLE
  };
  
  /**
   * Create logger with default configuration
   */
  static createDefault(): TypeSafeLogger {
    return new TypedLogger(this.defaultConfig);
  }
  
  /**
   * Create logger with custom configuration
   */
  static create(config: Partial<LogConfig>): TypeSafeLogger {
    return new TypedLogger({ ...this.defaultConfig, ...config });
  }
  
  /**
   * Create logger from environment configuration
   */
  static createFromEnvironment(): TypeSafeLogger {
    const level = process.env.LOG_LEVEL 
      ? LogLevelUtils.fromString(process.env.LOG_LEVEL)
      : LogLevel.INFO;
    
    const config: Partial<LogConfig> = {
      level,
      enableColors: process.env.LOG_COLORS !== 'false',
      enableTimestamps: process.env.LOG_TIMESTAMPS !== 'false',
      enableStackTrace: process.env.LOG_STACK_TRACE !== 'false',
      format: process.env.LOG_FORMAT === 'json' ? LogFormat.JSON : LogFormat.SIMPLE
    };
    
    return this.create(config);
  }
  
  /**
   * Update default configuration
   */
  static setDefaultConfig(config: Partial<LogConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}