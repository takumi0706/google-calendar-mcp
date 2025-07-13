import { McpToolResponse } from './error-handler';
import { CalendarEvent, CalendarResource } from '../calendar/types';

/**
 * Unified MCP tool response generation class (Singleton)
 */
class ResponseBuilder {
  private static instance: ResponseBuilder;

  private constructor() {}

  public static getInstance(): ResponseBuilder {
    if (!ResponseBuilder.instance) {
      ResponseBuilder.instance = new ResponseBuilder();
    }
    return ResponseBuilder.instance;
  }

  /**
   * Generate success response
   */
  public success(data: unknown, message?: string): McpToolResponse {
    let responseText: string;

    if (message) {
      responseText = `${message}\n\n${JSON.stringify(data, null, 2)}`;
    } else {
      responseText = JSON.stringify(data, null, 2);
    }

    return {
      content: [{ type: 'text', text: responseText }]
    };
  }

  /**
   * Calendar event list specific response
   */
  public eventsList(events: unknown[], message?: string): McpToolResponse {
    const count = events?.length || 0;
    const defaultMessage = `Retrieved ${count} events.`;
    const finalMessage = message || defaultMessage;

    return this.success({ events, count }, finalMessage);
  }

  /**
   * Single event specific response
   */
  public singleEvent(event: CalendarEvent, action: 'created' | 'updated' | 'retrieved' = 'retrieved'): McpToolResponse {
    const actionMessages = {
      created: 'Event created',
      updated: 'Event updated',
      retrieved: 'Event retrieved'
    };

    const message = `${actionMessages[action]}: "${event?.summary || 'No title'}"`;
    return this.success(event, message);
  }

  /**
   * Delete operation specific response
   */
  public deleteSuccess(resourceType: string = 'Resource'): McpToolResponse {
    return {
      content: [{ type: 'text', text: `${resourceType} successfully deleted.` }]
    };
  }

  /**
   * Authentication success response
   */
  public authSuccess(): McpToolResponse {
    return {
      content: [{ 
        type: 'text', 
        text: 'Google Calendar authentication completed. You can now use calendar tools (getEvents, createEvent, updateEvent, deleteEvent).' 
      }]
    };
  }

  /**
   * Already authenticated state response
   */
  public alreadyAuthenticated(): McpToolResponse {
    return {
      content: [{ 
        type: 'text', 
        text: 'Already authenticated with Google Calendar. You can use calendar tools (getEvents, createEvent, updateEvent, deleteEvent).' 
      }]
    };
  }

  /**
   * Calendar resource specific response
   */
  public calendarResource(calendar: CalendarResource): McpToolResponse {
    const message = `Calendar information retrieved: "${calendar?.summary || 'No title'}"`;
    return this.success(calendar, message);
  }

  /**
   * Configuration format success response
   */
  public configurationSuccess(config: Record<string, unknown>): McpToolResponse {
    return this.success(config, 'Configuration successfully applied.');
  }

  /**
   * Process start notification response
   */
  public processStarted(processName: string, details?: string): McpToolResponse {
    let message = `${processName} started.`;
    if (details) {
      message += ` ${details}`;
    }

    return {
      content: [{ type: 'text', text: message }]
    };
  }

  /**
   * Progress response
   */
  public progress(current: number, total: number, action: string): McpToolResponse {
    const percentage = Math.round((current / total) * 100);
    const message = `${action} in progress... (${current}/${total} - ${percentage}%)`;

    return {
      content: [{ type: 'text', text: message }]
    };
  }

  /**
   * Custom message response
   */
  public message(text: string): McpToolResponse {
    return {
      content: [{ type: 'text', text }]
    };
  }

  /**
   * Multiple items summary response
   */
  public summary(items: Array<{ name: string; status: string; details?: string }>): McpToolResponse {
    const summaryText = items.map(item => 
      `- ${item.name}: ${item.status}${item.details ? ` (${item.details})` : ''}`
    ).join('\n');

    return {
      content: [{ type: 'text', text: `Processing results:\n${summaryText}` }]
    };
  }

  /**
   * Data statistics response
   */
  public statistics(stats: Record<string, number | string>): McpToolResponse {
    const statsText = Object.entries(stats)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return this.success(stats, `Statistics:\n${statsText}`);
  }
}

// Export singleton instance
export const responseBuilder = ResponseBuilder.getInstance();
export default responseBuilder;