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
   * Define Zod schema using the shared schema
   */
  getSchema(): z.ZodRawShape {
    // Use the shared schema from schemas.ts but extract its shape for consistency
    return getEventsParamsSchema.shape;
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