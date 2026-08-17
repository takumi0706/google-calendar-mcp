// src/auth/token-manager.ts
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * TokenManager - セキュアなトークン管理クラス
 * 
 * トークンを暗号化してメモリ内に保存し、必要に応じて復号化して取得する
 * AES-256-GCM暗号化を使用して高いセキュリティを提供
 */
/** AES-256-GCM の鍵長（バイト）。hex 表記では 64 文字になる。 */
const KEY_BYTES = 32;

/**
 * GCM の初期化ベクトル長（バイト）。
 * NIST SP 800-38D が推奨する 96 ビット。これ以外の長さは内部で追加の
 * GHASH 処理を要し、衝突耐性が下がる。
 */
const IV_BYTES = 12;

class TokenManager {
  private readonly algorithm = 'aes-256-gcm' as const;
  private encryptionKey: Buffer;
  private tokens: Map<string, string> = new Map();
  private tokenExpirations: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.encryptionKey = TokenManager.resolveEncryptionKey();

    if (typeof logger.info === 'function') {
      logger.info('TokenManager initialized with secure encryption');
    }

    // 定期的に期限切れトークンをクリーンアップ
    this.cleanupInterval = setInterval(this.cleanupExpiredTokens.bind(this), 60 * 60 * 1000); // 1時間ごと
    // タイマーがイベントループを掴んだままにしないようにする（CLI の終了を妨げるため）
    this.cleanupInterval.unref();
  }

  /**
   * 暗号化キーを解決する
   *
   * TOKEN_ENCRYPTION_KEY が指定された場合は厳密に検証する。以前は
   * Buffer.from(value, 'hex') に素通ししていたため、hex でない文字列は黙って
   * 短いバッファになり、全ゼロの鍵すら受理されていた。
   *
   * 未指定の場合はプロセス限りのランダム鍵を生成する。トークンは
   * ディスクに永続化しないため、再起動で復号できなくなる問題は起きない
   * （再認証が必要になるだけ）。
   */
  private static resolveEncryptionKey(): Buffer {
    const provided = process.env.TOKEN_ENCRYPTION_KEY;

    if (!provided) {
      return crypto.randomBytes(KEY_BYTES);
    }

    if (!/^[0-9a-fA-F]{64}$/.test(provided)) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    const key = Buffer.from(provided, 'hex');

    if (key.equals(Buffer.alloc(KEY_BYTES))) {
      throw new Error('TOKEN_ENCRYPTION_KEY must not be all zeros.');
    }

    return key;
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
      const iv = crypto.randomBytes(IV_BYTES);
      // algorithm を 'aes-256-gcm' リテラル型にしてあるため CipherGCM の
      // オーバーロードが選ばれ、getAuthTag() が型付きで使える
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

      decipher.setAuthTag(authTag);

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
