// src/mcp/schemas.ts
import { z } from 'zod';

/**
 * Authentication schema - Empty object as no parameters are needed
 */
export const authenticateParamsSchema = z.object({});

/**
 * DateTime validation schema
 * Supports ISO 8601 format or YYYY-MM-DD format
 */
const dateTimeSchema = z.object({
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: 'DateTime must be in ISO 8601 format (YYYY-MM-DDThh:mm:ss+hh:mm)' }),
  timeZone: z.string().optional()
}).or(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 
    { message: 'Date must be in YYYY-MM-DD format' }),
  timeZone: z.string().optional()
}));

/**
 * Attendee schema
 */
const attendeeSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  displayName: z.string().optional()
});

/**
 * Reminder schema
 */
const reminderSchema = z.object({
  useDefault: z.boolean(), // does not allow undefined
  overrides: z.array(
    z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number().int().positive()
    })
  ).optional()
});

/**
 * Event schema - Used for creating and updating Google Calendar events
 */
export const eventSchema = z.object({
  summary: z.string().min(1, { message: 'Summary is required' }).max(500),
  description: z.string().max(8000).optional(),
  location: z.string().max(1000).optional(),
  start: dateTimeSchema,
  end: dateTimeSchema,
  attendees: z.array(attendeeSchema).optional(),
  reminders: reminderSchema.optional(), // using reminder schema
  colorId: z.string().optional().describe('Event color ID (number 1-11)'),
  recurrence: z.array(z.string()).optional().describe('Recurrence rules in RFC5545 format (e.g., ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"])')
});

/**
 * Event update schema - All fields are optional
 * All fields are optional to merge with existing event data
 */
export const eventUpdateSchema = z.object({
  summary: z.string().min(1).optional(), // optional
  description: z.string().max(8000).optional(),
  location: z.string().max(1000).optional(),
  start: dateTimeSchema.optional(),
  end: dateTimeSchema.optional(),
  attendees: z.array(attendeeSchema).optional(),
  reminders: reminderSchema.optional(),
  colorId: z.string().optional().describe('Event color ID (number 1-11)'),
  recurrence: z.array(z.string()).optional().describe('Recurrence rules in RFC5545 format (e.g., ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"])'),
});

/**
 * getEvents function parameter schema
 */
export const getEventsParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: 'timeMin must be in ISO 8601 format' }).optional(),
  timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, 
    { message: 'timeMax must be in ISO 8601 format' }).optional(),
  maxResults: z.number().int().positive().max(2500).optional().default(10),
  orderBy: z.enum(['startTime', 'updated']).optional().default('startTime')
});

/**
 * createEvent function parameter schema
 */
export const createEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  event: eventSchema
});

/**
 * updateEvent function parameter schema
 */
export const updateEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  eventId: z.string().min(1, { message: 'Event ID is required' }),
  event: eventUpdateSchema
});

/**
 * deleteEvent function parameter schema
 */
export const deleteEventParamsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  eventId: z.string().min(1, { message: 'Event ID is required' })
});

/**
 * getCalendar function parameter schema
 */
export const getCalendarParamsSchema = z.object({
  calendarId: z.string().min(1, { message: 'Calendar ID is required' })
});

/**
 * resources/read request schema
 */
export const readResourceRequestSchema = z.object({
  method: z.literal('resources/read'),
  params: z.object({
    uri: z.string().min(1, { message: 'URI is required' })
  })
});
