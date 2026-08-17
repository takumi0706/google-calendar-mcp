import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { deleteEventParamsSchema } from '../schemas';
import calendarApi from '../../calendar/calendar-api';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the deleteEvent tool
 */
export class DeleteEventHandler extends BaseCalendarToolHandler<typeof deleteEventParamsSchema> {
  constructor() {
    super('deleteEvent');
  }

  getDescription(): string {
    return 'Delete an event from a Google Calendar by its event ID.';
  }

  /**
   * Define Zod schema
   */
  getSchema(): typeof deleteEventParamsSchema {
    return deleteEventParamsSchema;
  }

  /**
   * Execute the actual processing
   */
  async execute(params: z.infer<typeof deleteEventParamsSchema>, _context: ToolExecutionContext): Promise<unknown> {
    this.logDebug('Executing deleteEvent', params);

    
    // Call Calendar API
    const result = await calendarApi.deleteEvent(params);

    if (!result.success) {
      throw new Error(result.content);
    }

    return result;
  }

  /**
   * Customize success response
   */
  protected createSuccessResponse(_result: any, _context: ToolExecutionContext): McpToolResponse {
    return responseBuilder.deleteSuccess('Event');
  }
}