import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import {
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import toolsManager from './tools';
import { HttpJsonServerTransport } from './http-transport';
import config from '../config/config';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private stdioTransport: StdioServerTransport;
  private httpTransport: HttpJsonServerTransport;
  private isRunning = false;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: '0.6.4',
    });

    // Stdioトランスポートの設定
    this.stdioTransport = new StdioServerTransport();

    // HTTP/JSONトランスポートの設定
    this.httpTransport = new HttpJsonServerTransport(
      config.server.port || 3000,
      config.server.host || 'localhost'
    );

    // オリジナルメッセージ処理は setupMessageLogging() で上書きされる
    this.stdioTransport.onmessage = async (_message: JSONRPCMessage): Promise<void> => {};
    this.httpTransport.onmessage = async (_message: JSONRPCMessage): Promise<void> => {};

    // メッセージ処理用の追加リスナー設定
    this.setupMessageLogging();

    // ツールの登録（先に実行して tools プロパティを設定）
    this.registerTools();

    // リソースとプロンプトのリスト機能を実装（ツール登録後に実行）
    this.implementResourcesAndPrompts();
  }

  // メッセージ処理用のヘルパー関数を追加
  private processJsonRpcMessage(message: string): any {
    try {
      // 特殊文字やBOMの除去
      const cleanedMessage = message.replace(/^\uFEFF/, '').trim();

      // 複数JSONオブジェクトが連結されている可能性があるので最初の有効なJSONだけを解析
      // 非貪欲マッチングを使用して、最小限のJSONオブジェクトまたは配列を抽出
      // 正規表現を改善して、JSONオブジェクトまたは配列の開始から終了までを正確に抽出
      const objectMatch = cleanedMessage.match(/(\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\})/);
      const arrayMatch = cleanedMessage.match(/(\[(?:[^[\]]|(?:\[(?:[^[\]]|(?:\[[^[\]]*\]))*\]))*\])/);

      // オブジェクトまたは配列のマッチが見つかった場合、それを解析
      if (objectMatch || arrayMatch) {
        const matchToUse = objectMatch ? objectMatch[0] : arrayMatch![0];
        try {
          return JSON.parse(matchToUse);
        } catch (e) {
          logger.debug(`Failed to parse matched JSON: ${e}`);
          // 失敗した場合は次の方法を試す
        }
      }

      // JSONの開始位置を見つける
      const jsonStartIndex = cleanedMessage.indexOf('{');
      const arrayStartIndex = cleanedMessage.indexOf('[');

      // 両方見つかった場合は、より早く出現する方を使用
      let startIndex = -1;
      if (jsonStartIndex >= 0 && arrayStartIndex >= 0) {
        startIndex = Math.min(jsonStartIndex, arrayStartIndex);
      } else if (jsonStartIndex >= 0) {
        startIndex = jsonStartIndex;
      } else if (arrayStartIndex >= 0) {
        startIndex = arrayStartIndex;
      }

      // 開始位置が見つかった場合、その位置から解析を試みる
      if (startIndex >= 0) {
        // 開始位置から文字列の終わりまでを取得
        const jsonSubstring = cleanedMessage.substring(startIndex);

        // JSONオブジェクトの終了位置を見つける試み
        if (cleanedMessage[startIndex] === '{') {
          // オブジェクトの場合、対応する閉じ括弧を探す
          let depth = 0;
          let endIndex = -1;

          for (let i = startIndex; i < cleanedMessage.length; i++) {
            if (cleanedMessage[i] === '{') depth++;
            else if (cleanedMessage[i] === '}') {
              depth--;
              if (depth === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }

          if (endIndex > startIndex) {
            try {
              const jsonObject = cleanedMessage.substring(startIndex, endIndex);
              return JSON.parse(jsonObject);
            } catch (e) {
              logger.debug(`Failed to parse balanced JSON object: ${e}`);
            }
          }
        } else if (cleanedMessage[startIndex] === '[') {
          // 配列の場合、対応する閉じ括弧を探す
          let depth = 0;
          let endIndex = -1;

          for (let i = startIndex; i < cleanedMessage.length; i++) {
            if (cleanedMessage[i] === '[') depth++;
            else if (cleanedMessage[i] === ']') {
              depth--;
              if (depth === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }

          if (endIndex > startIndex) {
            try {
              const jsonArray = cleanedMessage.substring(startIndex, endIndex);
              return JSON.parse(jsonArray);
            } catch (e) {
              logger.debug(`Failed to parse balanced JSON array: ${e}`);
            }
          }
        }

        // バランスの取れたJSONが見つからない場合、サブ文字列全体を解析
        try {
          return JSON.parse(jsonSubstring);
        } catch (e) {
          // 失敗した場合は、次の方法を試す
          logger.debug(`Failed to parse JSON substring: ${e}`);
        }
      }

      // 通常の解析も試す
      return JSON.parse(cleanedMessage);
    } catch (error) {
      logger.error(`Error parsing JSON-RPC message: ${error}`);
      logger.debug(`Problematic message: "${message}"`);
      throw error;
    }
  }

  private setupMessageLogging(): void {
    // StdioTransportのメッセージロギング設定
    this.setupStdioMessageLogging();

    // HttpTransportのメッセージロギング設定
    this.setupHttpMessageLogging();
  }

  private setupStdioMessageLogging(): void {
    // 直接サーバーのメッセージをインターセプトする方法がないため
    // トランスポートの機能を拡張
    const originalSend = this.stdioTransport.send.bind(this.stdioTransport);
    this.stdioTransport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        // 送信前に文字列に変換し、確実に改行で終わるようにする
        const messageStr = JSON.stringify(message);
        logger.info(`[STDIO] Message from server: ${messageStr}`);
      } catch (err) {
        logger.error(`[STDIO] Error logging server message: ${err}`);
      }
      return await originalSend(message);
    };

    // クライアントからのメッセージ処理を改善
    const originalOnMessage = this.stdioTransport.onmessage;
    this.stdioTransport.onmessage = async (message: any): Promise<void> => {
      try {
        // メッセージが文字列の場合は、適切にパース
        if (typeof message === 'string') {
          message = this.processJsonRpcMessage(message);
        }
        logger.info(`[STDIO] Message from client: ${JSON.stringify(message)}`);
        if (originalOnMessage) {
          return await originalOnMessage(message);
        }
      } catch (err) {
        logger.error(`[STDIO] Error processing client message: ${err}`);
      }
    };
  }

  private setupHttpMessageLogging(): void {
    // HTTP/JSONトランスポートのメッセージロギング設定
    const originalHttpSend = this.httpTransport.send.bind(this.httpTransport);
    this.httpTransport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        const messageStr = JSON.stringify(message);
        logger.info(`[HTTP] Message from server: ${messageStr}`);
      } catch (err) {
        logger.error(`[HTTP] Error logging server message: ${err}`);
      }
      return await originalHttpSend(message);
    };

    // クライアントからのHTTPメッセージ処理
    const originalHttpOnMessage = this.httpTransport.onmessage;
    this.httpTransport.onmessage = async (message: any): Promise<void> => {
      try {
        logger.info(`[HTTP] Message from client: ${JSON.stringify(message)}`);
        if (originalHttpOnMessage) {
          return await originalHttpOnMessage(message);
        }
      } catch (err) {
        logger.error(`[HTTP] Error processing client message: ${err}`);
      }
    };
  }

  // リソースとプロンプトのメソッド実装
  private implementResourcesAndPrompts() {
    // capabilities を登録（ツールも含める）
    this.server.server.registerCapabilities({
      resources: {},
      prompts: {},
      tools: toolsManager.tools // ツールを明示的に含める
    });

    // resources/list メソッドの実装
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('Handling resources/list request');
      // 現在はリソースを提供していないので空の配列を返す
      return { resources: [] };
    });

    // prompts/list メソッドの実装
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info('Handling prompts/list request');
      // 現在はプロンプトを提供していないので空の配列を返す
      return { prompts: [] };
    });
  }

  private registerTools() {
    // ToolsManagerを使用してツールを登録
    toolsManager.registerTools(this.server);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      logger.info('Initializing server...');

      // Start HTTP/JSON transport
      await this.httpTransport.start();
      logger.info(`HTTP/JSON transport started at ${this.httpTransport.getBaseUrl()}`);

      // Setup error handling for HTTP transport
      this.httpTransport.onerror = (error: Error): void => {
        logger.error(`HTTP transport error: ${error}`, { context: 'http-transport' });
      };

      this.httpTransport.onclose = (): void => {
        logger.info('HTTP transport closed');
      };

      // Connect server to STDIO transport
      await this.server.connect(this.stdioTransport);
      logger.info('STDIO transport connected');

      // Setup error handling for STDIO transport
      this.stdioTransport.onerror = (error: Error): void => {
        logger.error(`STDIO transport error: ${error}`, { context: 'stdio-transport' });
      };

      this.stdioTransport.onclose = (): void => {
        logger.info('STDIO transport closed');
        // Only set isRunning to false if both transports are closed
        if (!this.httpTransport) {
          this.isRunning = false;
        }
      };

      logger.info(`Server started and connected successfully with multiple transports`);
      this.isRunning = true;
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close HTTP transport
      await this.httpTransport.close();
      logger.info('HTTP transport stopped');

      // Close STDIO transport via server
      await this.server.close();
      logger.info('STDIO transport stopped');

      this.isRunning = false;
      logger.info('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
