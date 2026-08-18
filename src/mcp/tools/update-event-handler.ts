import { z } from 'zod';
import { BaseCalendarToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { updateEventParamsSchema } from '../schemas';
import type {
  CalendarEvent,
  EventAttendee,
  EventDateTime,
  GoogleCalendarEvent,
  SingleEventResponse,
} from '../../calendar/types';
import calendarApi from '../../calendar/calendar-api';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Google API の日時表現を自前の EventDateTime へ読み替える。
 * API 側は null を返しうるが、こちらは undefined で「未指定」を表す。
 */
function toEventDateTime(
  value: GoogleCalendarEvent['start']
): EventDateTime | undefined {
  if (!value) {
    return undefined;
  }

  const converted: EventDateTime = {};

  if (value.dateTime) {
    converted.dateTime = value.dateTime;
  }
  if (value.date) {
    converted.date = value.date;
  }
  if (value.timeZone) {
    converted.timeZone = value.timeZone;
  }

  return converted.dateTime || converted.date ? converted : undefined;
}

/**
 * Google API の参加者表現を自前の EventAttendee へ読み替える。
 * email を持たないエントリ（リソース等）は落とす。
 */
function toAttendees(
  value: GoogleCalendarEvent['attendees']
): EventAttendee[] | undefined {
  if (!value) {
    return undefined;
  }

  const converted = value.flatMap((attendee) =>
    attendee.email
      ? [
          {
            email: attendee.email,
            ...(attendee.displayName ? { displayName: attendee.displayName } : {}),
            ...(attendee.optional === true ? { optional: true } : {}),
          },
        ]
      : []
  );

  return converted.length > 0 ? converted : undefined;
}

/**
 * Handler for the updateEvent tool
 */
export class UpdateEventHandler extends BaseCalendarToolHandler<
  typeof updateEventParamsSchema,
  SingleEventResponse
> {
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
  async execute(params: z.infer<typeof updateEventParamsSchema>, _context: ToolExecutionContext): Promise<SingleEventResponse> {
    this.logDebug('Executing updateEvent', params);


    // Get existing event
    const existingEventResponse = await calendarApi.getEvent(
      params.calendarId || 'primary', 
      params.eventId
    );

    if (!existingEventResponse.success || !existingEventResponse.data) {
      throw new Error(`Existing event not found: ${existingEventResponse.content}`);
    }

    const existingEvent = existingEventResponse.data;

    // Merge update data with existing data.
    // Google API の Schema$Event は全フィールドが optional かつ null を取りうるので、
    // 型アサーションではなく明示的に読み替える。必須項目が欠けていれば
    // ここで失敗させる（以前は as CalendarEvent で潰していた）。
    const summary = params.event.summary ?? existingEvent.summary ?? undefined;
    const start = params.event.start ?? toEventDateTime(existingEvent.start);
    const end = params.event.end ?? toEventDateTime(existingEvent.end);

    if (!summary || !start || !end) {
      throw new Error(
        `Cannot update event ${params.eventId}: the existing event is missing a summary, start or end.`
      );
    }

    const mergedEvent: CalendarEvent = {
      summary,
      description: params.event.description ?? existingEvent.description ?? undefined,
      location: params.event.location ?? existingEvent.location ?? undefined,
      start,
      end,
      colorId: params.event.colorId ?? existingEvent.colorId ?? undefined,
      recurrence: params.event.recurrence ?? existingEvent.recurrence ?? undefined,
      attendees: params.event.attendees ?? toAttendees(existingEvent.attendees),
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
  protected createSuccessResponse(
    result: SingleEventResponse,
    _context: ToolExecutionContext
  ): McpToolResponse {
    if (result.data) {
      return responseBuilder.singleEvent(result.data, 'updated');
    }
    return responseBuilder.success(result);
  }
}