import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { updateEventParamsSchema } from '../schemas';
import { CalendarEvent } from '../../calendar/types';
import calendarApi from '../../calendar/calendar-api';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the updateEvent tool
 */
export class UpdateEventHandler extends BaseCalendarToolHandler {
  constructor() {
    super('updateEvent');
  }

  /**
   * Define Zod schema
   */
  getSchema(): z.ZodRawShape {
    return {
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
        recurrence: z.array(z.string()).optional().describe('Recurrence rules in RFC5545 format (examples: ["RRULE:FREQ=DAILY;COUNT=5"], ["RRULE:FREQ=WEEKLY;UNTIL=20250515T000000Z;BYDAY=MO,WE,FR"])'),
      }),
    };
  }

  /**
   * Execute the actual processing
   */
  async execute(validatedArgs: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    this.logDebug('Executing updateEvent', validatedArgs);

    // Validate parameters
    const params = updateEventParamsSchema.parse(validatedArgs);

    // Get existing event
    const existingEventResponse = await calendarApi.getEvent(
      params.calendarId || 'primary', 
      params.eventId
    );

    if (!existingEventResponse.success || !existingEventResponse.data) {
      throw new Error(`Existing event not found: ${existingEventResponse.content}`);
    }

    const existingEvent = existingEventResponse.data as CalendarEvent;

    // Merge update data with existing data
    const mergedEvent: CalendarEvent = {
      summary: params.event.summary || existingEvent.summary,
      description: params.event.description !== undefined 
        ? params.event.description 
        : existingEvent.description,
      location: params.event.location !== undefined 
        ? params.event.location 
        : existingEvent.location,
      start: params.event.start || existingEvent.start,
      end: params.event.end || existingEvent.end,
      colorId: params.event.colorId !== undefined 
        ? params.event.colorId 
        : existingEvent.colorId,
      recurrence: params.event.recurrence !== undefined 
        ? params.event.recurrence 
        : existingEvent.recurrence,
      attendees: params.event.attendees || existingEvent.attendees,
    };

    const updateParams = {
      calendarId: params.calendarId,
      eventId: params.eventId,
      event: mergedEvent
    };

    // Call Calendar API
    const result = await calendarApi.updateEvent(updateParams);

    if (!result.success) {
      throw new Error(result.content);
    }

    return result;
  }

  /**
   * Customize success response
   */
  protected createSuccessResponse(result: unknown, _context: ToolExecutionContext): McpToolResponse {
    const apiResult = result as { data?: CalendarEvent };
    if (apiResult.data) {
      return responseBuilder.singleEvent(apiResult.data, 'updated');
    }
    return responseBuilder.success(result);
  }
}