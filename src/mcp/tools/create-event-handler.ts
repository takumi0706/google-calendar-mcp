import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { createEventParamsSchema } from '../schemas';
import calendarApi from '../../calendar/calendar-api';
import type { SingleEventResponse } from '../../calendar/types';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the createEvent tool
 */
export class CreateEventHandler extends BaseCalendarToolHandler<typeof createEventParamsSchema, SingleEventResponse> {
  constructor() {
    super('createEvent');
  }

  getDescription(): string {
    return 'Create an event on a Google Calendar. Supports all-day events, attendees, reminders and RFC5545 recurrence rules.';
  }

  /**
   * Define Zod schema
   */
  getSchema(): typeof createEventParamsSchema {
    // schemas.ts の共通スキーマを使う。以前はここに独自の複製を持っており、
    // 文字数上限・reminders・attendees の検証が抜け落ちていたうえ、
    // execute() 側で共通スキーマによる再パースが走っていた。
    return createEventParamsSchema;
  }

  /**
   * Execute the actual processing
   */
  async execute(params: z.infer<typeof createEventParamsSchema>, _context: ToolExecutionContext): Promise<SingleEventResponse> {
    this.logDebug('Executing createEvent', params);

    
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
  protected createSuccessResponse(result: SingleEventResponse, _context: ToolExecutionContext): McpToolResponse {
    if (result.data) {
      return responseBuilder.singleEvent(result.data, 'created');
    }
    return responseBuilder.success(result);
  }
}