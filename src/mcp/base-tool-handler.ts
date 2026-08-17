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
 * ツール引数の正規化
 *
 * MCP クライアントは「値なし」を空文字や null で送ってくることがある。
 * それらを検証前に取り除くことで、Zod 側の .default() / .optional() が
 * 期待どおりに効くようにする。スキーマ自身に空文字を吸収する union を
 * 持たせる方法もあるが、z.undefined() は JSON Schema で表現できず
 * tools/list が失敗するため、正規化はここに集約している。
 */
export function normalizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined) {
      continue;
    }

    // 空文字・空白のみの文字列は「未指定」として扱う
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }

    // maxResults は数値だが、文字列で送ってくるクライアントがある
    if (key === 'maxResults' && typeof value === 'string') {
      const numValue = Number.parseInt(value, 10);
      if (Number.isFinite(numValue) && numValue > 0) {
        cleaned[key] = numValue;
      }
      // 解釈できない値は落として既定値に委ねる
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

/**
 * Abstract base class for MCP tools
 * Provides common processing (authentication check, validation, error handling)
 */
export abstract class BaseToolHandler<
  TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TResult = unknown
> {
  protected readonly toolName: string;
  protected readonly requiresAuth: boolean;

  constructor(toolName: string, requiresAuth: boolean = true) {
    this.toolName = toolName;
    this.requiresAuth = requiresAuth;
  }

  /**
   * Define the Zod schema for the tool (implemented by subclasses)
   *
   * 完全な ZodObject を返す。MCP SDK v2 の registerTool は Standard Schema を
   * 受け取り、そこから JSON Schema を導出する。以前は ZodRawShape を返して
   * 別途 JSON Schema を手書きしていたため、広告するスキーマと検証に使う
   * スキーマが食い違い、ネストした z.object の properties が失われていた。
   */
  abstract getSchema(): TSchema;

  /**
   * Human-readable description surfaced to MCP clients (implemented by subclasses)
   */
  abstract getDescription(): string;

  /**
   * Execute the actual tool logic (implemented by subclasses)
   *
   * 引数は getSchema() で検証済みの値。各ハンドラで再度 parse する必要はない。
   */
  abstract execute(validatedArgs: z.infer<TSchema>, context: ToolExecutionContext): Promise<TResult>;

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
   * Validate input arguments
   */
  private validateInput(args: Record<string, unknown>): {
    isValid: boolean;
    validatedArgs?: z.infer<TSchema>;
    errorResponse?: McpToolResponse;
  } {
    try {
      logger.debug(`[${this.toolName}] Raw args received:`, args);

      const processedArgs = normalizeToolArgs(args);
      logger.debug(`[${this.toolName}] Normalized args:`, processedArgs);

      const validatedArgs = this.getSchema().parse(processedArgs);
      return { isValid: true, validatedArgs };
    } catch (error) {
      logger.error(`Validation error in ${this.toolName}:`, { error });

      if (error instanceof z.ZodError) {
        // zod 4 で ZodError.errors は .issues に改名された
        const errorMessages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
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
        return authCheck.errorResponse ?? mcpErrorHandler.createAuthError();
      }

      // 2. Input validation
      const validation = this.validateInput(args);
      if (!validation.isValid || validation.validatedArgs === undefined) {
        logger.warn(`[${this.toolName}] Validation failed`);
        return validation.errorResponse ?? mcpErrorHandler.createValidationError('Invalid arguments');
      }

      const validatedArgs = validation.validatedArgs;

      // 3. Create execution context
      const context: ToolExecutionContext = {
        toolName: this.toolName,
        args: validatedArgs,
        requiresAuth: this.requiresAuth,
        metadata: { startTime, extra },
      };

      // 4. Execute the actual processing
      const result = await this.execute(validatedArgs, context);

      // 5. Generate success response
      const response = this.createSuccessResponse(result, context);

      const executionTime = Date.now() - startTime;
      logger.debug(`[MCP] Tool ${this.toolName} completed in ${executionTime}ms`);

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`[MCP] Error in tool ${this.toolName} (${executionTime}ms):`, { error });

      return mcpErrorHandler.handleError(error, {
        toolName: this.toolName,
        args,
        executionTime,
      });
    }
  }

  /**
   * Generate success response (can be overridden by subclasses)
   */
  protected createSuccessResponse(result: TResult, _context: ToolExecutionContext): McpToolResponse {
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
export abstract class BaseNoAuthToolHandler<
  TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TResult = unknown
> extends BaseToolHandler<TSchema, TResult> {
  constructor(toolName: string) {
    super(toolName, false);
  }
}

/**
 * Base class for calendar operation tools
 */
export abstract class BaseCalendarToolHandler<
  TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TResult = unknown
> extends BaseToolHandler<TSchema, TResult> {
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