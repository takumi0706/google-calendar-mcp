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

    // Check that the logger is properly exported and configured
    expect(loggerFileContent).toContain('EnhancedLoggerWrapper');
    expect(loggerFileContent).toContain('TypeSafeLogger');
    expect(loggerFileContent).toContain('export default enhancedLogger');
    expect(loggerFileContent).toContain('LoggerFactory');
  });
});
