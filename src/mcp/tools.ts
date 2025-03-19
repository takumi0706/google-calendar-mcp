import calendarApi from '../calendar/calendar-api';
import {
  getEventsSchema,
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
} from './schemas';
import logger from '../utils/logger';
import { JSONSchema } from '@modelcontextprotocol/sdk/common/jsonschema.js';

// カスタムツール定義の型
interface CustomTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: unknown) => Promise<any>;
}

// MCP Tool定義
export const tools: CustomTool[] = [
  {
    name: 'getEvents',
    description: 'Google Calendarからイベントを取得します',
    parameters: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'カレンダーID（省略時は主要カレンダー）',
        },
        timeMin: {
          type: 'string',
          description: '取得開始日時（ISO 8601形式。例: 2025-03-01T00:00:00Z）',
        },
        timeMax: {
          type: 'string',
          description: '取得終了日時（ISO 8601形式）',
        },
        maxResults: {
          type: 'integer',
          description: '最大取得件数（デフォルト10）',
        },
        orderBy: {
          type: 'string',
          enum: ['startTime', 'updated'],
          description: '並び順（startTime: 開始時刻順、updated: 更新順）',
        },
      },
      required: [],
    },
    handler: async (params: unknown) => {
      try {
        const validatedParams = getEventsSchema.parse(params);
        logger.info(`Getting events with params: ${JSON.stringify(validatedParams)}`);
        return await calendarApi.getEvents(validatedParams);
      } catch (error) {
        logger.error(`Validation error in getEvents: ${error}`);
        return {
          success: false,
          content: `パラメータエラー: ${error}`,
        };
      }
    },
  },
  {
    name: 'createEvent',
    description: 'Google Calendarに新しいイベントを作成します',
    parameters: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'カレンダーID（省略時は主要カレンダー）',
        },
        event: {
          type: 'object',
          description: 'イベント情報',
          properties: {
            summary: {
              type: 'string',
              description: 'イベントの件名（必須）',
            },
            description: {
              type: 'string',
              description: 'イベントの説明',
            },
            location: {
              type: 'string',
              description: '場所',
            },
            start: {
              type: 'object',
              description: '開始日時（dateTimeまたはdateのいずれかが必須）',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'ISO 8601形式の日時（例: 2025-03-15T09:00:00+09:00）',
                },
                date: {
                  type: 'string',
                  description: 'YYYY-MM-DD形式の日付（終日イベント用）',
                },
                timeZone: {
                  type: 'string',
                  description: 'タイムゾーン（例: Asia/Tokyo）',
                },
              },
            },
            end: {
              type: 'object',
              description: '終了日時（dateTimeまたはdateのいずれかが必須）',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'ISO 8601形式の日時（例: 2025-03-15T10:00:00+09:00）',
                },
                date: {
                  type: 'string',
                  description: 'YYYY-MM-DD形式の日付（終日イベント用）',
                },
                timeZone: {
                  type: 'string',
                  description: 'タイムゾーン（例: Asia/Tokyo）',
                },
              },
            },
            attendees: {
              type: 'array',
              description: '参加者リスト',
              items: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    description: '参加者のメールアドレス',
                  },
                  displayName: {
                    type: 'string',
                    description: '表示名',
                  },
                },
              },
            },
          },
          required: ['summary', 'start', 'end'],
        },
      },
      required: ['event'],
    },
    handler: async (params: unknown) => {
      try {
        const validatedParams = createEventSchema.parse(params);
        logger.info(`Creating event: ${validatedParams.event.summary}`);
        return await calendarApi.createEvent(validatedParams);
      } catch (error) {
        logger.error(`Validation error in createEvent: ${error}`);
        return {
          success: false,
          content: `パラメータエラー: ${error}`,
        };
      }
    },
  },
  {
    name: 'updateEvent',
    description: 'Google Calendar上の既存イベントを更新します',
    parameters: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'カレンダーID（省略時は主要カレンダー）',
        },
        eventId: {
          type: 'string',
          description: '更新するイベントのID（必須）',
        },
        event: {
          type: 'object',
          description: '更新するイベント情報',
          properties: {
            summary: {
              type: 'string',
              description: 'イベントの件名',
            },
            description: {
              type: 'string',
              description: 'イベントの説明',
            },
            location: {
              type: 'string',
              description: '場所',
            },
            start: {
              type: 'object',
              description: '開始日時',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'ISO 8601形式の日時',
                },
                date: {
                  type: 'string',
                  description: 'YYYY-MM-DD形式の日付（終日イベント用）',
                },
                timeZone: {
                  type: 'string',
                  description: 'タイムゾーン',
                },
              },
            },
            end: {
              type: 'object',
              description: '終了日時',
              properties: {
                dateTime: {
                  type: 'string',
                  description: 'ISO 8601形式の日時',
                },
                date: {
                  type: 'string',
                  description: 'YYYY-MM-DD形式の日付（終日イベント用）',
                },
                timeZone: {
                  type: 'string',
                  description: 'タイムゾーン',
                },
              },
            },
          },
        },
      },
      required: ['eventId', 'event'],
    },
    handler: async (params: unknown) => {
      try {
        const validatedParams = updateEventSchema.parse(params);
        logger.info(`Updating event: ${validatedParams.eventId}`);
        return await calendarApi.updateEvent(validatedParams);
      } catch (error) {
        logger.error(`Validation error in updateEvent: ${error}`);
        return {
          success: false,
          content: `パラメータエラー: ${error}`,
        };
      }
    },
  },
  {
    name: 'deleteEvent',
    description: 'Google Calendar上のイベントを削除します',
    parameters: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'カレンダーID（省略時は主要カレンダー）',
        },
        eventId: {
          type: 'string',
          description: '削除するイベントのID（必須）',
        },
      },
      required: ['eventId'],
    },
    handler: async (params: unknown) => {
      try {
        const validatedParams = deleteEventSchema.parse(params);
        logger.info(`Deleting event: ${validatedParams.eventId}`);
        return await calendarApi.deleteEvent(validatedParams);
      } catch (error) {
        logger.error(`Validation error in deleteEvent: ${error}`);
        return {
          success: false,
          content: `パラメータエラー: ${error}`,
        };
      }
    },
  },
];
