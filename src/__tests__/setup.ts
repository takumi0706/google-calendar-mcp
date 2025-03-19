// Jest グローバル環境のセットアップ
process.env.NODE_ENV = 'test';

// テスト実行前に環境変数を設定
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// このファイルはテストではないことを明示
export default {};