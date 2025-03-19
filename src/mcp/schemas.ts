import { z } from 'zod';

// 日時関連のスキーマ
const eventDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
}).refine(data => data.dateTime || data.date, {
  message: '日時（dateTime）または日付（date）のいずれかが必要です',
});

// 参加者のスキーマ
const eventAttendeeSchema = z.object({
  email: z.string().email('有効なメールアドレスが必要です'),
  displayName: z.string().optional(),
  responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
  optional: z.boolean().optional(),
});

// リマインダーのスキーマ
const eventReminderSchema = z.object({
  method: z.enum(['email', 'popup']),
  minutes: z.number().int().positive(),
});

const eventRemindersSchema = z.object({
  useDefault: z.boolean(),
  overrides: z.array(eventReminderSchema).optional(),
});

// イベントのスキーマ
const calendarEventSchema = z.object({
  id: z.string().optional(),
  summary: z.string().min(1, '件名は必須です'),
  description: z.string().optional(),
  location: z.string().optional(),
  start: eventDateTimeSchema,
  end: eventDateTimeSchema,
  attendees: z.array(eventAttendeeSchema).optional(),
  reminders: eventRemindersSchema.optional(),
});

// getEventsのパラメータスキーマ
export const getEventsSchema = z.object({
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().int().positive().optional(),
  orderBy: z.enum(['startTime', 'updated']).optional(),
});

// createEventのパラメータスキーマ
export const createEventSchema = z.object({
  calendarId: z.string().optional(),
  event: calendarEventSchema,
});

// updateEventのパラメータスキーマ
export const updateEventSchema = z.object({
  calendarId: z.string().optional(),
  eventId: z.string().min(1, 'イベントIDは必須です'),
  event: calendarEventSchema,
});

// deleteEventのパラメータスキーマ
export const deleteEventSchema = z.object({
  calendarId: z.string().optional(),
  eventId: z.string().min(1, 'イベントIDは必須です'),
});
