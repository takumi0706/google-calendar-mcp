import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/config';
import logger from '../utils/logger';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';
import * as crypto from 'crypto';
import { escapeHtml } from '../utils/html-sanitizer';
import { CodeChallengeMethod } from 'google-auth-library/build/src/auth/oauth2client';

class GoogleAuth {
  private oauth2Client: OAuth2Client;
  private authUrl: string;
  private authorizationPromise: Promise<OAuth2Client> | null = null;
  private codeVerifier: string | null = null;
  private state: string | null = null;

  constructor() {
    // OAuth2クライアントの初期化
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // PKCE用のcode_verifierとstate parameterを生成
    this.codeVerifier = this.generateCodeVerifier();
    this.state = this.generateState();

    // code_challengeの生成
    const codeChallenge = this.generateCodeChallenge(this.codeVerifier);

    // 認証URLの生成（PKCEとstate parameterを含む）
    this.authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: config.google.scopes,
      prompt: 'select_account',
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
      state: this.state
    });
  }

  // PKCE用のcode_verifierを生成
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // code_verifierからcode_challengeを生成
  private generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return hash;
  }

  // CSRF対策用のstate parameterを生成
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
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
            // 認証コードの取得
            const code = url.query.code as string;
            if (!code) {
              throw new Error('No code parameter in callback URL');
            }

            // state パラメータの検証（CSRF対策）
            const returnedState = url.query.state as string;
            if (!returnedState || returnedState !== this.state) {
              throw new Error('Invalid state parameter - possible CSRF attack');
            }

            // PKCE を使用してコードからトークン取得
            const { tokens } = await this.oauth2Client.getToken({
              code: code,
              codeVerifier: this.codeVerifier || undefined
            });
            this.oauth2Client.setCredentials(tokens);

            // 認証成功後、セキュリティのためにcode_verifierとstateをクリア
            this.codeVerifier = null;
            this.state = null;

            // レスポンスを返す
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html lang="en"><body><h3>Authentication was successful. Please close this window and continue.</h3></body></html>`);

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
          res.end(`<html lang="en"><body><h3>Authentication error: ${escapeHtml(error)}</h3></body></html>`);
          server.close(() => {
            this.authorizationPromise = null;
            reject(error);
          });
        }
      });

      server.listen(config.auth.port, config.auth.host, () => {
        logger.info(`Waiting for authorization on ${config.auth.host}:${config.auth.port}...`);
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
