// src/utils/error-handler.ts
import logger from './logger';
import { ErrorCode } from './error-codes';
import {
  sanitizeErrorForLogging,
  sanitizeRequestContext,
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
