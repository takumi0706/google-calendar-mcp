/**
 * Enhanced type-safe logger for Google Calendar MCP
 * 
 * This logger provides:
 * - Type-safe logging with comprehensive metadata support
 * - Performance timing capabilities
 * - Context-aware logging
 * - Safe JSON serialization
 * - Configurable log levels and formatting
 * - Backward compatibility with existing code
 */

import { LoggerFactory, LogLevel, LogLevelUtils } from './typed-logger';
import { LoggerMeta, TypeSafeLogger } from './logger-types';

// Re-export types for backward compatibility
export type { LoggerMeta };

// Legacy Logger interface for backward compatibility
export interface Logger {
  error: (message: string, meta?: LoggerMeta) => void;
  warn: (message: string, meta?: LoggerMeta) => void;
  info: (message: string, meta?: LoggerMeta) => void;
  http: (message: string, meta?: LoggerMeta) => void;
  verbose: (message: string, meta?: LoggerMeta) => void;
  silly: (message: string, meta?: LoggerMeta) => void;
  debug: (message: string, meta?: LoggerMeta) => void;
}

/**
 * Enhanced logger wrapper that implements the legacy interface
 * while providing access to the new type-safe features
 */
class EnhancedLoggerWrapper implements Logger {
  private typedLogger: TypeSafeLogger;

  constructor() {
    // Initialize with environment-based configuration
    this.typedLogger = LoggerFactory.createFromEnvironment();
    
    // Set log level based on environment or configuration
    const configLevel = this.getConfiguredLogLevel();
    if (configLevel !== null) {
      this.typedLogger.setLevel(configLevel);
    }
  }

  /**
   * Get configured log level from environment or config
   */
  private getConfiguredLogLevel(): LogLevel | null {
    // Try to get from imported config if available
    try {
      // Use dynamic import to avoid circular dependencies
      const configModule = eval('require')('../config/config');
      const config = configModule?.default;
      if (config?.security?.logLevel) {
        return LogLevelUtils.fromString(config.security.logLevel);
      }
    } catch {
      // Config not available, use environment or default
    }

    // Fallback to environment variable
    if (process.env.LOG_LEVEL) {
      try {
        return LogLevelUtils.fromString(process.env.LOG_LEVEL);
      } catch {
        // Invalid log level, use default
      }
    }

    return null;
  }

  // Legacy interface implementation
  error(message: string, meta?: LoggerMeta): void {
    this.typedLogger.error(message, meta);
  }

  warn(message: string, meta?: LoggerMeta): void {
    this.typedLogger.warn(message, meta);
  }

  info(message: string, meta?: LoggerMeta): void {
    this.typedLogger.info(message, meta);
  }

  http(message: string, meta?: LoggerMeta): void {
    this.typedLogger.http(message, meta);
  }

  verbose(message: string, meta?: LoggerMeta): void {
    this.typedLogger.verbose(message, meta);
  }

  silly(message: string, meta?: LoggerMeta): void {
    this.typedLogger.silly(message, meta);
  }

  debug(message: string, meta?: LoggerMeta): void {
    this.typedLogger.debug(message, meta);
  }

  // Enhanced methods (accessible through type assertion)
  
  /**
   * Get the underlying typed logger for advanced features
   */
  getTypedLogger(): TypeSafeLogger {
    return this.typedLogger;
  }

  /**
   * Log an error with automatic stack trace capture
   */
  logError(error: Error, message?: string, meta?: LoggerMeta): void {
    this.typedLogger.logError(error, message, meta);
  }

  /**
   * Create a logger with additional context
   */
  withContext(context: string): TypeSafeLogger {
    return this.typedLogger.withContext(context);
  }

  /**
   * Create a logger with request ID
   */
  withRequestId(requestId: string): TypeSafeLogger {
    return this.typedLogger.withRequestId(requestId);
  }

  /**
   * Start performance timer
   */
  time(label: string): void {
    this.typedLogger.time(label);
  }

  /**
   * End performance timer and log duration
   */
  timeEnd(label: string, meta?: LoggerMeta): void {
    this.typedLogger.timeEnd(label, meta);
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.typedLogger.isLevelEnabled(level);
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.typedLogger.setLevel(level);
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.typedLogger.getLevel();
  }

  /**
   * Clean up resources
   */
  close(): void {
    if (this.typedLogger.close) {
      this.typedLogger.close();
    }
  }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLoggerWrapper();

// Export default logger for backward compatibility
export default enhancedLogger;

// Export enhanced logger explicitly for type-aware usage
export const logger = enhancedLogger;

// Export factory and types for advanced usage
export { LoggerFactory, LogLevel, LogLevelUtils } from './typed-logger';
export type { TypeSafeLogger } from './logger-types';

/**
 * Utility function to create a scoped logger with context
 * 
 * @example
 * const scopedLogger = createScopedLogger('auth-service');
 * scopedLogger.info('User authenticated', { userId: '123' });
 */
export function createScopedLogger(context: string): TypeSafeLogger {
  return enhancedLogger.withContext(context);
}

/**
 * Utility function to create a request-scoped logger
 * 
 * @example
 * const requestLogger = createRequestLogger('req-abc-123');
 * requestLogger.info('Processing request');
 */
export function createRequestLogger(requestId: string): TypeSafeLogger {
  return enhancedLogger.withRequestId(requestId);
}

/**
 * Performance measurement decorator
 * 
 * @example
 * class MyService {
 *   @performanceLog('myMethod')
 *   async myMethod() {
 *     // Method implementation
 *   }
 * }
 */
export function performanceLog(label?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const timerLabel = label || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      enhancedLogger.time(timerLabel);
      try {
        const result = await originalMethod.apply(this, args);
        enhancedLogger.timeEnd(timerLabel);
        return result;
      } catch (error) {
        enhancedLogger.timeEnd(timerLabel, { hasError: true });
        throw error;
      }
    };

    return descriptor;
  };
}
