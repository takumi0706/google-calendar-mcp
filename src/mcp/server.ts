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
      res.json({ tools });
    });

    // ツール実行エンドポイント
    this.app.post('/mcp/v1/tools/:name', async (req, res) => {
      const { name } = req.params;
      const params = req.body;

      // 対応するツールの検索
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        return res.status(404).json({
          success: false,
          content: `ツール ${name} が見つかりません。`,
        });
      }

      try {
        // ツールのハンドラを実行
        const result = await tool.handler(params);
        return res.json(result);
      } catch (error) {
        logger.error(`Error executing tool ${name}: ${error}`);
        return res.status(500).json({
          success: false,
          content: `ツール ${name} の実行中にエラーが発生しました: ${error}`,
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
        this.server.close(err => {
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
