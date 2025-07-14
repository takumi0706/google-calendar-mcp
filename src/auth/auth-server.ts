import { serve, ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { OAuth2Client } from 'google-auth-library';
import readline from 'readline';
import { OAuthHandler } from './oauth-handler';
import { tokenManager } from './token-manager';
import config from '../config/config';
import logger, { LoggerMeta } from '../utils/logger';
import { sanitizeErrorForLogging, sanitizeText } from '../utils/security-sanitizer';

/**
 * Authentication server management class
 * Handles OAuth server lifecycle and authentication flows
 */
export class AuthServer {
  private honoApp: Hono;
  private oauthHandler: OAuthHandler;
  private server: ServerType | null = null;
  private isServerRunning: boolean = false;
  private authorizationPromise: Promise<OAuth2Client> | null = null;

  constructor() {
    // Initialize OAuthHandler
    this.oauthHandler = new OAuthHandler();
    
    // Get Hono app from OAuthHandler
    this.honoApp = this.oauthHandler.getApp();
    
    logger.info('AuthServer initialized - OAuth server will be started when authentication is needed');
  }

  /**
   * Check if server is currently running
   */
  public isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * Start the OAuth server
   */
  public startServer(): void {
    if (!this.isServerRunning) {
      try {
        this.server = serve({
          fetch: this.honoApp.fetch,
          port: config.auth.port,
          hostname: config.auth.host
        });

        logger.info(`OAuth server started on ${config.auth.host}:${config.auth.port}`);
        this.isServerRunning = true;

      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'EADDRINUSE') {
          logger.warn(`Port ${config.auth.port} is already in use, assuming OAuth server is already running`);
          // Set server object to null to indicate that we're using an existing server
          this.server = null;
          this.isServerRunning = false;
        } else {
          logger.error('OAuth server error:', { error } as LoggerMeta);
          this.isServerRunning = false;
        }
      }
    }
  }

  /**
   * Shut down the authentication server
   */
  public shutdownServer(): void {
    if (this.server && this.isServerRunning) {
      logger.info('Shutting down OAuth server');
      this.server.close(() => {
        logger.info('OAuth server has been shut down');
        this.isServerRunning = false;
      });
    }
  }

  /**
   * Start authentication flow for OAuth2Client
   */
  public async initiateAuthentication(oauth2Client: OAuth2Client): Promise<OAuth2Client> {
    if (this.authorizationPromise) {
      return this.authorizationPromise;
    }

    const userId = 'default-user';

    // Check if manual authentication is enabled
    if (config.auth.useManualAuth) {
      logger.info('Using manual authentication flow');
      this.authorizationPromise = this.handleManualAuth(oauth2Client, userId);
      return this.authorizationPromise;
    }

    // Regular authentication flow with local server
    this.startServer();
    this.authorizationPromise = this.startAuthenticationFlow(oauth2Client, userId);
    return this.authorizationPromise;
  }

  /**
   * Handle manual authentication flow
   */
  private async handleManualAuth(oauth2Client: OAuth2Client, userId: string): Promise<OAuth2Client> {
    try {
      // Generate authentication URL for manual auth
      const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
      const authUrlResult = this.oauthHandler.generateAuthUrl(userId, redirectUri, true);
      const { authUrl, state } = typeof authUrlResult === 'string' 
        ? { authUrl: authUrlResult, state: 'manual-auth' }
        : authUrlResult;

      const sanitizedUrl = sanitizeText(authUrl);
      logger.info(`Please authorize this app by visiting this URL: ${sanitizedUrl}`);

      // Try to open the browser automatically
      await this.openAuthUrl(authUrl);

      // Create readline interface for manual code input
      const rl = this.createReadlineInterface();

      let authCode: string;
      try {
        // Prompt for authorization code
        authCode = await new Promise<string>((resolve, reject) => {
          rl.question('\\nAfter authorizing, please enter the authorization code shown by Google: ', (code) => {
            resolve(code.trim());
          });
          
          // Set timeout for user input
          setTimeout(() => {
            reject(new Error('Authentication input timeout (5 minutes)'));
          }, 5 * 60 * 1000);
        });
      } finally {
        // Ensure readline interface is always closed
        rl.close();
      }

      if (!authCode) {
        throw new Error('No authorization code provided');
      }

      // Exchange code for tokens
      const result = await this.oauthHandler.exchangeCodeForTokens(authCode, state);
      if (!result.success) {
        throw new Error(result.message);
      }

      logger.info('Manual authentication successful');

      // Get tokens and set credentials
      return this.setCredentialsFromTokens(oauth2Client, userId);
    } catch (error) {
      logger.error('Error in manual authentication:', { 
        error: sanitizeErrorForLogging(error) 
      } as LoggerMeta);
      throw error;
    }
  }

  /**
   * Start the authentication flow with token monitoring
   */
  private startAuthenticationFlow(oauth2Client: OAuth2Client, userId: string): Promise<OAuth2Client> {
    return new Promise((resolve, reject) => {
      try {
        logger.debug('Starting authentication flow for user:', { userId } as LoggerMeta);
        this.generateAndOpenAuthUrl(userId);
        this.setupTokenMonitoring(oauth2Client, userId, resolve, reject);
      } catch (error) {
        this.handleAuthenticationError(error, reject);
      }
    });
  }

  /**
   * Generate authentication URL and open in browser
   */
  private generateAndOpenAuthUrl(userId: string): void {
    const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
    const authUrlResult = this.oauthHandler.generateAuthUrl(userId, redirectUri);
    
    const authUrl = typeof authUrlResult === 'string' ? authUrlResult : authUrlResult.authUrl;

    const sanitizedUrl = sanitizeText(authUrl);
    logger.info(`Please authorize this app by visiting this URL: ${sanitizedUrl}`);
    this.openAuthUrl(authUrl);
  }

  /**
   * Open authentication URL in browser
   */
  private async openAuthUrl(authUrl: string): Promise<void> {
    try {
      const openModule = await import('open');
      await openModule.default(authUrl);
      logger.info('Opening browser for authorization...');
    } catch (error) {
      logger.warn('Failed to open browser automatically:', { error } as LoggerMeta);
      logger.info(`Please open this URL manually: ${authUrl}`);
    }
  }

  /**
   * Set up token monitoring with periodic checks
   */
  private setupTokenMonitoring(
    oauth2Client: OAuth2Client,
    userId: string, 
    resolve: (client: OAuth2Client) => void, 
    reject: (error: Error) => void
  ): void {
    const checkToken = async () => {
      try {
        const accessToken = tokenManager.getToken(`${userId}_access`);
        if (accessToken) {
          logger.debug('Access token found, setting credentials');
          const result = await this.setCredentialsFromTokens(oauth2Client, userId);
          this.processAuthenticationSuccess(resolve, result, intervalId, timeoutId);
          return result;
        }
      } catch (error) {
        logger.error('Error checking token:', { error } as LoggerMeta);
      }
    };

    const intervalId = setInterval(checkToken, 1000);
    const timeoutId = setTimeout(() => {
      this.handleAuthenticationTimeout(intervalId, timeoutId, reject);
    }, 5 * 60 * 1000);
  }

  /**
   * Set credentials from stored tokens
   */
  private async setCredentialsFromTokens(oauth2Client: OAuth2Client, userId: string): Promise<OAuth2Client> {
    const refreshToken = tokenManager.getToken(userId);
    const accessToken = tokenManager.getToken(`${userId}_access`);

    if (!accessToken) {
      throw new Error('Failed to obtain access token');
    }

    const credentials = {
      access_token: accessToken,
      ...(refreshToken && { refresh_token: refreshToken })
    };

    if (refreshToken) {
      logger.info('Using stored refresh token for authentication');
    } else {
      logger.warn('No refresh token available, proceeding with access token only');
    }

    oauth2Client.setCredentials(credentials);
    return oauth2Client;
  }

  /**
   * Process successful authentication
   */
  private processAuthenticationSuccess(
    resolve: (client: OAuth2Client) => void,
    oauth2Client: OAuth2Client,
    intervalId?: NodeJS.Timeout,
    timeoutId?: NodeJS.Timeout
  ): void {
    logger.debug('Processing successful authentication');
    
    // Clean up timers
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
    
    this.authorizationPromise = null;
    this.shutdownServer();
    
    logger.info('Authentication completed successfully, resolving with OAuth2Client');
    resolve(oauth2Client);
  }

  /**
   * Handle authentication timeout
   */
  private handleAuthenticationTimeout(
    intervalId: NodeJS.Timeout, 
    timeoutId: NodeJS.Timeout, 
    reject: (error: Error) => void
  ): void {
    clearInterval(intervalId);
    clearTimeout(timeoutId);
    
    this.authorizationPromise = null;
    this.shutdownServer();
    reject(new Error('Authorization timed out after 5 minutes'));
  }

  /**
   * Handle authentication errors
   */
  private handleAuthenticationError(error: unknown, reject: (error: Error) => void): void {
    logger.error('Error in authorization:', { 
      error: sanitizeErrorForLogging(error) 
    } as LoggerMeta);
    this.authorizationPromise = null;
    this.shutdownServer();
    reject(error instanceof Error ? error : new Error('Authentication error occurred'));
  }

  /**
   * Create a readline interface for manual code input
   */
  private createReadlineInterface(): readline.Interface {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Get authentication server statistics
   */
  public getStatistics(): {
    isRunning: boolean;
    hasActivePromise: boolean;
    serverHost: string;
    serverPort: number;
    } {
    return {
      isRunning: this.isServerRunning,
      hasActivePromise: this.authorizationPromise !== null,
      serverHost: config.auth.host,
      serverPort: config.auth.port
    };
  }
}