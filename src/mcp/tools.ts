import calendarApi from '../calendar/calendar-api';
import {
  getEventsParamsSchema,
  createEventParamsSchema,
  updateEventParamsSchema,
  deleteEventParamsSchema,
} from './schemas';
import logger from '../utils/logger';
import { z } from 'zod';
import { CalendarEvent } from '../calendar/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * ツール管理クラス
 * MCPサーバーにツールを登録する機能を提供
 */
export class ToolsManager {
  /**
   * MCPサーバーにツールを登録する
   * @param server MCPサーバーインスタンス
   */
  public registerTools(server: McpServer): void {
    logger.info('Registering calendar tools with MCP server');

    // getEvents ツール
    server.tool(
      'getEvents',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        timeMin: z.string().optional().describe('取得開始日時（ISO 8601形式。例: 2025-03-01T00:00:00Z）'),
        timeMax: z.string().optional().describe('取得終了日時（ISO 8601形式）'),
        maxResults: z.number().int().positive().optional().describe('最大取得件数（デフォルト10）'),
        orderBy: z.enum(['startTime', 'updated']).optional().describe('並び順（startTime: 開始時刻順、updated: 更新順）'),
      },
      async (args, _extra) => {
        try {
          logger.info(`Executing getEvents with params: ${JSON.stringify(args)}`);
          const validatedParams = getEventsParamsSchema.parse(args);
          const result = await calendarApi.getEvents(validatedParams);
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
    server.tool(
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
      async (args, _extra) => {
        try {
          logger.info(`Executing createEvent with params: ${JSON.stringify(args)}`);
          const validatedParams = createEventParamsSchema.parse(args);
          const result = await calendarApi.createEvent(validatedParams);
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
    server.tool(
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
      async (args, _extra) => {
        try {
          logger.info(`Executing updateEvent with params: ${JSON.stringify(args)}`);

          // 既存のイベントを取得して、更新データとマージ
          // 必須フィールドを確保
          const validatedParams = updateEventParamsSchema.parse(args);
          const eventWithDefaults: CalendarEvent = {
            ...validatedParams.event,
            summary: validatedParams.event.summary || '（無題）',  // summaryがない場合はデフォルト値を設定
            start: validatedParams.event.start || { dateTime: new Date().toISOString() },
            end: validatedParams.event.end || { dateTime: new Date(Date.now() + 3600000).toISOString() }
          };

          const updateParams = {
            calendarId: validatedParams.calendarId,
            eventId: validatedParams.eventId,
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
    server.tool(
      'deleteEvent',
      {
        calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
        eventId: z.string().min(1).describe('削除するイベントのID（必須）'),
      },
      async (args, _extra) => {
        try {
          logger.info(`Executing deleteEvent with params: ${JSON.stringify(args)}`);
          const validatedParams = deleteEventParamsSchema.parse(args);
          const result = await calendarApi.deleteEvent(validatedParams);
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

    logger.info('All calendar tools registered successfully');
  }
}

// シングルトンインスタンスをエクスポート
export default new ToolsManager();
