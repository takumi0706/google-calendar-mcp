import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { getEventsParamsSchema } from '../schemas';
import calendarApi from '../../calendar/calendar-api';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the getEvents tool
 */
export class GetEventsHandler extends BaseCalendarToolHandler {
  constructor() {
    super('getEvents');
  }

  /**
   * Define Zod schema
   */
  getSchema(): z.ZodRawShape {
    return {
      calendarId: z.string().optional().describe('Calendar ID (uses primary calendar if omitted)'),
      timeMin: z.string().optional().describe('Start time for event retrieval (ISO 8601 format. Example: 2025-03-01T00:00:00Z)'),
      timeMax: z.string().optional().describe('End time for event retrieval (ISO 8601 format)'),
      maxResults: z.number().int().positive().optional().describe('Maximum number of events to retrieve (default: 10)'),
      orderBy: z.enum(['startTime', 'updated']).optional().describe('Sort order (startTime: by start time, updated: by update time)'),
    };
  }

  /**
   * Execute the actual processing
   */
  async execute(validatedArgs: any, _context: ToolExecutionContext): Promise<any> {
    this.logDebug('Executing getEvents', validatedArgs);

    // Re-validate parameters (for safety)
    const params = getEventsParamsSchema.parse(validatedArgs);
    
    // Call Calendar API
    const result = await calendarApi.getEvents(params);

    if (!result.success) {
      throw new Error(result.content);
    }

    return result;
  }

  /**
   * Customize success response
   */
  protected createSuccessResponse(result: any, _context: ToolExecutionContext): McpToolResponse {
    if (result.data && Array.isArray(result.data)) {
      return responseBuilder.eventsList(result.data, result.content);
    }
    return responseBuilder.success(result);
  }
}