/**
 * Tests for security-sanitizer.ts
 * Comprehensive tests for sanitizeText and sanitizeObject functions
 */

import {
  sanitizeText,
  sanitizeObject,
  getProductionSafeErrorMessage,
  sanitizeErrorForLogging,
  sanitizeRequestContext,
  createSecureErrorResponse
} from '../../utils/security-sanitizer';
import { ErrorCode } from '../../utils/error-codes';

describe('Security Sanitizer', () => {
  describe('sanitizeText', () => {
    it('should handle null, undefined, and non-string inputs', () => {
      expect(sanitizeText(null as any)).toBe(null);
      expect(sanitizeText(undefined as any)).toBe(undefined);
      expect(sanitizeText(123 as any)).toBe(123);
      expect(sanitizeText('' as any)).toBe('');
    });

    it('should redact API keys and tokens', () => {
      const testCases = [
        {
          input: 'API key: AIzaSyBvOiI9qwlnOKuGF8BjO-X4nGm6-r3VoKo',
          description: 'Google API key'
        },
        {
          input: 'OpenAI key: sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO',
          description: 'OpenAI API key'
        },
        {
          input: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          description: 'Bearer token'
        },
        {
          input: 'access_token: "abc123def456ghi789"',
          description: 'Access token'
        },
        {
          input: 'refresh_token: xyz789uvw456rst123',
          description: 'Refresh token'
        }
      ];

      testCases.forEach(({ input, description }) => {
        const result = sanitizeText(input);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toBe(input); // Should be different from original
      });
    });

    it('should redact passwords and secrets', () => {
      const testCases = [
        'password: mySecretPassword123',
        'secret: "topSecret"',
        'private_key: -----BEGIN PRIVATE KEY-----'
      ];

      testCases.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toBe(input);
      });
    });

    it('should redact email addresses', () => {
      const input = 'User email: john.doe@example.com sent a message';
      const result = sanitizeText(input);
      expect(result).toBe('User email: [REDACTED] sent a message');
    });

    it('should redact file paths with usernames', () => {
      const testCases = [
        'File path: /Users/johndoe/Documents/secret.txt',
        'Windows path: C:\\Users\\johndoe\\AppData\\file.txt'
      ];

      testCases.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toBe(input);
      });
    });

    it('should not modify safe text', () => {
      const safeTexts = [
        'This is a normal message',
        'Error occurred during processing',
        'Calendar event created successfully',
        'No sensitive data here'
      ];

      safeTexts.forEach(text => {
        expect(sanitizeText(text)).toBe(text);
      });
    });
  });

  describe('sanitizeObject', () => {
    it('should handle primitive values', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
      expect(sanitizeObject(123)).toBe(123);
      expect(sanitizeObject('string')).toBe('string');
      expect(sanitizeObject(true)).toBe(true);
    });

    it('should sanitize arrays recursively', () => {
      const input = [
        { text: 'normal text' },
        { password: 'secret123' },
        { data: 'API key: AIzaSyBvOiI9qwlnOKuGF8BjO-X4nGm6-r3VoKo' }
      ];

      const result = sanitizeObject(input) as unknown[];
      expect((result[0] as any).text).toBe('normal text');
      expect((result[1] as any).password).toBe('[REDACTED]');
      expect((result[2] as any).data).toContain('[REDACTED]');
    });

    it('should redact sensitive field names', () => {
      const sensitiveFields = [
        'password',
        'secret',
        'token',
        'key',
        'authorization',
        'auth',
        'credentials',
        'access_token',
        'refresh_token',
        'client_secret',
        'private_key',
        'session',
        'cookie',
        'jwt',
        'signature'
      ];

      sensitiveFields.forEach(field => {
        const input = { [field]: 'sensitive-value' };
        const result = sanitizeObject(input) as Record<string, unknown>;
        expect(result[field]).toBe('[REDACTED]');
      });
    });

    it('should handle case-insensitive field matching', () => {
      const input = {
        Password: 'secret123',
        ACCESS_TOKEN: 'token123',
        clientSecret: 'secret456'
      };

      const result = sanitizeObject(input) as Record<string, unknown>;
      expect(result.Password).toBe('[REDACTED]');
      expect(result.ACCESS_TOKEN).toBe('[REDACTED]');
      expect(result.clientSecret).toBe('[REDACTED]');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          userSettings: {
            password: 'secret123',
            theme: 'dark'
          }
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
          session: 'session123'
        }
      };

      const result = sanitizeObject(input) as any;
      expect(result.user.name).toBe('John Doe');
      expect(result.user.email).toBe('[REDACTED]');
      expect(result.user.userSettings.password).toBe('[REDACTED]');
      expect(result.user.userSettings.theme).toBe('dark');
      expect(result.metadata.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(result.metadata.session).toBe('[REDACTED]');
    });

    it('should preserve safe fields and values', () => {
      const input = {
        id: 123,
        name: 'Test User',
        status: 'active',
        settings: {
          theme: 'dark',
          notifications: true
        }
      };

      const result = sanitizeObject(input);
      expect(result).toEqual(input);
    });
  });

  describe('getProductionSafeErrorMessage', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return sanitized original message in non-production', () => {
      process.env.NODE_ENV = 'development';
      const result = getProductionSafeErrorMessage(
        ErrorCode.AUTHENTICATION_ERROR,
        'Authentication failed with token: sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO'
      );
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('Authentication failed');
    });

    it('should return safe message in production', () => {
      process.env.NODE_ENV = 'production';
      const result = getProductionSafeErrorMessage(
        ErrorCode.AUTHENTICATION_ERROR,
        'Authentication failed with token: sk-abc123'
      );
      expect(result).toBe('Authentication failed. Please check your credentials.');
    });

    it('should return default message for unknown error codes', () => {
      process.env.NODE_ENV = 'production';
      const result = getProductionSafeErrorMessage(
        'UNKNOWN_ERROR' as ErrorCode
      );
      expect(result).toBe('An error occurred.');
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should sanitize error objects', () => {
      const error = {
        message: 'API call failed with key: AIzaSyBvOiI9qwlnOKuGF8BjO-X4nGm6-r3VoKo',
        password: 'secret123',
        metadata: {
          user: 'john@example.com'
        }
      };

      const result = sanitizeErrorForLogging(error) as any;
      expect(result.message).toBe('API call failed with key: [REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.metadata.user).toBe('[REDACTED]');
    });
  });

  describe('sanitizeRequestContext', () => {
    it('should sanitize request context', () => {
      const context = {
        path: '/api/auth',
        method: 'POST',
        url: 'https://example.com/api/auth?token=secret123',
        headers: {
          authorization: 'Bearer token123',
          'content-type': 'application/json'
        }
      };

      const result = sanitizeRequestContext(context) as any;
      expect(result.path).toBe('/api/auth');
      expect(result.method).toBe('POST');
      expect(result.url).toContain('[REDACTED]');
      expect(result.headers.authorization).toBe('[REDACTED]');
      expect(result.headers['content-type']).toBe('application/json');
    });
  });

  describe('createSecureErrorResponse', () => {
    it('should create secure error response', () => {
      const result = createSecureErrorResponse(
        ErrorCode.AUTHENTICATION_ERROR,
        'Auth failed with token: secret123',
        { userId: 123, token: 'secret456' }
      );

      expect(result.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      expect(result.message).toBeDefined();
      expect((result.details as any).userId).toBe(123);
      expect((result.details as any).token).toBe('[REDACTED]');
    });
  });
});