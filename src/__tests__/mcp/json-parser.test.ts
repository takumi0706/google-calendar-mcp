import { processJsonRpcMessage } from '../../utils/json-parser';

// Mock the logger to prevent console output during tests
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}));

describe('JSON-RPC Message Parser', () => {
  describe('processJsonRpcMessage', () => {
    // Test case 1: Valid JSON object
    it('should parse a valid JSON object correctly', () => {
      const validJson = '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05"},"id":0}';
      const result = processJsonRpcMessage(validJson);
      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 0
      });
    });

    // Test case 2: Valid JSON array
    it('should parse a valid JSON array correctly', () => {
      const validJsonArray = '[{"id":1,"name":"test1"},{"id":2,"name":"test2"}]';
      const result = processJsonRpcMessage(validJsonArray);
      expect(result).toEqual([
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' }
      ]);
    });

    // Test case 3: JSON with leading whitespace
    it('should handle JSON with leading whitespace', () => {
      const jsonWithWhitespace = '   \n  {"jsonrpc":"2.0","method":"test","id":1}';
      const result = processJsonRpcMessage(jsonWithWhitespace);
      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      });
    });

    // Test case 4: JSON with BOM character
    it('should handle JSON with BOM character', () => {
      const jsonWithBOM = '\uFEFF{"jsonrpc":"2.0","method":"test","id":1}';
      const result = processJsonRpcMessage(jsonWithBOM);
      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      });
    });

    // Test case 5: JSON embedded in other text (simulating the error case)
    it('should extract JSON from text with non-JSON content before it', () => {
      const mixedContent = 'Some random text {"jsonrpc":"2.0","method":"test","id":1} and more text';
      const result = processJsonRpcMessage(mixedContent);
      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      });
    });

    // Test case 6: The specific error case mentioned in the issue
    it('should handle the specific error case with non-whitespace character at position 4', () => {
      const problematicJson = 'abc\t{"jsonrpc":"2.0","method":"test","id":1}';
      const result = processJsonRpcMessage(problematicJson);
      expect(result).toEqual({
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      });
    });

    // Test case 7: Nested JSON objects
    it('should handle nested JSON objects correctly', () => {
      const nestedJson = '{"jsonrpc":"2.0","params":{"nested":{"value":42}},"id":1}';
      const result = processJsonRpcMessage(nestedJson);
      expect(result).toEqual({
        jsonrpc: '2.0',
        params: {
          nested: {
            value: 42
          }
        },
        id: 1
      });
    });

    // Test case 8: Malformed JSON with unbalanced brackets
    it('should throw an error for unbalanced JSON', () => {
      const unbalancedJson = '{"jsonrpc":"2.0","method":"test"';
      expect(() => processJsonRpcMessage(unbalancedJson)).toThrow('Unbalanced JSON in the message');
    });

    // Test case 9: No JSON content
    it('should throw an error when no JSON object or array is found', () => {
      const noJsonContent = 'This is just plain text with no JSON';
      expect(() => processJsonRpcMessage(noJsonContent)).toThrow('No JSON object or array found in the message');
    });

    // Test case 10: Invalid JSON that passes the bracket check but fails parsing
    it('should throw an error for invalid JSON content', () => {
      const invalidJson = '{"key": value}'; // Missing quotes around value
      expect(() => processJsonRpcMessage(invalidJson)).toThrow();
    });
  });
});