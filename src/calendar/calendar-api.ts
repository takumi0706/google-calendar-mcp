import { calendar_v3, google } from 'googleapis';
import oauthAuth from '../auth/oauth-auth';
import logger from '../utils/logger';
import {
  CalendarApiResponse,
  CreateEventParams,
  DeleteEventParams,
  GetEventsParams,
  UpdateEventParams,
} from './types';

class GoogleCalendarApi {
  private calendar: calendar_v3.Calendar | null = null;

  // Calendar APIクライアントの初期化
  private async initCalendarClient(): Promise<calendar_v3.Calendar> {
    if (this.calendar) {
      return this.calendar;
    }

    try {
      const auth = await oauthAuth.getAuthenticatedClient();
      this.calendar = google.calendar({ version: 'v3', auth });
      return this.calendar;
    } catch (error) {
      logger.error(`Failed to initialize Calendar API client: ${error}`);
      throw error;
    }
  }

  // イベント一覧の取得
  async getEvents(params: GetEventsParams): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();
      const calendarId = params.calendarId || 'primary';

      const response = await calendar.events.list({
        calendarId,
        timeMin: params.timeMin || new Date().toISOString(),
        timeMax: params.timeMax,
        maxResults: params.maxResults || 10,
        singleEvents: true,
        orderBy: params.orderBy || 'startTime',
      });

      const events = response.data.items;
      return {
        success: true,
        content: `${events?.length || 0}件のイベントを取得しました。`,
        data: events,
      };
    } catch (error) {
      logger.error(`Error getting events: ${error}`);
      return {
        success: false,
        content: `イベントの取得に失敗しました: ${error}`,
      };
    }
  }

  // イベントの作成
  async createEvent(params: CreateEventParams): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();
      const calendarId = params.calendarId || 'primary';

      const response = await calendar.events.insert({
        calendarId,
        requestBody: params.event as any,
      });

      const createdEvent = response.data;
      return {
        success: true,
        content: `イベント「${createdEvent.summary}」を作成しました。`,
        data: createdEvent,
      };
    } catch (error) {
      logger.error(`Error creating event: ${error}`);
      return {
        success: false,
        content: `イベントの作成に失敗しました: ${error}`,
      };
    }
  }

  // イベントの更新
  async updateEvent(params: UpdateEventParams): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();
      const calendarId = params.calendarId || 'primary';

      const response = await calendar.events.update({
        calendarId,
        eventId: params.eventId,
        requestBody: params.event as any,
      });

      const updatedEvent = response.data;
      return {
        success: true,
        content: `イベント「${updatedEvent.summary}」を更新しました。`,
        data: updatedEvent,
      };
    } catch (error) {
      logger.error(`Error updating event: ${error}`);
      return {
        success: false,
        content: `イベントの更新に失敗しました: ${error}`,
      };
    }
  }

  // イベントの削除
  async deleteEvent(params: DeleteEventParams): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();
      const calendarId = params.calendarId || 'primary';

      await calendar.events.delete({
        calendarId,
        eventId: params.eventId,
      });

      return {
        success: true,
        content: `イベントを削除しました。`,
      };
    } catch (error) {
      logger.error(`Error deleting event: ${error}`);
      return {
        success: false,
        content: `イベントの削除に失敗しました: ${error}`,
      };
    }
  }
}

export default new GoogleCalendarApi();
