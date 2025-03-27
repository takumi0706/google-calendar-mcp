// src/mcp/schemas.ts
import { z } from 'zod';

/**
 * 日時の検証スキーマ
 * ISO 8601形式またはYYYY-MM-DD形式をサポート
 */
const dateTimeSchema = z.object({
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: '日時はISO 8601形式(YYYY-MM-DDThh:mm:ss+hh:mm)である必要があります' }),
  timeZone: z.string().optional()
}).or(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 
    { message: '日付はYYYY-MM-DD形式である必要があります' }),
  timeZone: z.string().optional()
}));

/**
 * 参加者スキーマ
 */
const attendeeSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  displayName: z.string().optional()
});

/**
 * リマインダースキーマ
 */
const reminderSchema = z.object({
  useDefault: z.boolean(), // undefined を許容しない
  overrides: z.array(
    z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number().int().positive()
    })
  ).optional()
});

/**
 * イベントスキーマ - Google Calendarイベントの作成・更新に使用
 */
export const eventSchema = z.object({
  summary: z.string().min(1, { message: '件名は必須です' }).max(500),
  description: z.string().max(8000).optional(),
  location: z.string().max(1000).optional(),
  start: dateTimeSchema,
  end: dateTimeSchema,
  attendees: z.array(attendeeSchema).optional(),
  reminders: reminderSchema.optional(), // リマインダースキーマを使用
  colorId: z.string().optional().describe('イベントの色ID（1-11の数字）'),
});

/**
 * イベント更新スキーマ - すべてのフィールドを任意に
 * ただし、createdEventが必要になるため、summaryは必須
 */
export const eventUpdateSchema = z.object({
  summary: z.string().min(1), // 必須
  description: z.string().max(8000).optional(),
  location: z.string().max(1000).optional(),
  start: dateTimeSchema.optional(),
  end: dateTimeSchema.optional(),
  attendees: z.array(attendeeSchema).optional(),
  reminders: reminderSchema.optional(),
  colorId: z.string().optional().describe('イベントの色ID（1-11の数字）'),
});

/**
 * getEvents関数パラメータスキーマ
 */
export const getEventsParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: 'timeMinはISO 8601形式である必要があります' }).optional(),
  timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: 'timeMaxはISO 8601形式である必要があります' }).optional(),
  maxResults: z.number().int().positive().max(2500).optional().default(10),
  orderBy: z.enum(['startTime', 'updated']).optional()
});

/**
 * createEvent関数パラメータスキーマ
 */
export const createEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  event: eventSchema
});

/**
 * updateEvent関数パラメータスキーマ
 */
export const updateEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  eventId: z.string().min(1, { message: 'イベントIDは必須です' }),
  event: eventUpdateSchema
});

/**
 * deleteEvent関数パラメータスキーマ
 */
export const deleteEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  eventId: z.string().min(1, { message: 'イベントIDは必須です' })
});

