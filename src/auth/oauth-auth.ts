// src/auth/oauth-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import express, { Express } from 'express';
import { OAuthHandler } from './oauth-handler';
import config from '../config/config';
import logger from '../utils/logger';
import { tokenManager } from './token-manager';
import open from 'open';

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

    // Start Express server (catch error if port is already in use)
    try {
      this.server = this.expressApp.listen(config.auth.port, config.auth.host, () => {
        logger.info(`OAuth server started on ${config.auth.host}:${config.auth.port}`);
      });

      // Add error handling
      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${config.auth.port} is already in use, assuming OAuth server is already running`);
          // Set server object to null to indicate that we're using an existing server
          this.server = null;
        } else {
          logger.error(`OAuth server error: ${err}`);
        }
      });
    } catch (err) {
      logger.warn(`Could not start OAuth server: ${err}`);
      // Set server object to null
      this.server = null;
    }
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

  // Start authentication flow
  private initiateAuthorization(): Promise<OAuth2Client> {
    if (this.authorizationPromise) {
      return this.authorizationPromise;
    }

    this.authorizationPromise = new Promise((resolve, reject) => {
      try {
        // OAuthHandlerを使用して認証URLを生成
        const userId = 'default-user';
        const redirectUri = `http://${config.auth.host}:${config.auth.port}/auth-success`;
        const authUrl = this.oauthHandler.generateAuthUrl(userId, redirectUri);

        logger.info(`Please authorize this app by visiting this URL: ${authUrl}`);

        // ブラウザで認証URLを開く
        try {
          open(authUrl);
          logger.info('Opening browser for authorization...');
        } catch (error) {
          logger.warn(`Failed to open browser automatically: ${error}`);
          logger.info(`Please open this URL manually: ${authUrl}`);
        }

        // 認証成功ページのルート
        this.expressApp.get('/auth-success', (req, res) => {
          res.send(`<html lang="en"><body><h3>Authentication was successful. Please close this window and continue.</h3></body></html>`);
        });

        // トークンマネージャーからトークンを監視
        const checkToken = async () => {
          try {
            const refreshToken = tokenManager.getToken(userId);
            const accessToken = tokenManager.getToken(`${userId}_access`);

            // アクセストークンがあれば認証成功とみなす
            // リフレッシュトークンは存在する場合のみ設定
            if (accessToken) {
              const credentials: any = {
                access_token: accessToken
              };

              // リフレッシュトークンが存在する場合は追加
              if (refreshToken) {
                credentials.refresh_token = refreshToken;
                logger.info('Using stored refresh token for authentication');
              } else {
                logger.warn('No refresh token available, proceeding with access token only');
              }

              // トークンが取得できたらOAuth2クライアントに設定
              this.oauth2Client.setCredentials(credentials);

              clearInterval(intervalId);
              this.authorizationPromise = null;
              resolve(this.oauth2Client);
            }
          } catch (error) {
            logger.error(`Error checking token: ${error}`);
          }
        };

        // 定期的にトークンをチェック
        const intervalId = setInterval(checkToken, 1000);

        // タイムアウト設定
        setTimeout(() => {
          clearInterval(intervalId);
          this.authorizationPromise = null;
          reject(new Error('Authorization timed out after 5 minutes'));
        }, 5 * 60 * 1000);

      } catch (error) {
        logger.error(`Error in authorization: ${error}`);
        this.authorizationPromise = null;
        reject(error);
      }
    });

    return this.authorizationPromise;
  }
}

export default new OAuthAuth();
