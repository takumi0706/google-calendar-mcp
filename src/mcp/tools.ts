import { McpServer } from '@modelcontextprotocol/server';
import logger from '../utils/logger';
import {
  GetEventsHandler,
  CreateEventHandler,
  UpdateEventHandler,
  DeleteEventHandler,
  AuthenticateHandler,
  BaseToolHandler
} from './tools/index';

/**
 * Tools Manager Class
 * Provides functionality to register tools with the MCP server using BaseToolHandler architecture
 */
export class ToolsManager {
  /**
   * Property that holds registered tool handlers
   */
  private toolHandlers: Map<string, BaseToolHandler> = new Map();

  constructor() {
    this.initializeToolHandlers();
  }

  /**
   * Initialize all tool handlers
   */
  private initializeToolHandlers(): void {
    // Create handler instances
    const handlers = [
      new GetEventsHandler(),
      new CreateEventHandler(),
      new UpdateEventHandler(),
      new DeleteEventHandler(),
      new AuthenticateHandler()
    ];

    // Register each handler
    handlers.forEach(handler => {
      this.toolHandlers.set(handler.getName(), handler);
      logger.debug(`Registered tool handler: ${handler.getName()}`);
    });
  }

  /**
   * Register tools with the MCP server
   * @param server MCP server instance
   */
  public registerTools(server: McpServer): void {
    logger.debug('Registering calendar tools with MCP server using BaseToolHandler architecture');

    // Register each tool handler with the MCP server.
    // inputSchema には完全な ZodObject を渡す。SDK がここから JSON Schema を
    // 導出するため、広告されるスキーマと検証に使うスキーマが常に一致する。
    this.toolHandlers.forEach((handler, toolName) => {
      server.registerTool(
        toolName,
        {
          description: handler.getDescription(),
          inputSchema: handler.getSchema(),
        },
        async (args, extra) => {
          logger.debug(`[MCP] Tool "${toolName}" called`);
          try {
            return await handler.handle(args, extra);
          } catch (error) {
            logger.error(
              `[MCP] Tool "${toolName}" error:`,
              { error: error instanceof Error ? error : String(error) }
            );
            throw error;
          }
        }
      );

      logger.debug(`Registered MCP tool: ${toolName}`);
    });

    logger.info(`Successfully registered ${this.toolHandlers.size} calendar tools with MCP server`);
  }

  /**
   * Get a specific tool handler
   */
  public getToolHandler(toolName: string): BaseToolHandler | undefined {
    return this.toolHandlers.get(toolName);
  }

  /**
   * Get all registered tool names
   */
  public getToolNames(): string[] {
    return Array.from(this.toolHandlers.keys());
  }

  /**
   * Get tool handler statistics
   */
  public getStatistics(): { totalTools: number; authRequiredTools: number; noAuthTools: number } {
    const authRequired = Array.from(this.toolHandlers.values())
      .filter(handler => handler.isAuthRequired()).length;
    
    return {
      totalTools: this.toolHandlers.size,
      authRequiredTools: authRequired,
      noAuthTools: this.toolHandlers.size - authRequired
    };
  }
}

// Export singleton instance
export default new ToolsManager();
