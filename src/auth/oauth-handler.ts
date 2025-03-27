// src/auth/oauth-handler.ts
import crypto from 'crypto';
import { Express, Request, Response } from 'express';
import { google } from 'googleapis';
import { tokenManager } from './token-manager';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';

/**
 * OAuthHandler - セキュアなOAuth認証フロー管理クラス
 * 
 * CSRF対策としてstateパラメータを使用し、
 * PKCE (Proof Key for Code Exchange)を実装して認証を強化
 */
export class OAuthHandler {
  private stateMap: Map<string, { expiry: number, redirectUri: string, codeVerifier: string }> = new Map();
  
  constructor(private app: Express) {
    this.setupRoutes();
    // 定期的に期限切れのstate値をクリーンアップ
    setInterval(this.cleanupExpiredStates.bind(this), 30 * 60 * 1000); // 30分ごと
  }
  
  /**
   * OAuth関連のルートを設定
   */
  private setupRoutes() {
    // OAuth リダイレクトエンドポイント
    this.app.get('/oauth2callback', this.handleOAuthCallback.bind(this));
  }
  
  /**
   * 認証URLを生成
   * 
   * @param userId ユーザーID
   * @param redirectUri 認証成功後のリダイレクトURI
   * @returns 認証URL
   */
  public generateAuthUrl(userId: string, redirectUri: string): string {
    // CSRF対策のためのランダムなstate値
    const state = crypto.randomBytes(32).toString('hex');
    
    // PKCE用のcode_verifier生成
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    // 10分後に期限切れになるよう設定
    const expiry = Date.now() + 10 * 60 * 1000;
    this.stateMap.set(state, { expiry, redirectUri, codeVerifier });
    
    logger.info('Generated auth URL with PKCE', { state, redirectUri });
    
    // OAuth認証URLを生成
    const oauth2Client = this.getOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state,
      // PKCE拡張の実装
      // GoogleのOAuth2クライアントが期待する型に合わせる
      code_challenge_method: 'S256', // 型キャストを削除
      code_challenge: codeChallenge
    });
  }
  
  /**
   * OAuth認証コールバックハンドラ
   */
  private async handleOAuthCallback(req: Request, res: Response) {
    const { code, state, error } = req.query;
    
    // エラーチェック
    if (error) {
      logger.error('OAuth error', { error });
      return res.status(400).send(`認証エラー: ${error}`);
    }
    
    // stateパラメータチェック
    if (!state || typeof state !== 'string') {
      logger.error('Missing state parameter');
      return res.status(400).send('不正なリクエスト: stateパラメータがありません');
    }
    
    // stateの検証
    const stateData = this.stateMap.get(state);
    if (!stateData) {
      logger.error('Invalid state parameter', { state });
      return res.status(400).send('認証に失敗しました: 無効なstateパラメータです');
    }
    
    // 期限切れチェック
    if (stateData.expiry < Date.now()) {
      logger.error('Expired state parameter', { state, expiry: stateData.expiry });
      this.stateMap.delete(state);
      return res.status(400).send('認証に失敗しました: 認証フローの期限が切れました');
    }
    
    // codeパラメータチェック
    if (!code || typeof code !== 'string') {
      logger.error('Missing code parameter');
      return res.status(400).send('不正なリクエスト: codeパラメータがありません');
    }
    
    try {
      const oauth2Client = this.getOAuthClient();
      
      // PKCEのcode_verifierを使用して認証コードをトークンと交換
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier: stateData.codeVerifier
      });
      
      // stateを使い終わったら削除
      this.stateMap.delete(state);
      
      // ユーザーIDを特定（実際の実装ではユーザー認証が必要）
      // 現時点ではシンプルな実装として'default-user'を使用
      const userId = 'default-user';
      
      // トークンを暗号化して保存
      if (tokens.refresh_token) {
        tokenManager.storeToken(userId, tokens.refresh_token);
        logger.info('Successfully obtained and stored refresh token', { userId });
      } else {
        logger.warn('No refresh token in the response', { userId });
      }
      
      // アクセストークンは必要に応じて短期間だけ保存
      if (tokens.access_token) {
        const expiresIn = tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600 * 1000;
        tokenManager.storeToken(`${userId}_access`, tokens.access_token, expiresIn);
        logger.debug('Stored access token', { userId, expiresIn });
      }
      
      // リダイレクト
      res.redirect(stateData.redirectUri || '/auth-success');
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('OAuth token exchange failed', { error: error.message, stack: error.stack });
      res.status(500).send('トークン交換に失敗しました。');
    }
  }
  
  /**
   * PKCE用のcode_verifierを生成
   * @returns ランダムなcode_verifier文字列
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * PKCE用のcode_challengeを生成
   * @param codeVerifier code_verifier
   * @returns SHA-256ハッシュされたcode_challenge
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
   * 期限切れのstate値をクリーンアップ
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
   * OAuth2クライアントを取得
   */
  private getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError(
        ErrorCode.CONFIGURATION_ERROR,
        'Google OAuth設定が不足しています',
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
