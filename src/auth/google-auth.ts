import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import config from '../config/config';
import logger from '../utils/logger';
import { createServer } from 'http';
import { parse } from 'url';

class GoogleAuth {
  private oauth2Client: OAuth2Client;
  private authUrl: string;
  private authorizationPromise: Promise<OAuth2Client> | null = null;

  constructor() {
    // OAuth2クライアントの初期化
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // 認証URLの生成
    this.authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: config.google.scopes,
      prompt: 'consent',
    });
  }

  // トークンを取得または更新
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    try {
      // トークンファイルが存在するか確認
      const token = await this.loadTokenFromFile();
      if (token) {
        this.oauth2Client.setCredentials(token);
        
        // トークンの有効期限チェック
        if (this.isTokenExpired(token)) {
          logger.info('Token expired, refreshing...');
          await this.refreshToken();
        }
        
        return this.oauth2Client;
      } else {
        // 新規認証が必要
        return await this.initiateAuthorization();
      }
    } catch (error) {
      logger.error(`Error getting authenticated client: ${error}`);
      // 認証をやり直し
      return await this.initiateAuthorization();
    }
  }

  // ファイルからトークンを読み込み
  private async loadTokenFromFile() {
    try {
      const tokenFile = await fs.readFile(config.google.tokenPath, 'utf-8');
      return JSON.parse(tokenFile);
    } catch (err) {
      logger.info('No token file found, authorization required');
      return null;
    }
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
      await this.saveTokenToFile(credentials);
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
      logger.info(`Please authorize this app by visiting this URL: ${this.authUrl}`);

      // ローカルサーバーを起動してOAuth2コールバックを処理
      const server = createServer(async (req, res) => {
        try {
          const url = parse(req.url || '', true);
          if (url.pathname === '/oauth2callback') {
            const code = url.query.code as string;
            if (!code) {
              throw new Error('No code parameter in callback URL');
            }

            // コードからトークンを取得
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // トークンをファイルに保存
            await this.saveTokenToFile(tokens);

            // レスポンスを返してブラウザを閉じるよう促す
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h3>Authentication was successful. Please close this window and continue.</h3></body></html>`);

            // サーバーを閉じてプロミスを解決
            server.close(() => {
              this.authorizationPromise = null;
              resolve(this.oauth2Client);
            });
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (error) {
          logger.error(`Error in authorization callback: ${error}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h3>Authentication error: ${error}</h3></body></html>`);
          server.close(() => {
            this.authorizationPromise = null;
            reject(error);
          });
        }
      });

      server.listen(config.server.port, config.server.host, () => {
        logger.info(`Waiting for authorization on ${config.server.host}:${config.server.port}...`);
      });

      // エラーハンドリング
      server.on('error', (error) => {
        logger.error(`Server error: ${error}`);
        this.authorizationPromise = null;
        reject(error);
      });
    });

    return this.authorizationPromise;
  }

  // トークンをファイルに保存
  private async saveTokenToFile(token: any): Promise<void> {
    try {
      await fs.writeFile(config.google.tokenPath, JSON.stringify(token));
      logger.info(`Token saved to ${config.google.tokenPath}`);
    } catch (error) {
      logger.error(`Error saving token: ${error}`);
      throw error;
    }
  }
}

export default new GoogleAuth();
