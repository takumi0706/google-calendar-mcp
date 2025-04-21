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
export interface CalendarApiResponse {
  success: boolean;
  content: string;
  data?: any;
}

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
