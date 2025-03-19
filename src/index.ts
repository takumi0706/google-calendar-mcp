#!/usr/bin/env node

import mcpServer from './mcp/server';
import logger from './utils/logger';

// プロセス終了時の処理
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Graceful shutdown...');
  await mcpServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Graceful shutdown...');
  await mcpServer.stop();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

// サーバー起動
async function main() {
  try {
    await mcpServer.start();
    logger.info('Google Calendar MCP Server is running');
    logger.info('このサーバーはGoogle Calendarへのアクセスを提供します');
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main();
