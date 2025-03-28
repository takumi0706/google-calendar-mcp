// src/__tests__/utils/html-sanitizer.test.ts
import { escapeHtml } from '../../utils/html-sanitizer';

describe('HTML Sanitizer', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should handle ampersands correctly', () => {
      expect(escapeHtml('This & that')).toBe('This &amp; that');
    });

    it('should handle quotes correctly', () => {
      expect(escapeHtml('Single \' and double " quotes')).toBe('Single &#39; and double &quot; quotes');
    });

    it('should handle non-string inputs by converting to string', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(null)).toBe('null');
      expect(escapeHtml(undefined)).toBe('undefined');
      expect(escapeHtml(true)).toBe('true');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify strings without special characters', () => {
      expect(escapeHtml('Normal text without special chars')).toBe('Normal text without special chars');
    });

    it('should handle complex HTML correctly', () => {
      const input = '<a href="javascript:alert(\'XSS\')" onclick="alert(\'XSS\')">Click me</a>';
      const expected = '&lt;a href=&quot;javascript:alert(&#39;XSS&#39;)&quot; onclick=&quot;alert(&#39;XSS&#39;)&quot;&gt;Click me&lt;/a&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });
});