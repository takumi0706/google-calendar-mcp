import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

  /**
   * Property that holds registered tool schemas for compatibility
   */
  public tools: Record<string, any> = {};

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
      this.tools[handler.getName()] = handler.getSchema();
      logger.debug(`Registered tool handler: ${handler.getName()}`);
    });
  }

  /**
   * Register tools with the MCP server
   * @param server MCP server instance
   */
  public registerTools(server: McpServer): void {
    logger.debug('Registering calendar tools with MCP server using BaseToolHandler architecture');

    // Register each tool handler with the MCP server
    this.toolHandlers.forEach((handler, toolName) => {
      server.tool(
        toolName,
        handler.getSchema(),
        async (args: any, extra: any) => {
          return await handler.handle(args, extra);
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
