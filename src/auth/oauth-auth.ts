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
 * OAuthAuth - OAuthHandlerを使用したGoogle認証クラス
 * 
 * OAuthHandlerを使用してGoogle OAuth認証を処理し、
 * GoogleAuthと同様のインターフェースを提供します。
 */
class OAuthAuth {
  private oauth2Client: OAuth2Client;
  private expressApp: express.Application;
  private oauthHandler: OAuthHandler;
  private server: any;
  private authorizationPromise: Promise<OAuth2Client> | null = null;

  constructor() {
    // OAuth2クライアントの初期化
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // Expressアプリケーションの初期化
    this.expressApp = express();

    // OAuthHandlerの初期化
    this.oauthHandler = new OAuthHandler(this.expressApp as Express);

    // Expressサーバーの起動
    this.server = this.expressApp.listen(config.auth.port, config.auth.host, () => {
      logger.info(`OAuth server started on ${config.auth.host}:${config.auth.port}`);
    });
  }

  // トークンを取得または更新
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    // すでに資格情報が設定されていればそのまま返す
    if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
      // 有効期限切れチェック
      if (this.isTokenExpired(this.oauth2Client.credentials)) {
        logger.info('Token expired, refreshing...');
        await this.refreshToken();
      }
      return this.oauth2Client;
    }

    // 新規認証
    return await this.initiateAuthorization();
  }

  // トークンの有効期限チェック
  private isTokenExpired(token: any): boolean {
    if (!token.expiry_date) return true;
    return token.expiry_date <= Date.now();
  }

  // トークンの更新
  private async refreshToken(): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
    } catch (error) {
      logger.error(`Failed to refresh token: ${error}`);
      throw error;
    }
  }

  // 認証フローの開始
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

            if (refreshToken && accessToken) {
              // トークンが取得できたらOAuth2クライアントに設定
              this.oauth2Client.setCredentials({
                refresh_token: refreshToken,
                access_token: accessToken
              });

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
