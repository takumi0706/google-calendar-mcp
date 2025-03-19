import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SocketServerTransport } from '@modelcontextprotocol/sdk/server/socket.js';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: SocketServerTransport;
  private isRunning = false;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({
      name: 'google-calendar-mcp',
      version: '0.1.3',
    });

    // ソケットトランスポートの設定
    this.transport = new SocketServerTransport({
      port: config.server.port,
      host: config.server.host,
    });

    // ツールの登録
    this.registerTools();
  }

  private registerTools() {
    for (const tool of tools) {
      this.server.addTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (params) => {
          try {
            logger.info(`Executing tool ${tool.name} with params: ${JSON.stringify(params)}`);
            const result = await tool.handler(params);
            return result;
          } catch (error) {
            logger.error(`Error executing tool ${tool.name}: ${error}`);
            throw error;
          }
        },
      });
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // サーバーとトランスポートの接続
      await this.server.connect(this.transport);
      
      logger.info('Initializing server...');
      
      // サーバーの初期化
      await this.server.initialize();
      
      logger.info(`Server started and connected successfully`);
      this.isRunning = true;
      
      logger.info(`Google Calendar MCP Server is running on ${config.server.host}:${config.server.port}`);
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.server.disconnect();
      this.isRunning = false;
      logger.info('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
