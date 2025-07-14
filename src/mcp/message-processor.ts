import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import logger from '../utils/logger';
import { processJsonRpcMessage } from '../utils/json-parser';

/**
 * Message cache entry with TTL
 */
interface MessageCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * MCP message processing class
 * Manages message sending and receiving processing for STDIO transport
 */
export class MessageProcessor {
  private stdioTransport: StdioServerTransport;
  private originalOnMessage: ((message: any) => Promise<void>) | undefined | null = null;
  private messageCache: Map<string, MessageCacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly DEFAULT_TTL = 5000; // 5 seconds
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(stdioTransport: StdioServerTransport) {
    this.stdioTransport = stdioTransport;
    this.setupCacheCleanup();
  }

  /**
   * Setup cache cleanup interval
   */
  private setupCacheCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      if (!this.isDestroyed) {
        this.cleanupExpiredCache();
      }
    }, 30000); // Clean every 30 seconds
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.messageCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.messageCache.delete(key);
      }
    }
  }

  /**
   * Setup message logging and processing
   */
  public setupMessageProcessing(): void {
    this.setupOutgoingMessageLogging();
    this.setupIncomingMessageProcessing();
  }

  /**
   * Setup outgoing message logging
   */
  private setupOutgoingMessageLogging(): void {
    const originalSend = this.stdioTransport.send.bind(this.stdioTransport);
    
    this.stdioTransport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        // Optimize logging with lazy evaluation
        if (process.env.NODE_ENV !== 'production') {
          const messageCopy = this.cloneAndCacheMessage(message, 'outgoing');
          logger.debug(`Outgoing message: ${JSON.stringify(messageCopy)}`);
        }
      } catch (err) {
        logger.error(`Error logging outgoing message: ${err}`);
      }

      try {
        // Message normalization with caching
        const cleanMessage = this.cloneAndCacheMessage(message, 'clean');
        return await originalSend(cleanMessage);
      } catch (err) {
        logger.error(`Error preparing outgoing message: ${err}`);
        // Attempt to send with original message even if error occurs
        return await originalSend(message);
      }
    };
  }

  /**
   * Setup incoming message processing
   */
  private setupIncomingMessageProcessing(): void {
    // Save original onmessage handler
    this.originalOnMessage = this.stdioTransport.onmessage as ((message: any) => Promise<void>) | null;
    
    this.stdioTransport.onmessage = async (message: any): Promise<void> => {
      try {
        const processedMessage = this.processIncomingMessage(message);
        
        // Check if this is a tool call
        if (processedMessage && processedMessage.method === 'tools/call') {
          logger.debug(`[MCP] Tool call: ${processedMessage.params?.name}`);
        }
        
        // Log message output
        this.logIncomingMessage(processedMessage);

        // Execute original handler if it exists
        if (this.originalOnMessage) {
          return await this.originalOnMessage(processedMessage);
        }
      } catch (err) {
        logger.error(`[MCP] Error processing incoming message: ${err}`);
      }
    };
  }

  /**
   * Process incoming messages
   */
  private processIncomingMessage(message: any): any {
    let processedMessage = message;

    // Attempt JSON parsing for string messages
    if (typeof message === 'string') {
      try {
        processedMessage = JSON.parse(message);
      } catch (jsonError) {
        // Use robust parser if standard JSON parsing fails
        logger.debug(`Standard JSON parsing failed, using robust parser: ${jsonError}`);
        processedMessage = processJsonRpcMessage(message);
      }
    }

    // Message normalization with caching
    try {
      processedMessage = this.cloneAndCacheMessage(processedMessage, 'normalized');
    } catch (cloneError) {
      logger.error(`Error normalizing incoming message: ${cloneError}`);
      // Use original message if normalization fails
    }

    return processedMessage;
  }

  /**
   * Log incoming messages with optimization
   */
  private logIncomingMessage(message: any): void {
    try {
      // Only process if debug logging is enabled
      if (process.env.NODE_ENV !== 'production') {
        const messageCopy = this.cloneAndCacheMessage(message, 'incoming');
        logger.debug(`Incoming message: ${JSON.stringify(messageCopy)}`);
      }
    } catch (logError) {
      logger.error(`Error logging incoming message: ${logError}`);
    }
  }

  /**
   * Generate cache key for message
   */
  private generateCacheKey(message: any, context: string): string {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      const hash = this.simpleHash(messageStr);
      return `${context}:${hash}`;
    } catch {
      return `${context}:${Date.now()}:${Math.random()}`;
    }
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Optimized clone and cache message
   */
  private cloneAndCacheMessage(message: any, context: string): any {
    try {
      const cacheKey = this.generateCacheKey(message, context);
      const cached = this.messageCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }

      // Perform deep clone
      const cloned = this.performDeepClone(message);
      
      // Cache the result if cache isn't full
      if (this.messageCache.size < this.MAX_CACHE_SIZE) {
        this.messageCache.set(cacheKey, {
          data: cloned,
          timestamp: Date.now(),
          ttl: this.DEFAULT_TTL
        });
      }
      
      return cloned;
    } catch (error) {
      logger.warn(`Failed to clone message: ${error}`);
      return { error: 'Failed to clone message for logging' };
    }
  }

  /**
   * Perform deep clone based on object complexity
   */
  private performDeepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.performDeepClone(item));
    }

    // For simple objects, use JSON approach (fastest for deep cloning)
    if (this.isSimpleObject(obj)) {
      return JSON.parse(JSON.stringify(obj));
    }

    // For complex objects, use manual cloning
    const cloned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.performDeepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Check if object is simple (safe for JSON.stringify)
   */
  private isSimpleObject(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return true;
    }

    // Check for functions, undefined values, or circular references
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'function' || value === undefined) {
          return false;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursive check with depth limit
          if (!this.hasSimpleStructure(value, 5)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Check object structure depth and complexity
   */
  private hasSimpleStructure(obj: any, maxDepth: number): boolean {
    if (maxDepth <= 0 || typeof obj !== 'object' || obj === null) {
      return maxDepth > 0;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'function' || value === undefined) {
          return false;
        }
        if (typeof value === 'object' && value !== null) {
          if (!this.hasSimpleStructure(value, maxDepth - 1)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get message processing statistics
   */
  public getStatistics(): { 
    hasCustomSendHandler: boolean; 
    hasCustomReceiveHandler: boolean;
    originalHandlerPresent: boolean;
    cacheSize: number;
    cacheHitRate: number;
    } {
    return {
      hasCustomSendHandler: this.stdioTransport.send !== StdioServerTransport.prototype.send,
      hasCustomReceiveHandler: this.stdioTransport.onmessage !== StdioServerTransport.prototype.onmessage,
      originalHandlerPresent: this.originalOnMessage !== null,
      cacheSize: this.messageCache.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateCacheHitRate(): number {
    // This would require tracking hits/misses in a real implementation
    // For now, return a basic metric based on cache utilization
    return this.messageCache.size > 0 ? (this.messageCache.size / this.MAX_CACHE_SIZE) * 100 : 0;
  }

  /**
   * Clear message cache
   */
  public clearCache(): void {
    this.messageCache.clear();
  }

  /**
   * Stop cleanup timer and prevent memory leaks
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clearCache();
    this.originalOnMessage = null;
  }

  /**
   * Restart cleanup timer if stopped
   */
  public restart(): void {
    if (this.isDestroyed) {
      this.isDestroyed = false;
      this.setupCacheCleanup();
    }
  }

  /**
   * Restore message processing (for testing)
   */
  public restoreOriginalHandlers(): void {
    if (this.originalOnMessage) {
      this.stdioTransport.onmessage = this.originalOnMessage;
    }
    this.clearCache();
    // Don't restore send handler (usually unnecessary)
  }
}