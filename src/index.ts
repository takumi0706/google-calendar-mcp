#!/usr/bin/env node

import mcpServer from './mcp/server';
import logger from './utils/logger';

/**
 * プロセスのライフサイクルはこのファイルだけが購読する。
 * 以前は mcp/server.ts でも SIGINT/SIGTERM/uncaughtException を登録しており、
 * server.ts 側の process.exit(1) が必ず先に走って、ここでのログ出力や
 * 後片付けを追い越していた。
 */
let shuttingDown = false;

async function shutdown(reason: string, exitCode: number): Promise<never> {
  if (shuttingDown) {
    process.exit(exitCode);
  }
  shuttingDown = true;

  logger.debug(`${reason}. Graceful shutdown...`);

  try {
    await mcpServer.stop();
  } catch (error) {
    logger.error(`Error during shutdown: ${error}`);
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void shutdown('Received SIGINT', 0);
});

process.on('SIGTERM', () => {
  void shutdown('Received SIGTERM', 0);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.stack ?? error.message}`);
  void shutdown('Uncaught exception', 1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  void shutdown('Unhandled rejection', 1);
});

// Server startup
async function main(): Promise<void> {
  try {
    await mcpServer.start();
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

void main();
