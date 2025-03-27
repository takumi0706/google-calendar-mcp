import calendarApi from '../calendar/calendar-api';
import {
  getEventsParamsSchema,
  createEventParamsSchema,
  updateEventParamsSchema,
  deleteEventParamsSchema,
} from './schemas';
import logger from '../utils/logger';
import { z } from 'zod';

// カスタムデータ型の定義
type GetEventsParams = z.infer<typeof getEventsParamsSchema>;
type CreateEventParams = z.infer<typeof createEventParamsSchema>;
type UpdateEventParams = z.infer<typeof updateEventParamsSchema>;
type DeleteEventParams = z.infer<typeof deleteEventParamsSchema>;

// ツールレスポンスの型
type ToolResponse = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

// ツール定義
export const tools = [
  {
    name: 'getEvents',
    description: 'Google Calendarからイベントを取得します',
    parameters: {
      calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
      timeMin: z.string().optional().describe('取得開始日時（ISO 8601形式。例: 2025-03-01T00:00:00Z）'),
      timeMax: z.string().optional().describe('取得終了日時（ISO 8601形式）'),
      maxResults: z.number().int().positive().optional().describe('最大取得件数（デフォルト10）'),
      orderBy: z.enum(['startTime', 'updated']).optional().describe('並び順（startTime: 開始時刻順、updated: 更新順）'),
    },
    handler: async (params: GetEventsParams): Promise<ToolResponse> => {
      try {
        const validatedParams = getEventsParamsSchema.parse(params);
        logger.info(`Getting events with params: ${JSON.stringify(validatedParams)}`);
        const result = await calendarApi.getEvents(validatedParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        logger.error(`Validation error in getEvents: ${error}`);
        return {
          content: [{ type: 'text', text: `パラメータエラー: ${error}` }],
          isError: true
        };
      }
    },
  },
  {
    name: 'createEvent',
    description: 'Google Calendarに新しいイベントを作成します',
    parameters: {
      calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
      event: z.object({
        summary: z.string().min(1).describe('イベントの件名（必須）'),
        description: z.string().optional().describe('イベントの説明'),
        location: z.string().optional().describe('場所'),
        start: z.object({
          dateTime: z.string().optional().describe('ISO 8601形式の日時（例: 2025-03-15T09:00:00+09:00）'),
          date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
          timeZone: z.string().optional().describe('タイムゾーン（例: Asia/Tokyo）'),
        }).refine(data => data.dateTime || data.date, {
          message: '日時（dateTime）または日付（date）のいずれかが必要です',
        }).describe('開始日時（dateTimeまたはdateのいずれかが必須）'),
        end: z.object({
          dateTime: z.string().optional().describe('ISO 8601形式の日時（例: 2025-03-15T10:00:00+09:00）'),
          date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
          timeZone: z.string().optional().describe('タイムゾーン（例: Asia/Tokyo）'),
        }).refine(data => data.dateTime || data.date, {
          message: '日時（dateTime）または日付（date）のいずれかが必要です',
        }).describe('終了日時（dateTimeまたはdateのいずれかが必須）'),
        attendees: z.array(z.object({
          email: z.string().email(),
          displayName: z.string().optional(),
        })).optional().describe('参加者リスト'),
      }).describe('イベント情報'),
    },
    handler: async (params: CreateEventParams): Promise<ToolResponse> => {
      try {
        const validatedParams = createEventParamsSchema.parse(params);
        logger.info(`Creating event: ${validatedParams.event.summary}`);
        const result = await calendarApi.createEvent(validatedParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        logger.error(`Validation error in createEvent: ${error}`);
        return {
          content: [{ type: 'text', text: `パラメータエラー: ${error}` }],
          isError: true
        };
      }
    },
  },
  {
    name: 'updateEvent',
    description: 'Google Calendar上の既存イベントを更新します',
    parameters: {
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
        }).optional().describe('開始日時'),
        end: z.object({
          dateTime: z.string().optional().describe('ISO 8601形式の日時'),
          date: z.string().optional().describe('YYYY-MM-DD形式の日付（終日イベント用）'),
          timeZone: z.string().optional().describe('タイムゾーン'),
        }).optional().describe('終了日時'),
      }).describe('更新するイベント情報'),
    },
    handler: async (params: UpdateEventParams): Promise<ToolResponse> => {
      try {
        const validatedParams = updateEventParamsSchema.parse(params);
        logger.info(`Updating event: ${validatedParams.eventId}`);
        const result = await calendarApi.updateEvent(validatedParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        logger.error(`Validation error in updateEvent: ${error}`);
        return {
          content: [{ type: 'text', text: `パラメータエラー: ${error}` }],
          isError: true
        };
      }
    },
  },
  {
    name: 'deleteEvent',
    description: 'Google Calendar上のイベントを削除します',
    parameters: {
      calendarId: z.string().optional().describe('カレンダーID（省略時は主要カレンダー）'),
      eventId: z.string().min(1).describe('削除するイベントのID（必須）'),
    },
    handler: async (params: DeleteEventParams): Promise<ToolResponse> => {
      try {
        const validatedParams = deleteEventParamsSchema.parse(params);
        logger.info(`Deleting event: ${validatedParams.eventId}`);
        const result = await calendarApi.deleteEvent(validatedParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        logger.error(`Validation error in deleteEvent: ${error}`);
        return {
          content: [{ type: 'text', text: `パラメータエラー: ${error}` }],
          isError: true
        };
      }
    },
  },
];
