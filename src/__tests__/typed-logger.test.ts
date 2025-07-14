import {
  TypedLogger,
  LoggerFactory,
  JsonFormatter,
  SimpleFormatter
} from '../utils/typed-logger';
import {
  LogLevel,
  LogLevelUtils,
  SafeJsonSerializer,
  TimestampUtils,
  LogFormat
} from '../utils/logger-types';

// Mock console to capture output
const mockConsoleError = jest.fn();
const originalConsoleError = console.error;

describe('TypedLogger', () => {
  beforeEach(() => {
    console.error = mockConsoleError;
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Basic Logging', () => {
    it('should log messages with correct format', () => {
      const logger = LoggerFactory.createDefault();
      
      logger.info('Test message', { context: 'test' });
      
      const logOutput = mockConsoleError.mock.calls[0][0];
      expect(logOutput).toMatch(/\[.*INFO.*\]/); // Match [INFO] with potential color codes
      expect(logOutput).toContain('Test message');
    });

    it('should respect log levels', () => {
      const logger = new TypedLogger({ level: LogLevel.WARN });
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      // Only warn and error should be logged
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      const warnOutput = mockConsoleError.mock.calls[0][0];
      const errorOutput = mockConsoleError.mock.calls[1][0];
      expect(warnOutput).toMatch(/\[.*WARN.*\]/);
      expect(errorOutput).toMatch(/\[.*ERROR.*\]/);
    });

    it('should support all log levels', () => {
      const logger = new TypedLogger({ level: LogLevel.SILLY });
      
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.http('HTTP');
      logger.verbose('Verbose');
      logger.debug('Debug');
      logger.silly('Silly');
      
      expect(mockConsoleError).toHaveBeenCalledTimes(7);
    });
  });

  describe('Metadata Handling', () => {
    it('should include metadata in logs', () => {
      const logger = LoggerFactory.createDefault();
      
      logger.info('Test with metadata', {
        userId: '123',
        action: 'login',
        duration: 100
      });
      
      const metaOutput = mockConsoleError.mock.calls[0][0];
      expect(metaOutput).toContain('userId');
    });

    it('should handle complex metadata safely', () => {
      const logger = LoggerFactory.createDefault();
      const circularObj: any = { prop: 'value' };
      circularObj.circular = circularObj;
      
      logger.info('Test with circular reference', { circularObj });
      
      // Should not throw and should log something
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('Context Management', () => {
    it('should support context-aware logging', () => {
      const logger = LoggerFactory.createDefault();
      const contextLogger = logger.withContext('auth-service');
      
      contextLogger.info('Authentication successful');
      
      const contextOutput = mockConsoleError.mock.calls[0][0];
      expect(contextOutput).toContain('[auth-service]');
    });

    it('should support request ID logging', () => {
      const logger = LoggerFactory.createDefault();
      const requestLogger = logger.withRequestId('req-123');
      
      requestLogger.info('Processing request');
      
      const requestOutput = mockConsoleError.mock.calls[0][0];
      expect(requestOutput).toContain('req-123');
    });
  });

  describe('Error Logging', () => {
    it('should log errors with stack traces', () => {
      const logger = new TypedLogger({ enableStackTrace: true });
      const error = new Error('Test error');
      
      logger.logError(error, 'An error occurred');
      
      const errorOutput = mockConsoleError.mock.calls[0][0];
      expect(errorOutput).toMatch(/\[.*ERROR.*\]/);
      expect(errorOutput).toContain('Test error');
    });

    it('should handle error objects in metadata', () => {
      const logger = LoggerFactory.createDefault();
      const error = new Error('Test error');
      
      logger.error('Error occurred', { error });
      
      const errorMetaOutput = mockConsoleError.mock.calls[0][0];
      expect(errorMetaOutput).toContain('Test error');
    });
  });

  describe('Performance Timing', () => {
    it('should measure execution time', (done) => {
      const logger = new TypedLogger({ level: LogLevel.DEBUG }); // Enable debug logging
      
      logger.time('test-operation');
      
      setTimeout(() => {
        logger.timeEnd('test-operation');
        
        expect(mockConsoleError).toHaveBeenCalled();
        const timerOutput = mockConsoleError.mock.calls.find(call => 
          call[0].includes('test-operation')
        );
        expect(timerOutput).toBeDefined();
        if (timerOutput) {
          expect(timerOutput[0]).toContain('ms');
        }
        done();
      }, 50); // Increase timeout slightly
    });

    it('should warn about non-existent timers', () => {
      const logger = LoggerFactory.createDefault();
      
      logger.timeEnd('non-existent-timer');
      
      const warningOutput = mockConsoleError.mock.calls[0][0];
      expect(warningOutput).toContain('does not exist');
    });
  });

  describe('Configuration', () => {
    it('should support different log formats', () => {
      const jsonLogger = new TypedLogger({ format: LogFormat.JSON });
      
      jsonLogger.info('Test message', { key: 'value' });
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/)
      );
    });

    it('should allow level changes', () => {
      const logger = new TypedLogger({ level: LogLevel.ERROR });
      
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
      
      logger.setLevel(LogLevel.DEBUG);
      
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(true);
    });
  });
});

describe('LogLevelUtils', () => {
  it('should convert string to LogLevel', () => {
    expect(LogLevelUtils.fromString('ERROR')).toBe(LogLevel.ERROR);
    expect(LogLevelUtils.fromString('debug')).toBe(LogLevel.DEBUG);
    expect(LogLevelUtils.fromString('Info')).toBe(LogLevel.INFO);
  });

  it('should convert LogLevel to string', () => {
    expect(LogLevelUtils.toString(LogLevel.ERROR)).toBe('ERROR');
    expect(LogLevelUtils.toString(LogLevel.DEBUG)).toBe('DEBUG');
  });

  it('should validate log level comparison', () => {
    expect(LogLevelUtils.shouldLog(LogLevel.ERROR, LogLevel.INFO)).toBe(true);
    expect(LogLevelUtils.shouldLog(LogLevel.DEBUG, LogLevel.INFO)).toBe(false);
    expect(LogLevelUtils.shouldLog(LogLevel.WARN, LogLevel.WARN)).toBe(true);
  });

  it('should throw for invalid log levels', () => {
    expect(() => LogLevelUtils.fromString('INVALID')).toThrow();
  });
});

describe('SafeJsonSerializer', () => {
  it('should serialize simple objects', () => {
    const obj = { name: 'test', value: 123 };
    const result = SafeJsonSerializer.serialize(obj);
    
    expect(result).toBe('{"name":"test","value":123}');
  });

  it('should handle circular references', () => {
    const obj: any = { name: 'test' };
    obj.circular = obj;
    
    const result = SafeJsonSerializer.serialize(obj);
    
    expect(result).toContain('[Circular Reference]');
  });

  it('should handle functions', () => {
    const obj = { 
      name: 'test',
      method: () => 'hello'
    };
    
    const result = SafeJsonSerializer.serialize(obj);
    
    expect(result).toContain('[Function]');
  });

  it('should handle errors', () => {
    const obj = { 
      error: new Error('Test error')
    };
    
    const result = SafeJsonSerializer.serialize(obj);
    
    expect(result).toContain('Test error');
  });

  it('should limit string length', () => {
    const longString = 'a'.repeat(2000);
    const obj = { longString };
    
    const result = SafeJsonSerializer.serialize(obj);
    
    expect(result).toContain('[Truncated]');
  });

  it('should handle deep nesting', () => {
    const createDeepObject = (depth: number): any => {
      if (depth === 0) return { value: 'deep' };
      return { nested: createDeepObject(depth - 1) };
    };
    
    const deepObj = createDeepObject(20);
    const result = SafeJsonSerializer.serialize(deepObj);
    
    expect(result).toContain('[Max Depth Exceeded]');
  });
});

describe('TimestampUtils', () => {
  it('should generate ISO timestamps', () => {
    const timestamp = TimestampUtils.getISOTimestamp();
    
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should generate formatted timestamps', () => {
    const isoTimestamp = TimestampUtils.getFormattedTimestamp('ISO');
    const simpleTimestamp = TimestampUtils.getFormattedTimestamp('simple');
    
    expect(isoTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(simpleTimestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should generate high-resolution timestamps', () => {
    const start = TimestampUtils.getHighResTimestamp();
    const end = TimestampUtils.getHighResTimestamp();
    
    expect(end).toBeGreaterThan(start);
    expect(typeof start).toBe('number');
    expect(typeof end).toBe('number');
  });
});

describe('LoggerFactory', () => {
  it('should create default logger', () => {
    const logger = LoggerFactory.createDefault();
    
    expect(logger).toBeDefined();
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });

  it('should create logger with custom config', () => {
    const logger = LoggerFactory.create({
      level: LogLevel.DEBUG,
      enableColors: false
    });
    
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('should create logger from environment', () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    
    const logger = LoggerFactory.createFromEnvironment();
    
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    
    // Restore original value
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });
});

describe('Formatters', () => {
  describe('JsonFormatter', () => {
    it('should format log entries as JSON', () => {
      const formatter = new JsonFormatter();
      const entry = {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'INFO' as const,
        message: 'Test message',
        meta: { key: 'value' }
      };
      
      const result = formatter.format(entry);
      
      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain('Test message');
    });
  });

  describe('SimpleFormatter', () => {
    it('should format log entries as text', () => {
      const formatter = new SimpleFormatter(true, true, false);
      const entry = {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'INFO' as const,
        message: 'Test message',
        meta: { key: 'value' }
      };
      
      const result = formatter.format(entry);
      
      expect(result).toContain('[2023-01-01T00:00:00.000Z]');
      expect(result).toContain('[INFO]');
      expect(result).toContain('Test message');
    });
  });
});