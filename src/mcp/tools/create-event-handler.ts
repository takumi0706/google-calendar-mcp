import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { createEventParamsSchema } from '../schemas';
import calendarApi from '../../calendar/calendar-api';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the createEvent tool
 */
export class CreateEventHandler extends BaseCalendarToolHandler {
  constructor() {
    super('createEvent');
  }

  /**
   * Define Zod schema
   */
  getSchema(): z.ZodRawShape {
    return {
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
        recurrence: z.array(z.string()).optional().describe('Recurrence rules in RFC5545 format (examples: ["RRULE:FREQ=DAILY;COUNT=5"], ["RRULE:FREQ=WEEKLY;UNTIL=20250515T000000Z;BYDAY=MO,WE,FR"])'),
      }),
    };
  }

  /**
   * Execute the actual processing
   */
  async execute(validatedArgs: any, _context: ToolExecutionContext): Promise<any> {
    this.logDebug('Executing createEvent', validatedArgs);

    // Re-validate parameters (for safety)
    const params = createEventParamsSchema.parse(validatedArgs);
    
    // Call Calendar API
    const result = await calendarApi.createEvent(params);

    if (!result.success) {
      throw new Error(result.content);
    }

    return result;
  }

  /**
   * Customize success response
   */
  protected createSuccessResponse(result: any, _context: ToolExecutionContext): McpToolResponse {
    if (result.data) {
      return responseBuilder.singleEvent(result.data, 'created');
    }
    return responseBuilder.success(result);
  }
}