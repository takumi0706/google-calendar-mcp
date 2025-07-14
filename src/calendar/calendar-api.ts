import { calendar_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import oauthAuth from '../auth/oauth-auth';
import logger from '../utils/logger';
import {
  CalendarApiResponse,
  CreateEventParams,
  DeleteEventParams,
  GetEventsParams,
  UpdateEventParams,
  GetCalendarParams,
} from './types';

/**
 * Cached client entry with authentication status
 */
interface CachedClientEntry {
  client: calendar_v3.Calendar;
  lastValidated: number;
  authHash: string;
}

class GoogleCalendarApi {
  private calendar: calendar_v3.Calendar | null = null;
  private cachedClients: Map<string, CachedClientEntry> = new Map();
  private readonly CLIENT_CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHED_CLIENTS = 5;
  private authenticationInProgress = false;

  /**
   * Get authentication hash for caching
   */
  private getAuthHash(auth: OAuth2Client): string {
    const credentials = auth.credentials;
    return `${credentials.access_token?.substring(0, 16) || 'no-token'}:${credentials.expiry_date || 0}`;
  }

  /**
   * Initialize Calendar API client with caching
   */
  private async initCalendarClient(): Promise<calendar_v3.Calendar> {
    try {
      // Prevent concurrent authentication
      if (this.authenticationInProgress) {
        // Wait for authentication to complete
        while (this.authenticationInProgress) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Try again after authentication completes
        return this.initCalendarClient();
      }

      // Quick check for existing valid calendar client
      if (this.calendar) {
        const auth = await oauthAuth.getAuthenticatedClientSafe();
        if (auth) {
          const authHash = this.getAuthHash(auth);
          const cached = this.cachedClients.get(authHash);
          
          if (cached && Date.now() - cached.lastValidated < this.CLIENT_CACHE_TTL) {
            this.calendar = cached.client;
            return this.calendar;
          }
        }
      }

      // Get authenticated client
      this.authenticationInProgress = true;
      const authResult = await oauthAuth.getAuthenticatedClientSafe();
      
      if (!authResult) {
        throw new Error('Authentication required. Please run the "authenticate" tool first.');
      }
      
      const auth = authResult;

      const client = this.getOrCreateCachedClient(auth);
      this.calendar = client;
      
      return client;
    } catch (error) {
      logger.error(`Failed to initialize Calendar API client: ${error}`);
      throw error;
    } finally {
      this.authenticationInProgress = false;
    }
  }

  /**
   * Get or create cached client
   */
  private getOrCreateCachedClient(auth: OAuth2Client): calendar_v3.Calendar {
    const authHash = this.getAuthHash(auth);
    const cached = this.cachedClients.get(authHash);
    
    if (cached && Date.now() - cached.lastValidated < this.CLIENT_CACHE_TTL) {
      cached.lastValidated = Date.now();
      return cached.client;
    }

    // Create new client
    const client = google.calendar({ version: 'v3', auth });
    
    // Cache management
    if (this.cachedClients.size >= this.MAX_CACHED_CLIENTS) {
      // Remove oldest entry
      const oldestKey = Array.from(this.cachedClients.keys())[0];
      this.cachedClients.delete(oldestKey);
    }
    
    this.cachedClients.set(authHash, {
      client,
      lastValidated: Date.now(),
      authHash
    });
    
    return client;
  }

  /**
   * Clear cached clients
   */
  public clearClientCache(): void {
    this.cachedClients.clear();
    this.calendar = null;
  }

  /**
   * Cleanup all resources to prevent memory leaks
   */
  public destroy(): void {
    this.clearClientCache();
    this.authenticationInProgress = false;
  }

  /**
   * Get list of events with retry logic
   */
  async getEvents(params: GetEventsParams): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();
        const calendarId = params.calendarId || 'primary';

        const response = await calendar.events.list({
          calendarId,
          timeMin: params.timeMin || new Date().toISOString(),
          timeMax: params.timeMax,
          maxResults: params.maxResults || 10,
          singleEvents: true,
          orderBy: params.orderBy || 'startTime',
        });

        const events = response.data.items;
        return {
          success: true,
          content: `Retrieved ${events?.length || 0} events.`,
          data: events,
        };
      } catch (error) {
        lastError = error;
        
        // If authentication error, clear cache and retry
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          logger.warn(`Authentication error on attempt ${attempt + 1}, clearing cache and retrying`);
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error getting events after ${maxRetries + 1} attempts: ${lastError}`);
    return {
      success: false,
      content: `Failed to retrieve events: ${lastError}`,
    };
  }

  /**
   * Check if error is authentication related
   */
  private isAuthenticationError(error: any): boolean {
    const errorStr = String(error).toLowerCase();
    return errorStr.includes('auth') || 
           errorStr.includes('unauthorized') || 
           errorStr.includes('token') ||
           errorStr.includes('credential');
  }

  /**
   * Get a single event by ID with retry logic
   */
  async getEvent(calendarId: string = 'primary', eventId: string): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();

        const response = await calendar.events.get({
          calendarId,
          eventId,
        });

        const event = response.data;
        return {
          success: true,
          content: `Retrieved event "${event.summary}".`,
          data: event,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error getting event: ${lastError}`);
    return {
      success: false,
      content: `Failed to retrieve event: ${lastError}`,
    };
  }

  /**
   * Create a new event with retry logic
   */
  async createEvent(params: CreateEventParams): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();
        const calendarId = params.calendarId || 'primary';

        const response = await calendar.events.insert({
          calendarId,
          requestBody: params.event as any,
        });

        const createdEvent = response.data;
        return {
          success: true,
          content: `Created event "${createdEvent.summary}".`,
          data: createdEvent,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error creating event: ${lastError}`);
    return {
      success: false,
      content: `Failed to create event: ${lastError}`,
    };
  }

  /**
   * Update an existing event with retry logic
   */
  async updateEvent(params: UpdateEventParams): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();
        const calendarId = params.calendarId || 'primary';

        const response = await calendar.events.update({
          calendarId,
          eventId: params.eventId,
          requestBody: params.event as any,
        });

        const updatedEvent = response.data;
        return {
          success: true,
          content: `Updated event "${updatedEvent.summary}".`,
          data: updatedEvent,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error updating event: ${lastError}`);
    return {
      success: false,
      content: `Failed to update event: ${lastError}`,
    };
  }

  /**
   * Delete an event with retry logic
   */
  async deleteEvent(params: DeleteEventParams): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();
        const calendarId = params.calendarId || 'primary';

        await calendar.events.delete({
          calendarId,
          eventId: params.eventId,
        });

        return {
          success: true,
          content: `Event deleted successfully.`,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error deleting event: ${lastError}`);
    return {
      success: false,
      content: `Failed to delete event: ${lastError}`,
    };
  }

  /**
   * Get calendar resource with retry logic
   */
  async getCalendar(params: GetCalendarParams): Promise<CalendarApiResponse> {
    const maxRetries = 2;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const calendar = await this.initCalendarClient();
        const calendarId = params.calendarId;

        const response = await calendar.calendars.get({
          calendarId,
        });

        const calendarResource = response.data;
        return {
          success: true,
          content: `Retrieved calendar "${calendarResource.summary}".`,
          data: calendarResource,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isAuthenticationError(error)) {
          this.clearClientCache();
          continue;
        }
        
        break;
      }
    }
    
    logger.error(`Error getting calendar: ${lastError}`);
    return {
      success: false,
      content: `Failed to retrieve calendar: ${lastError}`,
    };
  }
  /**
   * Get API statistics
   */
  public getStatistics(): {
    cachedClients: number;
    hasActiveClient: boolean;
    authInProgress: boolean;
    lastAuthTime: number | null;
    } {
    let lastAuthTime = null;
    if (this.cachedClients.size > 0) {
      const entries = Array.from(this.cachedClients.values());
      lastAuthTime = Math.max(...entries.map(e => e.lastValidated));
    }
    
    return {
      cachedClients: this.cachedClients.size,
      hasActiveClient: this.calendar !== null,
      authInProgress: this.authenticationInProgress,
      lastAuthTime
    };
  }
}

export default new GoogleCalendarApi();
