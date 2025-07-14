import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import {
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { readResourceRequestSchema } from './schemas';
import toolsManager from './tools';
import { version } from '../../package.json';
import { MessageProcessor } from './message-processor';
import { ResourceProvider } from './resource-provider';
import { PromptProvider } from './prompt-provider';
import { ToolSchemaRegistry } from './tool-schema-registry';
import calendarApi from '../calendar/calendar-api';
import { tokenManager } from '../auth/token-manager';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private stdioTransport: StdioServerTransport;
  private isRunning = false;
  private messageProcessor: MessageProcessor;
  private resourceProvider: ResourceProvider;
  private promptProvider: PromptProvider;
  private toolSchemaRegistry: ToolSchemaRegistry;

  constructor() {
    // MCP server configuration
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: version,
    });

    // Stdio transport configuration
    this.stdioTransport = new StdioServerTransport();

    // Initialize provider instances
    this.messageProcessor = new MessageProcessor(this.stdioTransport);
    this.resourceProvider = new ResourceProvider();
    this.promptProvider = new PromptProvider();
    this.toolSchemaRegistry = new ToolSchemaRegistry();

    // Original message processing will be overridden by MessageProcessor
    this.stdioTransport.onmessage = async (_message: JSONRPCMessage): Promise<void> => {};

    // Set up message processing using MessageProcessor
    this.messageProcessor.setupMessageProcessing();

    // Register tools (execute first to set the tools property)
    this.registerTools();

    // Implement resources and prompts list functionality (execute after tool registration)
    this.implementResourcesAndPrompts();
    
    // Setup cleanup handlers for graceful shutdown
    this.setupCleanupHandlers();
  }


  // Implement resources and prompts methods
  private implementResourcesAndPrompts() {
    // Register capabilities (including tools)
    this.server.server.registerCapabilities({
      resources: {},
      prompts: {},
      tools: toolsManager.tools // Explicitly include tools
    });

    // Implement resources/list method using ResourceProvider
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('Handling resources/list request');
      return this.resourceProvider.getResourceList();
    });

    // Implement prompts/list method using PromptProvider
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.debug('Handling prompts/list request');
      return this.promptProvider.getPromptList();
    });

    // Implement resources/read method using ResourceProvider
    this.server.server.setRequestHandler(readResourceRequestSchema, async (params) => {
      logger.debug(`Handling resources/read request with URI: ${params.params.uri}`);
      
      try {
        return await this.resourceProvider.readResource(params.params.uri);
      } catch (error) {
        logger.error(`Error handling resources/read request: ${error}`);
        throw error;
      }
    });

    // Implement tools/list method using ToolSchemaRegistry
    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Handling tools/list request');
      return this.toolSchemaRegistry.getToolSchemas();
    });
  }

  private registerTools() {
    // Register tools using ToolsManager
    toolsManager.registerTools(this.server);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      logger.debug('Initializing server...');

      // Connect server to STDIO transport
      await this.server.connect(this.stdioTransport);
      logger.debug('STDIO transport connected');

      // Setup error handling for STDIO transport
      this.stdioTransport.onerror = (error: Error): void => {
        logger.error(`STDIO transport error: ${error}`, { context: 'stdio-transport' });
      };

      this.stdioTransport.onclose = (): void => {
        logger.debug('STDIO transport closed');
        this.isRunning = false;
        this.cleanup(); // Clean up resources when transport closes
      };

      logger.debug(`Server started and connected successfully with STDIO transport`);
      this.isRunning = true;
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      throw error;
    }
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  private cleanup(): void {
    try {
      // Clean up message processor
      if ('destroy' in this.messageProcessor && typeof (this.messageProcessor as any).destroy === 'function') {
        (this.messageProcessor as any).destroy();
      }
      
      // Clean up calendar API client cache
      if ('destroy' in calendarApi && typeof (calendarApi as any).destroy === 'function') {
        (calendarApi as any).destroy();
      }
      
      // Stop token manager cleanup timer
      tokenManager.stopCleanupTimer();
      
      logger.debug('Resources cleaned up successfully');
    } catch (error) {
      logger.error(`Error during cleanup: ${error}`);
    }
  }

  /**
   * Setup process cleanup handlers
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      logger.debug('Process cleanup initiated');
      this.cleanup();
    };

    // Handle various termination signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error}`);
      cleanup();
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`);
      cleanup();
      process.exit(1);
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Clean up resources before stopping
      this.cleanup();
      
      // Close STDIO transport via server
      await this.server.close();
      logger.debug('STDIO transport stopped');

      this.isRunning = false;
      logger.debug('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
