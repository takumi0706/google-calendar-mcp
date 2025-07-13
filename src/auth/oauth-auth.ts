// src/auth/oauth-auth.ts
import { OAuth2Client, Credentials } from 'google-auth-library';
import { google } from 'googleapis';
import { serve, ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { OAuthHandler } from './oauth-handler';
import config from '../config/config';
import logger from '../utils/logger';
import { tokenManager } from './token-manager';
import readline from 'readline';
/**
 * OAuthAuth - Google authentication class using Hono-based OAuthHandler
 * 
 * Processes Google OAuth authentication using Hono OAuthHandler,
 * providing an interface similar to GoogleAuth.
 */
class OAuthAuth {
  private oauth2Client: OAuth2Client;
  private honoApp: Hono;
  private oauthHandler: OAuthHandler;
  private server: ServerType | null = null;
  private authorizationPromise: Promise<OAuth2Client> | null = null;
  private isServerRunning: boolean = false;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // Initialize OAuthHandler
    this.oauthHandler = new OAuthHandler();

    // Get Hono app from OAuthHandler
    this.honoApp = this.oauthHandler.getApp();

    // Server will be started on-demand when needed
    logger.info('OAuth server will be started when authentication is needed');
  }

  // Get or refresh token
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    // If credentials are already set, return them
    if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
      // Check if token is expired
      if (this.isTokenExpired(this.oauth2Client.credentials)) {
        logger.info('Token expired, refreshing...');
        await this.refreshToken();
      }
      return this.oauth2Client;
    }

    // New authentication
    return await this.initiateAuthorization();
  }

  // Check token expiration
  private isTokenExpired(token: Credentials): boolean {
    if (!token.expiry_date) return true;
    return token.expiry_date <= Date.now();
  }

  // Refresh token
  private async refreshToken(): Promise<void> {
    try {
      // If there's no refresh token, start a new authentication flow
      if (!this.oauth2Client.credentials.refresh_token) {
        logger.warn('No refresh token available, initiating new authorization flow');
        // Clear existing credentials
        this.oauth2Client.credentials = {};
        // Call initiateAuthorization directly to avoid infinite loop
        await this.initiateAuthorization();
        return;
      }

      // If there's a refresh token, perform normal refresh
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      // Also store the refreshed access token in the token manager
      if (credentials.access_token) {
        const userId = 'default-user';
        const expiresIn = credentials.expiry_date ? credentials.expiry_date - Date.now() : 3600 * 1000;
        tokenManager.storeToken(`${userId}_access`, credentials.access_token, expiresIn);
        logger.info('Successfully refreshed and stored access token');
      }
    } catch (error) {
      logger.error(`Failed to refresh token: ${error}`);

      // If an error occurs, start a new authentication flow
      logger.warn('Token refresh failed, initiating new authorization flow');
      // Clear existing credentials
      this.oauth2Client.credentials = {};
      // Call initiateAuthorization directly to avoid infinite loop
      await this.initiateAuthorization();
    }
  }

  // Shut down the authentication server
  private shutdownServer(): void {
    if (this.server && this.isServerRunning) {
      logger.info('Shutting down OAuth server');
      this.server.close(() => {
        logger.info('OAuth server has been shut down');
        this.isServerRunning = false;
      });
    }
  }

  // Start or restart the authentication server
  private startServer(): void {
    if (!this.isServerRunning) {
      try {
        this.server = serve({
          fetch: this.honoApp.fetch,
          port: config.auth.port,
          hostname: config.auth.host
        });

        logger.info(`OAuth server started on ${config.auth.host}:${config.auth.port}`);
        this.isServerRunning = true;

      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${config.auth.port} is already in use, assuming OAuth server is already running`);
          // Set server object to null to indicate that we're using an existing server
          this.server = null;
          this.isServerRunning = false;
        } else {
          logger.error(`OAuth server error: ${err}`);
          this.isServerRunning = false;
        }
      }
    }
  }

  // Create a readline interface for manual code input
  private createReadlineInterface(): readline.Interface {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Handle manual authentication flow
  private async handleManualAuth(userId: string): Promise<OAuth2Client> {
    try {
      // Generate authentication URL for manual auth
      const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
      const authUrlResult = this.oauthHandler.generateAuthUrl(userId, redirectUri, true);
      const { authUrl, state } = typeof authUrlResult === 'string' 
        ? { authUrl: authUrlResult, state: 'manual-auth' }
        : authUrlResult;

      logger.info(`Please authorize this app by visiting this URL: ${authUrl}`);

      // Try to open the browser automatically
      try {
        import('open').then(openModule => {
          openModule.default(authUrl);
          logger.info('Opening browser for authorization...');
        }).catch(error => {
          logger.warn(`Failed to import 'open' package: ${error}`);
          logger.info(`Please open this URL manually: ${authUrl}`);
        });
      } catch (error) {
        logger.warn(`Failed to open browser automatically: ${error}`);
        logger.info(`Please open this URL manually: ${authUrl}`);
      }

      // Create readline interface for manual code input
      const rl = this.createReadlineInterface();

      // Prompt for authorization code
      const authCode = await new Promise<string>((resolve) => {
        rl.question('\nAfter authorizing, please enter the authorization code shown by Google: ', (code) => {
          resolve(code.trim());
        });
      });

      // Close readline interface
      rl.close();

      if (!authCode) {
        throw new Error('No authorization code provided');
      }

      // Exchange code for tokens
      const result = await this.oauthHandler.exchangeCodeForTokens(authCode, state);
      if (!result.success) {
        throw new Error(result.message);
      }

      logger.info('Manual authentication successful');

      // Get tokens from token manager
      const refreshToken = tokenManager.getToken(userId);
      const accessToken = tokenManager.getToken(`${userId}_access`);

      if (!accessToken) {
        throw new Error('Failed to obtain access token');
      }

      // Set credentials
      const credentials: Credentials = {
        access_token: accessToken
      };

      if (refreshToken) {
        credentials.refresh_token = refreshToken;
        logger.info('Using stored refresh token for authentication');
      } else {
        logger.warn('No refresh token available, proceeding with access token only');
      }

      this.oauth2Client.setCredentials(credentials);
      return this.oauth2Client;
    } catch (error) {
      logger.error(`Error in manual authentication: ${error}`);
      throw error;
    }
  }

  // Start authentication flow
  public initiateAuthorization(): Promise<OAuth2Client> {
    if (this.authorizationPromise) {
      return this.authorizationPromise;
    }

    const userId = 'default-user';

    // Check if manual authentication is enabled
    if (config.auth.useManualAuth) {
      logger.info('Using manual authentication flow');
      this.authorizationPromise = this.handleManualAuth(userId);
      return this.authorizationPromise;
    }

    // Regular authentication flow with local server
    this.startServer();
    this.authorizationPromise = this.startAuthenticationFlow(userId);
    return this.authorizationPromise;
  }

  // Start the authentication flow with token monitoring
  private startAuthenticationFlow(userId: string): Promise<OAuth2Client> {
    return new Promise((resolve, reject) => {
      try {
        this.generateAndOpenAuthUrl(userId);
        this.setupTokenMonitoring(userId, resolve, reject);
      } catch (error) {
        this.handleAuthenticationError(error, reject);
      }
    });
  }

  // Generate authentication URL and open in browser
  private generateAndOpenAuthUrl(userId: string): void {
    const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
    const authUrlResult = this.oauthHandler.generateAuthUrl(userId, redirectUri);
    
    const authUrl = typeof authUrlResult === 'string' ? authUrlResult : authUrlResult.authUrl;

    logger.info(`Please authorize this app by visiting this URL: ${authUrl}`);
    this.openAuthUrl(authUrl);
  }

  // Open authentication URL in browser
  private openAuthUrl(authUrl: string): void {
    try {
      import('open').then(openModule => {
        openModule.default(authUrl);
        logger.info('Opening browser for authorization...');
      }).catch(error => {
        logger.warn(`Failed to import 'open' package: ${error}`);
        logger.info(`Please open this URL manually: ${authUrl}`);
      });
    } catch (error) {
      logger.warn(`Failed to open browser automatically: ${error}`);
      logger.info(`Please open this URL manually: ${authUrl}`);
    }
  }

  // Set up token monitoring with periodic checks
  private setupTokenMonitoring(
    userId: string, 
    resolve: (client: OAuth2Client) => void, 
    reject: (error: Error) => void
  ): { intervalId: NodeJS.Timeout; timeoutId: NodeJS.Timeout } {
    const checkToken = async () => {
      try {
        const refreshToken = tokenManager.getToken(userId);
        const accessToken = tokenManager.getToken(`${userId}_access`);

        if (accessToken) {
          this.processAuthenticationSuccess(userId, accessToken, refreshToken, resolve);
        }
      } catch (error) {
        logger.error(`Error checking token: ${error}`);
      }
    };

    const intervalId = setInterval(checkToken, 1000);
    const timeoutId = setTimeout(() => {
      this.handleAuthenticationTimeout(intervalId, null, reject);
    }, 5 * 60 * 1000);

    return { intervalId, timeoutId };
  }

  // Process successful authentication
  private processAuthenticationSuccess(
    userId: string, 
    accessToken: string, 
    refreshToken: string | null, 
    resolve: (client: OAuth2Client) => void
  ): void {
    const credentials: Credentials = { access_token: accessToken };

    if (refreshToken) {
      credentials.refresh_token = refreshToken;
      logger.info('Using stored refresh token for authentication');
    } else {
      logger.warn('No refresh token available, proceeding with access token only');
    }

    this.oauth2Client.setCredentials(credentials);
    this.authorizationPromise = null;
    this.shutdownServer();
    resolve(this.oauth2Client);
  }

  // Handle authentication timeout
  private handleAuthenticationTimeout(
    intervalId: NodeJS.Timeout, 
    timeoutId: NodeJS.Timeout | null, 
    reject: (error: Error) => void
  ): void {
    clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
    
    this.authorizationPromise = null;
    this.shutdownServer();
    reject(new Error('Authorization timed out after 5 minutes'));
  }

  // Handle authentication errors
  private handleAuthenticationError(error: unknown, reject: (error: Error) => void): void {
    logger.error(`Error in authorization: ${error}`);
    this.authorizationPromise = null;
    this.shutdownServer();
    reject(error instanceof Error ? error : new Error('Unknown authentication error'));
  }
}

export default new OAuthAuth();
