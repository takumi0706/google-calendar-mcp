import { OAuth2Client } from 'google-auth-library';
import { OAuthHandler } from '../../auth/oauth-handler';
import { tokenManager } from '../../auth/token-manager';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

/**
 * PKCE と state の検証は認可コード横取り・CSRF に対する唯一の防御なので、
 * 実装の細部ではなく「攻撃が成立しないこと」を確認する。
 */
describe('OAuthHandler', () => {
  // getToken はコールバック版を含む複数のオーバーロードを持つ。jest.spyOn は
  // 最後のシグネチャ（戻り値 void）を拾うため mockResolvedValue は使えない。
  // Promise を返す実装を渡し、型はこのヘルパーからの推論に任せる。
  function mockGetToken() {
    const spy = jest.spyOn(OAuth2Client.prototype, 'getToken');

    spy.mockImplementation(async () => ({
      tokens: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: Date.now() + 3600 * 1000,
      },
      res: null,
    }));

    return spy;
  }

  let handler: OAuthHandler;
  let getTokenSpy: ReturnType<typeof mockGetToken>;

  beforeEach(() => {
    getTokenSpy = mockGetToken();
    handler = new OAuthHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    tokenManager.removeToken('default-user');
    tokenManager.removeToken('default-user_access');
  });

  async function startManualFlow(): Promise<{ authUrl: string; state: string }> {
    const result = await handler.generateAuthUrl('default-user', 'unused', true);

    if (typeof result === 'string') {
      throw new Error('Expected the manual flow to return an authUrl/state pair');
    }

    return result;
  }

  describe('authorization request', () => {
    it('sends a PKCE S256 challenge', async () => {
      const { authUrl } = await startManualFlow();
      const params = new URL(authUrl).searchParams;

      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('code_challenge')).toBeTruthy();
      // S256 challenge は SHA-256 を base64url にしたもの = 43 文字
      expect(params.get('code_challenge')).toHaveLength(43);
    });

    it('never puts the code_verifier on the wire', async () => {
      const { authUrl } = await startManualFlow();

      expect(authUrl).not.toContain('code_verifier');
    });

    it('pins redirect_uri to the configured value instead of a request header', async () => {
      const { authUrl } = await startManualFlow();
      const params = new URL(authUrl).searchParams;

      expect(params.get('redirect_uri')).toBe('http://localhost:3000/oauth2callback');
    });

    it('issues a high-entropy, unique state for every request', async () => {
      const states = new Set<string>();

      for (let i = 0; i < 8; i++) {
        const { state } = await startManualFlow();
        // 32 バイトを base64url にすると 43 文字。Math.random() 由来の
        // 短い文字列に戻っていないことを確認する。
        expect(state).toHaveLength(43);
        states.add(state);
      }

      expect(states.size).toBe(8);
    });
  });

  describe('token exchange', () => {
    it('exchanges the code together with the stored verifier', async () => {
      const { state } = await startManualFlow();

      const result = await handler.exchangeCodeForTokens('auth-code', state);

      expect(result.success).toBe(true);
      expect(getTokenSpy).toHaveBeenCalledTimes(1);

      const [options] = getTokenSpy.mock.calls[0];
      expect(options).toMatchObject({
        code: 'auth-code',
        codeVerifier: expect.any(String),
      });
    });

    it('stores both tokens on success', async () => {
      const { state } = await startManualFlow();

      await handler.exchangeCodeForTokens('auth-code', state);

      expect(tokenManager.getToken('default-user_access')).toBe('test-access-token');
      expect(tokenManager.getToken('default-user')).toBe('test-refresh-token');
      expect(handler.isAuthenticated()).toBe(true);
    });

    it('rejects a state that was never issued', async () => {
      await startManualFlow();

      const result = await handler.exchangeCodeForTokens('auth-code', 'attacker-supplied-state');

      expect(result.success).toBe(false);
      // 交換自体を試みてはならない
      expect(getTokenSpy).not.toHaveBeenCalled();
    });

    it('refuses to reuse a state (one-shot)', async () => {
      const { state } = await startManualFlow();

      const first = await handler.exchangeCodeForTokens('auth-code', state);
      const second = await handler.exchangeCodeForTokens('auth-code', state);

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(getTokenSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects a state that has expired', async () => {
      jest.useFakeTimers();

      try {
        const { state } = await startManualFlow();

        // TTL は 10 分
        jest.advanceTimersByTime(10 * 60 * 1000 + 1);

        const result = await handler.exchangeCodeForTokens('auth-code', state);

        expect(result.success).toBe(false);
        expect(getTokenSpy).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps concurrent authorization requests independent', async () => {
      const first = await startManualFlow();
      const second = await startManualFlow();

      const secondResult = await handler.exchangeCodeForTokens('code-2', second.state);
      const firstResult = await handler.exchangeCodeForTokens('code-1', first.state);

      expect(secondResult.success).toBe(true);
      expect(firstResult.success).toBe(true);
      expect(getTokenSpy).toHaveBeenCalledTimes(2);
    });
  });
});
