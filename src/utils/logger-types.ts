/**
 * Type-safe logger definitions and utilities
 * Provides comprehensive type safety for logging operations
 */

/**
 * Standard log levels with numeric values for comparison
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  VERBOSE = 4,
  DEBUG = 5,
  SILLY = 6
}

/**
 * String representations of log levels
 */
export type LogLevelString = keyof typeof LogLevel;

/**
 * Log level configuration
 */
export interface LogConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableStackTrace: boolean;
  outputStream: 'stdout' | 'stderr';
  format: LogFormat;
}

/**
 * Log format options
 */
export enum LogFormat {
  SIMPLE = 'simple',
  JSON = 'json',
  STRUCTURED = 'structured'
}

/**
 * Base log entry structure
 */
export interface BaseLogEntry {
  timestamp: string;
  level: LogLevelString;
  message: string;
  meta?: LoggerMeta;
}

/**
 * Extended log entry with additional context
 */
export interface ExtendedLogEntry extends BaseLogEntry {
  context?: string;
  requestId?: string;
  userId?: string;
  errorCode?: string;
  stackTrace?: string;
}

/**
 * Type-safe logger metadata
 */
export interface LoggerMeta {
  // Common fields
  context?: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  
  // Error-specific fields
  error?: Error | string;
  errorCode?: string;
  stackTrace?: string;
  
  // HTTP-specific fields
  method?: string;
  url?: string;
  statusCode?: number;
  userAgent?: string;
  
  // Performance fields
  memoryUsage?: number;
  cpuUsage?: number;
  
  // Custom fields (allow extension but maintain type safety)
  [key: string]: unknown;
}

/**
 * Log formatter interface
 */
export interface LogFormatter {
  format(entry: ExtendedLogEntry): string;
}

/**
 * Log transport interface
 */
export interface LogTransport {
  write(formattedMessage: string, level: LogLevel): void;
  close?(): void;
}

/**
 * Logger interface with enhanced type safety
 */
export interface TypeSafeLogger {
  // Standard log methods
  error(message: string, meta?: LoggerMeta): void;
  warn(message: string, meta?: LoggerMeta): void;
  info(message: string, meta?: LoggerMeta): void;
  http(message: string, meta?: LoggerMeta): void;
  verbose(message: string, meta?: LoggerMeta): void;
  debug(message: string, meta?: LoggerMeta): void;
  silly(message: string, meta?: LoggerMeta): void;
  
  // Enhanced methods
  log(level: LogLevelString, message: string, meta?: LoggerMeta): void;
  
  // Utility methods
  isLevelEnabled(level: LogLevel): boolean;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  
  // Context management
  withContext(context: string): TypeSafeLogger;
  withRequestId(requestId: string): TypeSafeLogger;
  
  // Error logging with automatic stack trace capture
  logError(error: Error, message?: string, meta?: LoggerMeta): void;
  
  // Performance logging
  time(label: string): void;
  timeEnd(label: string, meta?: LoggerMeta): void;
  
  // Cleanup
  close?(): void;
}

/**
 * Logger factory configuration
 */
export interface LoggerFactoryConfig {
  defaultLevel: LogLevel;
  transports: LogTransport[];
  formatters: Record<LogFormat, LogFormatter>;
  globalMeta?: Partial<LoggerMeta>;
}

/**
 * Performance timer interface
 */
export interface PerformanceTimer {
  label: string;
  startTime: number;
  startMemory?: number;
}

/**
 * Log level utilities
 */
export class LogLevelUtils {
  /**
   * Convert string to LogLevel enum
   */
  static fromString(level: string): LogLevel {
    const upperLevel = level.toUpperCase() as LogLevelString;
    if (upperLevel in LogLevel) {
      return LogLevel[upperLevel];
    }
    throw new Error(`Invalid log level: ${level}`);
  }
  
  /**
   * Convert LogLevel to string
   */
  static toString(level: LogLevel): LogLevelString {
    const entry = Object.entries(LogLevel).find(([, value]) => value === level);
    if (!entry) {
      throw new Error(`Invalid log level: ${level}`);
    }
    return entry[0] as LogLevelString;
  }
  
  /**
   * Check if a level should be logged based on current config
   */
  static shouldLog(messageLevel: LogLevel, configLevel: LogLevel): boolean {
    return messageLevel <= configLevel;
  }
  
  /**
   * Get all available log levels
   */
  static getAllLevels(): LogLevelString[] {
    return Object.keys(LogLevel).filter(key => isNaN(Number(key))) as LogLevelString[];
  }
}

/**
 * Safe JSON serialization utilities
 */
export class SafeJsonSerializer {
  private static readonly MAX_DEPTH = 10;
  private static readonly MAX_STRING_LENGTH = 1000;
  
  /**
   * Safely serialize object to JSON string
   */
  static serialize(obj: unknown, maxDepth = this.MAX_DEPTH): string {
    try {
      return JSON.stringify(obj, this.createReplacer(maxDepth));
    } catch (error) {
      return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
    }
  }
  
  /**
   * Create JSON.stringify replacer with depth and length limits
   */
  private static createReplacer(maxDepth: number) {
    const visited = new WeakSet();
    const depthMap = new WeakMap();
    
    return function replacer(this: any, key: string, value: unknown): unknown {
      // Get current depth based on parent object
      const currentDepth = (this && depthMap.get(this)) || 0;
      
      if (currentDepth > maxDepth) {
        return '[Max Depth Exceeded]';
      }
      
      if (typeof value === 'object' && value !== null) {
        if (visited.has(value)) {
          return '[Circular Reference]';
        }
        visited.add(value);
        depthMap.set(value, currentDepth + 1);
      }
      
      if (typeof value === 'string' && value.length > SafeJsonSerializer.MAX_STRING_LENGTH) {
        return value.substring(0, SafeJsonSerializer.MAX_STRING_LENGTH) + '...[Truncated]';
      }
      
      if (typeof value === 'function') {
        return '[Function]';
      }
      
      if (typeof value === 'undefined') {
        return '[Undefined]';
      }
      
      if (typeof value === 'symbol') {
        return value.toString();
      }
      
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      
      return value;
    };
  }
}

/**
 * Timestamp utilities
 */
export class TimestampUtils {
  /**
   * Get ISO timestamp string
   */
  static getISOTimestamp(): string {
    return new Date().toISOString();
  }
  
  /**
   * Get formatted timestamp for display
   */
  static getFormattedTimestamp(format: 'ISO' | 'locale' | 'simple' = 'ISO'): string {
    const now = new Date();
    
    switch (format) {
    case 'ISO':
      return now.toISOString();
    case 'locale':
      return now.toLocaleString();
    case 'simple':
      return now.toTimeString().split(' ')[0]; // HH:MM:SS
    default:
      return now.toISOString();
    }
  }
  
  /**
   * Get high-resolution timestamp for performance measurement
   */
  static getHighResTimestamp(): number {
    return performance.now();
  }
}