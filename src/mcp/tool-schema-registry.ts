import logger from '../utils/logger';
import toolsManager from './tools';

/**
 * MCP tool schema definition
 */
export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Tool Schema Registry Class
 * Dynamically manage schema definitions for MCP tools
 */
export class ToolSchemaRegistry {
  private schemas: Map<string, McpToolSchema> = new Map();

  constructor() {
    this.initializeDynamicSchemas();
  }

  /**
   * Initialize schemas dynamically from ToolsManager
   */
  private initializeDynamicSchemas(): void {
    logger.debug('Initializing dynamic tool schemas from ToolsManager');
    this.syncWithToolsManager();
  }

  /**
   * Get a list of all tool schemas
   */
  public getToolSchemas(): { tools: McpToolSchema[] } {
    logger.debug('Providing tool schema list');
    return { 
      tools: Array.from(this.schemas.values()) 
    };
  }

  /**
   * Get specific tool schema
   */
  public getToolSchema(toolName: string): McpToolSchema | undefined {
    return this.schemas.get(toolName);
  }

  /**
   * Generate schema from BaseToolHandler
   */
  private generateSchemaFromHandler(handler: any): McpToolSchema {
    const zodSchema = handler.getSchema();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Convert Zod schema to JSON schema format
    Object.entries(zodSchema).forEach(([key, zodType]: [string, any]) => {
      if (zodType && typeof zodType === 'object') {
        // Extract type and description from Zod schema
        properties[key] = {
          type: this.getJsonTypeFromZod(zodType),
          description: zodType.description || `${key} parameter`
        };

        // Check if field is required (not optional)
        if (zodType._def && !zodType._def.optional) {
          required.push(key);
        }
      }
    });

    return {
      name: handler.getName(),
      description: `${handler.getName()} tool for Google Calendar operations`,
      inputSchema: {
        type: 'object',
        properties,
        ...(required.length > 0 && { required })
      }
    };
  }

  /**
   * Convert Zod type to JSON Schema type
   */
  private getJsonTypeFromZod(zodType: any): string {
    if (!zodType._def) return 'string';
    
    const typeName = zodType._def.typeName;
    switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodEnum':
      return 'string';
    case 'ZodOptional':
      return this.getJsonTypeFromZod(zodType._def.innerType);
    default:
      return 'string';
    }
  }

  /**
   * Register new tool schema
   */
  public registerToolSchema(schema: McpToolSchema): void {
    if (this.schemas.has(schema.name)) {
      logger.warn(`Tool schema ${schema.name} already exists, overriding`);
    }
    
    this.schemas.set(schema.name, schema);
    logger.debug(`Registered tool schema: ${schema.name}`);
  }

  /**
   * Delete tool schema
   */
  public unregisterToolSchema(toolName: string): boolean {
    const removed = this.schemas.delete(toolName);
    if (removed) {
      logger.debug(`Unregistered tool schema: ${toolName}`);
    }
    return removed;
  }

  /**
   * Synchronize with ToolsManager to update schema
   */
  public syncWithToolsManager(): void {
    logger.debug('Syncing tool schemas with ToolsManager');

    // Clear existing schemas to rebuild from ToolsManager
    this.schemas.clear();

    const toolNames = toolsManager.getToolNames();

    // Generate schemas dynamically from tool handlers
    toolNames.forEach(toolName => {
      const handler = toolsManager.getToolHandler(toolName);
      if (handler) {
        const schema = this.generateSchemaFromHandler(handler);
        this.schemas.set(toolName, schema);
        logger.debug(`Generated dynamic schema for tool: ${toolName}`);
      }
    });

    logger.info(`Successfully generated ${this.schemas.size} dynamic tool schemas`);
  }

  /**
   * Obtain schema statistics
   */
  public getStatistics(): {
    totalSchemas: number;
    toolNames: string[];
    hasRequiredFields: number;
    } {
    const schemas = Array.from(this.schemas.values());
    const hasRequiredFields = schemas.filter(schema =>
      schema.inputSchema.required && schema.inputSchema.required.length > 0
    ).length;

    return {
      totalSchemas: schemas.length,
      toolNames: schemas.map(s => s.name),
      hasRequiredFields
    };
  }

  /**
   * Schema Validation
   */
  public validateSchema(schema: McpToolSchema): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema.name || schema.name.trim().length === 0) {
      errors.push('Tool name is required');
    }

    if (!schema.description || schema.description.trim().length === 0) {
      errors.push('Tool description is required');
    }

    if (!schema.inputSchema || typeof schema.inputSchema !== 'object') {
      errors.push('Input schema is required and must be an object');
    }

    if (schema.inputSchema && schema.inputSchema.type !== 'object') {
      errors.push('Input schema type must be "object"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}