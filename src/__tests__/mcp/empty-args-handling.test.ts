/**
 * Tests for empty string argument handling in MCP tools
 *
 * MCP クライアントは「値なし」を空文字や null で送ってくることがある。
 * 実際の経路は normalizeToolArgs で正規化してから Zod で検証する二段構えなので、
 * ここではその組み合わせをそのままテストする。
 *
 * 以前はスキーマ側の union（z.undefined() を含む）が空文字を吸収していたが、
 * z.undefined() は JSON Schema で表現できず tools/list が
 * "Undefined cannot be represented in JSON Schema" で失敗するため、
 * 正規化を normalizeToolArgs に集約した。
 */

import { getEventsParamsSchema } from '../../mcp/schemas';
import { normalizeToolArgs } from '../../mcp/base-tool-handler';

/** 実際の検証パイプラインと同じ順序で処理する */
function parseGetEventsArgs(args: Record<string, unknown>) {
  return getEventsParamsSchema.parse(normalizeToolArgs(args));
}

describe('Empty Arguments Handling', () => {
  describe('getEvents argument pipeline', () => {
    it('should handle empty strings correctly', () => {
      const result = parseGetEventsArgs({
        calendarId: '',
        timeMin: '',
        timeMax: '',
        maxResults: 10,
        orderBy: '',
      });

      expect(result.calendarId).toBe('primary');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      expect(result.maxResults).toBe(10);
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle completely empty object', () => {
      const result = parseGetEventsArgs({});

      expect(result.calendarId).toBe('primary');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      expect(result.maxResults).toBe(10);
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle valid ISO 8601 dates', () => {
      const result = parseGetEventsArgs({
        timeMin: '2023-12-01T00:00:00Z',
        timeMax: '2023-12-31T23:59:59Z',
        orderBy: 'updated',
      });

      expect(result.timeMin).toBe('2023-12-01T00:00:00Z');
      expect(result.timeMax).toBe('2023-12-31T23:59:59Z');
      expect(result.orderBy).toBe('updated');
    });

    it('should reject invalid ISO 8601 dates', () => {
      expect(() => parseGetEventsArgs({ timeMin: 'invalid-date' })).toThrow(
        'timeMin must be in ISO 8601 format'
      );
    });

    it('should handle null and undefined values', () => {
      const result = parseGetEventsArgs({
        calendarId: null,
        timeMin: undefined,
        timeMax: null,
        orderBy: undefined,
      });

      expect(result.calendarId).toBe('primary');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBeUndefined();
      expect(result.orderBy).toBe('startTime');
    });

    it('should handle mixed empty and valid values', () => {
      const result = parseGetEventsArgs({
        calendarId: 'my-calendar@gmail.com',
        timeMin: '',
        timeMax: '2023-12-31T23:59:59Z',
        maxResults: 50,
        orderBy: '',
      });

      expect(result.calendarId).toBe('my-calendar@gmail.com');
      expect(result.timeMin).toBeUndefined();
      expect(result.timeMax).toBe('2023-12-31T23:59:59Z');
      expect(result.maxResults).toBe(50);
      expect(result.orderBy).toBe('startTime');
    });

    it('should drop whitespace-only values', () => {
      const result = parseGetEventsArgs({ calendarId: '   ', orderBy: '\t' });

      expect(result.calendarId).toBe('primary');
      expect(result.orderBy).toBe('startTime');
    });
  });

  describe('normalizeToolArgs', () => {
    it('coerces a string maxResults into a number', () => {
      expect(normalizeToolArgs({ maxResults: '25' })).toEqual({ maxResults: 25 });
    });

    it('drops an unparseable maxResults so the schema default applies', () => {
      expect(normalizeToolArgs({ maxResults: 'many' })).toEqual({});
      expect(parseGetEventsArgs({ maxResults: 'many' }).maxResults).toBe(10);
    });

    it('drops a non-positive maxResults', () => {
      expect(normalizeToolArgs({ maxResults: '0' })).toEqual({});
      expect(normalizeToolArgs({ maxResults: '-5' })).toEqual({});
    });

    it('keeps values that are legitimately falsy but meaningful', () => {
      expect(normalizeToolArgs({ count: 0, flag: false })).toEqual({ count: 0, flag: false });
    });
  });
});
