// src/config/express-security.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Expressアプリケーションにセキュリティミドルウェアを設定
 * 
 * @param app Expressインスタンス
 */
export function setupSecurityMiddleware(app: Express): void {
  // Helmet.jsを使用してセキュリティヘッダーを設定
  app.use(helmet());
  
  // レートリミッターの設定
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分間
    max: 100, // IPごとに最大100リクエスト
    standardHeaders: true,
    legacyHeaders: false,
    message: 'リクエスト数が多すぎます。しばらく経ってから再試行してください。',
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      logger.warn('Rate limit exceeded', { 
        ip: req.ip, 
        path: req.path 
      });
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_ERROR',
          message: options.message
        }
      });
    }
  });
  
  // APIエンドポイントにレートリミッターを適用
  app.use('/api/', apiLimiter);
  
  // OAuth callbackエンドポイントにも別のレートリミッターを適用
  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1時間
    max: 20, // IPごとに最大20リクエスト
    standardHeaders: true,
    legacyHeaders: false,
    message: '認証リクエスト数が多すぎます。しばらく経ってから再試行してください。'
  });
  
  app.use('/oauth2callback', authLimiter);
  
  // Content-Security-Policyの設定
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'https://www.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    })
  );
  
  // XSSプロテクション（最新のブラウザでは不要だが、古いブラウザ向けに設定）
  app.use(helmet.xssFilter());
  
  // クリックジャッキング対策
  app.use(helmet.frameguard({ action: 'deny' }));
  
  // MIMEタイプスニッフィング防止
  app.use(helmet.noSniff());
  
  // HTTP Strict Transport Security
  app.use(
    helmet.hsts({
      maxAge: 15552000, // 180日
      includeSubDomains: true,
      preload: true
    })
  );
  
  // X-Powered-By ヘッダーを削除（Express.jsを使用していることを隠す）
  app.disable('x-powered-by');
  
  // CORS設定
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', 'localhost');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });
  
  logger.info('Express security middleware configured');
}
