// src/__tests__/auth/token-manager.test.ts
import { tokenManager } from '../../auth/token-manager';

// モックロガー
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('TokenManager', () => {
  beforeEach(() => {
    // テスト間での干渉を防ぐためにトークンをクリア
    // 通常はTokenManagerのprivateフィールドを直接操作するべきではないが
    // テストのためにprivateフィールドにアクセス
    (tokenManager as any).tokens = new Map();
    (tokenManager as any).tokenExpirations = new Map();
    
    // 時間関連のモック
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test('should store and retrieve tokens', () => {
    const userId = 'test-user';
    const token = 'test-refresh-token';
    
    tokenManager.storeToken(userId, token);
    const retrievedToken = tokenManager.getToken(userId);
    
    expect(retrievedToken).toBe(token);
  });
  
  test('should return null for non-existent tokens', () => {
    const result = tokenManager.getToken('non-existent-user');
    expect(result).toBeNull();
  });
  
  test('should handle token expiration', () => {
    const userId = 'expiring-user';
    const token = 'expiring-token';
    const expiresIn = 1000; // 1秒後に期限切れ
    
    tokenManager.storeToken(userId, token, expiresIn);
    
    // 期限切れ前
    expect(tokenManager.getToken(userId)).toBe(token);
    
    // 時間を進める（期限切れ後）
    jest.advanceTimersByTime(expiresIn + 100);
    
    // 期限切れ後はnullを返す
    expect(tokenManager.getToken(userId)).toBeNull();
  });
  
  test('should remove tokens', () => {
    const userId = 'remove-test-user';
    const token = 'token-to-remove';
    
    tokenManager.storeToken(userId, token);
    expect(tokenManager.getToken(userId)).toBe(token);
    
    tokenManager.removeToken(userId);
    expect(tokenManager.getToken(userId)).toBeNull();
  });
  
  test('should cleanup expired tokens automatically', () => {
    const userId1 = 'user1';
    const userId2 = 'user2';
    const token1 = 'token1';
    const token2 = 'token2';
    
    // 短い期限のトークンと長い期限のトークンを設定
    tokenManager.storeToken(userId1, token1, 1000); // 1秒後期限切れ
    tokenManager.storeToken(userId2, token2, 10000); // 10秒後期限切れ
    
    // 両方のトークンが取得できることを確認
    expect(tokenManager.getToken(userId1)).toBe(token1);
    expect(tokenManager.getToken(userId2)).toBe(token2);
    
    // 2秒進める（userId1のトークンのみ期限切れ）
    jest.advanceTimersByTime(2000);
    
    // クリーンアップを手動で呼び出す（通常は自動実行）
    (tokenManager as any).cleanupExpiredTokens();
    
    // 期限切れのトークンはnull、期限内のトークンは取得できる
    expect(tokenManager.getToken(userId1)).toBeNull();
    expect(tokenManager.getToken(userId2)).toBe(token2);
  });
  
  test('should handle encryption/decryption', () => {
    // 暗号化/復号化を確認するテスト
    // 同じキーを使用して複数のトークンを処理
    
    const users = ['user-a', 'user-b', 'user-c'];
    const tokens = ['token-a', 'token-b', 'token-c'];
    
    // 複数のトークンを保存
    users.forEach((userId, index) => {
      tokenManager.storeToken(userId, tokens[index]);
    });
    
    // すべてのトークンが正しく取得できることを確認
    users.forEach((userId, index) => {
      expect(tokenManager.getToken(userId)).toBe(tokens[index]);
    });
    
    // ランダムにトークンを削除
    tokenManager.removeToken(users[1]);
    
    // 削除されたトークンはnull、他のトークンは利用可能
    expect(tokenManager.getToken(users[0])).toBe(tokens[0]);
    expect(tokenManager.getToken(users[1])).toBeNull();
    expect(tokenManager.getToken(users[2])).toBe(tokens[2]);
  });
});
