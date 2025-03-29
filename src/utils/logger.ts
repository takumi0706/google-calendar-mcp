// Simple console-based logger that outputs to stderr to avoid interfering with JSON-RPC
// This ensures that all logs go to stderr and don't interfere with stdout which is used for JSON-RPC

const customLogger = {
  // Error logs - these are always shown
  error: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[ERROR] ${message}${metaStr}`);
  },

  // Warning logs - these are important for troubleshooting
  warn: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[WARN] ${message}${metaStr}`);
  },

  // Info logs - output to stderr to avoid interfering with JSON-RPC
  info: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[INFO] ${message}${metaStr}`);
  },

  // HTTP logs - output to stderr to avoid interfering with JSON-RPC
  http: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[HTTP] ${message}${metaStr}`);
  },

  // Verbose logs - output to stderr to avoid interfering with JSON-RPC
  verbose: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[VERBOSE] ${message}${metaStr}`);
  },

  // Silly logs - output to stderr to avoid interfering with JSON-RPC
  silly: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[SILLY] ${message}${metaStr}`);
  },

  // Debug logs - output to stderr to avoid interfering with JSON-RPC
  debug: (message: string, meta?: any) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[DEBUG] ${message}${metaStr}`);
  }
};

export default customLogger;
