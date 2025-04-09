import calendarApi from '../calendar/calendar-api';
import {
  getEventsParamsSchema,
  createEventParamsSchema,
  updateEventParamsSchema,
  deleteEventParamsSchema,
} from './schemas';
import logger from '../utils/logger';
import { z } from 'zod';
import { CalendarEvent } from '../calendar/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Tools Manager Class
 * Provides functionality to register tools with the MCP server
 */
export class ToolsManager {
  /**
   * Property that holds registered tools
   */
  public tools: Record<string, any> = {};

  /**
   * Register tools with the MCP server
   * @param server MCP server instance
   */
  public registerTools(server: McpServer): void {
    logger.debug('Registering calendar tools with MCP server');

    // getEvents tool
    const getEventsSchema = {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      timeMin: z.string().optional().describe('Start time for event retrieval (ISO 8601 format. Example: 2025-03-01T00:00:00Z)'),
      timeMax: z.string().optional().describe('End time for event retrieval (ISO 8601 format)'),
      maxResults: z.number().int().positive().optional().describe('Maximum number of events to retrieve (default: 10)'),
      orderBy: z.enum(['startTime', 'updated']).optional().describe('Sort order (startTime: by start time, updated: by update time)'),
    };

    this.tools['getEvents'] = getEventsSchema;

    server.tool(
      'getEvents',
      getEventsSchema,
      async (args, _extra) => {
        try {
          logger.debug(`Executing getEvents with params: ${JSON.stringify(args)}`);
          const validatedParams = getEventsParamsSchema.parse(args);
          const result = await calendarApi.getEvents(validatedParams);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in getEvents: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `Error: ${error}` }],
            isError: true
          };
        }
      }
    );

    // createEvent tool
    const createEventSchema = {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      event: z.object({
        summary: z.string().min(1).describe('Event title (required)'),
        description: z.string().optional().describe('Event description'),
        location: z.string().optional().describe('Location'),
        start: z.object({
          dateTime: z.string().optional().describe('ISO 8601 format datetime (example: 2025-03-15T09:00:00+09:00)'),
          date: z.string().optional().describe('YYYY-MM-DD format date (for all-day events)'),
          timeZone: z.string().optional().describe('Timezone (example: Asia/Tokyo)'),
        }),
        end: z.object({
          dateTime: z.string().optional().describe('ISO 8601 format datetime (example: 2025-03-15T10:00:00+09:00)'),
          date: z.string().optional().describe('YYYY-MM-DD format date (for all-day events)'),
          timeZone: z.string().optional().describe('Timezone (example: Asia/Tokyo)'),
        }),
        attendees: z.array(z.object({
          email: z.string().email(),
          displayName: z.string().optional(),
        })).optional().describe('Attendee list'),
        colorId: z.string().optional().describe('Event color ID (number 1-11)'),
      }),
    };

    this.tools['createEvent'] = createEventSchema;

    server.tool(
      'createEvent',
      createEventSchema,
      async (args, _extra) => {
        try {
          logger.debug(`Executing createEvent with params: ${JSON.stringify(args)}`);
          const validatedParams = createEventParamsSchema.parse(args);
          const result = await calendarApi.createEvent(validatedParams);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in createEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `Error: ${error}` }],
            isError: true
          };
        }
      }
    );

    // updateEvent tool
    const updateEventSchema = {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      eventId: z.string().min(1).describe('ID of the event to update (required)'),
      event: z.object({
        summary: z.string().optional().describe('Event title (uses existing value if omitted)'),
        description: z.string().optional().describe('Event description (uses existing value if omitted)'),
        location: z.string().optional().describe('Location (uses existing value if omitted)'),
        start: z.object({
          dateTime: z.string().optional().describe('ISO 8601 format datetime'),
          date: z.string().optional().describe('YYYY-MM-DD format date (for all-day events)'),
          timeZone: z.string().optional().describe('Timezone'),
        }).optional().describe('Start time (uses existing value if omitted)'),
        end: z.object({
          dateTime: z.string().optional().describe('ISO 8601 format datetime'),
          date: z.string().optional().describe('YYYY-MM-DD format date (for all-day events)'),
          timeZone: z.string().optional().describe('Timezone'),
        }).optional().describe('End time (uses existing value if omitted)'),
        colorId: z.string().optional().describe('Event color ID (number 1-11, uses existing value if omitted)'),
      }),
    };

    this.tools['updateEvent'] = updateEventSchema;

    server.tool(
      'updateEvent',
      updateEventSchema,
      async (args, _extra) => {
        try {
          logger.debug(`Executing updateEvent with params: ${JSON.stringify(args)}`);

          // Parameter validation
          const validatedParams = updateEventParamsSchema.parse(args);

          // Get existing event
          const existingEventResponse = await calendarApi.getEvent(
            validatedParams.calendarId || 'primary', 
            validatedParams.eventId
          );

          if (!existingEventResponse.success || !existingEventResponse.data) {
            return {
              content: [{ type: 'text' as const, text: `Error: Existing event not found: ${existingEventResponse.content}` }],
              isError: true
            };
          }

          const existingEvent = existingEventResponse.data;

          // Merge update data with existing data
          // Only update fields explicitly specified in the update data, preserve existing values for others
          const mergedEvent: CalendarEvent = {
            summary: validatedParams.event.summary || existingEvent.summary,
            description: validatedParams.event.description !== undefined 
              ? validatedParams.event.description 
              : existingEvent.description,
            location: validatedParams.event.location !== undefined 
              ? validatedParams.event.location 
              : existingEvent.location,
            start: validatedParams.event.start || existingEvent.start,
            end: validatedParams.event.end || existingEvent.end,
            colorId: validatedParams.event.colorId !== undefined 
              ? validatedParams.event.colorId 
              : existingEvent.colorId,
            // Process other fields similarly
            attendees: validatedParams.event.attendees || existingEvent.attendees,
          };

          const updateParams = {
            calendarId: validatedParams.calendarId,
            eventId: validatedParams.eventId,
            event: mergedEvent
          };

          const result = await calendarApi.updateEvent(updateParams);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in updateEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `Error: ${error}` }],
            isError: true
          };
        }
      }
    );

    // deleteEvent tool
    const deleteEventSchema = {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      eventId: z.string().min(1).describe('ID of the event to delete (required)'),
    };

    this.tools['deleteEvent'] = deleteEventSchema;

    server.tool(
      'deleteEvent',
      deleteEventSchema,
      async (args, _extra) => {
        try {
          logger.debug(`Executing deleteEvent with params: ${JSON.stringify(args)}`);
          const validatedParams = deleteEventParamsSchema.parse(args);
          const result = await calendarApi.deleteEvent(validatedParams);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error(`Error in deleteEvent: ${error}`);
          return {
            content: [{ type: 'text' as const, text: `Error: ${error}` }],
            isError: true
          };
        }
      }
    );

    logger.info('All calendar tools registered successfully');
  }
}

// Export singleton instance
export default new ToolsManager();
