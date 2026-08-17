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
export class UpdateEventHandler extends BaseCalendarToolHandler<typeof updateEventParamsSchema> {
  constructor() {
    super('updateEvent');
  }

  getDescription(): string {
    return 'Update an existing Google Calendar event. Omitted fields keep their current values.';
  }

  /**
   * Define Zod schema
   */
  getSchema(): typeof updateEventParamsSchema {
    // schemas.ts の共通スキーマを使う（従来はここに複製を持っていた）
    return updateEventParamsSchema;
  }

  /**
   * Execute the actual processing
   */
  async execute(params: z.infer<typeof updateEventParamsSchema>, _context: ToolExecutionContext): Promise<unknown> {
    this.logDebug('Executing updateEvent', params);


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