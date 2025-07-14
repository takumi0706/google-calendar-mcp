// src/utils/error-handler.ts
import { Context, Next } from 'hono';
import logger from './logger';
import { ErrorCode } from './error-codes';
import { 
  sanitizeErrorForLogging, 
  sanitizeRequestContext, 
  createSecureErrorResponse,
  getProductionSafeErrorMessage 
} from './security-sanitizer';

// Re-export ErrorCode for backward compatibility
export { ErrorCode };

/**
 * Application-specific error class
 * Contains error code, status code, and optional details
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';

    // Correctly set up the prototype chain (fixes issue with extending Error class in TypeScript)
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error response that can be converted to JSON
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Error handling middleware for Hono
 * Used in Hono applications to return appropriate error responses
 */
export function handleError(err: unknown, c: Context): Response {
  // If error is an instance of AppError, return structured response
  if (err instanceof AppError) {
    const secureErrorResponse = createSecureErrorResponse(err.code, err.message, err.details);
    const errorResponse: ErrorResponse = {
      error: secureErrorResponse
    };

    // Use sanitized logging
    logger.error(`${err.code}: ${err.message}`, {
      statusCode: err.statusCode,
      details: sanitizeErrorForLogging(err.details),
      requestContext: sanitizeRequestContext({
        path: c.req.path,
        method: c.req.method,
        url: c.req.url
      })
    });

    // Ensure statusCode is a valid HTTP error code (400-599 range)
    const statusCode = (err.statusCode >= 400 && err.statusCode <= 599) ? err.statusCode : 500;
    return c.json(errorResponse, statusCode as 400 | 401 | 403 | 404 | 422 | 429 | 500 | 502 | 503);
  }

  // Handle Google API errors appropriately
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const errorWithResponse = err as { response?: { data?: { error?: unknown }; status?: number } };
    if (errorWithResponse.response?.data?.error) {
      const googleError = errorWithResponse.response.data.error;
      const statusCode = errorWithResponse.response.status || 500;

      // Use sanitized logging for Google API errors
      logger.error('Google API Error', {
        googleError: sanitizeErrorForLogging(googleError),
        statusCode,
        requestContext: sanitizeRequestContext({
          path: c.req.path,
          method: c.req.method
        })
      });

      const errorMessage = typeof googleError === 'object' && googleError !== null && 'message' in googleError 
        ? (googleError as { message: string }).message 
        : 'Google API Error';

      const secureErrorResponse = createSecureErrorResponse(
        ErrorCode.API_ERROR, 
        errorMessage, 
        googleError
      );

      return c.json({ error: secureErrorResponse }, statusCode as 200 | 201 | 300 | 400 | 401 | 403 | 404 | 500);
    }
  }

  // Handle other unknown errors
  const errorObj = err as { statusCode?: number; status?: number; message?: string; stack?: string };
  const statusCode = errorObj.statusCode || errorObj.status || 500;
  const errorMessage = errorObj.message || 'Internal server error occurred';

  // Use sanitized logging for unexpected errors
  logger.error('Unexpected error', {
    errorDetails: sanitizeErrorForLogging(err),
    requestContext: sanitizeRequestContext({
      path: c.req.path,
      method: c.req.method
    })
  });

  const secureErrorResponse = createSecureErrorResponse(
    ErrorCode.SERVER_ERROR,
    errorMessage
  );

  return c.json({ error: secureErrorResponse }, statusCode as 200 | 201 | 300 | 400 | 401 | 403 | 404 | 500);
}

/**
 * Wrap async functions to automate error handling
 * Used in Hono route handlers
 */
export function asyncHandler(fn: (c: Context, next?: Next) => Promise<any>) {
  return async (c: Context, next?: Next) => {
    try {
      return await Promise.resolve(fn(c, next));
    } catch (err) {
      return handleError(err, c);
    }
  };
}

/**
 * Create error handling middleware for Hono
 */
export function createErrorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      return handleError(err, c);
    }
  };
}

/**
 * MCP tool response format
 */
export interface McpToolResponse {
  [x: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Unified error handler for MCP tools (Singleton)
 */
class McpErrorHandler {
  private static instance: McpErrorHandler;

  private constructor() {}

  public static getInstance(): McpErrorHandler {
    if (!McpErrorHandler.instance) {
      McpErrorHandler.instance = new McpErrorHandler();
    }
    return McpErrorHandler.instance;
  }

  /**
   * Convert error to ErrorCode
   */
  private determineErrorCode(error: unknown): ErrorCode {
    if (typeof error === 'string') {
      const lowerError = error.toLowerCase();
      if (lowerError.includes('auth') || lowerError.includes('token')) {
        return ErrorCode.AUTHENTICATION_ERROR;
      }
      if (lowerError.includes('not found')) {
        return ErrorCode.NOT_FOUND_ERROR;
      }
      if (lowerError.includes('validation') || lowerError.includes('invalid')) {
        return ErrorCode.VALIDATION_ERROR;
      }
      return ErrorCode.SERVER_ERROR;
    }

    if (error instanceof AppError) {
      return error.code;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('authentication') || message.includes('unauthorized') || 
          message.includes('token') || message.includes('credentials')) {
        return ErrorCode.AUTHENTICATION_ERROR;
      }
      
      if (message.includes('validation') || message.includes('invalid') || 
          message.includes('required') || message.includes('format')) {
        return ErrorCode.VALIDATION_ERROR;
      }
      
      if (message.includes('calendar') || message.includes('google') || 
          message.includes('api')) {
        return ErrorCode.CALENDAR_ERROR;
      }
      
      if (message.includes('permission') || message.includes('forbidden') || 
          message.includes('access denied')) {
        return ErrorCode.PERMISSION_ERROR;
      }
      
      if (message.includes('not found') || message.includes('does not exist')) {
        return ErrorCode.NOT_FOUND_ERROR;
      }
      
      if (message.includes('rate limit') || message.includes('quota')) {
        return ErrorCode.RATE_LIMIT_ERROR;
      }
    }

    return ErrorCode.SERVER_ERROR;
  }

  /**
   * Generate user-friendly messages based on ErrorCode
   */
  private generateUserMessage(errorCode: ErrorCode, originalMessage: string): string {
    return getProductionSafeErrorMessage(errorCode, originalMessage);
  }

  /**
   * Convert error to MCP tool response format
   */
  public handleError(error: unknown, context?: Record<string, unknown>): McpToolResponse {
    const errorCode = this.determineErrorCode(error);
    const originalMessage = error instanceof Error ? error.message : String(error);
    
    // Use sanitized logging
    logger.error(`[${errorCode}] ${originalMessage}`, {
      requestContext: sanitizeRequestContext(context || {}),
      errorDetails: sanitizeErrorForLogging(error)
    });

    // Generate user-friendly message
    const userMessage = this.generateUserMessage(errorCode, originalMessage);

    return {
      content: [{ type: 'text', text: userMessage }],
      isError: true
    };
  }

  /**
   * Generate authentication error response
   */
  public createAuthError(): McpToolResponse {
    return {
      content: [{ 
        type: 'text', 
        text: 'Google Calendar authentication is required. Please run the "authenticate" tool to complete authentication.' 
      }],
      isError: true
    };
  }

  /**
   * Generate validation error response
   */
  public createValidationError(message: string): McpToolResponse {
    return {
      content: [{ 
        type: 'text', 
        text: `Input data validation failed: ${message}` 
      }],
      isError: true
    };
  }

  /**
   * Success response generation helper
   */
  public createSuccessResponse(data: unknown): McpToolResponse {
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
}

// Export singleton instance of MCP error handler
export const mcpErrorHandler = McpErrorHandler.getInstance();
