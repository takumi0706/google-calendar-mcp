import express from 'express';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';

// JSON-RPC 2.0 レスポンス型
interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class McpServer {
  private app = express();
  private server: any = null;

  constructor() {
    this.setup();
  }

  private setup() {
    this.app.use(express.json());

    // MCP ツールリスト取得エンドポイント
    this.app.post('/mcp/v1/tools', (req, res) => {
      // JSON-RPC形式のリクエストからIDを取得
      const { id = null } = req.body;
      
      // JSON-RPC 2.0形式のレスポンスを返す
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        result: { tools }
      };
      
      res.json(response);
      logger.info(`Tools list requested, responding with ${tools.length} tools`);
    });

    // ツール実行エンドポイント
    this.app.post('/mcp/v1/tools/:name', async (req, res) => {
      try {
        const { name } = req.params;
        const { id = null, params } = req.body;
        
        logger.info(`Tool execution requested: ${name}`);

        // 対応するツールの検索
        const tool = tools.find(t => t.name === name);
        if (!tool) {
          // JSON-RPC 2.0エラーレスポンス
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Tool ${name} not found`,
              data: { 
                content: `ツール ${name} が見つかりません。`
              }
            }
          };
          return res.status(404).json(errorResponse);
        }

        // ツールのハンドラを実行
        const result = await tool.handler(params);
        
        // JSON-RPC 2.0成功レスポンス
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id,
          result
        };
        
        return res.json(response);
      } catch (error) {
        logger.error(`Error executing tool: ${error}`);
        
        // JSON-RPC 2.0エラーレスポンス
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32000,
            message: `Internal error`,
            data: { 
              content: `ツールの実行中にエラーが発生しました: ${error}`
            }
          }
        };
        
        return res.status(500).json(errorResponse);
      }
    });

    // ヘルスチェックエンドポイント
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(config.server.port, () => {
        logger.info(`MCP Server started on http://${config.server.host}:${config.server.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error | undefined) => {
          if (err) {
            logger.error(`Error stopping server: ${err}`);
            reject(err);
          } else {
            logger.info('MCP Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

export default new McpServer();