import { config } from 'dotenv';
import logger from '../utils/logger';
import path from 'path';

// .envファイルの読み込み
config();

// 必須環境変数のチェック
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// 開発/テスト環境以外でのみ警告を表示
if (missingEnvVars.length > 0 && process.env.NODE_ENV !== 'test') {
  logger.warn(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  logger.info('Please set these variables in your .env file or environment');
}

// トークンパスの設定
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// スコープの設定
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export default {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'dummy-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    scopes: SCOPES,
    tokenPath: TOKEN_PATH,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
};