import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from '../utils/logger';
import {
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import toolsManager from './tools';

class GoogleCalendarMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private isRunning = false;

  constructor() {
    // MCPサーバーの設定
    this.server = new McpServer({ 
      name: 'google-calendar-mcp',
      version: '0.4.2',
    });

    // Stdioトランスポートの設定
    this.transport = new StdioServerTransport();

    // オリジナルメッセージ処理は setupMessageLogging() で上書きされる
    this.transport.onmessage = async (_message: JSONRPCMessage): Promise<void> => {};

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
      const match = cleanedMessage.match(/(\{.*|\[.*)/s);
      if (match) {
        return JSON.parse(match[0]);
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
    // 直接サーバーのメッセージをインターセプトする方法がないため
    // トランスポートの機能を拡張
    const originalSend = this.transport.send.bind(this.transport);
    this.transport.send = async (message: JSONRPCMessage): Promise<void> => {
      try {
        // 送信前に文字列に変換し、確実に改行で終わるようにする
        const messageStr = JSON.stringify(message);
        logger.info(`Message from server: ${messageStr}`);
      } catch (err) {
        logger.error(`Error logging server message: ${err}`);
      }
      return await originalSend(message);
    };

    // クライアントからのメッセージ処理を改善
    const originalOnMessage = this.transport.onmessage;
    this.transport.onmessage = async (message: any): Promise<void> => {
      try {
        // メッセージが文字列の場合は、適切にパース
        if (typeof message === 'string') {
          message = this.processJsonRpcMessage(message);
        }
        logger.info(`Message from client: ${JSON.stringify(message)}`);
        if (originalOnMessage) {
          return await originalOnMessage(message);
        }
      } catch (err) {
        logger.error(`Error processing client message: ${err}`);
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

      // サーバーとトランスポートの接続
      // MCP SDKの仕様に従い、stdioトランスポートを使用
      await this.server.connect(this.transport);

      // エラーハンドリングを追加
      this.transport.onerror = (error: Error): void => {
        logger.error(`Transport error: ${error}`, { context: 'transport' });
      };

      this.transport.onclose = (): void => {
        logger.info('Transport closed');
        this.isRunning = false;
      };

      logger.info(`Server started and connected successfully`);
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
      // サーバーの切断
      await this.server.close();
      this.isRunning = false;
      logger.info('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${error}`);
      throw error;
    }
  }
}

export default new GoogleCalendarMcpServer();
