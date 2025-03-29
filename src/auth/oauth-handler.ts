// src/auth/oauth-handler.ts
import crypto from 'crypto';
import { Express, Request, Response } from 'express';
import { google } from 'googleapis';
import { tokenManager } from './token-manager';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';
import { CodeChallengeMethod } from 'google-auth-library/build/src/auth/oauth2client';
import { escapeHtml } from '../utils/html-sanitizer';

/**
 * OAuthHandler - Secure OAuth authentication flow management class
 * 
 * Uses state parameter for CSRF protection and
 * implements PKCE (Proof Key for Code Exchange) to enhance authentication
 */
export class OAuthHandler {
  private stateMap: Map<string, { expiry: number, redirectUri: string, codeVerifier: string }> = new Map();

  constructor(private app: Express) {
    this.setupRoutes();
    // Periodically clean up expired state values
    setInterval(this.cleanupExpiredStates.bind(this), 30 * 60 * 1000); // every 30 minutes
  }

  /**
   * Set up OAuth-related routes
   */
  private setupRoutes() {
    // OAuth redirect endpoint
    this.app.get('/oauth2callback', this.handleOAuthCallback.bind(this));
  }

  /**
   * Generate authentication URL
   * 
   * @param userId User ID
   * @param redirectUri Redirect URI after successful authentication
   * @returns Authentication URL
   */
  public generateAuthUrl(userId: string, redirectUri: string): string {
    // Random state value for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Generate code_verifier for PKCE
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Set to expire after 10 minutes
    const expiry = Date.now() + 10 * 60 * 1000;
    this.stateMap.set(state, { expiry, redirectUri, codeVerifier });

    logger.info('Generated auth URL with PKCE', { state, redirectUri });

    // Generate OAuth authentication URL
    const oauth2Client = this.getOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state,
      // Always display consent screen to force obtaining a new refresh token
      prompt: 'consent',
      // Implementation of PKCE extension
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge
    });
  }

  /**
   * OAuth authentication callback handler
   */
  private async handleOAuthCallback(req: Request, res: Response) {
    const { code, state, error } = req.query;

    // Error check
    if (error) {
      logger.error('OAuth error', { error });
      return res.status(400).send(`Authentication error: ${escapeHtml(error)}`);
    }

    // State parameter check
    if (!state || typeof state !== 'string') {
      logger.error('Missing state parameter');
      return res.status(400).send('Invalid request: state parameter is missing');
    }

    // Validate state
    const stateData = this.stateMap.get(state);
    if (!stateData) {
      logger.error('Invalid state parameter', { state });
      return res.status(400).send('Authentication failed: Invalid state parameter');
    }

    // Expiration check
    if (stateData.expiry < Date.now()) {
      logger.error('Expired state parameter', { state, expiry: stateData.expiry });
      this.stateMap.delete(state);
      return res.status(400).send('Authentication failed: Authentication flow has expired');
    }

    // Code parameter check
    if (!code || typeof code !== 'string') {
      logger.error('Missing code parameter');
      return res.status(400).send('Invalid request: code parameter is missing');
    }

    try {
      const oauth2Client = this.getOAuthClient();

      // Exchange authorization code for token using PKCE code_verifier
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier: stateData.codeVerifier
      });

      // Delete state after it's been used
      this.stateMap.delete(state);

      // Identify user ID (actual implementation would require user authentication)
      // Using 'default-user' as a simple implementation for now
      const userId = 'default-user';

      // Encrypt and store token
      if (tokens.refresh_token) {
        tokenManager.storeToken(userId, tokens.refresh_token);
        logger.info('Successfully obtained and stored refresh token', { userId });
      } else {
        logger.warn('No refresh token in the response', { userId });
      }

      // Store access token for a short period as needed
      if (tokens.access_token) {
        const expiresIn = tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600 * 1000;
        tokenManager.storeToken(`${userId}_access`, tokens.access_token, expiresIn);
        logger.debug('Stored access token', { userId, expiresIn });
      }

      // Redirect
      res.redirect(stateData.redirectUri || '/auth-success');
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('OAuth token exchange failed', { error: error.message, stack: error.stack });
      res.status(500).send('Token exchange failed.');
    }
  }

  /**
   * Generate code_verifier for PKCE
   * @returns Random code_verifier string
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate code_challenge for PKCE
   * @param codeVerifier code_verifier
   * @returns SHA-256 hashed code_challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Clean up expired state values
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [state, data] of this.stateMap.entries()) {
      if (data.expiry < now) {
        this.stateMap.delete(state);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info(`Cleaned up ${expiredCount} expired OAuth states`);
    }
  }

  /**
   * Get OAuth2 client
   */
  private getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError(
        ErrorCode.CONFIGURATION_ERROR,
        'Google OAuth configuration is missing',
        500,
        { missingVars: [
          !clientId ? 'GOOGLE_CLIENT_ID' : null,
          !clientSecret ? 'GOOGLE_CLIENT_SECRET' : null,
          !redirectUri ? 'GOOGLE_REDIRECT_URI' : null
        ].filter(Boolean) }
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
}
