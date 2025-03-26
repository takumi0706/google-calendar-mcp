import winston from 'winston';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ユーザーのホームディレクトリ内にログディレクトリを作成
const LOG_DIR = path.join(os.homedir(), '.google-calendar-mcp', 'logs');

// ディレクトリが存在しなければ再帰的に作成
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error(`ログディレクトリの作成に失敗しました: ${err}`);
}

// ロガーの設定
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const contextStr = context ? `[${context}] ` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [google-calendar] [${level}] ${contextStr}${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    // ディレクトリ作成が失敗してもコンソールだけは動作するようにtry-catchで囲む
    ...(() => {
      try {
        return [
          new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'error.log'), 
            level: 'error' 
          }),
          new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'combined.log') 
          })
        ];
      } catch (err) {
        console.error(`ログファイルの設定に失敗しました: ${err}`);
        return [];
      }
    })()
  ],
});

// デバッグメソッドを追加したオリジナルロガー
const customLogger = {
  ...logger,
  // 既存のメソッドをそのまま保持
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  http: logger.http.bind(logger),
  verbose: logger.verbose.bind(logger),
  silly: logger.silly.bind(logger),
  
  // デバッグメソッドを追加
  debug: (message: string, meta?: any) => {
    if (process.env.LOG_LEVEL === 'debug') {
      logger.info(`[DEBUG] ${message}`, meta);
    }
  }
};

export default customLogger;