import express from 'express';
import { tools } from './tools';
import logger from '../utils/logger';
import config from '../config/config';

class McpServer {
  private app = express();
  private server: any = null;

  constructor() {
    this.setup();
  }

  private setup() {
    this.app.use(express.json());

    // MCPプロトコルのエンドポイント
    this.app.post('/mcp/v1/tools', (req, res) => {
      // MCP形式のレスポンスを構築
      const response = {
        jsonrpc: "2.0",
        id: req.body.id || null,
        result: { tools }
      };
      res.json(response);
    });

    // ツール実行エンドポイント
    this.app.post('/mcp/v1/tools/:name', async (req, res) => {
      const { name } = req.params;
      const params = req.body.params || req.body;
      const id = req.body.id || null;

      // 対応するツールの検索
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        // JSON-RPC形式のエラーレスポンス
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `ツール ${name} が見つかりません。`
          }
        });
      }

      try {
        // ツールのハンドラを実行
        const result = await tool.handler(params);
        // 正しいJSON-RPC形式のレスポンスを返す
        return res.json({
          jsonrpc: "2.0",
          id,
          result
        });
      } catch (error) {
        logger.error(`Error executing tool ${name}: ${error}`);
        // JSON-RPC形式のエラーレスポンス
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: `ツール ${name} の実行中にエラーが発生しました: ${error}`
          }
        });
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