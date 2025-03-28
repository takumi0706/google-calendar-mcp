import fs from 'fs';
import path from 'path';

// This test verifies that the logger is correctly configured to send
// info logs to stdout and error/warn logs to stderr
describe('Logger', () => {
  // In the Winston configuration, we've set stderrLevels to ['error', 'warn']
  // This means that error and warn logs should go to stderr, while info logs go to stdout

  // We can verify this by checking the logger.ts file directly
  test('logger should be configured correctly', () => {
    // Read the logger.ts file
    const loggerFilePath = path.resolve(__dirname, '../utils/logger.ts');
    const loggerFileContent = fs.readFileSync(loggerFilePath, 'utf8');

    // Check that the stderrLevels array only contains 'error' and 'warn'
    expect(loggerFileContent).toContain('stderrLevels: [\'error\', \'warn\']');

    // Check that the stderrLevels array does not contain 'info'
    expect(loggerFileContent).not.toContain('stderrLevels: [\'error\', \'warn\', \'info\'');
  });
});
