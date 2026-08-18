// src/auth/oauth-handler.ts
import crypto from 'crypto';
import { Hono } from 'hono';
import { OAuth2Client, CodeChallengeMethod, type Credentials } from 'google-auth-library';
import { tokenManager } from './token-manager';
import logger from '../utils/logger';
import config from '../config/config';
import { escapeHtml } from '../utils/html-sanitizer';

/** 認可フローを開始したユーザーの識別子。現状シングルユーザー運用。 */
const DEFAULT_USER_ID = 'default-user';

/** 発行済み state / code_verifier を保持する時間。RFC 8252 の推奨に沿った短命設定。 */
const PENDING_AUTH_TTL_MS = 10 * 60 * 1000;

/** 保留中の認可フローの上限。取りこぼした state によるメモリ増加を防ぐ。 */
const MAX_PENDING_AUTHORIZATIONS = 16;

/** アクセストークンの有効期限が不明な場合のフォールバック。 */
const DEFAULT_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

interface PendingAuthorization {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

function renderPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8">
  </head>
  <body>
${bodyHtml}
  </body>
</html>`;
}

/**
 * OAuthHandler - OAuth 2.0 認可コードフロー（PKCE 付き）の管理
 *
 * 以前は @hono/oauth-providers の googleAuth() ミドルウェアを使っていたが、
 * 次の理由で google-auth-library の OAuth2Client による自前実装に置き換えた。
 *
 * 1. PKCE 非対応。あのパッケージで code_challenge を送るのは X/Twitter
 *    プロバイダのみで、Google プロバイダは一切送らない。デスクトップ配布の
 *    MCP サーバーは client_secret を秘密にできないパブリッククライアントで
 *    あり、RFC 8252 §8.1 が要求する認可コード横取り対策が欠落していた。
 * 2. state を Math.random() で生成していた。暗号学的に安全でない。
 * 3. redirect_uri を c.req.url（= Host ヘッダ由来）にフォールバックしており、
 *    設定値に固定されていなかった。
 */
export class OAuthHandler {
  private app: Hono;
  private oauth2Client: OAuth2Client;
  private pendingAuthorizations: Map<string, PendingAuthorization> = new Map();

  constructor() {
    this.oauth2Client = new OAuth2Client({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      // Host ヘッダではなく設定値に固定する。Google 側の登録 URI とも一致させる。
      redirectUri: config.google.redirectUri,
    });

    this.app = new Hono();
    this.setupRoutes();
    this.warnOnRedirectUriMismatch();
  }

  /**
   * リダイレクト先が自分の待受と食い違っていないか確認する。
   *
   * GOOGLE_REDIRECT_URI と AUTH_HOST/AUTH_PORT は別々に設定できるため、
   * 食い違うと Google からのリダイレクトがローカルサーバーに届かず、
   * 認証が無言でタイムアウトする。原因が分かりにくいので警告を出す。
   */
  private warnOnRedirectUriMismatch(): void {
    const redirect = new URL(config.google.redirectUri);
    const expectedPort = String(config.auth.port);
    const actualPort = redirect.port || (redirect.protocol === 'https:' ? '443' : '80');

    if (redirect.hostname !== config.auth.host || actualPort !== expectedPort) {
      logger.warn(
        'GOOGLE_REDIRECT_URI does not point at the local OAuth server. ' +
          'Google will redirect somewhere this process is not listening and authentication will time out.',
        {
          redirectUri: config.google.redirectUri,
          listeningOn: `${config.auth.host}:${config.auth.port}`,
        }
      );
    }
  }

  private setupRoutes(): void {
    // 認可フローの開始点。ブラウザはまずここを開き、Google へリダイレクトされる。
    this.app.get('/auth/google', async (c) => {
      try {
        const { authUrl } = await this.createAuthorizationRequest();
        return c.redirect(authUrl, 302);
      } catch (error) {
        logger.error('Failed to start OAuth authorization', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return c.html(
          renderPage(
            'Authentication Error',
            '      <h3>Could not start authentication.</h3>\n' +
              '      <p>Check the server logs for details.</p>'
          ),
          500
        );
      }
    });

    // Google からのリダイレクト先。config.google.redirectUri のパスと一致させる。
    this.app.get(this.callbackPath(), async (c) => {
      const errorParam = c.req.query('error');
      if (errorParam) {
        // 認可サーバーが返した文字列はそのまま埋め込まない。
        logger.warn('Authorization denied by the authorization server', { errorParam });
        return c.html(
          renderPage(
            'Authentication Error',
            '      <h3>Authentication was denied or cancelled.</h3>\n' +
              '      <p>You can close this window and try again.</p>'
          ),
          400
        );
      }

      const code = c.req.query('code');
      const state = c.req.query('state');

      if (!code || !state) {
        logger.warn('OAuth callback missing code or state');
        return c.html(
          renderPage('Authentication Error', '      <h3>Invalid authentication response.</h3>'),
          400
        );
      }

      try {
        await this.completeAuthorization(code, state);
        return c.html(
          renderPage(
            'Authentication Successful',
            '      <h3>Authentication succeeded. Please close this window to continue.</h3>\n' +
              '      <script>window.close();</script>'
          )
        );
      } catch (error) {
        // error.message は Google のトークンエンドポイント由来の文字列が入りうる。
        // 反射型 XSS を避けるためページには出さず、ログにのみ残す。
        logger.error('OAuth callback error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return c.html(
          renderPage(
            'Authentication Error',
            '      <h3>An authentication error has occurred.</h3>\n' +
              '      <p>Check the server logs for details.</p>'
          ),
          500
        );
      }
    });

    this.app.get('/auth-success', (c) =>
      c.html(
        renderPage(
          'Authentication Successful',
          '      <h3>Authentication succeeded. Please close this window to continue.</h3>'
        )
      )
    );
  }

  /** config.google.redirectUri からコールバックのパス部分を取り出す。 */
  private callbackPath(): string {
    return new URL(config.google.redirectUri).pathname;
  }

  /**
   * state と code_verifier を新規に発行し、Google の認可 URL を組み立てる。
   */
  private async createAuthorizationRequest(): Promise<{ authUrl: string; state: string }> {
    this.prunePendingAuthorizations();

    const state = crypto.randomBytes(32).toString('base64url');
    const { codeVerifier, codeChallenge } = await this.oauth2Client.generateCodeVerifierAsync();

    if (!codeChallenge) {
      throw new Error('Failed to derive a PKCE code challenge');
    }

    this.pendingAuthorizations.set(state, { state, codeVerifier, createdAt: Date.now() });

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: config.google.scopes,
      state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
    });

    logger.debug('Created PKCE authorization request', { pending: this.pendingAuthorizations.size });

    return { authUrl, state };
  }

  /**
   * state を検証したうえで認可コードをトークンに交換し、保存する。
   */
  private async completeAuthorization(code: string, state: string): Promise<void> {
    const pending = this.consumePendingAuthorization(state);

    if (!pending) {
      throw new Error('Unknown, expired, or already-used state parameter');
    }

    const { tokens } = await this.oauth2Client.getToken({
      code,
      codeVerifier: pending.codeVerifier,
    });

    this.storeCredentials(tokens);
  }

  /**
   * state に対応する保留中フローを取り出し、同時に破棄する（使い捨て）。
   *
   * 突き合わせは crypto.timingSafeEqual で行う。Map のキー参照でも機能的には
   * 十分だが、state は認可コード注入を防ぐための秘密値なので、比較時間から
   * 情報が漏れない形にしておく。
   */
  private consumePendingAuthorization(state: string): PendingAuthorization | null {
    this.prunePendingAuthorizations();

    const candidate = Buffer.from(state, 'utf8');
    let matched: PendingAuthorization | null = null;

    for (const pending of this.pendingAuthorizations.values()) {
      const expected = Buffer.from(pending.state, 'utf8');

      if (expected.length !== candidate.length) {
        continue;
      }

      if (crypto.timingSafeEqual(expected, candidate)) {
        matched = pending;
      }
    }

    if (matched) {
      this.pendingAuthorizations.delete(matched.state);
    }

    return matched;
  }

  /** 期限切れの保留フローを掃除し、件数の上限も守る。 */
  private prunePendingAuthorizations(): void {
    const now = Date.now();

    for (const [state, pending] of this.pendingAuthorizations) {
      if (now - pending.createdAt > PENDING_AUTH_TTL_MS) {
        this.pendingAuthorizations.delete(state);
      }
    }

    while (this.pendingAuthorizations.size >= MAX_PENDING_AUTHORIZATIONS) {
      const oldest = this.pendingAuthorizations.keys().next();
      if (oldest.done) {
        break;
      }
      this.pendingAuthorizations.delete(oldest.value);
    }
  }

  /** 取得した認証情報を TokenManager に保存する。 */
  private storeCredentials(tokens: Credentials): void {
    if (tokens.access_token) {
      const expiresIn = tokens.expiry_date
        ? Math.max(tokens.expiry_date - Date.now(), 0)
        : DEFAULT_ACCESS_TOKEN_TTL_MS;
      tokenManager.storeToken(`${DEFAULT_USER_ID}_access`, tokens.access_token, expiresIn);
      logger.debug('Stored access token', { userId: DEFAULT_USER_ID, expiresIn });
    }

    if (tokens.refresh_token) {
      tokenManager.storeToken(DEFAULT_USER_ID, tokens.refresh_token);
      logger.info('Successfully obtained and stored refresh token', { userId: DEFAULT_USER_ID });
    } else {
      logger.warn('No refresh token in the response - re-authentication will be required later', {
        userId: DEFAULT_USER_ID,
      });
    }
  }

  /**
   * 認証 URL を生成する
   *
   * @param userId 互換性のために受け取るが未使用（シングルユーザー運用）
   * @param redirectUri 互換性のために受け取るが未使用。実際の redirect_uri は
   *                    config.google.redirectUri に固定される。
   * @param forManualAuth 手動認証用に Google の URL と state を直接返すかどうか
   */
  public async generateAuthUrl(
    userId: string,
    redirectUri: string,
    forManualAuth: boolean = false
  ): Promise<string | { authUrl: string; state: string }> {
    if (forManualAuth) {
      // 手動モードではローカルサーバーを起動しないため、Google の認可 URL を
      // そのまま返す。以前はローカル URL を返していたので、受け口が無く
      // フローが成立しなかった。
      const { authUrl, state } = await this.createAuthorizationRequest();
      logger.info('Generated PKCE auth URL for manual authentication');
      return { authUrl, state };
    }

    // 通常フローではローカルの開始エンドポイントを開かせ、そこから
    // Google へリダイレクトする。state と verifier はその時点で発行される。
    const authUrl = `http://${config.auth.host}:${config.auth.port}/auth/google`;
    logger.info('Generated local auth entry point', { authUrl, redirectUri });
    return authUrl;
  }

  /**
   * 認可コードをトークンに交換する（手動認証用）
   *
   * 以前の実装は引数 code を一切使わず、進行中の Promise の有無だけを見て
   * 成否を返すスタブだった。PKCE 化に伴い、保持している code_verifier を
   * 使って実際に交換する。
   */
  public async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.completeAuthorization(code, state);
      logger.info('Manual authentication completed');
      return { success: true, message: 'Authentication successful' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      logger.error('OAuth token exchange failed', { error: error.message });
      return { success: false, message: `Token exchange failed: ${error.message}` };
    }
  }

  public getApp(): Hono {
    return this.app;
  }

  public isAuthenticated(): boolean {
    const accessToken = tokenManager.getToken(`${DEFAULT_USER_ID}_access`);
    const refreshToken = tokenManager.getToken(DEFAULT_USER_ID);

    return !!(accessToken || refreshToken);
  }
}
