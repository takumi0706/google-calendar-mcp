import { calendar_v3, google } from 'googleapis';
import oauthAuth from '../auth/oauth-auth';
import logger from '../utils/logger';
import {
  CalendarApiResponse,
  CreateEventParams,
  DeleteEventParams,
  GetEventsParams,
  UpdateEventParams,
  GetCalendarParams,
} from './types';

class GoogleCalendarApi {
  private calendar: calendar_v3.Calendar | null = null;

  // Initialize Calendar API client
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

  // Get list of events
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
        content: `Retrieved ${events?.length || 0} events.`,
        data: events,
      };
    } catch (error) {
      logger.error(`Error getting events: ${error}`);
      return {
        success: false,
        content: `Failed to retrieve events: ${error}`,
      };
    }
  }

  // Get a single event by ID
  async getEvent(calendarId: string = 'primary', eventId: string): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();

      const response = await calendar.events.get({
        calendarId,
        eventId,
      });

      const event = response.data;
      return {
        success: true,
        content: `Retrieved event "${event.summary}".`,
        data: event,
      };
    } catch (error) {
      logger.error(`Error getting event: ${error}`);
      return {
        success: false,
        content: `Failed to retrieve event: ${error}`,
      };
    }
  }

  // Create a new event
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
        content: `Created event "${createdEvent.summary}".`,
        data: createdEvent,
      };
    } catch (error) {
      logger.error(`Error creating event: ${error}`);
      return {
        success: false,
        content: `Failed to create event: ${error}`,
      };
    }
  }

  // Update an existing event
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
        content: `Updated event "${updatedEvent.summary}".`,
        data: updatedEvent,
      };
    } catch (error) {
      logger.error(`Error updating event: ${error}`);
      return {
        success: false,
        content: `Failed to update event: ${error}`,
      };
    }
  }

  // Delete an event
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
        content: `Event deleted successfully.`,
      };
    } catch (error) {
      logger.error(`Error deleting event: ${error}`);
      return {
        success: false,
        content: `Failed to delete event: ${error}`,
      };
    }
  }

  // Get calendar resource
  async getCalendar(params: GetCalendarParams): Promise<CalendarApiResponse> {
    try {
      const calendar = await this.initCalendarClient();
      const calendarId = params.calendarId;

      const response = await calendar.calendars.get({
        calendarId,
      });

      const calendarResource = response.data;
      return {
        success: true,
        content: `Retrieved calendar "${calendarResource.summary}".`,
        data: calendarResource,
      };
    } catch (error) {
      logger.error(`Error getting calendar: ${error}`);
      return {
        success: false,
        content: `Failed to retrieve calendar: ${error}`,
      };
    }
  }
}

export default new GoogleCalendarApi();
