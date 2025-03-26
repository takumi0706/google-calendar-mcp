import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/config';
import logger from '../utils/logger';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';

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

  // トークンを取得または更新（ファイル保存は行わず、メモリ上に保持）
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    // すでに資格情報が設定されていればそのまま返す
    if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
      // 有効期限切れチェックが必要な場合はここで実施
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

  // トークンの更新（ファイル保存は行わない）
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
      logger.info(`Please authorize this app by visiting this URL: ${this.authUrl}`);

      try {
        open(this.authUrl);
        logger.info('Opening browser for authorization...');
      } catch (error) {
        logger.warn(`Failed to open browser automatically: ${error}`);
        logger.info(`Please open this URL manually: ${this.authUrl}`);
      }

      const server = createServer(async (req, res) => {
        try {
          const url = parse(req.url || '', true);
          if (url.pathname === '/oauth2callback') {
            const code = url.query.code as string;
            if (!code) {
              throw new Error('No code parameter in callback URL');
            }

            // コードからトークン取得
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // レスポンスを返す
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h3>Authentication was successful. Please close this window and continue.</h3></body></html>`);

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

      server.on('error', (error) => {
        logger.error(`Server error: ${error}`);
        this.authorizationPromise = null;
        reject(error);
      });
    });

    return this.authorizationPromise;
  }
}

export default new GoogleAuth();