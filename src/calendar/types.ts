// Google Calendar Event関連の型定義
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
}

export interface EventDateTime {
  dateTime?: string; // ISO 8601形式の日時
  date?: string;     // YYYY-MM-DD形式の日付（終日イベント用）
  timeZone?: string; // 例: 'Asia/Tokyo'
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

// APIレスポンスの型定義
export interface CalendarApiResponse {
  success: boolean;
  content: string;
  data?: any;
}

// イベント一覧取得のパラメータ型
export interface GetEventsParams {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
}

// イベント作成のパラメータ型
export interface CreateEventParams {
  calendarId?: string;
  event: CalendarEvent;
}

// イベント更新のパラメータ型
export interface UpdateEventParams {
  calendarId?: string;
  eventId: string;
  event: CalendarEvent;
}

// イベント削除のパラメータ型
export interface DeleteEventParams {
  calendarId?: string;
  eventId: string;
}
