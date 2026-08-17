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
export class GetEventsHandler extends BaseCalendarToolHandler<typeof getEventsParamsSchema> {
  constructor() {
    super('getEvents');
  }

  getDescription(): string {
    return 'List events from a Google Calendar within an optional time range.';
  }

  /**
   * Define Zod schema using the shared schema
   */
  getSchema(): typeof getEventsParamsSchema {
    return getEventsParamsSchema;
  }

  /**
   * Execute the actual processing
   */
  async execute(params: z.infer<typeof getEventsParamsSchema>, _context: ToolExecutionContext): Promise<unknown> {
    this.logDebug('Executing getEvents', params);

    
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