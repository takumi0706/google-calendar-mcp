// src/utils/error-handler.ts
import { Context, Next } from 'hono';
import logger from './logger';

/**
 * Error codes used in the application
 */
export enum ErrorCode {
  AUTHENTICATION_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CALENDAR_ERROR = 'CALENDAR_ERROR',
  CONFIGURATION_ERROR = 'CONFIG_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TOKEN_ERROR = 'TOKEN_ERROR'
}

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
    details?: Record<string, unknown>;
  };
}

/**
 * Error handling middleware for Hono
 * Used in Hono applications to return appropriate error responses
 */
export function handleError(err: unknown, c: Context): Response {
  // If error is an instance of AppError, return structured response
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message
      }
    };

    // Include details in development environment
    if (process.env.NODE_ENV !== 'production' && err.details) {
      errorResponse.error.details = err.details;
    }

    logger.error(`${err.code}: ${err.message}`, { 
      statusCode: err.statusCode,
      details: err.details,
      path: c.req.path,
      method: c.req.method,
      url: c.req.url
    });

    return c.json(errorResponse, err.statusCode as 200 | 201 | 300 | 400 | 401 | 403 | 404 | 500);
  }

  // Handle Google API errors appropriately
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const errorWithResponse = err as { response?: { data?: { error?: unknown }; status?: number } };
    if (errorWithResponse.response?.data?.error) {
      const googleError = errorWithResponse.response.data.error;
      const statusCode = errorWithResponse.response.status || 500;

      logger.error('Google API Error', { 
        googleError,
        statusCode,
        path: c.req.path,
        method: c.req.method
      });

      const errorMessage = typeof googleError === 'object' && googleError !== null && 'message' in googleError 
        ? (googleError as { message: string }).message 
        : 'Google API Error';

      return c.json({
        error: {
          code: ErrorCode.API_ERROR,
          message: errorMessage,
          details: process.env.NODE_ENV !== 'production' ? googleError as Record<string, unknown> : undefined
        }
      }, statusCode as 200 | 201 | 300 | 400 | 401 | 403 | 404 | 500);
    }
  }

  // Handle other unknown errors
  const errorObj = err as { statusCode?: number; status?: number; message?: string; stack?: string };
  const statusCode = errorObj.statusCode || errorObj.status || 500;
  const errorMessage = errorObj.message || 'Internal server error occurred';

  logger.error('Unexpected error', { 
    error: errorObj.message, 
    stack: errorObj.stack,
    path: c.req.path,
    method: c.req.method
  });

  return c.json({
    error: {
      code: ErrorCode.SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error occurred' 
        : errorMessage
    }
  }, statusCode as 200 | 201 | 300 | 400 | 401 | 403 | 404 | 500);
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
