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
 * イベントスキーマ - Google Calendarイベントの作成・更新に使用
 */
export const eventSchema = z.object({
  summary: z.string().min(1, { message: '件名は必須です' }).max(500),
  description: z.string().max(8000).optional(),
  location: z.string().max(1000).optional(),
  start: dateTimeSchema,
  end: dateTimeSchema,
  attendees: z.array(attendeeSchema).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(
      z.object({
        method: z.enum(['email', 'popup']),
        minutes: z.number().int().positive()
      })
    ).optional()
  }).optional(),
  // その他のGoogle Calendarフィールドも必要に応じて追加
});

/**
 * イベント更新スキーマ - eventSchemaの部分的な更新を許可
 */
export const eventUpdateSchema = eventSchema.partial();

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

/**
 * スキーマ検証関数 - Zodスキーマを使用してデータを検証
 * @param schema Zodスキーマ
 * @param data 検証するデータ
 * @returns 検証済みデータ
 * @throws ZodError 検証エラー
 */
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * 安全なスキーマ検証関数 - エラーをthrowせず、結果オブジェクトを返す
 * @param schema Zodスキーマ
 * @param data 検証するデータ
 * @returns 検証結果オブジェクト
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  error?: z.ZodError;
} {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}
