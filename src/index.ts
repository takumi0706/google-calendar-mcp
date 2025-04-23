#!/usr/bin/env node

import mcpServer from './mcp/server';
import logger from './utils/logger';
import oauthAuth from './auth/oauth-auth';

// Process termination handling
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

// Server startup
async function main() {
  try {
    await oauthAuth.getAuthenticatedClient();
    await mcpServer.start();
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main();
