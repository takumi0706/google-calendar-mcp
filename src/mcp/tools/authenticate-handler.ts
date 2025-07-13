import { z } from 'zod';
import { BaseNoAuthToolHandler } from '../base-tool-handler';
import { ToolExecutionContext } from '../base-tool-handler';
import { authenticateParamsSchema } from '../schemas';
import oauthAuth from '../../auth/oauth-auth';
import responseBuilder from '../../utils/response-builder';
import { McpToolResponse } from '../../utils/error-handler';

/**
 * Handler for the authenticate tool
 */
export class AuthenticateHandler extends BaseNoAuthToolHandler {
  constructor() {
    super('authenticate');
  }

  /**
   * Define Zod schema
   */
  getSchema(): z.ZodRawShape {
    return {};
  }

  /**
   * Execute the actual processing
   */
  async execute(validatedArgs: any, _context: ToolExecutionContext): Promise<any> {
    this.logDebug('Executing authenticate');

    // Check if already authenticated
    if (oauthAuth.isAuthenticated()) {
      this.logInfo('User is already authenticated');
      return { alreadyAuthenticated: true };
    }

    // Validate parameters (empty object)
    authenticateParamsSchema.parse(validatedArgs);
    
    // Start authentication flow
    await oauthAuth.initiateAuthorization();
    
    this.logInfo('Authentication process started');
    return { authenticationStarted: true };
  }

  /**
   * Customize success response
   */
  protected createSuccessResponse(result: any, _context: ToolExecutionContext): McpToolResponse {
    if (result.alreadyAuthenticated) {
      return responseBuilder.alreadyAuthenticated();
    }
    
    return responseBuilder.processStarted(
      'Google Calendar Authentication',
      'Please complete authentication in your browser. After successful authentication, you can use other calendar tools.'
    );
  }
}