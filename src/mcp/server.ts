import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';
import * as net from 'net';
import { z } from 'zod';
import { getEventsSchema, createEventSchema, updateEventSchema, deleteEventSchema } from './schemas';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private isRunning = false;
  private socketServer: net.Server | null = null;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: '0.1.5',
    });

    // Stdioトランスポートの設定
    this.transport = new StdioServerTransport();

    // ツールの登録
    this.registerTools();
  }

  private registerTools() {
    // getEvents ツール
    this.server.tool(
      'getEvents',
      {
        calendarId: z.string().optional(),
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.number().int().positive().optional(),
        orderBy: z.enum(['startTime', 'updated']).optional(),
      },
      async (args, extra) => {
        try {
          logger.info(`Getting events with params: ${JSON.stringify(args)}`);
          // args型をgetEventsSchemaに合わせる
          const result = await getEventsSchema.parseAsync(args).then(validParams => {
            return tools[0].handler(validParams);
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in getEvents: ${error}`);
          return {
            content: [{ type: "text" as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // createEvent ツール
    this.server.tool(
      'createEvent',
      {
        calendarId: z.string().optional(),
        event: z.object({
          summary: z.string().min(1),
          description: z.string().optional(),
          location: z.string().optional(),
          start: z.object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          }),
          end: z.object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          }),
          attendees: z.array(z.object({
            email: z.string().email(),
            displayName: z.string().optional(),
          })).optional(),
        }),
      },
      async (args, extra) => {
        try {
          logger.info(`Creating event: ${JSON.stringify(args)}`);
          // args型をcreateEventSchemaに合わせる
          const result = await createEventSchema.parseAsync(args).then(validParams => {
            return tools[1].handler(validParams);
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in createEvent: ${error}`);
          return {
            content: [{ type: "text" as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // updateEvent ツール
    this.server.tool(
      'updateEvent',
      {
        calendarId: z.string().optional(),
        eventId: z.string().min(1),
        event: z.object({
          summary: z.string().optional(),
          description: z.string().optional(),
          location: z.string().optional(),
          start: z.object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          }).optional(),
          end: z.object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          }).optional(),
        }),
      },
      async (args, extra) => {
        try {
          logger.info(`Updating event: ${JSON.stringify(args)}`);
          // args型をupdateEventSchemaに合わせる
          const result = await updateEventSchema.parseAsync(args).then(validParams => {
            return tools[2].handler(validParams);
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in updateEvent: ${error}`);
          return {
            content: [{ type: "text" as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // deleteEvent ツール
    this.server.tool(
      'deleteEvent',
      {
        calendarId: z.string().optional(),
        eventId: z.string().min(1),
      },
      async (args, extra) => {
        try {
          logger.info(`Deleting event: ${JSON.stringify(args)}`);
          // args型をdeleteEventSchemaに合わせる
          const result = await deleteEventSchema.parseAsync(args).then(validParams => {
            return tools[3].handler(validParams);
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in deleteEvent: ${error}`);
          return {
            content: [{ type: "text" as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );
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
