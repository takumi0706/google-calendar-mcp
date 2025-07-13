// src/auth/oauth-handler.ts
import { Hono } from 'hono';
import { googleAuth } from '@hono/oauth-providers/google';
import { tokenManager } from './token-manager';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';
import config from '../config/config';

// Type definitions for Google OAuth tokens and user
interface GoogleTokens {
  token: string;
  expires_in: number;
  refresh_token?: string;
  access_token?: string;
}

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

/**
 * OAuthHandler - Secure OAuth authentication flow management class using Hono
 * 
 * Uses Hono's OAuth provider integration with built-in PKCE support
 */
export class OAuthHandler {
  private app: Hono;
  private authPromise: Promise<{ user: GoogleUser; tokens: GoogleTokens }> | null = null;

  constructor() {
    this.app = new Hono();
    this.setupRoutes();
  }

  /**
   * Set up OAuth-related routes
   */
  private setupRoutes() {
    // Google OAuth authentication route with built-in PKCE
    this.app.use(
      '/auth/google',
      googleAuth({
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent',
        access_type: 'offline'
      })
    );

    // OAuth callback handler
    this.app.get('/auth/google', async (c) => {
      try {
        const token = c.get('token') as GoogleTokens;
        const user = c.get('user-google') as GoogleUser;
        
        if (!token || !user) {
          throw new AppError(ErrorCode.AUTHENTICATION_ERROR, 'Failed to get authentication tokens');
        }

        // Store tokens using existing token manager
        const userId = 'default-user';
        
        // In @hono/oauth-providers, the token contains the access token
        if (token.token) {
          const expiresIn = token.expires_in ? token.expires_in * 1000 : 3600 * 1000;
          tokenManager.storeToken(`${userId}_access`, token.token, expiresIn);
          logger.debug('Stored access token', { userId, expiresIn });
        }

        // Check if there's a refresh token in the response
        if (token.refresh_token) {
          tokenManager.storeToken(userId, token.refresh_token);
          logger.info('Successfully obtained and stored refresh token', { userId });
        } else {
          logger.warn('No refresh token in the response - need to check Google OAuth configuration', { userId });
        }

        // Resolve authentication promise if waiting
        if (this.authPromise) {
          this.authPromise = Promise.resolve({ user, tokens: token });
        }

        return c.html(`
          <html lang="en">
            <head>
              <title>Authentication Successful</title>
              <meta charset="utf-8">
            </head>
            <body>
              <h3>認証が成功しました。このウィンドウを閉じて続行してください。</h3>
              <script>window.close();</script>
            </body>
          </html>
        `);
      } catch (error) {
        logger.error('OAuth callback error', { error });
        return c.html(`
          <html lang="en">
            <head>
              <title>Authentication Error</title>
              <meta charset="utf-8">
            </head>
            <body>
              <h3>認証エラーが発生しました</h3>
              <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
            </body>
          </html>
        `, 500);
      }
    });

    // Authentication success page
    this.app.get('/auth-success', (c) => {
      return c.html(`
        <html lang="en">
          <head>
            <title>Authentication Successful</title>
            <meta charset="utf-8">
          </head>
          <body>
            <h3>認証が成功しました。このウィンドウを閉じて続行してください。</h3>
          </body>
        </html>
      `);
    });
  }

  /**
   * Generate authentication URL
   * 
   * @param userId User ID (for compatibility)
   * @param redirectUri Redirect URI after successful authentication (handled internally)
   * @param forManualAuth Whether this is for manual authentication
   * @returns Auth URL string or object for manual auth
   */
  public generateAuthUrl(userId: string, redirectUri: string, forManualAuth: boolean = false): string | { authUrl: string; state: string } {
    const authUrl = `http://${config.auth.host}:${config.auth.port}/auth/google`;
    
    logger.info('Generated Hono-based auth URL', { authUrl, redirectUri });

    // For compatibility with existing code
    if (forManualAuth) {
      return { authUrl, state: 'hono-oauth' };
    }

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens (for manual authentication)
   * 
   * @param code Authorization code from Google (not used in Hono implementation)
   * @param state State parameter from the auth URL
   * @returns Success status and message
   */
  public async exchangeCodeForTokens(code: string, state: string): Promise<{ success: boolean, message: string }> {
    try {
      // For manual auth with Hono, we need to wait for the OAuth flow to complete
      // This is handled internally by the googleAuth middleware
      logger.info('Manual authentication using Hono OAuth flow', { state });
      
      if (this.authPromise) {
        await this.authPromise;
        return { success: true, message: 'Authentication successful' };
      }

      return { success: false, message: 'No authentication flow in progress' };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('OAuth token exchange failed', { error: error.message, stack: error.stack });
      return { success: false, message: `Token exchange failed: ${error.message}` };
    }
  }

  /**
   * Get Hono app instance
   */
  public getApp(): Hono {
    return this.app;
  }

  /**
   * Wait for authentication to complete
   * Used for synchronous authentication flows
   */
  public async waitForAuthentication(): Promise<{ user: GoogleUser; tokens: GoogleTokens }> {
    if (!this.authPromise) {
      this.authPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        // Set up a promise that resolves when authentication completes
        const checkAuth = () => {
          const userId = 'default-user';
          const accessToken = tokenManager.getToken(`${userId}_access`);
          if (accessToken) {
            clearTimeout(timeout);
            resolve({
              user: {} as GoogleUser,
              tokens: { token: accessToken, expires_in: 3600 } as GoogleTokens
            });
          } else {
            setTimeout(checkAuth, 1000);
          }
        };
        checkAuth();
      });
    }

    return this.authPromise;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    const userId = 'default-user';
    const accessToken = tokenManager.getToken(`${userId}_access`);
    const refreshToken = tokenManager.getToken(userId);
    
    return !!(accessToken || refreshToken);
  }
}
