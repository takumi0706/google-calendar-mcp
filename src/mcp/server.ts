import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import config from '../config/config';
import * as net from 'net';
import { z } from 'zod';
import calendarApi from '../calendar/calendar-api';
import { CalendarEvent } from '../calendar/types';

// ツールレスポンスの型
type ToolResponse = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private isRunning = false;
  private socketServer: net.Server | null = null;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: '0.2.4',
    });

    // Stdioトランスポートの設定
    this.transport = new StdioServerTransport();

    // エラーハンドリング
    // TODO: デバック用であるから後から消す
    this.transport.onmessage = (data: any): void => {
      logger.info('👹onmessage callback invoked👹'); // コールバックが呼ばれたか確認
      try {
        // 受信したデータを文字列に変換して余計な文字を除去
        const rawMessage = typeof data === 'string' ? data : JSON.stringify(data);
        const trimmedMessage = rawMessage.trim();
        logger.info(`Received raw message: [${rawMessage}]`);
        logger.info(`Trimmed message: [${trimmedMessage}]`);

        // JSONのパース処理
        const message = JSON.parse(trimmedMessage);
        logger.info(`Message from client: ${JSON.stringify(message)}`);

        // ここでmessageに基づく後続処理を実装
      } catch (err) {
        logger.error(`Error processing message: ${err}`);
      }
    };

    // ツールの登録
    this.registerTools();
  }

  private registerTools() {
    // getEvents ツール
    this.server.tool(
      'getEvents',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        timeMin: z.string().optional().describe('取得開始日時（ISO 8601形式。例: 2025-03-01T00:00:00Z）'),
        timeMax: z.string().optional().describe('取得終了日時（ISO 8601形式）'),
        maxResults: z.number().int().positive().optional().describe('最大取得件数（デフォルト10）'),
        orderBy: z.enum(['startTime', 'updated']).optional().describe('並び順（startTime: 開始時刻順、updated: 更新順）'),
      },
      async (args, extra) => {
        try {
          logger.info(`Executing getEvents with params: ${JSON.stringify(args)}`);
          const result = await calendarApi.getEvents(args);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in getEvents: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // createEvent ツール
    this.server.tool(
      'createEvent',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        event: z.object({
          summary: z.string().min(1).describe('イベントの件名（必須）'),
          description: z.string().optional().describe('イベントの説明'),
          location: z.string().optional().describe('場所'),
          start: z.object({
            dateTime: z.string().optional().describe('ISO 8601形式の日時（例: 2025-03-15T09:00:00+09:00）'),
            date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
            timeZone: z.string().optional().describe('タイムゾーン（例: Asia/Tokyo）'),
          }),
          end: z.object({
            dateTime: z.string().optional().describe('ISO 8601形式の日時（例: 2025-03-15T10:00:00+09:00）'),
            date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
            timeZone: z.string().optional().describe('タイムゾーン（例: Asia/Tokyo）'),
          }),
          attendees: z.array(z.object({
            email: z.string().email(),
            displayName: z.string().optional(),
          })).optional().describe('参加者リスト'),
        }),
      },
      async (args, extra) => {
        try {
          logger.info(`Executing createEvent with params: ${JSON.stringify(args)}`);
          const result = await calendarApi.createEvent(args);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in createEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // updateEvent ツール
    this.server.tool(
      'updateEvent',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        eventId: z.string().min(1).describe('更新するイベントのID（必須）'),
        event: z.object({
          summary: z.string().optional().describe('イベントの件名'),
          description: z.string().optional().describe('イベントの説明'),
          location: z.string().optional().describe('場所'),
          start: z.object({
            dateTime: z.string().optional().describe('ISO 8601形式の日時'),
            date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
            timeZone: z.string().optional().describe('タイムゾーン'),
          }).optional(),
          end: z.object({
            dateTime: z.string().optional().describe('ISO 8601形式の日時'),
            date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
            timeZone: z.string().optional().describe('タイムゾーン'),
          }).optional(),
        }),
      },
      async (args, extra) => {
        try {
          logger.info(`Executing updateEvent with params: ${JSON.stringify(args)}`);
          
          // 既存のイベントを取得して、更新データとマージ
          // 必須フィールドを確保
          const eventWithDefaults: CalendarEvent = {
            summary: args.event.summary || '（無題）',  // summaryがない場合はデフォルト値を設定
            start: args.event.start || { dateTime: new Date().toISOString() },
            end: args.event.end || { dateTime: new Date(Date.now() + 3600000).toISOString() },
            ...args.event
          };
          
          const updateParams = {
            calendarId: args.calendarId,
            eventId: args.eventId,
            event: eventWithDefaults
          };
          
          const result = await calendarApi.updateEvent(updateParams);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in updateEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `エラー: ${error}` }],
            isError: true
          };
        }
      }
    );

    // deleteEvent ツール
    this.server.tool(
      'deleteEvent',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        eventId: z.string().min(1).describe('削除するイベントのID（必須）'),
      },
      async (args, extra) => {
        try {
          logger.info(`Executing deleteEvent with params: ${JSON.stringify(args)}`);
          const result = await calendarApi.deleteEvent(args);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in deleteEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `エラー: ${error}` }],
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
      logger.info('Initializing server...');
      
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
