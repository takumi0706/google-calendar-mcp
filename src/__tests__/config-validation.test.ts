import { 
  validateEnvironment, 
  validateConfig, 
  ConfigValidationError,
  parseConfigSafely,
  EnvironmentSchema,
  ConfigSchema
} from '../config/config-schema';

describe('Configuration Validation', () => {
  describe('Environment Validation', () => {
    it('should validate valid environment variables', () => {
      const validEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        NODE_ENV: 'test' as const
      };

      expect(() => validateEnvironment(validEnv)).not.toThrow();
      const result = validateEnvironment(validEnv);
      expect(result.GOOGLE_CLIENT_ID).toBe('test-client-id');
      expect(result.GOOGLE_CLIENT_SECRET).toBe('test-client-secret');
    });

    it('should reject missing required environment variables', () => {
      const invalidEnv = {
        GOOGLE_CLIENT_SECRET: 'test-client-secret'
        // Missing GOOGLE_CLIENT_ID
      };

      expect(() => validateEnvironment(invalidEnv)).toThrow(ConfigValidationError);
    });

    it('should validate optional environment variables with defaults', () => {
      const envWithOptionals = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        PORT: '8080',
        LOG_LEVEL: 'debug' as const
      };

      const result = validateEnvironment(envWithOptionals);
      expect(result.PORT).toBe('8080');
      expect(result.LOG_LEVEL).toBe('debug');
    });

    it('should reject invalid port numbers', () => {
      const invalidEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        PORT: 'not-a-number'
      };

      expect(() => validateEnvironment(invalidEnv)).toThrow(ConfigValidationError);
    });

    it('should reject invalid log levels', () => {
      const invalidEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        LOG_LEVEL: 'invalid-level'
      };

      expect(() => validateEnvironment(invalidEnv)).toThrow(ConfigValidationError);
    });
  });

  describe('Configuration Validation', () => {
    const validConfig = {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:4153/oauth2callback',
        scopes: ['https://www.googleapis.com/auth/calendar.events']
      },
      server: {
        port: 3000,
        host: 'localhost'
      },
      auth: {
        port: 4153,
        host: 'localhost',
        useManualAuth: false
      },
      security: {
        enableDetailedErrors: true,
        sanitizeLogs: true,
        logLevel: 'debug' as const,
        redactSensitiveData: true
      }
    };

    it('should validate complete valid configuration', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
      const result = validateConfig(validConfig);
      expect(result.google.clientId).toBe('test-client-id');
      expect(result.server.port).toBe(3000);
    });

    it('should reject dummy client ID in production context', () => {
      const configWithDummy = {
        ...validConfig,
        google: {
          ...validConfig.google,
          clientId: 'dummy-client-id'
        }
      };

      expect(() => validateConfig(configWithDummy)).toThrow(ConfigValidationError);
    });

    it('should reject invalid redirect URI', () => {
      const configWithInvalidUri = {
        ...validConfig,
        google: {
          ...validConfig.google,
          redirectUri: 'not-a-valid-url'
        }
      };

      expect(() => validateConfig(configWithInvalidUri)).toThrow(ConfigValidationError);
    });

    it('should reject invalid port numbers', () => {
      const configWithInvalidPort = {
        ...validConfig,
        server: {
          ...validConfig.server,
          port: 70000 // Too high
        }
      };

      expect(() => validateConfig(configWithInvalidPort)).toThrow(ConfigValidationError);
    });

    it('should reject redirect URI without oauth2callback', () => {
      const configWithoutCallback = {
        ...validConfig,
        google: {
          ...validConfig.google,
          redirectUri: 'http://localhost:4153/wrong-endpoint'
        }
      };

      expect(() => validateConfig(configWithoutCallback)).toThrow(ConfigValidationError);
    });

    it('should require at least one scope', () => {
      const configWithoutScopes = {
        ...validConfig,
        google: {
          ...validConfig.google,
          scopes: []
        }
      };

      expect(() => validateConfig(configWithoutScopes)).toThrow(ConfigValidationError);
    });
  });

  describe('Safe Configuration Parsing', () => {
    const validConfig = {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:4153/oauth2callback',
        scopes: ['https://www.googleapis.com/auth/calendar.events']
      },
      server: {
        port: 3000,
        host: 'localhost'
      },
      auth: {
        port: 4153,
        host: 'localhost',
        useManualAuth: false
      },
      security: {
        enableDetailedErrors: true,
        sanitizeLogs: true,
        logLevel: 'debug' as const,
        redactSensitiveData: true
      }
    };

    it('should return success for valid configuration', () => {
      const result = parseConfigSafely(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.google.clientId).toBe('test-client-id');
      }
    });

    it('should return error for invalid configuration', () => {
      const invalidConfig = {
        ...validConfig,
        server: {
          ...validConfig.server,
          port: 'invalid-port'
        }
      };

      const result = parseConfigSafely(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
        expect(result.error.getFormattedErrors().length).toBeGreaterThan(0);
      }
    });
  });

  describe('ConfigValidationError', () => {
    it('should format errors correctly', () => {
      const invalidConfig = {
        google: {
          clientId: '', // Invalid: empty string
          scopes: [] // Invalid: empty array
        }
      };

      try {
        validateConfig(invalidConfig);
        fail('Should have thrown ConfigValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        if (error instanceof ConfigValidationError) {
          const formattedErrors = error.getFormattedErrors();
          expect(formattedErrors.length).toBeGreaterThan(0);
          expect(error.getSummary()).toContain('Configuration validation failed');
        }
      }
    });
  });

  describe('Schema Types', () => {
    it('should provide correct TypeScript types', () => {
      // This test ensures that our schema types work correctly at compile time
      const validEnvResult = EnvironmentSchema.safeParse({
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'test'
      });

      expect(validEnvResult.success).toBe(true);
      if (validEnvResult.success) {
        // TypeScript should infer these types correctly
        const clientId: string = validEnvResult.data.GOOGLE_CLIENT_ID;
        const clientSecret: string = validEnvResult.data.GOOGLE_CLIENT_SECRET;
        expect(clientId).toBe('test');
        expect(clientSecret).toBe('test');
      }

      const validConfigResult = ConfigSchema.safeParse({
        google: {
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:4153/oauth2callback',
          scopes: ['https://www.googleapis.com/auth/calendar.events']
        },
        server: { port: 3000, host: 'localhost' },
        auth: { port: 4153, host: 'localhost', useManualAuth: false },
        security: {
          enableDetailedErrors: true,
          sanitizeLogs: true,
          logLevel: 'debug',
          redactSensitiveData: true
        }
      });

      expect(validConfigResult.success).toBe(true);
    });
  });
});