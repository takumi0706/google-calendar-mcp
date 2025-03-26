import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import { z } from 'zod';
import calendarApi from '../calendar/calendar-api';
import { CalendarEvent } from '../calendar/types';
import {
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// ツールレスポンスの型
type ToolResponse = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private isRunning = false;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: '0.3.2',
    });

    // Stdioトランスポートの設定
    this.transport = new StdioServerTransport();

    // オリジナルメッセージ処理は setupMessageLogging() で上書きされる
    this.transport.onmessage = async (message: JSONRPCMessage): Promise<void> => {};

    // メッセージ処理用の追加リスナー設定
    this.setupMessageLogging();

    // ツールの登録
    this.registerTools();

    // リソースとプロンプトのリスト機能を実装
    this.implementResourcesAndPrompts();
  }

  // メッセージ処理用のヘルパー関数を追加
  private processJsonRpcMessage(message: string): any {
    try {
      // 特殊文字やBOMの除去
      const cleanedMessage = message.replace(/^\uFEFF/, '').trim();
      
      // 複数JSONオブジェクトが連結されている可能性があるので最初の有効なJSONだけを解析
      const match = cleanedMessage.match(/(\{.*\}|\[.*\])/s);
      if (match) {
        return JSON.parse(match[0]);
      }
      
      // 通常の解析も試す
      return JSON.parse(cleanedMessage);
    } catch (error) {
      logger.error(`Error parsing JSON-RPC message: ${error}`);
      logger.debug(`Problematic message: "${message}"`);
      throw error;
    }
  }

  private setupMessageLogging(): void {
    // 直接サーバーのメッセージをインターセプトする方法がないため
    // トランスポートの機能を拡張
    const originalSend = this.transport.send.bind(this.transport);
    this.transport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        // 送信前に文字列に変換し、確実に改行で終わるようにする
        const messageStr = JSON.stringify(message);
        logger.info(`Message from server: ${messageStr}`);
      } catch (err) {
        logger.error(`Error logging server message: ${err}`);
      }
      return await originalSend(message);
    };

    // クライアントからのメッセージ処理を改善
    const originalOnMessage = this.transport.onmessage;
    this.transport.onmessage = async (message: any): Promise<void> => {
      try {
        // メッセージが文字列の場合は、適切にパース
        if (typeof message === 'string') {
          message = this.processJsonRpcMessage(message);
        }
        logger.info(`Message from client: ${JSON.stringify(message)}`);
        if (originalOnMessage) {
          return await originalOnMessage(message);
        }
      } catch (err) {
        logger.error(`Error processing client message: ${err}`);
      }
    };
  }

  // リソースとプロンプトのメソッド実装
  private implementResourcesAndPrompts() {
    // capabilities を登録
    this.server.server.registerCapabilities({
      resources: {},
      prompts: {}
    });

    // resources/list メソッドの実装
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('Handling resources/list request');
      // 現在はリソースを提供していないので空の配列を返す
      return { resources: [] };
    });

    // prompts/list メソッドの実装
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info('Handling prompts/list request');
      // 現在はプロンプトを提供していないので空の配列を返す
      return { prompts: [] };
    });
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
      // MCP SDKの仕様に従い、stdioトランスポートを使用
      await this.server.connect(this.transport);
      
      // エラーハンドリングを追加
      this.transport.onerror = (error: Error): void => {
        logger.error(`Transport error: ${error}`, { context: 'transport' });
      };
      
      this.transport.onclose = (): void => {
        logger.info('Transport closed');
        this.isRunning = false;
      };
      
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