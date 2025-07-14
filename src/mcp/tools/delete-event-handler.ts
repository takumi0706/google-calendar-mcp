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
export class DeleteEventHandler extends BaseCalendarToolHandler {
  constructor() {
    super('deleteEvent');
  }

  /**
   * Define Zod schema
   */
  getSchema(): z.ZodRawShape {
    return {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      eventId: z.string().min(1).describe('ID of the event to delete (required)'),
    };
  }

  /**
   * Execute the actual processing
   */
  async execute(validatedArgs: any, _context: ToolExecutionContext): Promise<any> {
    this.logDebug('Executing deleteEvent', validatedArgs);

    // Re-validate parameters (for safety)
    const params = deleteEventParamsSchema.parse(validatedArgs);
    
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