// src/utils/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * アプリケーションで使用するエラーコード
 */
export enum ErrorCode {
  AUTHENTICATION_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CALENDAR_ERROR = 'CALENDAR_ERROR',
  CONFIGURATION_ERROR = 'CONFIG_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TOKEN_ERROR = 'TOKEN_ERROR'
}

/**
 * アプリケーション固有のエラークラス
 * エラーコード、ステータスコード、詳細情報を含む
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    
    // Errorのプロトタイプチェーンを正しく設定（TypeScriptで継承したErrorクラスの問題を修正）
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * JSONに変換可能なエラーレスポンス
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * エラーハンドリングミドルウェア
 * ExpressアプリケーションでCLARRして適切なエラーレスポンスを返す
 */
export function handleError(err: any, req: Request, res: Response, next: NextFunction) {
  // すでにレスポンスが送信されている場合は次へ
  if (res.headersSent) {
    return next(err);
  }

  // AppErrorインスタンスの場合は構造化されたレスポンスを返す
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message
      }
    };
    
    // 開発環境では詳細情報も含める
    if (process.env.NODE_ENV !== 'production' && err.details) {
      errorResponse.error.details = err.details;
    }
    
    logger.error(`${err.code}: ${err.message}`, { 
      statusCode: err.statusCode,
      details: err.details,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(err.statusCode).json(errorResponse);
  }
  
  // Google APIエラーの場合は適切に処理
  if (err.response && err.response.data && err.response.data.error) {
    const googleError = err.response.data.error;
    const statusCode = err.response.status || 500;
    
    logger.error('Google API Error', { 
      googleError,
      statusCode,
      path: req.path,
      method: req.method
    });
    
    return res.status(statusCode).json({
      error: {
        code: ErrorCode.API_ERROR,
        message: googleError.message || 'Google APIエラー',
        details: process.env.NODE_ENV !== 'production' ? googleError : undefined
      }
    });
  }
  
  // その他の未知のエラー
  const statusCode = err.statusCode || err.status || 500;
  const errorMessage = err.message || '内部サーバーエラーが発生しました';
  
  logger.error('Unexpected error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  return res.status(statusCode).json({
    error: {
      code: ErrorCode.SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? '内部サーバーエラーが発生しました' 
        : errorMessage
    }
  });
}

/**
 * 非同期関数をラップしてエラーハンドリングを自動化
 * Express routeハンドラで使用
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
