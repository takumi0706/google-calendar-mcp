import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import {
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { readResourceRequestSchema } from './schemas';
import toolsManager from './tools';
import calendarApi from '../calendar/calendar-api';
import { processJsonRpcMessage } from '../utils/json-parser';
import { version } from '../../package.json';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private stdioTransport: StdioServerTransport;
  private isRunning = false;

  constructor() {
    // MCP server configuration
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: version,
    });

    // Stdio transport configuration
    this.stdioTransport = new StdioServerTransport();

    // Original message processing will be overridden by setupMessageLogging()
    this.stdioTransport.onmessage = async (_message: JSONRPCMessage): Promise<void> => {};

    // Set up additional listeners for message processing
    this.setupMessageLogging();

    // Register tools (execute first to set the tools property)
    this.registerTools();

    // Implement resources and prompts list functionality (execute after tool registration)
    this.implementResourcesAndPrompts();
  }

  // Helper function for message processing
  // Uses common JSON parsing utility
  private processJsonRpcMessage(message: string): any {
    return processJsonRpcMessage(message);
  }

  private setupMessageLogging(): void {
    // Since there's no direct way to intercept server messages
    // We extend the transport functionality
    const originalSend = this.stdioTransport.send.bind(this.stdioTransport);
    this.stdioTransport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        // Only log to the logger, don't write to stdout
        // Clone the message for logging purposes
        const messageCopy = JSON.parse(JSON.stringify(message));
        logger.debug(`Message from server: ${JSON.stringify(messageCopy)}`);
      } catch (err) {
        logger.error(`Error logging server message: ${err}`);
      }

      try {
        // Ensure the message is a valid JSON object before sending
        // This will remove any special characters or formatting issues
        const cleanMessage = JSON.parse(JSON.stringify(message));
        return await originalSend(cleanMessage);
      } catch (err) {
        logger.error(`Error preparing message for sending: ${err}`);
        // If there's an error, still try to send the original message
        return await originalSend(message);
      }
    };

    // Improve message processing from clients
    const originalOnMessage = this.stdioTransport.onmessage;
    this.stdioTransport.onmessage = async (message: any): Promise<void> => {
      try {
        // If the message is a string, parse it appropriately
        let processedMessage = message;
        if (typeof message === 'string') {
          try {
            // First try standard JSON parsing
            processedMessage = JSON.parse(message);
          } catch (jsonError) {
            // If standard parsing fails, use our robust parser
            logger.debug(`Standard JSON parsing failed, using robust parser: ${jsonError}`);
            processedMessage = this.processJsonRpcMessage(message);
          }
        }

        // Ensure the message is a valid JSON object
        try {
          // Clone the message to ensure it's a plain object
          processedMessage = JSON.parse(JSON.stringify(processedMessage));
        } catch (cloneError) {
          logger.error(`Error cloning message: ${cloneError}`);
          // If cloning fails, continue with the original processed message
        }

        // Clone the message for logging (separate try-catch to avoid affecting the main flow)
        try {
          const messageCopy = JSON.parse(JSON.stringify(processedMessage));
          logger.debug(`Message from client: ${JSON.stringify(messageCopy)}`);
        } catch (logError) {
          logger.error(`Error logging message: ${logError}`);
        }

        if (originalOnMessage) {
          return await originalOnMessage(processedMessage);
        }
      } catch (err) {
        logger.error(`Error processing client message: ${err}`);
      }
    };
  }

  // Implement resources and prompts methods
  private implementResourcesAndPrompts() {
    // Register capabilities (including tools)
    this.server.server.registerCapabilities({
      resources: {},
      prompts: {},
      tools: toolsManager.tools // Explicitly include tools
    });

    // Implement resources/list method
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('Handling resources/list request');
      return { 
        resources: [
          {
            name: 'primary_calendar',
            description: 'User\'s primary Google Calendar',
            uri: 'google-calendar://primary',
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Calendar ID' },
                summary: { type: 'string', description: 'Calendar name' },
                description: { type: 'string', description: 'Calendar description' },
                timeZone: { type: 'string', description: 'Calendar time zone' }
              }
            }
          },
          {
            name: 'user_calendars',
            description: 'List of all calendars accessible to the user',
            uri: 'google-calendar://calendars',
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Calendar ID' },
                  summary: { type: 'string', description: 'Calendar name' },
                  description: { type: 'string', description: 'Calendar description' },
                  timeZone: { type: 'string', description: 'Calendar time zone' },
                  accessRole: { type: 'string', description: 'User\'s access role for this calendar' }
                }
              }
            }
          }
        ] 
      };
    });

    // Implement prompts/list method
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.debug('Handling prompts/list request');
      return { 
        prompts: [
          {
            name: 'view_upcoming_events',
            description: 'Show my upcoming events',
            text: 'Show my upcoming events for the next week'
          },
          {
            name: 'create_meeting',
            description: 'Create a new meeting',
            text: 'Create a meeting titled "Team Sync" tomorrow from 10am to 11am'
          },
          {
            name: 'find_free_time',
            description: 'Find available time slots',
            text: 'Find free time slots in my calendar for next Monday'
          },
          {
            name: 'reschedule_event',
            description: 'Reschedule an existing event',
            text: 'Reschedule my "Dentist Appointment" to next Friday at 2pm'
          },
          {
            name: 'cancel_event',
            description: 'Cancel an existing event',
            text: 'Cancel my meeting scheduled for tomorrow at 3pm'
          }
        ] 
      };
    });

    // Implement resources/read method
    this.server.server.setRequestHandler(readResourceRequestSchema, async (params) => {
      logger.debug(`Handling resources/read request with URI: ${params.params.uri}`);

      try {
        // Parse the URI to determine which resource to retrieve
        const uri = params.params.uri;

        if (uri === 'google-calendar://primary') {
          // Retrieve the primary calendar
          const result = await calendarApi.getCalendar({ calendarId: 'primary' });

          if (!result.success || !result.data) {
            throw new Error(result.content);
          }

          const calendarData = result.data;

          // Return the resource data in the format expected by the client
          return {
            resource: {
              uri: 'google-calendar://primary',
              data: {
                id: calendarData.id,
                summary: calendarData.summary,
                description: calendarData.description,
                timeZone: calendarData.timeZone
              },
              contents: []
            }
          };
        } else if (uri === 'google-calendar://calendars') {
          // For the calendars list resource, we would need to implement a method to retrieve all calendars
          // For now, return a placeholder
          return {
            resource: {
              uri: 'google-calendar://calendars',
              data: {
                calendars: []
              },
              contents: []
            }
          };
        } else {
          throw new Error(`Unsupported resource URI: ${uri}`);
        }
      } catch (error) {
        logger.error(`Error handling resources/read request: ${error}`);
        throw error;
      }
    });

    // Implement tools/list method
    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Handling tools/list request');
      return {
        tools: [
          {
            name: 'getEvents',
            description: 'Get events from Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar if not provided)' },
                timeMin: { type: 'string', description: 'Start time in ISO 8601 format (e.g., 2025-03-01T00:00:00Z)' },
                timeMax: { type: 'string', description: 'End time in ISO 8601 format' },
                maxResults: { type: 'number', description: 'Maximum number of results to return (default 10)' },
                orderBy: { type: 'string', description: 'Order of results (startTime or updated)' },
              },
            },
          },
          {
            name: 'createEvent',
            description: 'Create a new event in Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar if not provided)' },
                event: {
                  type: 'object',
                  properties: {
                    summary: { type: 'string', description: 'Event title (required)' },
                    description: { type: 'string', description: 'Event description' },
                    location: { type: 'string', description: 'Event location' },
                    start: {
                      type: 'object',
                      properties: {
                        dateTime: { type: 'string', description: 'Start time in ISO 8601 format (e.g., 2025-03-15T09:00:00+09:00)' },
                        date: { type: 'string', description: 'Start date in YYYY-MM-DD format (for all-day events)' },
                        timeZone: { type: 'string', description: 'Time zone (e.g., Asia/Tokyo)' },
                      },
                    },
                    end: {
                      type: 'object',
                      properties: {
                        dateTime: { type: 'string', description: 'End time in ISO 8601 format (e.g., 2025-03-15T10:00:00+09:00)' },
                        date: { type: 'string', description: 'End date in YYYY-MM-DD format (for all-day events)' },
                        timeZone: { type: 'string', description: 'Time zone (e.g., Asia/Tokyo)' },
                      },
                    },
                    attendees: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          email: { type: 'string', description: 'Attendee email' },
                          displayName: { type: 'string', description: 'Attendee display name' },
                        },
                      },
                      description: 'List of attendees',
                    },
                    colorId: { type: 'string', description: 'Event color ID (1-11)' },
                  },
                  required: ['summary', 'start', 'end'],
                },
              },
              required: ['event'],
            },
          },
          {
            name: 'updateEvent',
            description: 'Update an existing event in Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar if not provided)' },
                eventId: { type: 'string', description: 'ID of the event to update (required)' },
                event: {
                  type: 'object',
                  properties: {
                    summary: { type: 'string', description: 'Event title' },
                    description: { type: 'string', description: 'Event description' },
                    location: { type: 'string', description: 'Event location' },
                    start: {
                      type: 'object',
                      properties: {
                        dateTime: { type: 'string', description: 'Start time in ISO 8601 format' },
                        date: { type: 'string', description: 'Start date in YYYY-MM-DD format (for all-day events)' },
                        timeZone: { type: 'string', description: 'Time zone' },
                      },
                    },
                    end: {
                      type: 'object',
                      properties: {
                        dateTime: { type: 'string', description: 'End time in ISO 8601 format' },
                        date: { type: 'string', description: 'End date in YYYY-MM-DD format (for all-day events)' },
                        timeZone: { type: 'string', description: 'Time zone' },
                      },
                    },
                    colorId: { type: 'string', description: 'Event color ID (1-11)' },
                  },
                },
              },
              required: ['eventId', 'event'],
            },
          },
          {
            name: 'deleteEvent',
            description: 'Delete an event from Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: { type: 'string', description: 'Calendar ID (defaults to primary calendar if not provided)' },
                eventId: { type: 'string', description: 'ID of the event to delete (required)' },
              },
              required: ['eventId'],
            },
          },
        ],
      };
    });
  }

  private registerTools() {
    // Register tools using ToolsManager
    toolsManager.registerTools(this.server);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      logger.debug('Initializing server...');

      // Connect server to STDIO transport
      await this.server.connect(this.stdioTransport);
      logger.debug('STDIO transport connected');

      // Setup error handling for STDIO transport
      this.stdioTransport.onerror = (error: Error): void => {
        logger.error(`STDIO transport error: ${error}`, { context: 'stdio-transport' });
      };

      this.stdioTransport.onclose = (): void => {
        logger.debug('STDIO transport closed');
        this.isRunning = false;
      };

      logger.debug(`Server started and connected successfully with STDIO transport`);
      this.isRunning = true;
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close STDIO transport via server
      await this.server.close();
      logger.debug('STDIO transport stopped');

      this.isRunning = false;
      logger.debug('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
