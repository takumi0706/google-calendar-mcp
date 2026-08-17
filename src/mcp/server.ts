import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import logger from '../utils/logger';
import toolsManager from './tools';
import { version } from '../../package.json';
import { ResourceProvider } from './resource-provider';
import { PromptProvider } from './prompt-provider';
import calendarApi from '../calendar/calendar-api';
import { tokenManager } from '../auth/token-manager';
import { describeError } from '../utils/format-error';

/**
 * Build a fully configured MCP server instance.
 *
 * serveStdio は接続ごとにこのファクトリを呼ぶ。プロトコルのどの世代で
 * 応答するかは開始時のやり取りで決まり、その接続の間は1つのインスタンスが
 * 固定される。したがってサーバーはモジュール読み込み時ではなく、
 * ここで組み立てる必要がある。
 */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: 'google-calendar-mcp',
    version,
  });

  // capabilities は registerTool / registerPrompt / registerResource の
  // 呼び出しから SDK が導出する。以前は registerCapabilities に Zod の生
  // インスタンスを渡しており、initialize レスポンスに Zod の内部構造が
  // そのまま載っていた（仕様上 capabilities.tools は listChanged のみ）。
  toolsManager.registerTools(server);
  registerPrompts(server);
  registerResources(server);

  return server;
}

/**
 * プロンプトを登録する
 *
 * 以前は prompts/list だけを setRequestHandler で実装しており、
 * prompts/get のハンドラが無かったため、広告した10個のプロンプトはどれも
 * 取得できず Method not found になっていた。registerPrompt を使えば
 * list と get の両方が SDK 側で用意される。
 */
function registerPrompts(server: McpServer): void {
  const promptProvider = new PromptProvider();

  for (const prompt of promptProvider.getPromptList().prompts) {
    server.registerPrompt(
      prompt.name,
      { description: prompt.description },
      () => ({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: prompt.text },
          },
        ],
      })
    );
  }

  logger.debug(`Registered ${promptProvider.getPromptList().prompts.length} prompts`);
}

/**
 * リソースを登録する
 */
function registerResources(server: McpServer): void {
  const resourceProvider = new ResourceProvider();

  for (const resource of resourceProvider.getResourceList().resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: 'application/json' },
      async () => {
        logger.debug(`Handling resources/read request with URI: ${resource.uri}`);
        const result = await resourceProvider.readResource(resource.uri);

        // ResourceProvider は { resource: { uri, data, contents } } を返すが、
        // MCP の ReadResourceResult は { contents: [{ uri, mimeType, text }] }。
        // 従来はそのまま返しており、しかも contents は常に空だった。
        return {
          contents: [
            {
              uri: result.resource.uri,
              mimeType: 'application/json',
              text: JSON.stringify(result.resource.data, null, 2),
            },
          ],
        };
      }
    );
  }

  logger.debug(`Registered ${resourceProvider.getResourceList().resources.length} resources`);
}

class GoogleCalendarMcpServer {
  private handle: StdioServerHandle | null = null;

  public start(): void {
    if (this.handle) {
      return;
    }

    logger.debug('Initializing server...');

    this.handle = serveStdio(() => buildServer(), {
      onerror: (error) => {
        logger.error(`STDIO transport error: ${error.message}`, { context: 'stdio-transport' });
      },
    });

    logger.debug('Server started and connected successfully with STDIO transport');
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  public cleanup(): void {
    try {
      calendarApi.destroy();
      tokenManager.stopCleanupTimer();
      logger.debug('Resources cleaned up successfully');
    } catch (error) {
      logger.error(`Error during cleanup: ${describeError(error)}`);
    }
  }

  public async stop(): Promise<void> {
    if (!this.handle) {
      return;
    }

    try {
      this.cleanup();
      await this.handle.close();
      this.handle = null;
      logger.debug('MCP Server stopped');
    } catch (error) {
      logger.error(`Error stopping server: ${describeError(error)}`);
      throw error;
    }
  }
}

// プロセスシグナルの購読は index.ts が一元的に行う。以前はここでも
// SIGINT/SIGTERM/uncaughtException を登録しており、index.ts 側の
// 「ログを流し切ってから終了する」処理を必ず追い越して落ちていた。
export default new GoogleCalendarMcpServer();
