// jest型定義は自動的に利用されるため、明示的なインポートは不要
import config from '../config/config';

// 環境変数を一時的にモック
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
});

// テスト後にモックを元に戻す
afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
});

describe('Config', () => {
  it('should have google configuration', () => {
    expect(config.google).toBeDefined();
    expect(config.google.clientId).toBeDefined();
    expect(config.google.clientSecret).toBeDefined();
    expect(config.google.redirectUri).toBeDefined();
    expect(config.google.scopes).toBeInstanceOf(Array);
  });

  it('should have server configuration', () => {
    expect(config.server).toBeDefined();
    expect(config.server.port).toBeDefined();
    expect(typeof config.server.port).toBe('number');
    expect(config.server.host).toBeDefined();
  });
});