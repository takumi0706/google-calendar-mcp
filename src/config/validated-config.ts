import { config } from 'dotenv';
import logger from '../utils/logger';
import {
  validateEnvironment,
  validateConfig,
  ConfigValidationError,
  type Config,
  type Environment
} from './config-schema';

// Load .env file first
config();

/**
 * Validated configuration manager
 * Provides type-safe configuration with comprehensive validation
 */
class ValidatedConfigManager {
  private _config: Config | null = null;
  private _isInitialized = false;

  /**
   * Initialize and validate configuration
   */
  public initialize(): Config {
    if (this._isInitialized && this._config) {
      return this._config;
    }

    try {
      // Step 1: Validate environment variables
      const validatedEnv = this.validateEnvironmentVariables();
      
      // Step 2: Create configuration object
      const configObject = this.createConfigObject(validatedEnv);
      
      // Step 3: Validate complete configuration
      this._config = validateConfig(configObject);
      this._isInitialized = true;
      
      logger.info('Configuration validated successfully');
      return this._config;
      
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        logger.error('Configuration validation failed:');
        error.getFormattedErrors().forEach(err => logger.error(`  - ${err}`));
        
        // In production, we should fail fast
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Configuration validation failed: ${error.getSummary()}`);
        }
        
        // In development, provide helpful guidance
        logger.warn('Using fallback configuration for development. Please fix the following issues:');
        logger.warn(error.getSummary());
        
        // Return development fallback config
        return this.createDevelopmentFallbackConfig();
      }
      
      throw error;
    }
  }

  /**
   * Get current configuration (must call initialize first)
   */
  public getConfig(): Config {
    if (!this._isInitialized || !this._config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this._config;
  }

  /**
   * Validate environment variables
   */
  private validateEnvironmentVariables(): Environment {
    const env = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      AUTH_PORT: process.env.AUTH_PORT,
      AUTH_HOST: process.env.AUTH_HOST,
      USE_MANUAL_AUTH: process.env.USE_MANUAL_AUTH,
      NODE_ENV: process.env.NODE_ENV,
      SANITIZE_LOGS: process.env.SANITIZE_LOGS,
      LOG_LEVEL: process.env.LOG_LEVEL,
      REDACT_SENSITIVE_DATA: process.env.REDACT_SENSITIVE_DATA,
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY
    };

    return validateEnvironment(env);
  }

  /**
   * Create configuration object from validated environment
   */
  private createConfigObject(env: Environment): unknown {
    const SCOPES = [
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authPort = parseInt(env.AUTH_PORT || '4153', 10);
    const authHost = env.AUTH_HOST || 'localhost';

    return {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI || `http://${authHost}:${authPort}/oauth2callback`,
        scopes: SCOPES,
      },
      server: {
        port: parseInt(env.PORT || '3000', 10),
        host: env.HOST || 'localhost',
      },
      auth: {
        port: authPort,
        host: authHost,
        useManualAuth: env.USE_MANUAL_AUTH === 'true',
      },
      security: {
        enableDetailedErrors: env.NODE_ENV !== 'production',
        sanitizeLogs: env.SANITIZE_LOGS !== 'false',
        logLevel: env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'warn' : 'debug'),
        redactSensitiveData: env.REDACT_SENSITIVE_DATA !== 'false',
      },
    };
  }

  /**
   * Create development fallback configuration
   */
  private createDevelopmentFallbackConfig(): Config {
    const SCOPES = [
      'https://www.googleapis.com/auth/calendar.events',
    ];

    // Allow dummy values in test environment, require real values in production
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const clientId = process.env.GOOGLE_CLIENT_ID || (isTestEnvironment ? 'test-client-id' : undefined);
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (isTestEnvironment ? 'test-client-secret' : undefined);
    
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
    }

    return {
      google: {
        clientId,
        clientSecret,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:4153/oauth2callback`,
        scopes: SCOPES,
      },
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || 'localhost',
      },
      auth: {
        port: parseInt(process.env.AUTH_PORT || '4153', 10),
        host: process.env.AUTH_HOST || 'localhost',
        useManualAuth: process.env.USE_MANUAL_AUTH === 'true',
      },
      security: {
        enableDetailedErrors: false, // Always disabled for production safety
        sanitizeLogs: process.env.SANITIZE_LOGS !== 'false',
        logLevel: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'warn',
        redactSensitiveData: process.env.REDACT_SENSITIVE_DATA !== 'false',
      },
    };
  }

  /**
   * Check if configuration is properly initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Reset configuration (for testing)
   */
  public reset(): void {
    this._config = null;
    this._isInitialized = false;
  }

  /**
   * Get configuration validation status
   */
  public getValidationStatus(): {
    isValid: boolean;
    errors?: string[];
    } {
    try {
      if (!this._isInitialized) {
        this.initialize();
      }
      return { isValid: true };
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        return {
          isValid: false,
          errors: error.getFormattedErrors()
        };
      }
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }
}

// Create and export singleton instance
const validatedConfigManager = new ValidatedConfigManager();

// Initialize configuration on module load
const configInstance = validatedConfigManager.initialize();

// Export the validated configuration as default
export default configInstance;

// Export the manager for advanced usage
export { validatedConfigManager };

// Export types for external use
export type { Config, Environment, ConfigValidationError };