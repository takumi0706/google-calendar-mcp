import {
  getEventsSchema,
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
} from '../mcp/schemas';

// テスト環境を設定
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

describe('Schemas', () => {
  describe('getEventsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        calendarId: 'primary',
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-12-31T23:59:59Z',
        maxResults: 10,
        orderBy: 'startTime' as const,
      };

      expect(() => getEventsSchema.parse(validParams)).not.toThrow();
    });

    it('should allow empty params', () => {
      expect(() => getEventsSchema.parse({})).not.toThrow();
    });
  });

  describe('createEventSchema', () => {
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

      expect(() => createEventSchema.parse(validParams)).not.toThrow();
    });

    it('should require event', () => {
      expect(() => createEventSchema.parse({})).toThrow();
    });

    it('should require summary in event', () => {
      const invalidParams = {
        event: {
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => createEventSchema.parse(invalidParams)).toThrow();
    });
  });

  describe('updateEventSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        eventId: '123456',
        event: {
          summary: 'Updated Event',
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => updateEventSchema.parse(validParams)).not.toThrow();
    });

    it('should require eventId', () => {
      const invalidParams = {
        event: {
          summary: 'Updated Event',
          start: { dateTime: '2025-03-15T09:00:00+09:00' },
          end: { dateTime: '2025-03-15T10:00:00+09:00' },
        },
      };

      expect(() => updateEventSchema.parse(invalidParams)).toThrow();
    });
  });

  describe('deleteEventSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        eventId: '123456',
      };

      expect(() => deleteEventSchema.parse(validParams)).not.toThrow();
    });

    it('should require eventId', () => {
      expect(() => deleteEventSchema.parse({})).toThrow();
    });
  });
});