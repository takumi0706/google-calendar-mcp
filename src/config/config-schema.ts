import { z } from 'zod';

/**
 * Environment validation schema using Zod
 * Provides type-safe configuration validation with detailed error messages
 */

// Google OAuth Configuration Schema
const GoogleConfigSchema = z.object({
  clientId: z.string()
    .min(1, 'Google Client ID is required')
    .refine(val => val !== 'dummy-client-id', 'Google Client ID must be a valid value, not dummy'),
  clientSecret: z.string()
    .min(1, 'Google Client Secret is required')
    .refine(val => val !== 'dummy-client-secret', 'Google Client Secret must be a valid value, not dummy'),
  redirectUri: z.string()
    .url('Google Redirect URI must be a valid URL')
    .refine(val => val.includes('/oauth2callback'), 'Redirect URI must include /oauth2callback endpoint'),
  scopes: z.array(z.string().url('Scope must be a valid URL'))
    .min(1, 'At least one scope is required')
});

// Server Configuration Schema
const ServerConfigSchema = z.object({
  port: z.number()
    .int('Server port must be an integer')
    .min(1, 'Server port must be greater than 0')
    .max(65535, 'Server port must be less than 65536'),
  host: z.string()
    .min(1, 'Server host is required')
    .refine(
      val => val === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || /^[a-zA-Z0-9.-]+$/.test(val),
      'Host must be localhost, valid IP address, or valid hostname'
    )
});

// Auth Configuration Schema
const AuthConfigSchema = z.object({
  port: z.number()
    .int('Auth port must be an integer')
    .min(1, 'Auth port must be greater than 0')
    .max(65535, 'Auth port must be less than 65536'),
  host: z.string()
    .min(1, 'Auth host is required')
    .refine(
      val => val === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || /^[a-zA-Z0-9.-]+$/.test(val),
      'Auth host must be localhost, valid IP address, or valid hostname'
    ),
  useManualAuth: z.boolean()
});

// Security Configuration Schema
const SecurityConfigSchema = z.object({
  enableDetailedErrors: z.boolean(),
  sanitizeLogs: z.boolean(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug'], {
    errorMap: () => ({ message: 'Log level must be one of: error, warn, info, debug' })
  }),
  redactSensitiveData: z.boolean()
});

// Complete Configuration Schema
export const ConfigSchema = z.object({
  google: GoogleConfigSchema,
  server: ServerConfigSchema,
  auth: AuthConfigSchema,
  security: SecurityConfigSchema
});

// Environment Variables Schema for validation before config creation
export const EnvironmentSchema = z.object({
  // Required environment variables
  GOOGLE_CLIENT_ID: z.string()
    .min(1, 'GOOGLE_CLIENT_ID environment variable is required'),
  GOOGLE_CLIENT_SECRET: z.string()
    .min(1, 'GOOGLE_CLIENT_SECRET environment variable is required'),
  
  // Optional environment variables with defaults
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  PORT: z.string().regex(/^\d+$/, 'PORT must be a valid number').optional(),
  HOST: z.string().optional(),
  AUTH_PORT: z.string().regex(/^\d+$/, 'AUTH_PORT must be a valid number').optional(),
  AUTH_HOST: z.string().optional(),
  USE_MANUAL_AUTH: z.enum(['true', 'false']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  SANITIZE_LOGS: z.enum(['true', 'false']).optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  REDACT_SENSITIVE_DATA: z.enum(['true', 'false']).optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional()
});

// Type exports for TypeScript
export type Config = z.infer<typeof ConfigSchema>;
export type GoogleConfig = z.infer<typeof GoogleConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Validation error formatter
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }

  /**
   * Get formatted error messages
   */
  getFormattedErrors(): string[] {
    return this.errors.issues.map(issue => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
  }

  /**
   * Get user-friendly error summary
   */
  getSummary(): string {
    const errorCount = this.errors.issues.length;
    const errors = this.getFormattedErrors();
    
    return `Configuration validation failed with ${errorCount} error${errorCount > 1 ? 's' : ''}:\n` +
           errors.map(err => `  - ${err}`).join('\n');
  }
}

/**
 * Validate environment variables before config creation
 */
export function validateEnvironment(env: Record<string, string | undefined>): Environment {
  try {
    return EnvironmentSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError('Environment validation failed', error);
    }
    throw error;
  }
}

/**
 * Validate complete configuration object
 */
export function validateConfig(config: unknown): Config {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError('Configuration validation failed', error);
    }
    throw error;
  }
}

/**
 * Safe configuration parser with detailed error reporting
 */
export function parseConfigSafely(config: unknown): { success: true; data: Config } | { success: false; error: ConfigValidationError } {
  try {
    const validatedConfig = validateConfig(config);
    return { success: true, data: validatedConfig };
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return { success: false, error };
    }
    // Wrap unexpected errors
    return { 
      success: false, 
      error: new ConfigValidationError(
        'Unexpected validation error', 
        new z.ZodError([{
          code: 'custom',
          message: error instanceof Error ? error.message : 'Unknown error',
          path: []
        }])
      )
    };
  }
}