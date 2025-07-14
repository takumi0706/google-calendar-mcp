/**
 * Error codes used throughout the application
 * Separated to avoid circular dependencies
 */

/**
 * Error codes enum
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