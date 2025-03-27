# Google Calendar MCP Server

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Security](https://img.shields.io/badge/security-enhanced-green.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)

Model Context Protocol (MCP) サーバーの実装で、Google Calendarとのインテグレーションを提供します。このサーバーを使用することで、Claude DesktopからGoogle Calendarの予定管理が可能になります。

## 🆕 セキュリティと品質の改善点 (v0.4.0)

### セキュリティ強化
- **トークン暗号化**: AES-256-GCM暗号化によるトークンの安全な保存
- **OAuth認証強化**: CSRF保護とPKCE実装による認証フローの改善
- **セキュリティヘッダー**: Helmet.jsを使用したHTTPセキュリティヘッダーの適用
- **レートリミット**: APIエンドポイントへのアクセス制限による保護
- **入力バリデーション**: Zodによる厳格なデータ検証システム

### 品質向上
- **テストカバレッジ向上**: 単体テストと統合テストの拡充
- **エラーハンドリング改善**: 統一されたエラーフォーマットと詳細なログ記録
- **CI/CD強化**: GitHub Actionsによる自動ビルド、テスト、セキュリティスキャン
- **ドキュメント拡充**: 詳細なAPIリファレンスとセキュリティガイドライン
- **コード品質**: 厳格なTypeScript型定義と一貫したコーディングスタイル

## 機能

- Google Calendarイベント管理（取得、作成、更新、削除）
- OAuth2認証による安全なGoogle Calendar API連携
- MCP SDKとClaudeの統合
- 認証のための自動ブラウザ起動
- メモリ内トークン管理（ファイルベースのストレージなし）
- シンプルなセットアップと設定

## インストール

```bash
npx @takumi0706/google-calendar-mcp
```

## 使用方法

### 前提条件

1. Google Cloudプロジェクトを作成し、Google Calendar APIを有効化
2. Google Cloud Consoleで OAuth2 認証情報を設定
3. 環境変数を設定：

```bash
# .envファイルに環境変数を設定
GOOGLE_CLIENT_ID=あなたのクライアントID
GOOGLE_CLIENT_SECRET=あなたのクライアントシークレット
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
# オプション: トークン暗号化キー（指定しない場合は自動生成）
TOKEN_ENCRYPTION_KEY=32バイトの16進数キー
```

### Claude Desktop の設定

`claude_desktop_config.json` にサーバーを追加：

```json
{
  "globalShortcut": "Shift+Alt+Space",
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": [
        "-y",
        "@takumi0706/google-calendar-mcp"
      ],
      "env": {
        "GOOGLE_CLIENT_ID": "あなたのクライアントID",
        "GOOGLE_CLIENT_SECRET": "あなたのクライアントシークレット",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth2callback"
      }
    }
  }
}
```

## API

このMCPサーバーは、以下のGoogle Calendar機能を提供します：

- `getEvents`: ユーザーのカレンダーからイベントを取得
- `createEvent`: 新しいカレンダーイベントを作成
- `updateEvent`: 既存のカレンダーイベントを更新
- `deleteEvent`: カレンダーイベントを削除

## 実装詳細

このサーバーは以下を使用しています：

- **MCP SDK**: Claude Desktop統合のための `@modelcontextprotocol/sdk`
- **Google APIs**: Google Calendar APIアクセスのための `googleapis`
- **TypeScript**: 型安全なコード
- **Zod**: スキーマ検証
- **Helmet.js**: セキュリティヘッダー
- **AES-256-GCM**: トークン暗号化
- **Jest**: ユニットテストとカバレッジ
- **GitHub Actions**: CI/CD

## ストレージとログ

サーバーは以下のデータを保存します：

- **OAuthトークン**: メモリ内のみに保存（v0.3.3+以降はファイルベースのストレージなし）
- **ログ**: ユーザーのホームディレクトリの `~/.google-calendar-mcp/logs/` に保存

## セキュリティ対策

v0.4.0で導入されたセキュリティ機能：

1. **トークン暗号化**：
   - AES-256-GCM暗号化によるトークンの保護
   - 各トークンに一意の初期化ベクトル(IV)を使用
   - 環境変数またはランダムに生成されたキーによる暗号化

2. **OAuth認証強化**：
   - CSRF攻撃からの保護のための一意のstate値
   - PKCEによる認証コード傍受の防止
   - 厳格な認証フロー検証

3. **Webセキュリティ**：
   - Content Security Policy (CSP)
   - XSS保護
   - HTTPSのみの接続推奨
   - レートリミッティング

詳細は [SECURITY.md](SECURITY.md) をご参照ください。

## トラブルシューティング

問題が発生した場合：

1. ホームディレクトリの `~/.google-calendar-mcp/logs/` にあるログを確認
2. Google OAuth認証情報が正しく設定されていることを確認
3. Google Calendar APIへのアクセス権限が十分にあることを確認
4. Claude Desktop設定が正しいことを確認

### よくあるエラー

- **JSON解析エラー**: `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)` のようなエラーは、JSON-RPCメッセージが不正な形式であることが原因です。このバグはバージョン0.2.6+で修正されました。
- **認証エラー**: Google OAuth認証情報の確認が必要です
- **接続エラー**: サーバーが一つだけ実行されていることを確認してください
- **切断の問題**: サーバーがMCPメッセージを適切に処理していることを確認してください

## バージョン履歴

### バージョン0.4.0の変更点
- トークン暗号化システムを実装（AES-256-GCM）
- CSRF保護とPKCEを含む強化されたOAuth認証フロー
- Helmet.jsを使用したセキュリティヘッダーの追加
- レートリミットの実装によるDDoS保護
- 強化された入力検証とエラーハンドリング
- テストカバレッジの向上
- GitHub ActionsによるCI/CD自動化
- セキュリティドキュメントの拡充

### バージョン0.3.3の変更点
- ファイルベースのトークンストレージを削除し、メモリ内トークン管理を改善
- メモリリークの修正とリソース管理の向上
- 安定性とエラー処理の強化

### バージョン0.3.2の変更点
- Google Calendar認証のための自動ブラウザ起動を追加
- 認証フロー中のユーザーエクスペリエンスを向上

### バージョン0.3.1の変更点
- サーバーバージョンインジケータを更新
- イベント処理の細かなバグを修正

### バージョン0.2.7の修正
- 不正な形式のメッセージを処理するためのJSON-RPCメッセージ処理を修正
- クライアントとサーバー間のメッセージ処理を改善
- コンテキスト情報を含むログ形式の強化
- JSON-RPCメッセージのトラブルシューティングのためのデバッグモードサポートを追加

### バージョン0.2.6の修正
- 解析エラーを引き起こしていたJSON-RPCメッセージ処理を修正
- 接続問題を引き起こしていたカスタムTCPソケットサーバーを削除
- トランスポートエラーの適切なエラー処理を追加
- クライアントとサーバー間のメッセージ交換のロギングを改善

### バージョン0.2.0の変更点
- 最新のMCP SDK API（v1.7.0+）を使用するように更新
- 古い`Server`クラスから最新の`McpServer`クラスに移行
- 適切に型付けされたツールハンドラによる型安全性の向上
- 部分的なイベント更新を適切に処理するように更新操作を修正
- 詳細なエラーメッセージによるエラー処理の強化
- カレンダー操作を処理する際のパフォーマンスの最適化
- 直接APIコールによる実装の簡素化

## 開発

このプロジェクトに貢献するには：

```bash
# リポジトリをクローン
git clone https://github.com/takumi0706/google-calendar-mcp.git
cd google-calendar-mcp

# 依存関係をインストール
npm install

# 開発モードで実行
npm run dev
```

## テスト

テストを実行するには：

```bash
# すべてのテストを実行
npm test

# カバレッジレポート付きでテストを実行
npm test -- --coverage
```

## ライセンス

MIT
