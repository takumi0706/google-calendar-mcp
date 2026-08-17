import type { calendar_v3 } from 'googleapis';

/**
 * Google Calendar API がそのまま返してくるイベント表現。
 *
 * 自前の CalendarEvent とは別物である点に注意。API 側は全フィールドが
 * optional かつ null を取りうるのに対し、CalendarEvent は summary / start / end
 * を必須にしている。両者は toCalendarEvent() で明示的に変換する。
 */
export type GoogleCalendarEvent = calendar_v3.Schema$Event;

/** Google Calendar API が返すカレンダー本体の表現 */
export type GoogleCalendar = calendar_v3.Schema$Calendar;

// Type definitions related to Google Calendar Event
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: EventDateTime;
  end: EventDateTime;
  attendees?: EventAttendee[];
  reminders?: EventReminders;
  colorId?: string;
  recurrence?: string[]; // RFC5545 Repeating rules in RRULE format (example: ['RRULE:FREQ=DAILY;COUNT=5'])
}

export interface EventDateTime {
  dateTime?: string; // DateTime in ISO 8601 format
  date?: string;     // Date in YYYY-MM-DD format (for all-day events)
  timeZone?: string; // Example: 'Asia/Tokyo'
}

export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

export interface EventReminders {
  useDefault: boolean;
  overrides?: EventReminder[];
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

// Type definition for API response
export interface CalendarApiResponse<T = unknown> {
  success: boolean;
  content: string;
  data?: T;
}

// Specialized API response types.
// data には Google API のレスポンスがそのまま入るため GoogleCalendarEvent を使う。
export type EventsListResponse = CalendarApiResponse<GoogleCalendarEvent[] | undefined>;
export type SingleEventResponse = CalendarApiResponse<GoogleCalendarEvent>;
export type CalendarResourceResponse = CalendarApiResponse<CalendarResource>;
export type GoogleCalendarResponse = CalendarApiResponse<GoogleCalendar>;
export type DeleteEventResponse = CalendarApiResponse<void>;

// Parameter type for retrieving event list
export interface GetEventsParams {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
}

// Parameter type for creating event
export interface CreateEventParams {
  calendarId?: string;
  event: CalendarEvent;
}

// Parameter type for updating event
export interface UpdateEventParams {
  calendarId?: string;
  eventId: string;
  event: CalendarEvent;
}

// Parameter type for deleting event
export interface DeleteEventParams {
  calendarId?: string;
  eventId: string;
}

// Type definition for calendar resource
export interface CalendarResource {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  accessRole?: string;
}

// Parameter type for retrieving calendar
export interface GetCalendarParams {
  calendarId: string;
}
