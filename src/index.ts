#!/usr/bin/env node

import mcpServer from './mcp/server';
import logger from './utils/logger';
import oauthAuth from './auth/oauth-auth';

// プロセス終了時の処理
process.on('SIGINT', async () => {
  logger.debug('Received SIGINT. Graceful shutdown...');
  await mcpServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.debug('Received SIGTERM. Graceful shutdown...');
  await mcpServer.stop();
  process.exit(0);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

// サーバー起動
async function main() {
  try {
    // サーバーを起動する前に認証を初期化
    logger.debug('Initializing Google Calendar authentication...');
    await oauthAuth.getAuthenticatedClient();

    await mcpServer.start();
    logger.debug('Google Calendar MCP Server is running');
    logger.debug('このサーバーはGoogle Calendarへのアクセスを提供します');
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main();
