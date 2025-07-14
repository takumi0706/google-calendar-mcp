// src/auth/oauth-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { AuthServer } from './auth-server';
import { TokenProcessor } from './token-processor';
import config from '../config/config';
import logger from '../utils/logger';
/**
 * OAuthAuth - Google authentication class using AuthServer and TokenProcessor
 * 
 * Provides a simplified interface for Google OAuth authentication,
 * delegating server management to AuthServer and token operations to TokenProcessor.
 */
class OAuthAuth {
  private oauth2Client: OAuth2Client;
  private authServer: AuthServer;
  private tokenProcessor: TokenProcessor;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // Initialize server and token processor
    this.authServer = new AuthServer();
    this.tokenProcessor = TokenProcessor.getInstance();

    logger.info('OAuthAuth initialized with AuthServer and TokenProcessor');
  }

  // Check if user is authenticated without triggering authentication flow
  public isAuthenticated(): boolean {
    return this.tokenProcessor.isAuthenticated(this.oauth2Client);
  }

  // Get authenticated client without triggering authentication flow
  // Returns null if not authenticated
  public async getAuthenticatedClientSafe(): Promise<OAuth2Client | null> {
    return await this.tokenProcessor.getAuthenticatedClientSafe(this.oauth2Client);
  }

  // Get or refresh token
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    try {
      // Try to get or refresh existing token
      return await this.tokenProcessor.getOrRefreshToken(this.oauth2Client);
    } catch (error) {
      // If token operations fail, initiate new authentication
      logger.info('Token operations failed, initiating new authentication');
      return await this.authServer.initiateAuthentication(this.oauth2Client);
    }
  }



  // Start authentication flow
  public async initiateAuthorization(): Promise<OAuth2Client> {
    return await this.authServer.initiateAuthentication(this.oauth2Client);
  }

  /**
   * Get authentication and server statistics
   */
  public getStatistics(): {
    isAuthenticated: boolean;
    tokenInfo: ReturnType<TokenProcessor['getTokenInfo']>;
    authServerStats: ReturnType<AuthServer['getStatistics']>;
    tokenProcessorStats: ReturnType<TokenProcessor['getStatistics']>;
    } {
    return {
      isAuthenticated: this.isAuthenticated(),
      tokenInfo: this.tokenProcessor.getTokenInfo(this.oauth2Client),
      authServerStats: this.authServer.getStatistics(),
      tokenProcessorStats: this.tokenProcessor.getStatistics()
    };
  }

  /**
   * Clear all authentication data
   */
  public clearAuthentication(): void {
    this.tokenProcessor.clearTokens(this.oauth2Client);
    logger.info('Authentication data cleared');
  }
}

export default new OAuthAuth();
