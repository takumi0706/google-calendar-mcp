// src/auth/oauth-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import express, { Express } from 'express';
import { OAuthHandler } from './oauth-handler';
import config from '../config/config';
import logger from '../utils/logger';
import { tokenManager } from './token-manager';
import readline from 'readline';
/**
 * OAuthAuth - Google authentication class using OAuthHandler
 * 
 * Processes Google OAuth authentication using OAuthHandler,
 * providing an interface similar to GoogleAuth.
 */
class OAuthAuth {
  private oauth2Client: OAuth2Client;
  private expressApp: express.Application;
  private oauthHandler: OAuthHandler;
  private server: any;
  private authorizationPromise: Promise<OAuth2Client> | null = null;
  private isServerRunning: boolean = false;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // Initialize Express application
    this.expressApp = express();

    // Initialize OAuthHandler
    this.oauthHandler = new OAuthHandler(this.expressApp as Express);

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
  private isTokenExpired(token: any): boolean {
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
        this.server = this.expressApp.listen(config.auth.port, config.auth.host, () => {
          logger.info(`OAuth server started on ${config.auth.host}:${config.auth.port}`);
          this.isServerRunning = true;
        });

        // Add error handling
        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.warn(`Port ${config.auth.port} is already in use, assuming OAuth server is already running`);
            // Set server object to null to indicate that we're using an existing server
            this.server = null;
            this.isServerRunning = false;
          } else {
            logger.error(`OAuth server error: ${err}`);
            this.isServerRunning = false;
          }
        });
      } catch (err) {
        logger.warn(`Could not start OAuth server: ${err}`);
        // Set server object to null
        this.server = null;
        this.isServerRunning = false;
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
      const { authUrl, state } = this.oauthHandler.generateAuthUrl(userId, redirectUri, true);

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
      const credentials: any = {
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
    // Ensure the server is running before starting the authentication flow
    this.startServer();

    this.authorizationPromise = new Promise((resolve, reject) => {
      try {
        // Generate authentication URL using OAuthHandler
        const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
        const authUrl = this.oauthHandler.generateAuthUrl(userId, redirectUri);

        logger.info(`Please authorize this app by visiting this URL: ${authUrl}`);

        // Open authentication URL in browser
        try {
          // Use dynamic import for the 'open' package (ESM module)
          // This is necessary because 'open' v10+ is ESM-only and doesn't support CommonJS require()
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

        // Authentication success page route
        this.expressApp.get('/auth-success', (req, res) => {
          res.send(`<html lang="en"><body><h3>Authentication was successful. Please close this window and continue.</h3></body></html>`);
        });

        // Monitor tokens from token manager
        const checkToken = async () => {
          try {
            const refreshToken = tokenManager.getToken(userId);
            const accessToken = tokenManager.getToken(`${userId}_access`);

            // Consider authentication successful if access token exists
            // Set refresh token only if it exists
            if (accessToken) {
              const credentials: any = {
                access_token: accessToken
              };

              // Add refresh token if it exists
              if (refreshToken) {
                credentials.refresh_token = refreshToken;
                logger.info('Using stored refresh token for authentication');
              } else {
                logger.warn('No refresh token available, proceeding with access token only');
              }

              // Set credentials to OAuth2 client when tokens are obtained
              this.oauth2Client.setCredentials(credentials);

              clearInterval(intervalId);
              this.authorizationPromise = null;

              // Shut down the authentication server after successful authentication
              this.shutdownServer();

              resolve(this.oauth2Client);
            }
          } catch (error) {
            logger.error(`Error checking token: ${error}`);
          }
        };

        // Check tokens periodically
        const intervalId = setInterval(checkToken, 1000);

        // Set timeout
        setTimeout(() => {
          clearInterval(intervalId);
          this.authorizationPromise = null;

          // Shut down the authentication server if authentication times out
          this.shutdownServer();

          reject(new Error('Authorization timed out after 5 minutes'));
        }, 5 * 60 * 1000);

      } catch (error) {
        logger.error(`Error in authorization: ${error}`);
        this.authorizationPromise = null;

        // Shut down the authentication server if there's an error during authentication
        this.shutdownServer();

        reject(error);
      }
    });

    return this.authorizationPromise;
  }
}

export default new OAuthAuth();
