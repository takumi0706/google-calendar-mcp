import { OAuth2Client, Credentials } from 'google-auth-library';
import { tokenManager } from './token-manager';
import logger, { LoggerMeta } from '../utils/logger';
import { sanitizeErrorForLogging } from '../utils/security-sanitizer';

/**
 * Token processing and management class
 * Handles token validation, refresh, and storage operations
 */
export class TokenProcessor {
  private static instance: TokenProcessor;
  
  private constructor() {}

  public static getInstance(): TokenProcessor {
    if (!TokenProcessor.instance) {
      TokenProcessor.instance = new TokenProcessor();
    }
    return TokenProcessor.instance;
  }

  /**
   * Check if user is authenticated without triggering authentication flow
   */
  public isAuthenticated(oauth2Client: OAuth2Client): boolean {
    const userId = 'default-user';
    
    // Check if we have valid credentials in OAuth2Client
    if (oauth2Client.credentials && oauth2Client.credentials.access_token) {
      if (!this.isTokenExpired(oauth2Client.credentials)) {
        return true;
      }
    }
    
    // Check if we have valid tokens in token manager
    const accessToken = tokenManager.getToken(`${userId}_access`);
    const refreshToken = tokenManager.getToken(userId);
    
    return !!(accessToken || refreshToken);
  }

  /**
   * Get authenticated client without triggering authentication flow
   * Returns null if not authenticated
   */
  public async getAuthenticatedClientSafe(oauth2Client: OAuth2Client): Promise<OAuth2Client | null> {
    if (!this.isAuthenticated(oauth2Client)) {
      return null;
    }

    const userId = 'default-user';
    
    // If credentials are already set and valid, return them
    if (oauth2Client.credentials && oauth2Client.credentials.access_token) {
      if (!this.isTokenExpired(oauth2Client.credentials)) {
        return oauth2Client;
      }
    }

    // Try to load tokens from token manager
    const refreshToken = tokenManager.getToken(userId);
    const accessToken = tokenManager.getToken(`${userId}_access`);

    if (accessToken) {
      const credentials: Credentials = { access_token: accessToken };
      if (refreshToken) {
        credentials.refresh_token = refreshToken;
      }
      oauth2Client.setCredentials(credentials);
      return oauth2Client;
    }

    return null;
  }

  /**
   * Get or refresh token
   */
  public async getOrRefreshToken(oauth2Client: OAuth2Client): Promise<OAuth2Client> {
    // If credentials are already set, check and refresh if needed
    if (oauth2Client.credentials && oauth2Client.credentials.access_token) {
      // Check if token is expired
      if (this.isTokenExpired(oauth2Client.credentials)) {
        logger.info('Token expired, refreshing...');
        await this.refreshToken(oauth2Client);
      }
      return oauth2Client;
    }

    // Try to load from token manager
    const userId = 'default-user';
    const refreshToken = tokenManager.getToken(userId);
    const accessToken = tokenManager.getToken(`${userId}_access`);

    if (accessToken) {
      const credentials: Credentials = { access_token: accessToken };
      if (refreshToken) {
        credentials.refresh_token = refreshToken;
      }
      oauth2Client.setCredentials(credentials);
      
      // Check if loaded token is expired and refresh if needed
      if (this.isTokenExpired(credentials)) {
        logger.info('Loaded token is expired, refreshing...');
        await this.refreshToken(oauth2Client);
      }
      
      return oauth2Client;
    }

    throw new Error('No valid tokens available - authentication required');
  }

  /**
   * Check token expiration
   */
  public isTokenExpired(token: Credentials): boolean {
    if (!token.expiry_date) return true;
    return token.expiry_date <= Date.now();
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(oauth2Client: OAuth2Client): Promise<void> {
    try {
      // If there's no refresh token, throw error to indicate re-authentication is needed
      if (!oauth2Client.credentials.refresh_token) {
        logger.warn('No refresh token available, re-authentication required');
        // Clear existing credentials
        oauth2Client.credentials = {};
        throw new Error('No refresh token available - re-authentication required');
      }

      // If there's a refresh token, perform normal refresh
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Also store the refreshed access token in the token manager
      if (credentials.access_token) {
        const userId = 'default-user';
        const expiresIn = credentials.expiry_date ? credentials.expiry_date - Date.now() : 3600 * 1000;
        tokenManager.storeToken(`${userId}_access`, credentials.access_token, expiresIn);
        logger.info('Successfully refreshed and stored access token');
      }
    } catch (error) {
      logger.error('Failed to refresh token:', { 
        error: sanitizeErrorForLogging(error) 
      } as LoggerMeta);

      // If an error occurs, clear credentials and throw error
      logger.warn('Token refresh failed, re-authentication required');
      oauth2Client.credentials = {};
      throw new Error('Token refresh failed - re-authentication required');
    }
  }

  /**
   * Store tokens from OAuth2Client credentials
   */
  public storeTokensFromCredentials(oauth2Client: OAuth2Client): void {
    const userId = 'default-user';
    const credentials = oauth2Client.credentials;

    if (credentials.access_token) {
      const expiresIn = credentials.expiry_date ? credentials.expiry_date - Date.now() : 3600 * 1000;
      tokenManager.storeToken(`${userId}_access`, credentials.access_token, expiresIn);
      logger.debug('Stored access token');
    }

    if (credentials.refresh_token) {
      tokenManager.storeToken(userId, credentials.refresh_token);
      logger.debug('Stored refresh token');
    }
  }

  /**
   * Clear all stored tokens
   */
  public clearTokens(oauth2Client: OAuth2Client): void {
    const userId = 'default-user';
    
    // Clear from token manager
    tokenManager.removeToken(userId);
    tokenManager.removeToken(`${userId}_access`);
    
    // Clear from OAuth2Client
    oauth2Client.credentials = {};
    
    logger.info('All tokens cleared');
  }

  /**
   * Get token information
   */
  public getTokenInfo(oauth2Client: OAuth2Client): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isExpired: boolean;
    expiryDate: number | null;
    storedAccessToken: boolean;
    storedRefreshToken: boolean;
  } {
    const userId = 'default-user';
    const credentials = oauth2Client.credentials;
    
    return {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
      isExpired: this.isTokenExpired(credentials),
      expiryDate: credentials.expiry_date || null,
      storedAccessToken: !!tokenManager.getToken(`${userId}_access`),
      storedRefreshToken: !!tokenManager.getToken(userId)
    };
  }

  /**
   * Validate token and attempt refresh if expired
   */
  public async validateAndRefreshIfNeeded(oauth2Client: OAuth2Client): Promise<boolean> {
    try {
      if (!oauth2Client.credentials.access_token) {
        return false;
      }

      if (this.isTokenExpired(oauth2Client.credentials)) {
        await this.refreshToken(oauth2Client);
      }

      return true;
    } catch (error) {
      logger.error('Token validation failed:', { 
        error: sanitizeErrorForLogging(error) 
      } as LoggerMeta);
      return false;
    }
  }

  /**
   * Get token processor statistics
   */
  public getStatistics(): {
    totalActiveTokens: number;
    hasValidCredentials: boolean;
    lastRefreshAttempt: string | null;
    } {
    const userId = 'default-user';
    const accessToken = tokenManager.getToken(`${userId}_access`);
    const refreshToken = tokenManager.getToken(userId);
    
    let totalTokens = 0;
    if (accessToken) totalTokens++;
    if (refreshToken) totalTokens++;

    return {
      totalActiveTokens: totalTokens,
      hasValidCredentials: !!(accessToken || refreshToken),
      lastRefreshAttempt: null // Could be extended to track this
    };
  }
}