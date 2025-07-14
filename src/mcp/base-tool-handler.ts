import { z } from 'zod';
import logger, { LoggerMeta } from '../utils/logger';
import oauthAuth from '../auth/oauth-auth';
import { mcpErrorHandler, McpToolResponse } from '../utils/error-handler';
import responseBuilder from '../utils/response-builder';

/**
 * MCP tool execution context
 */
export interface ToolExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  requiresAuth: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for MCP tools
 * Provides common processing (authentication check, validation, error handling)
 */
export abstract class BaseToolHandler {
  protected readonly toolName: string;
  protected readonly requiresAuth: boolean;

  constructor(toolName: string, requiresAuth: boolean = true) {
    this.toolName = toolName;
    this.requiresAuth = requiresAuth;
  }

  /**
   * Define the Zod schema for the tool (implemented by subclasses)
   */
  abstract getSchema(): z.ZodRawShape;

  /**
   * Execute the actual tool logic (implemented by subclasses)
   */
  abstract execute(validatedArgs: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;

  /**
   * Check authentication status
   */
  private checkAuthentication(): { isAuthenticated: boolean; errorResponse?: McpToolResponse } {
    if (!this.requiresAuth) {
      return { isAuthenticated: true };
    }

    if (!oauthAuth.isAuthenticated()) {
      return {
        isAuthenticated: false,
        errorResponse: mcpErrorHandler.createAuthError(),
      };
    }

    return { isAuthenticated: true };
  }

  /**
   * Preprocess arguments to handle empty strings and ensure MCP compatibility
   */
  private preprocessArgs(args: Record<string, unknown>): Record<string, unknown> {
    // Debug log the original args
    logger.debug(`[${this.toolName}] Raw args received:`, args);
    
    const cleaned: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(args)) {
      // Skip empty, null, or undefined values entirely
      // This allows Zod optional() defaults to be applied correctly
      if (value === '' || value === null || value === undefined) {
        logger.debug(`[${this.toolName}] Skipping empty value for key: ${key}`);
        continue;
      }
      
      // Skip strings that are only whitespace
      if (typeof value === 'string' && value.trim() === '') {
        logger.debug(`[${this.toolName}] Skipping whitespace-only value for key: ${key}`);
        continue;
      }
      
      // Special handling for maxResults - convert string to number
      if (key === 'maxResults' && typeof value === 'string') {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue > 0) {
          cleaned[key] = numValue;
        } else {
          logger.debug(`[${this.toolName}] Skipping invalid maxResults: ${value}`);
          // Skip invalid numbers to use default
        }
      } else {
        cleaned[key] = value;
      }
    }
    
    logger.debug(`[${this.toolName}] Cleaned args:`, cleaned);
    return cleaned;
  }

  /**
   * Validate input arguments
   */
  private validateInput(args: Record<string, unknown>): {
    isValid: boolean;
    validatedArgs?: Record<string, unknown>;
    errorResponse?: McpToolResponse;
  } {
    try {
      // Preprocess arguments to handle empty strings
      const processedArgs = this.preprocessArgs(args);
      
      const schema = z.object(this.getSchema());
      const validatedArgs = schema.parse(processedArgs);
      return { isValid: true, validatedArgs };
    } catch (error) {
      logger.error(`Validation error in ${this.toolName}:`, { error } as LoggerMeta);

      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        return {
          isValid: false,
          errorResponse: mcpErrorHandler.createValidationError(errorMessages),
        };
      }

      return {
        isValid: false,
        errorResponse: mcpErrorHandler.handleError(error, { toolName: this.toolName }),
      };
    }
  }

  /**
   * Main execution method (Template Method Pattern)
   */
  public async handle(args: Record<string, unknown>, extra?: unknown): Promise<McpToolResponse> {
    const startTime = Date.now();

    logger.debug(`[MCP] Starting execution of tool: ${this.toolName}`);

    try {
      // 1. Authentication check
      const authCheck = this.checkAuthentication();
      if (!authCheck.isAuthenticated) {
        logger.warn(`[${this.toolName}] Authentication failed`);
        return authCheck.errorResponse!;
      }

      // 2. Input validation
      const validation = this.validateInput(args);
      if (!validation.isValid) {
        logger.warn(`[${this.toolName}] Validation failed`);
        return validation.errorResponse!;
      }

      // 3. Create execution context
      const context: ToolExecutionContext = {
        toolName: this.toolName,
        args: validation.validatedArgs || {},
        requiresAuth: this.requiresAuth,
        metadata: { startTime, extra },
      };

      // 4. Execute the actual processing
      const result = await this.execute(validation.validatedArgs || {}, context);

      // 5. Generate success response
      const response = this.createSuccessResponse(result, context);

      const executionTime = Date.now() - startTime;
      logger.debug(`[MCP] Tool ${this.toolName} completed in ${executionTime}ms`);

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`[MCP] Error in tool ${this.toolName} (${executionTime}ms):`, { error } as LoggerMeta);

      return mcpErrorHandler.handleError(error, {
        toolName: this.toolName,
        args: args as LoggerMeta,
        executionTime,
      });
    }
  }

  /**
   * Generate success response (can be overridden by subclasses)
   */
  protected createSuccessResponse(result: unknown, _context: ToolExecutionContext): McpToolResponse {
    return responseBuilder.success(result);
  }

  /**
   * Get tool name
   */
  public getName(): string {
    return this.toolName;
  }

  /**
   * Check if authentication is required
   */
  public isAuthRequired(): boolean {
    return this.requiresAuth;
  }

  /**
   * Output debug information
   */
  protected logDebug(message: string, data?: LoggerMeta): void {
    logger.debug(`[${this.toolName}] ${message}`, data);
  }

  /**
   * Output error information
   */
  protected logError(message: string, error?: LoggerMeta): void {
    logger.error(`[${this.toolName}] ${message}`, error);
  }

  /**
   * Output information log
   */
  protected logInfo(message: string, data?: LoggerMeta): void {
    logger.info(`[${this.toolName}] ${message}`, data);
  }
}

/**
 * Base class for tools that don't require authentication
 */
export abstract class BaseNoAuthToolHandler extends BaseToolHandler {
  constructor(toolName: string) {
    super(toolName, false);
  }
}

/**
 * Base class for calendar operation tools
 */
export abstract class BaseCalendarToolHandler extends BaseToolHandler {
  constructor(toolName: string) {
    super(toolName, true);
  }

  /**
   * Get default calendar ID
   */
  protected getCalendarId(args: { calendarId?: string }): string {
    return args.calendarId || 'primary';
  }
}