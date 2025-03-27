// jest型定義は自動的に利用されるため、明示的なインポートは不要
import {
  getEventsParamsSchema,
  createEventParamsSchema,
  updateEventParamsSchema,
  deleteEventParamsSchema,
  eventSchema
} from '../mcp/schemas';

// テスト環境を設定
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

describe('Schemas', () => {
  describe('getEventsParamsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        calendarId: 'primary',
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-12-31T23:59:59Z',
        maxResults: 10,
        orderBy: 'startTime' as const,
      };

      expect(() => getEventsParamsSchema.parse(validParams)).not.toThrow();
    });

    it('should allow empty params', () => {
      expect(() => getEventsParamsSchema.parse({})).not.toThrow();
    });
  });

  describe('createEventParamsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        calendarId: 'primary',
        event: {
          summary: 'Test Event',
          description: 'Test Description',
          start: {
            dateTime: '2025-03-15T09:00:00+09:00',
          },
          end: {
            dateTime: '2025-03-15T10:00:00+09:00',
          },
        },
      };

      expect(() => createEventParamsSchema.parse(validParams)).not.toThrow();
    });

    it('should require event', () => {
      expect(() => createEventParamsSchema.parse({})).toThrow();
    });

    it('should require summary in event', () => {
      const invalidParams = {
        event: {
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => createEventParamsSchema.parse(invalidParams)).toThrow();
    });
  });

  describe('updateEventParamsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        eventId: '123456',
        event: {
          summary: 'Updated Event',
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => updateEventParamsSchema.parse(validParams)).not.toThrow();
    });

    it('should require eventId', () => {
      const invalidParams = {
        event: {
          summary: 'Updated Event',
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => updateEventParamsSchema.parse(invalidParams)).toThrow();
    });
  });

  describe('deleteEventParamsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        eventId: '123456',
      };

      expect(() => deleteEventParamsSchema.parse(validParams)).not.toThrow();
    });

    it('should require eventId', () => {
      expect(() => deleteEventParamsSchema.parse({})).toThrow();
    });
  });
});