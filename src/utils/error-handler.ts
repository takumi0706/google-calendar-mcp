// src/utils/error-handler.ts
import { Request, Response, NextFunction } from 'express';
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
    public details?: any
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
    details?: any;
  };
}

/**
 * Error handling middleware
 * Used in Express applications to return appropriate error responses
 */
export function handleError(err: any, req: Request, res: Response, next: NextFunction) {
  // If response has already been sent, pass to next middleware
  if (res.headersSent) {
    return next(err);
  }

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
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle Google API errors appropriately
  if (err.response && err.response.data && err.response.data.error) {
    const googleError = err.response.data.error;
    const statusCode = err.response.status || 500;

    logger.error('Google API Error', { 
      googleError,
      statusCode,
      path: req.path,
      method: req.method
    });

    return res.status(statusCode).json({
      error: {
        code: ErrorCode.API_ERROR,
        message: googleError.message || 'Google API Error',
        details: process.env.NODE_ENV !== 'production' ? googleError : undefined
      }
    });
  }

  // Handle other unknown errors
  const statusCode = err.statusCode || err.status || 500;
  const errorMessage = err.message || 'Internal server error occurred';

  logger.error('Unexpected error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  return res.status(statusCode).json({
    error: {
      code: ErrorCode.SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error occurred' 
        : errorMessage
    }
  });
}

/**
 * Wrap async functions to automate error handling
 * Used in Express route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
