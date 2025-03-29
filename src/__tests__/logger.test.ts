import fs from 'fs';
import path from 'path';

// This test verifies that the logger is correctly configured to send
// all logs to stderr to avoid interfering with JSON-RPC
describe('Logger', () => {
  // The custom logger implementation outputs all logs to stderr using console.error
  // This ensures that logs don't interfere with stdout which is used for JSON-RPC

  // We can verify this by checking the logger.ts file directly
  test('logger should be configured correctly', () => {
    // Read the logger.ts file
    const loggerFilePath = path.resolve(__dirname, '../utils/logger.ts');
    const loggerFileContent = fs.readFileSync(loggerFilePath, 'utf8');

    // Check that all log levels use console.error
    expect(loggerFileContent).toContain('console.error(`[ERROR]');
    expect(loggerFileContent).toContain('console.error(`[WARN]');
    expect(loggerFileContent).toContain('console.error(`[INFO]');
    expect(loggerFileContent).toContain('console.error(`[DEBUG]');
  });
});
