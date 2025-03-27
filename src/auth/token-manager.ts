// src/auth/token-manager.ts
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * TokenManager - セキュアなトークン管理クラス
 * 
 * トークンを暗号化してメモリ内に保存し、必要に応じて復号化して取得する
 * AES-256-GCM暗号化を使用して高いセキュリティを提供
 */
class TokenManager {
  private algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer;
  private tokens: Map<string, string> = new Map();
  private tokenExpirations: Map<string, number> = new Map();

  constructor() {
    // 環境変数から暗号化キーを取得するか、ランダムに生成する
    const keyString = process.env.TOKEN_ENCRYPTION_KEY || 
      crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(keyString, 'hex');
    
    logger.info('TokenManager initialized with secure encryption');
    
    // 定期的に期限切れトークンをクリーンアップ
    setInterval(this.cleanupExpiredTokens.bind(this), 60 * 60 * 1000); // 1時間ごと
  }

  /**
   * トークンを暗号化して保存
   * 
   * @param userId ユーザーID
   * @param token 保存するトークン
   * @param expiresIn トークンの有効期限（ミリ秒）、デフォルト30日
   */
  public storeToken(userId: string, token: string, expiresIn: number = 30 * 24 * 60 * 60 * 1000): void {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // 初期化ベクトル、認証タグ、暗号文を連結して保存
      const tokenData = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      this.tokens.set(userId, tokenData);
      
      // 有効期限を設定
      const expiryTime = Date.now() + expiresIn;
      this.tokenExpirations.set(userId, expiryTime);
      
      logger.debug(`Token stored for user: ${userId}, expires: ${new Date(expiryTime).toISOString()}`);
    } catch (error) {
      logger.error('Failed to encrypt and store token', { userId, error: error.message });
      throw new Error('Token encryption failed');
    }
  }

  /**
   * 保存されたトークンを復号化して取得
   * 
   * @param userId ユーザーID
   * @returns 復号化されたトークン、または存在しない場合はnull
   */
  public getToken(userId: string): string | null {
    const tokenData = this.tokens.get(userId);
    if (!tokenData) {
      logger.debug(`No token found for user: ${userId}`);
      return null;
    }
    
    // トークンの有効期限をチェック
    const expiry = this.tokenExpirations.get(userId);
    if (expiry && expiry < Date.now()) {
      logger.debug(`Token expired for user: ${userId}`);
      this.removeToken(userId);
      return null;
    }
    
    try {
      const [ivHex, authTagHex, encrypted] = tokenData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt token', { userId, error: error.message });
      return null;
    }
  }

  /**
   * トークンを削除
   * 
   * @param userId ユーザーID
   */
  public removeToken(userId: string): void {
    this.tokens.delete(userId);
    this.tokenExpirations.delete(userId);
    logger.debug(`Token removed for user: ${userId}`);
  }

  /**
   * 期限切れのトークンをクリーンアップ
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [userId, expiry] of this.tokenExpirations.entries()) {
      if (expiry < now) {
        this.removeToken(userId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.info(`Cleaned up ${expiredCount} expired tokens`);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const tokenManager = new TokenManager();
