/**
 * Tests for empty string argument handling in MCP tools
 * Ensures getEvents and other tools handle empty parameters correctly
 */

import { getEventsParamsSchema } from '../../mcp/schemas';

describe('Empty Arguments Handling', () => {
  describe('getEventsParamsSchema', () => {
    it('should handle empty strings correctly', () => {
      const params = {
        calendarId: '',
        timeMin: '',
        timeMax: '',
        maxResults: 10,
        orderBy: ''
      };

      const result = getEventsParamsSchema.parse(params);
      
      // Empty calendarId should use default
      expect(result.calendarId).toBe('primary');
      
      // Empty timeMin/timeMax should be undefined
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      
      // maxResults should be preserved
      expect(result.maxResults).toBe(10);
      
      // Empty orderBy should use default
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle completely empty object', () => {
      const result = getEventsParamsSchema.parse({});
      
      expect(result.calendarId).toBe('primary');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      expect(result.maxResults).toBe(10);
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle valid ISO 8601 dates', () => {
      const params = {
        timeMin: '2023-12-01T00:00:00Z',
        timeMax: '2023-12-31T23:59:59Z',
        orderBy: 'updated'
      };

      const result = getEventsParamsSchema.parse(params);
      
      expect(result.timeMin).toBe('2023-12-01T00:00:00Z');
      expect(result.timeMax).toBe('2023-12-31T23:59:59Z');
      expect(result.orderBy).toBe('updated');
    });

    it('should reject invalid ISO 8601 dates', () => {
      const params = {
        timeMin: 'invalid-date'
      };

      expect(() => getEventsParamsSchema.parse(params)).toThrow('timeMin must be in ISO 8601 format');
    });

    it('should handle null and undefined values', () => {
      const params = {
        calendarId: null,
        timeMin: undefined,
        timeMax: null,
        orderBy: undefined
      };

      const result = getEventsParamsSchema.parse(params);
      
      expect(result.calendarId).toBe('primary');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle mixed empty and valid values', () => {
      const params = {
        calendarId: 'my-calendar@gmail.com',
        timeMin: '',
        timeMax: '2023-12-31T23:59:59Z',
        maxResults: 50,
        orderBy: ''
      };

      const result = getEventsParamsSchema.parse(params);
      
      expect(result.calendarId).toBe('my-calendar@gmail.com');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBe('2023-12-31T23:59:59Z');
      expect(result.maxResults).toBe(50);
      expect(result.orderBy).toBe('startTime');
    });
  });
});