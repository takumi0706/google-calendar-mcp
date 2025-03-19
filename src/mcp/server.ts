import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SocketServerTransport } from '@modelcontextprotocol/sdk/server/socket.js';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';

class GoogleCalendarMcpServer {
  private server: Server;
  private transport: SocketServerTransport;
  private isRunning = false;

  constructor() {
    // MCPサーバーの設定
    this.server = new Server(
      {
        name: 'google-calendar-mcp',
        version: '0.1.3',
      },
      {
        capabilities: {
          tools: {
            // ツール機能を有効化
          },
        },
      }
    );

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
      this.server.setToolHandler(tool.name, async (params: any) => {
        try {
          logger.info(`Executing tool ${tool.name} with params: ${JSON.stringify(params)}`);
          const result = await tool.handler(params);
          return result;
        } catch (error) {
          logger.error(`Error executing tool ${tool.name}: ${error}`);
          throw error;
        }
      });
    }

    // ツールのスキーマを登録
    this.server.registerTools(tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })));
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // サーバーとトランスポートの接続
      logger.info('Starting server...');
      
      await this.server.listen(this.transport);
      
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
      await this.server.close();
      this.isRunning = false;
      logger.info('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
