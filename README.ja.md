# Google Calendar MCP Server
![Apr-15-2025 12-17-08](https://github.com/user-attachments/assets/8970351e-c90d-42e3-8609-b4dfe33f8615)


> **🔔 バージョン更新のお知らせ 🔔**  
> バージョン1.0.5では、`createEvent`と`updateEvent`ツールの両方に`recurrence`パラメータを追加し、定期的なイベントのサポートを追加しました。これにより、作成後に手動で設定することなく、直接定期的なイベントを作成および変更できるようになりました。

![](https://badge.mcpx.dev?type=server 'MCP Server')
![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

[![日本語](https://img.shields.io/badge/日本語-クリック-青)](README.ja.md)
[![English](https://img.shields.io/badge/English-Click-blue)](README.md)

## プロジェクト概要

Google Calendar MCP Serverは、GoogleカレンダーとClaude Desktopの間の統合を可能にするMCP（Model Context Protocol）サーバーの実装です。このプロジェクトにより、ClaudeはユーザーのGoogleカレンダーと対話し、自然言語による対話を通じてカレンダーイベントの表示、作成、更新、削除を行うことができます。

### 主な機能

- **Googleカレンダー統合**: Claude DesktopとGoogle Calendar APIの間のブリッジを提供
- **MCP実装**: AI アシスタントツール統合のためのModel Context Protocolの仕様に準拠
- **OAuth2認証**: Google API認証フローを安全に処理
- **イベント管理**: 包括的なカレンダーイベント操作（取得、作成、更新、削除）をサポート
- **カラーサポート**: colorIdパラメータを使用してイベントの色を設定および更新する機能
- **STDIO転送**: Claude Desktopとの通信に標準入出力を使用

## 技術アーキテクチャ

このプロジェクトでは以下を使用しています：

- **TypeScript**: 型安全なコード開発のため
- **MCP SDK**: Claude Desktopとの統合のために`@modelcontextprotocol/sdk`を使用
- **Google API**: Google Calendar APIアクセスのために`googleapis`を使用
- **Hono**: 認証サーバー用の軽量で高速なWebフレームワーク
- **OAuth2 Providers**: PKCE対応のOAuth2フローのために`@hono/oauth-providers`を使用
- **Zod**: リクエスト/レスポンスデータのスキーマ検証を実装
- **環境ベースの設定**: 設定管理にdotenvを使用
- **AES-256-GCM**: Node.js cryptoモジュールを使用したトークン暗号化
- **Open**: 認証時のブラウザ自動起動のため
- **Readline**: サーバー環境での手動認証入力のため
- **Jest**: ユニットテストとカバレッジのため
- **GitHub Actions**: CI/CDのため

## 主要コンポーネント

1. **MCPサーバー**: Claude Desktopとの通信を処理するコアサーバー実装
2. **Googleカレンダーツール**: カレンダー操作（取得、作成、更新、削除）
3. **認証ハンドラー**: Google APIとのOAuth2フローの管理
4. **スキーマ検証**: すべての操作におけるデータ整合性の確保
5. **トークンマネージャー**: 認証トークンの安全な取り扱い

## 利用可能なツール

このMCPサーバーは、Googleカレンダーと対話するための以下のツールを提供します：

### 1. getEvents

様々なフィルタリングオプションでカレンダーイベントを取得します。

**パラメータ:**
- `calendarId` (オプション): カレンダーID（省略、空文字列、null、undefinedの場合はプライマリカレンダーを使用）
- `timeMin` (オプション): イベント取得の開始時間（ISO 8601形式、例："2025-03-01T00:00:00Z"）。空文字列、null、undefined値は無視されます
- `timeMax` (オプション): イベント取得の終了時間（ISO 8601形式）。空文字列、null、undefined値は無視されます
- `maxResults` (オプション): 取得するイベントの最大数（デフォルト：10）
- `orderBy` (オプション): 並べ替え順序（"startTime"または"updated"）。空文字列、null、undefinedの場合は"startTime"がデフォルト

### 2. createEvent

新しいカレンダーイベントを作成します。

**パラメータ:**
- `calendarId` (オプション): カレンダーID（省略時はプライマリカレンダーを使用）
- `event`: 以下を含むイベント詳細オブジェクト：
  - `summary` (必須): イベントのタイトル
  - `description` (オプション): イベントの説明
  - `location` (オプション): イベントの場所
  - `start`: 以下を含む開始時間オブジェクト：
    - `dateTime` (オプション): ISO 8601形式（例："2025-03-15T09:00:00+09:00"）
    - `date` (オプション): 終日イベント用のYYYY-MM-DD形式
    - `timeZone` (オプション): タイムゾーン（例："Asia/Tokyo"）
  - `end`: 終了時間オブジェクト（開始時間と同じ形式）
  - `attendees` (オプション): メールとオプションのdisplayNameを持つ参加者の配列
  - `colorId` (オプション): イベントの色ID（1-11）
  - `recurrence` (オプション): RFC5545形式の繰り返しルールの配列（例：["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]）

### 3. updateEvent

既存のカレンダーイベントを更新します。この関数は最初に既存のイベントデータを取得し、それを更新データとマージして、更新リクエストに含まれていないフィールドを保持します。

**パラメータ:**
- `calendarId` (オプション): カレンダーID（省略時はプライマリカレンダーを使用）
- `eventId` (必須): 更新するイベントのID
- `event`: 更新するフィールドを含むイベント詳細オブジェクト（createEventと同じ構造、すべてのフィールドはオプション）
  - 明示的に提供されたフィールドのみが更新されます
  - 更新リクエストに含まれていないフィールドは既存の値を保持します
  - これにより、データを失うことなく部分的な更新が可能になります
  - `recurrence`パラメータを更新して、定期的なイベントのパターンを変更できます

### 4. deleteEvent

カレンダーイベントを削除します。

**パラメータ:**
- `calendarId` (オプション): カレンダーID（省略時はプライマリカレンダーを使用）
- `eventId` (必須): 削除するイベントのID

### 5. authenticate

Googleカレンダーに再認証します。これは、Claudeを再起動せずに異なるGoogleアカウント間で切り替えたい場合に便利です。

**パラメータ:**
- なし

## 開発ガイドライン

新しい機能を追加したり、コードを変更したり、バグを修正したりする場合は、`npm version`コマンドを使用して各変更に対してセマンティックにバージョンを増やしてください。
また、コーディングが明確で、OOPなどの必要なコーディングルールに従っていることを確認してください。
バージョンスクリプトはバージョンが更新されると自動的に`npm install`を実行しますが、それでも提出する前にビルド、リント実行、コードのテストを行う必要があります。

### コード構造

- **src/**: ソースコードディレクトリ
  - **auth/**: 認証処理
  - **config/**: 設定
  - **mcp/**: MCPサーバー実装
  - **tools/**: Googleカレンダーツール実装
  - **utils/**: ユーティリティ関数とヘルパー

### ベストプラクティス

- TypeScriptのベストプラクティスに従った適切な型付け
- 包括的なエラー処理の維持
- 適切な認証フローの確保
- 依存関係を最新の状態に保つ
- すべての関数に明確なドキュメントを書く
- セキュリティのベストプラクティスを実装する
- OAuth 2.1認証標準に従う
- すべての入出力データにスキーマ検証を使用する

### テスト

- コア機能のユニットテストを実装
- 認証フローを徹底的にテスト
- Google APIに対するカレンダー操作を検証
- カバレッジレポート付きでテストを実行
- セキュリティテストが含まれていることを確認

## デプロイメント

このパッケージはnpmで`@takumi0706/google-calendar-mcp`として公開されています：

```bash
npx @takumi0706/google-calendar-mcp@1.0.7
```

### 前提条件

1. Google Cloudプロジェクトを作成し、Google Calendar APIを有効にする
2. Google Cloud ConsoleでOAuth2認証情報を設定する
3. 環境変数を設定する：
[参考サイト](https://zenn.dev/acompany/articles/51e1dcc83279ee)

```bash
# Google OAuth認証情報を含む.envファイルを作成
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4153/oauth2callback
# オプション：トークン暗号化キー（提供されない場合は自動生成）
TOKEN_ENCRYPTION_KEY=32-byte-hex-key
# オプション：認証サーバーのポートとホスト（デフォルトポート：4153、ホスト：localhost）
AUTH_PORT=4153
AUTH_HOST=localhost
# オプション：MCPサーバーのポートとホスト（デフォルトポート：3000、ホスト：localhost）
PORT=3000
HOST=localhost
# オプション：手動認証を有効にする（localhostにアクセスできない場合に便利）
USE_MANUAL_AUTH=true
```

### Claude Desktop設定

サーバーを`claude_desktop_config.json`に追加します。localhostにアクセスできない環境で実行している場合は、`USE_MANUAL_AUTH`環境変数を"true"に設定します。

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": [
        "-y",
        "@takumi0706/google-calendar-mcp"
      ],
      "env": {
        "GOOGLE_CLIENT_ID": "your_client_id",
        "GOOGLE_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:4153/oauth2callback"
      }
    }
  }
}
```

## セキュリティに関する考慮事項

- **OAuthトークン**はメモリにのみ保存されます（ファイルベースのストレージには保存されません）
- **機密認証情報**は環境変数として提供する必要があります
- **トークン暗号化**：安全な保存のためにAES-256-GCMを使用
- **PKCE実装**：明示的なcode_verifierとcode_challenge生成
- **状態パラメータ検証**：CSRF保護のため
- **レート制限**：APIエンドポイント保護のため
- **入力検証**：Zodスキーマを使用

詳細については、[SECURITY.md](SECURITY.md)を参照してください。

## メンテナンス

- Google Calendar APIとの互換性を維持するための定期的な更新
- バージョン更新はREADME.mdに記載されています

## トラブルシューティング

問題が発生した場合：


1. Google OAuth認証情報が正しく設定されていることを確認してください
2. Google Calendar APIアクセスに十分な権限があることを確認してください
3. Claude Desktop設定が正しいことを確認してください

### 一般的なエラー

- **JSONパースエラー**：`Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`のようなエラーが表示される場合、通常は不正な形式のJSON-RPCメッセージが原因です。この問題はバージョン0.6.7以降で修正されています。これらのエラーがまだ発生する場合は、最新バージョンに更新してください。
- **認証エラー**：Google OAuth認証情報を確認してください
- **無効な状態パラメータ**：再認証時に`Authentication failed: Invalid state parameter`が表示される場合は、OAuth サーバーのライフサイクル管理を修正したバージョン1.0.3以降に更新してください。古いバージョンでは、ポート4153を閉じてアプリケーションを再起動する必要がある場合があります。
- **接続エラー**：サーバーのインスタンスが1つだけ実行されていることを確認してください
- **切断の問題**：サーバーがカスタムTCPソケットなしでMCPメッセージを適切に処理していることを確認してください
- **localhostにアクセスできない**：リモートサーバーやコンテナなど、localhostにアクセスできない環境でアプリケーションを実行している場合は、`USE_MANUAL_AUTH=true`を設定して手動認証を有効にしてください。これにより、アプリケーションを承認した後にGoogleによって表示される認証コードを手動で入力できるようになります。
- **MCPパラメータ検証エラー**：空文字列パラメータでエラー-32602が発生する場合は、空文字列、null、undefined値を適切に処理するバージョン1.0.7以降にアップデートしてください。

## バージョン履歴

### バージョン1.0.7の変更点
- MCPツールのパラメータ検証を強化し、空文字列、null、undefined値を適切に処理
- getEventsツールに空文字列パラメータが渡された際のMCPエラー-32602を修正
- preprocessArgs関数を改善し、空の値をスキップすることでZodスキーマのデフォルト値が適切に適用されるように
- 空パラメータ処理の包括的なテストカバレッジを追加

### バージョン1.0.6の変更点
- このGoogle Calendar MCPサーバーで不要なスコープを修正しました

### バージョン1.0.5の変更点
- `createEvent`と`updateEvent`ツールの両方に`recurrence`パラメータを追加し、定期的なイベントのサポートを追加
- 手動設定なしで直接定期的なイベントの作成と変更が可能に

### バージョン1.0.4の変更点
- バージョン番号更新によるメンテナンスリリース
- バージョン1.0.3からの機能的な変更はなし
- 最新の依存関係との互換性を確保

### バージョン1.0.3の変更点
- Claudeを再起動せずに再認証を可能にする新しい`authenticate`ツールを追加
- セッション中に異なるGoogleアカウント間で切り替えることが可能に
- MCP インターフェースを通じて認証機能を公開
- アカウント切り替えのために再起動する必要がなくなり、ユーザーエクスペリエンスを向上
- localhostにアクセスできない環境向けに手動認証オプションを追加
- 認証コードを手動で入力するためのreadlineインターフェースを実装
- 手動認証を有効にするためのUSE_MANUAL_AUTH環境変数を追加
- zod依存関係を最新バージョン（3.24.2）に更新
- 最新のzod機能によるスキーマ検証の改善
- コードの安定性とセキュリティの向上
- 再認証中の「無効な状態パラメータ」エラーを修正
- OAuth サーバーをオンデマンドで起動し、認証後にシャットダウンするように変更
- ポート競合を防ぐためのサーバーライフサイクル管理の改善
- 認証フローのエラー処理の強化

### バージョン1.0.2の変更点
- 部分的な更新を実行する際に既存のイベントデータを保持するように`updateEvent`関数を修正
- 更新前に既存のイベントデータを取得する`getEvent`関数を追加
- データ損失を防ぐために更新データを既存データとマージするように`updateEvent`を変更
- 更新リクエストですべてのフィールドをオプションにするようにスキーマ検証を更新
- `updateEvent`関数のドキュメントを改善

### バージョン1.0.1の変更点
- Node.js v20.9.0+と'open'パッケージ（v10+）の互換性の問題を修正
- ESMのみの'open'パッケージの静的インポートを動的インポートに置き換え
- OAuth認証中のブラウザ起動のエラー処理を改善
- 保守性向上のためのコードコメントの強化

### バージョン1.0.0の変更点
- 本番稼働準備完了を示すメジャーバージョンリリース
- 保守性向上のための包括的なコードリファクタリング
- すべてのメッセージとコメントの国際化（日本語から英語への翻訳）
- コードの一貫性と可読性の向上
- ユーザーエクスペリエンス向上のためのエラーメッセージの改善
- プロジェクトの現状を反映するためのドキュメントの更新
- コードベース全体のコーディングスタイルの標準化

### バージョン0.8.0の変更点
- リフレッシュトークンの問題を処理するためのOAuth認証フローの強化
- 新しいリフレッシュトークンを提供するためにGoogleに同意画面を表示させる`prompt: 'consent'`パラメータを追加
- リフレッシュトークンが利用できない場合にアクセストークンのみで動作するように認証フローを変更
- リフレッシュトークンがない場合や無効な場合を処理するためのトークンリフレッシュロジックの改善
- より良いトークン管理のためにリフレッシュされたアクセストークンを保存するようにトークンストレージを更新
- トークンリフレッシュロジックの潜在的な無限ループを修正

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
