import logger, { LoggerMeta } from '../utils/logger';
import calendarApi from '../calendar/calendar-api';
import { CalendarResource } from '../calendar/types';
import { MCP_RESOURCE_DEFINITIONS, type McpResourceDefinition } from './schemas';

/**
 * MCP resource definition
 */
export interface McpResource {
  name: string;
  description: string;
  uri: string;
  schema?: Record<string, any>;
}

/**
 * Resource response
 */
export interface ResourceResponse {
  resource: {
    uri: string;
    data: CalendarResource | { calendars: CalendarResource[] };
    contents: unknown[];
  };
  [x: string]: unknown;
}

/**
 * MCP resource provider class
 * Manages provision of Google Calendar resources
 */
export class ResourceProvider {
  private readonly resources: McpResource[] = MCP_RESOURCE_DEFINITIONS.map(def => ({
    name: def.name,
    description: def.description,
    uri: def.uri,
    schema: def.schema
  }));

  /**
   * Get list of available resources
   */
  public getResourceList(): { resources: McpResource[] } {
    logger.debug('Providing resource list');
    return { resources: this.resources };
  }

  /**
   * Read specific resource
   */
  public async readResource(uri: string): Promise<ResourceResponse> {
    logger.debug(`Reading resource with URI: ${uri}`);

    try {
      if (uri === 'google-calendar://primary') {
        return await this.readPrimaryCalendar();
      } else if (uri === 'google-calendar://calendars') {
        return await this.readCalendarsList();
      } else {
        throw new Error(`Unsupported resource URI: ${uri}`);
      }
    } catch (error) {
      logger.error(`Error reading resource ${uri}:`, { error } as LoggerMeta);
      throw error;
    }
  }

  /**
   * Read primary calendar information
   */
  private async readPrimaryCalendar(): Promise<ResourceResponse> {
    const result = await calendarApi.getCalendar({ calendarId: 'primary' });

    if (!result.success || !result.data) {
      throw new Error(result.content);
    }

    const calendarData = result.data as CalendarResource;

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
  }

  /**
   * Read calendar list (currently placeholder implementation)
   */
  private async readCalendarsList(): Promise<ResourceResponse> {
    // TODO: Implementation to get multiple calendars via Calendar API
    // Currently returns empty list as placeholder
    logger.warn('Calendar list resource is not fully implemented yet');
    
    return {
      resource: {
        uri: 'google-calendar://calendars',
        data: {
          calendars: []
        },
        contents: []
      }
    };
  }

  /**
   * Check if resource exists
   */
  public isValidResourceUri(uri: string): boolean {
    return this.resources.some(resource => resource.uri === uri);
  }

  /**
   * Get resource statistics
   */
  public getStatistics(): { 
    totalResources: number; 
    supportedUris: string[];
    implementedUris: string[];
    } {
    const implementedUris = ['google-calendar://primary'];
    
    return {
      totalResources: this.resources.length,
      supportedUris: this.resources.map(r => r.uri),
      implementedUris
    };
  }

  /**
   * Add new resource (for extension)
   */
  public addResource(resource: McpResource): void {
    // Check if URI conflicts with existing ones
    if (this.isValidResourceUri(resource.uri)) {
      throw new Error(`Resource with URI ${resource.uri} already exists`);
    }
    
    this.resources.push(resource);
    logger.debug(`Added new resource: ${resource.name} (${resource.uri})`);
  }

  /**
   * Get resource information
   */
  public getResource(uri: string): McpResource | undefined {
    return this.resources.find(resource => resource.uri === uri);
  }
}