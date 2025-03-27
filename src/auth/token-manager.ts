// src/auth/token-manager.ts
import crypto from 'crypto';
import logger from '../utils/logger';

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
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 環境変数から暗号化キーを取得するか、ランダムに生成する
    const keyString = process.env.TOKEN_ENCRYPTION_KEY || 
      crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(keyString, 'hex');

    if (typeof logger.info === 'function') {
      logger.info('TokenManager initialized with secure encryption');
    }

    // 定期的に期限切れトークンをクリーンアップ
    this.cleanupInterval = setInterval(this.cleanupExpiredTokens.bind(this), 60 * 60 * 1000); // 1時間ごと
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

      // crypto.Cipher.prototype.getAuthTag は @types/node に定義されていないが、実際のNodeJSには存在する
      const authTag = (cipher as any).getAuthTag();

      // 初期化ベクトル、認証タグ、暗号文を連結して保存
      const tokenData = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      this.tokens.set(userId, tokenData);

      // 有効期限を設定
      const expiryTime = Date.now() + expiresIn;
      this.tokenExpirations.set(userId, expiryTime);

      if (typeof logger.debug === 'function') {
        logger.debug(`Token stored for user: ${userId}, expires: ${new Date(expiryTime).toISOString()}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (typeof logger.error === 'function') {
        logger.error('Failed to encrypt and store token', { userId, error: error.message });
      }
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
      if (typeof logger.debug === 'function') {
        logger.debug(`No token found for user: ${userId}`);
      }
      return null;
    }

    // トークンの有効期限をチェック
    const expiry = this.tokenExpirations.get(userId);
    if (expiry && expiry < Date.now()) {
      if (typeof logger.debug === 'function') {
        logger.debug(`Token expired for user: ${userId}`);
      }
      this.removeToken(userId);
      return null;
    }

    try {
      const [ivHex, authTagHex, encrypted] = tokenData.split(':');

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      // crypto.Decipher.prototype.setAuthTag は @types/node に定義されていないが、実際のNodeJSには存在する
      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err: unknown) {
      const error = err as Error;
      if (typeof logger.error === 'function') {
        logger.error('Failed to decrypt token', { userId, error: error.message });
      }
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
    if (typeof logger.debug === 'function') {
      logger.debug(`Token removed for user: ${userId}`);
    }
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
      if (typeof logger.info === 'function') {
        logger.info(`Cleaned up ${expiredCount} expired tokens`);
      }
    }
  }

  /**
   * クリーンアップタイマーを停止し、リソースを解放する
   * テスト環境やアプリケーション終了時に呼び出すべき
   */
  public stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      if (typeof logger.debug === 'function') {
        logger.debug('TokenManager cleanup timer stopped');
      }
    }
  }
}

// シングルトンインスタンスをエクスポート
export const tokenManager = new TokenManager();
