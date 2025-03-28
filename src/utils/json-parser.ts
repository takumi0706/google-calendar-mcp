/**
 * Utility functions for parsing JSON-RPC messages
 * 
 * This module provides functions to handle malformed JSON-RPC messages
 * and extract valid JSON objects or arrays from them.
 */
import logger from './logger';

/**
 * Process a potentially malformed JSON-RPC message and extract a valid JSON object or array
 * 
 * @param message - The message string to process
 * @returns The parsed JSON object or array
 * @throws Error if no valid JSON can be extracted or parsed
 */
export function processJsonRpcMessage(message: string): any {
  try {
    // Remove special characters like BOM and trim whitespace
    const cleanedMessage = message.replace(/^\uFEFF/, '').trim();

    // Find the start of the JSON object or array (whichever comes first)
    const jsonStartIndex = Math.min(
      cleanedMessage.indexOf('{') >= 0 ? cleanedMessage.indexOf('{') : Number.MAX_SAFE_INTEGER,
      cleanedMessage.indexOf('[') >= 0 ? cleanedMessage.indexOf('[') : Number.MAX_SAFE_INTEGER
    );

    if (jsonStartIndex === Number.MAX_SAFE_INTEGER) {
      throw new Error('No JSON object or array found in the message');
    }

    // Determine if we're dealing with an object or array
    const isObject = cleanedMessage[jsonStartIndex] === '{';
    let depth = 0;
    let endIndex = -1;

    // Use balanced bracket matching to find the end of the JSON
    for (let i = jsonStartIndex; i < cleanedMessage.length; i++) {
      const openChar = isObject ? '{' : '[';
      const closeChar = isObject ? '}' : ']';

      if (cleanedMessage[i] === openChar) {
        depth++;
      } else if (cleanedMessage[i] === closeChar) {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex === -1) {
      throw new Error('Unbalanced JSON in the message');
    }

    // Extract and parse the JSON string
    const jsonString = cleanedMessage.substring(jsonStartIndex, endIndex);
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      logger.error(`Failed to parse extracted JSON: ${e}`);
      logger.debug(`Extracted JSON string: "${jsonString}"`);
      throw e;
    }
  } catch (error) {
    logger.error(`Error parsing JSON-RPC message: ${error}`);
    logger.debug(`Problematic message: "${message}"`);
    throw error;
  }
}