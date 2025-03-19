import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';
import * as net from 'net';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private isRunning = false;
  private socketServer: net.Server | null = null;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({
      name: 'google-calendar-mcp',
      version: '0.1.4',
    });

    // Stdioトランスポートの設定
    this.transport = new StdioServerTransport();

    // ツールの登録
    this.registerTools();
  }

  private registerTools() {
    for (const tool of tools) {
      // ツールを登録
      this.server.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler: async (params) => {
          try {
            logger.info(`Executing tool ${tool.name} with params: ${JSON.stringify(params)}`);
            const result = await tool.handler(params);
            return result;
          } catch (error) {
            logger.error(`Error executing tool ${tool.name}: ${error}`);
            throw error;
          }
        }
      });
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      logger.info('Starting server...');
      
      // サーバーとトランスポートの接続
      await this.server.connect(this.transport);
      
      // TCPリスナーを設定（Claude Desktopとの接続用）
      this.socketServer = net.createServer((socket) => {
        logger.info(`Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
        
        socket.on('error', (err) => {
          logger.error(`Socket error: ${err}`);
        });
      });
      
      // TCPサーバーを指定ポートでリッスン
      this.socketServer.listen(config.server.port, config.server.host, () => {
        logger.info(`TCP Server listening on ${config.server.host}:${config.server.port}`);
      });
      
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
      if (this.socketServer) {
        this.socketServer.close();
      }
      
      // サーバーの切断
      this.server.disconnect();
      this.isRunning = false;
      logger.info('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
