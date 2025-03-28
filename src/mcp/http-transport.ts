import { JSONRPCMessage, JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response, Router } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import config from '../config/config';

/**
 * HTTP/JSON transport for MCP server
 * 
 * This transport implements bidirectional communication over HTTP with JSON-RPC messages.
 * It supports OAuth 2.1 authentication and JSON-RPC batch processing.
 */
export class HttpJsonServerTransport {
  private app: express.Application;
  private router: Router;
  private server: any;
  private sessionId: string;
  private port: number;
  private host: string;
  private authTokens: Map<string, string> = new Map(); // sessionId -> token
  private pendingMessages: Map<string, JSONRPCMessage[]> = new Map(); // sessionId -> messages

  // Callbacks
  public onmessage?: (message: JSONRPCMessage) => Promise<void>;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;

  constructor(port: number = 3000, host: string = 'localhost') {
    this.port = port;
    this.host = host;
    this.sessionId = randomUUID();

    // Create Express app
    this.app = express();
    this.router = Router();

    // Configure middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '4mb' }));

    // Rate limiting
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests, please try again later.'
    });
    this.app.use('/api', apiLimiter);

    // Setup routes
    this.setupRoutes();

    // Add OAuth callback route
    this.app.get('/oauth2callback', (req: Request, res: Response) => {
      logger.debug('Received OAuth callback, redirecting to auth server');
      const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      res.redirect(`http://${config.auth.host}:${config.auth.port}/oauth2callback${queryString}`);
    });

    // Use router
    this.app.use('/mcp', this.router);
  }

  /**
   * Setup HTTP routes for the transport
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.router.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // Authentication endpoint
    this.router.post('/auth', (req: Request, res: Response) => {
      try {
        const { token } = req.body;
        if (!token) {
          return res.status(401).json({ error: 'Authentication token required' });
        }

        // Store token for the session
        this.authTokens.set(this.sessionId, token);

        res.status(200).json({ 
          status: 'authenticated',
          sessionId: this.sessionId
        });
      } catch (error) {
        logger.error(`Authentication error: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Message endpoint - receive messages from client
    this.router.post('/message', async (req: Request, res: Response) => {
      try {
        const { sessionId } = req.query;

        // Validate session
        if (!sessionId || typeof sessionId !== 'string' || !this.authTokens.has(sessionId)) {
          return res.status(401).json({ error: 'Invalid or missing session ID' });
        }

        // Process message(s)
        const body = req.body;

        // Handle batch requests (array of messages)
        if (Array.isArray(body)) {
          const validMessages: JSONRPCMessage[] = [];
          const errors: any[] = [];

          // Validate each message in the batch
          for (let i = 0; i < body.length; i++) {
            try {
              const parsedMessage = JSONRPCMessageSchema.parse(body[i]);
              validMessages.push(parsedMessage);
            } catch (error) {
              errors.push({
                index: i,
                error: `Invalid message format: ${error}`
              });
            }
          }

          // Process valid messages
          if (validMessages.length > 0 && this.onmessage) {
            for (const message of validMessages) {
              await this.onmessage(message);
            }
          }

          // Return response with any errors
          if (errors.length > 0) {
            return res.status(207).json({
              processed: validMessages.length,
              errors
            });
          }

          return res.status(202).json({ processed: validMessages.length });
        } 
        // Handle single message
        else {
          try {
            const message = JSONRPCMessageSchema.parse(body);
            if (this.onmessage) {
              await this.onmessage(message);
            }
            return res.status(202).json({ status: 'accepted' });
          } catch (error) {
            return res.status(400).json({ error: `Invalid message format: ${error}` });
          }
        }
      } catch (error) {
        logger.error(`Error processing message: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Poll endpoint - client polls for messages from server
    this.router.get('/poll', (req: Request, res: Response) => {
      try {
        const { sessionId } = req.query;

        // Validate session
        if (!sessionId || typeof sessionId !== 'string' || !this.authTokens.has(sessionId)) {
          return res.status(401).json({ error: 'Invalid or missing session ID' });
        }

        // Get pending messages for this session
        const messages = this.pendingMessages.get(sessionId as string) || [];

        // Clear pending messages
        this.pendingMessages.set(sessionId as string, []);

        // Return messages
        res.status(200).json({ messages });
      } catch (error) {
        logger.error(`Error in poll endpoint: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          logger.debug(`HTTP/JSON transport started on ${this.host}:${this.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error(`HTTP server error: ${error}`);
          if (this.onerror) {
            this.onerror(error);
          }
          reject(error);
        });
      } catch (error) {
        logger.error(`Failed to start HTTP server: ${error}`);
        if (this.onerror) {
          this.onerror(error as Error);
        }
        reject(error);
      }
    });
  }

  /**
   * Close the HTTP server
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.debug('HTTP/JSON transport closed');
          if (this.onclose) {
            this.onclose();
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a message to the client
   * Messages are stored and delivered when the client polls
   */
  async send(message: JSONRPCMessage): Promise<void> {
    try {
      // Store message for each active session
      for (const sessionId of this.authTokens.keys()) {
        const messages = this.pendingMessages.get(sessionId) || [];
        messages.push(message);
        this.pendingMessages.set(sessionId, messages);
      }
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
      if (this.onerror) {
        this.onerror(error as Error);
      }
    }
  }

  /**
   * Get the base URL for the transport
   */
  getBaseUrl(): string {
    return `http://${this.host}:${this.port}/mcp`;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}
