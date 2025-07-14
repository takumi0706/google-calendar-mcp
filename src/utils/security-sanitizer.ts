/**
 * Security sanitizer for error messages and logging
 * Prevents sensitive information leakage in error responses and logs
 */

import { ErrorCode } from './error-codes';

/**
 * Sensitive data patterns that should be redacted
 */
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  /\b[A-Za-z0-9]{32,}\b/g, // Generic API keys
  /\bsk-[A-Za-z0-9]{48,}\b/g, // OpenAI API keys
  /\bAIza[A-Za-z0-9-_]{35}\b/g, // Google API keys
  /\byaA[A-Za-z0-9-_]{40,}\b/g, // OAuth tokens
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, // Base64 encoded tokens
  
  // Authentication tokens
  /\bBearer\s+[A-Za-z0-9+/=]+/gi,
  /\baccess_token['":\s]*[A-Za-z0-9+/=]+/gi,
  /\brefresh_token['":\s]*[A-Za-z0-9+/=]+/gi,
  /\bauthorization['":\s]*[A-Za-z0-9+/=\s]+/gi,
  
  // Passwords and secrets
  /\bpassword['":\s]*[^\s'"]+/gi,
  /\bsecret['":\s]*[^\s'"]+/gi,
  /\bprivate_key['":\s]*[^\s'"]+/gi,
  
  // Email addresses (partial redaction)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // File paths that might contain usernames
  /\b\/[Uu]sers\/[^/\s]+/g,
  /\b[A-Z]:\\[Uu]sers\\[^\\\s]+/g,
];

/**
 * Sensitive field names that should be redacted
 */
const SENSITIVE_FIELDS = [
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

/**
 * Production-safe error messages for different error types
 */
const SAFE_ERROR_MESSAGES = {
  [ErrorCode.AUTHENTICATION_ERROR]: 'Authentication failed. Please check your credentials.',
  [ErrorCode.VALIDATION_ERROR]: 'Invalid input data provided.',
  [ErrorCode.API_ERROR]: 'External service error occurred.',
  [ErrorCode.SERVER_ERROR]: 'Internal server error occurred.',
  [ErrorCode.CALENDAR_ERROR]: 'Calendar service error occurred.',
  [ErrorCode.CONFIGURATION_ERROR]: 'Configuration error detected.',
  [ErrorCode.PERMISSION_ERROR]: 'Access denied.',
  [ErrorCode.NOT_FOUND_ERROR]: 'Requested resource not found.',
  [ErrorCode.RATE_LIMIT_ERROR]: 'Rate limit exceeded.',
  [ErrorCode.TOKEN_ERROR]: 'Token error occurred.'
};

/**
 * Sanitize text by removing or redacting sensitive information
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let sanitized = text;

  // Apply pattern-based redaction
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Sanitize object by removing or redacting sensitive fields
 */
export function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;

  Object.entries(objRecord).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    
    // Check if field name is sensitive
    const isSensitiveField = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitiveField) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Get production-safe error message
 */
export function getProductionSafeErrorMessage(errorCode: ErrorCode, originalMessage?: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction && originalMessage) {
    return sanitizeText(originalMessage);
  }
  
  return SAFE_ERROR_MESSAGES[errorCode] || 'An error occurred.';
}

/**
 * Sanitize error details for logging
 */
export function sanitizeErrorForLogging(error: unknown): unknown {
  if (error instanceof Error) {
    const baseErrorInfo = {
      name: error.name,
      message: sanitizeText(error.message),
      stack: process.env.NODE_ENV === 'production' ? '[REDACTED]' : sanitizeText(error.stack || '')
    };
    
    const sanitizedError = sanitizeObject(error) as Record<string, unknown>;
    return sanitizeObject({ ...baseErrorInfo, ...sanitizedError });
  }
  
  return sanitizeObject(error);
}

/**
 * Sanitize request context for logging
 */
export function sanitizeRequestContext(context: {
  path?: string;
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}): Record<string, unknown> {
  return sanitizeObject({
    path: context.path,
    method: context.method,
    url: context.url ? sanitizeText(context.url) : undefined,
    headers: sanitizeObject(context.headers || {}),
    // Only include safe context fields
    userAgent: typeof context.userAgent === 'string' ? sanitizeText(context.userAgent) : undefined,
    timestamp: context.timestamp,
    requestId: context.requestId
  }) as Record<string, unknown>;
}

/**
 * Check if current environment allows detailed error information
 */
export function shouldShowDetailedErrors(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Redact email addresses (show only first letter and domain)
 */
export function redactEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email;
  }
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 1) {
    return `${localPart}@${domain}`;
  }
  
  return `${localPart[0]}***@${domain}`;
}

/**
 * Redact file paths to remove sensitive directory information
 */
export function redactFilePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return path;
  }
  
  // Replace user directories with generic placeholder
  return path
    .replace(/\/Users\/[^/]+/g, '/Users/[USER]')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]')
    .replace(/\/home\/[^/]+/g, '/home/[USER]');
}

/**
 * Create security-aware error response
 */
export function createSecureErrorResponse(
  errorCode: ErrorCode,
  originalMessage: string,
  details?: unknown
): {
  code: ErrorCode;
  message: string;
  details?: unknown;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const result: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  } = {
    code: errorCode,
    message: getProductionSafeErrorMessage(errorCode, originalMessage)
  };

  if (!isProduction) {
    result.details = sanitizeObject(details);
  }

  return result;
}