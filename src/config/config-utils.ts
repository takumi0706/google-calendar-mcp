import { validatedConfigManager, type Config } from './validated-config';
import logger from '../utils/logger';

/**
 * Configuration utilities for runtime config management and validation
 */

/**
 * Health check for configuration
 */
export interface ConfigHealthCheck {
  isValid: boolean;
  environment: 'development' | 'production' | 'test';
  missingRequired: string[];
  warnings: string[];
  errors: string[];
  lastChecked: Date;
}

/**
 * Configuration monitoring service
 */
export class ConfigMonitor {
  private lastHealthCheck: ConfigHealthCheck | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Perform comprehensive configuration health check
   */
  public performHealthCheck(): ConfigHealthCheck {
    const now = new Date();
    const environment = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
    
    const healthCheck: ConfigHealthCheck = {
      isValid: true,
      environment,
      missingRequired: [],
      warnings: [],
      errors: [],
      lastChecked: now
    };

    try {
      // Check if configuration is properly initialized
      if (!validatedConfigManager.isInitialized()) {
        healthCheck.errors.push('Configuration not initialized');
        healthCheck.isValid = false;
        return healthCheck;
      }

      // Get validation status
      const validationStatus = validatedConfigManager.getValidationStatus();
      if (!validationStatus.isValid) {
        healthCheck.isValid = false;
        healthCheck.errors.push(...(validationStatus.errors || []));
      }

      // Check for development warnings in production
      if (environment === 'production') {
        const config = validatedConfigManager.getConfig();
        
        // Check for dummy values in production
        if (config.google.clientId === 'dummy-client-id') {
          healthCheck.errors.push('Google Client ID is using dummy value in production');
          healthCheck.isValid = false;
        }
        
        if (config.google.clientSecret === 'dummy-client-secret') {
          healthCheck.errors.push('Google Client Secret is using dummy value in production');
          healthCheck.isValid = false;
        }

        // Check security settings
        if (config.security.enableDetailedErrors) {
          healthCheck.warnings.push('Detailed error messages are enabled in production');
        }

        if (!config.security.sanitizeLogs) {
          healthCheck.warnings.push('Log sanitization is disabled in production');
        }

        if (config.security.logLevel === 'debug') {
          healthCheck.warnings.push('Debug logging is enabled in production');
        }
      }

      // Check environment variables
      this.checkRequiredEnvironmentVariables(healthCheck);
      
      // Check network configuration
      this.checkNetworkConfiguration(healthCheck);

    } catch (error) {
      healthCheck.isValid = false;
      healthCheck.errors.push(
        error instanceof Error ? error.message : 'Unknown configuration error'
      );
    }

    this.lastHealthCheck = healthCheck;
    return healthCheck;
  }

  /**
   * Check required environment variables
   */
  private checkRequiredEnvironmentVariables(healthCheck: ConfigHealthCheck): void {
    const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        healthCheck.missingRequired.push(varName);
        healthCheck.isValid = false;
      }
    }
  }

  /**
   * Check network configuration
   */
  private checkNetworkConfiguration(healthCheck: ConfigHealthCheck): void {
    try {
      const config = validatedConfigManager.getConfig();
      
      // Check for port conflicts
      if (config.server.port === config.auth.port) {
        healthCheck.warnings.push(
          `Server and auth ports are the same (${config.server.port}). This may cause conflicts.`
        );
      }

      // Check for localhost in production
      if (healthCheck.environment === 'production') {
        if (config.server.host === 'localhost') {
          healthCheck.warnings.push('Server host is set to localhost in production');
        }
        
        if (config.auth.host === 'localhost') {
          healthCheck.warnings.push('Auth host is set to localhost in production');
        }
      }

    } catch (error) {
      healthCheck.errors.push('Failed to check network configuration');
    }
  }

  /**
   * Start periodic health checks
   */
  public startMonitoring(intervalMs: number = 300000): void { // Default 5 minutes
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      const healthCheck = this.performHealthCheck();
      
      if (!healthCheck.isValid) {
        logger.error('Configuration health check failed:', {
          errors: healthCheck.errors,
          warnings: healthCheck.warnings,
          missingRequired: healthCheck.missingRequired
        });
      } else if (healthCheck.warnings.length > 0) {
        logger.warn('Configuration health check warnings:', {
          warnings: healthCheck.warnings
        });
      } else {
        logger.debug('Configuration health check passed');
      }
    }, intervalMs);

    logger.info(`Configuration monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic health checks
   */
  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Configuration monitoring stopped');
    }
  }

  /**
   * Get last health check result
   */
  public getLastHealthCheck(): ConfigHealthCheck | null {
    return this.lastHealthCheck;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopMonitoring();
    this.lastHealthCheck = null;
  }
}

/**
 * Configuration debugging utilities
 */
export class ConfigDebugger {
  /**
   * Get sanitized configuration for debugging (sensitive data redacted)
   */
  public static getSanitizedConfig(): Record<string, unknown> {
    try {
      const config = validatedConfigManager.getConfig();
      
      return {
        google: {
          clientId: this.redactSecret(config.google.clientId),
          clientSecret: this.redactSecret(config.google.clientSecret),
          redirectUri: config.google.redirectUri,
          scopes: config.google.scopes
        },
        server: config.server,
        auth: config.auth,
        security: config.security
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to get configuration'
      };
    }
  }

  /**
   * Get configuration validation errors
   */
  public static getValidationErrors(): string[] {
    const status = validatedConfigManager.getValidationStatus();
    return status.errors || [];
  }

  /**
   * Check if running with development defaults
   */
  public static isUsingDevelopmentDefaults(): boolean {
    try {
      const config = validatedConfigManager.getConfig();
      return config.google.clientId === 'dummy-client-id' || 
             config.google.clientSecret === 'dummy-client-secret';
    } catch {
      return false;
    }
  }

  /**
   * Get environment variable summary
   */
  public static getEnvironmentSummary(): Record<string, string> {
    const envVars = [
      'NODE_ENV', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 
      'PORT', 'HOST', 'AUTH_PORT', 'AUTH_HOST', 'USE_MANUAL_AUTH',
      'LOG_LEVEL', 'SANITIZE_LOGS', 'REDACT_SENSITIVE_DATA'
    ];

    const summary: Record<string, string> = {};
    
    for (const varName of envVars) {
      const value = process.env[varName];
      if (value !== undefined) {
        // Redact sensitive values
        if (varName.includes('SECRET') || varName.includes('KEY')) {
          summary[varName] = this.redactSecret(value);
        } else {
          summary[varName] = value;
        }
      } else {
        summary[varName] = '<not set>';
      }
    }

    return summary;
  }

  /**
   * Redact sensitive strings for logging
   */
  private static redactSecret(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }
}

/**
 * Create and export singleton monitor instance
 */
export const configMonitor = new ConfigMonitor();

/**
 * Initialize configuration monitoring (call this during app startup)
 */
export function initializeConfigMonitoring(): ConfigHealthCheck {
  const healthCheck = configMonitor.performHealthCheck();
  
  // Log initial health check
  if (!healthCheck.isValid) {
    logger.error('Initial configuration validation failed:', {
      errors: healthCheck.errors,
      warnings: healthCheck.warnings,
      missingRequired: healthCheck.missingRequired
    });
  } else {
    logger.info('Configuration validation successful', {
      environment: healthCheck.environment,
      warnings: healthCheck.warnings.length > 0 ? healthCheck.warnings : undefined
    });
  }

  // Start monitoring in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    configMonitor.startMonitoring();
  }

  return healthCheck;
}

/**
 * Get current configuration safely
 */
export function getCurrentConfig(): Config | null {
  try {
    return validatedConfigManager.getConfig();
  } catch {
    return null;
  }
}

/**
 * Check if configuration is ready
 */
export function isConfigurationReady(): boolean {
  return validatedConfigManager.isInitialized() && 
         validatedConfigManager.getValidationStatus().isValid;
}