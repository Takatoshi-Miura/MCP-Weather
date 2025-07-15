# MCP-Weather

気象庁APIを使用した天気情報取得MCPサーバー（OAuth 2.0認証付き）

## 概要

mcp-weatherは、気象庁の天気予報API（livedoor 天気互換）を使用して、日本各地の天気情報を取得するMCPサーバーです。OAuth 2.0認証を使用したセキュアなアクセス制御により、Cloudflare Workersでリモートサーバーとしてデプロイ可能です。

## 特徴

- **OAuth 2.0認証**: セキュアなアクセス制御とトークンベース認証
- **豊富な気象データ**: 天気概況、降水確率、風速情報を提供
- **全国対応**: 主要都市の天気データを取得可能
- **リモート対応**: Cloudflare Workersにデプロイしてリモートサーバーとして利用可能
- **モバイル対応**: 標準的なOAuthフローでモバイルアプリからも利用可能

## 利用できるツール

### 1. get_weather_overview
指定した都市の天気概況を取得します。
- 発表時刻
- 天気概況文
- 今日・明日・明後日の天気予報
- 詳細な天気情報

### 2. get_precipitation_probability
指定した都市の降水確率を取得します。
- 時間帯別（0-6時、6-12時、12-18時、18-24時）の降水確率
- 今日・明日・明後日の予報

### 3. get_wind_speed
指定した都市の風速情報を取得します。
- 風向・風速の詳細情報
- 今日・明日・明後日の予報

## 対応都市

札幌、青森、盛岡、仙台、秋田、山形、福島、水戸、宇都宮、前橋、さいたま、千葉、東京、横浜、新潟、富山、金沢、福井、甲府、長野、岐阜、静岡、名古屋、津、大津、京都、大阪、神戸、奈良、和歌山、鳥取、松江、岡山、広島、山口、徳島、高松、松山、高知、福岡、佐賀、長崎、熊本、大分、宮崎、鹿児島、那覇

## セットアップ

### 利用方法の選択

このMCPサーバーは2つの利用方法をサポートしています：

| 利用方法 | 特徴 | 認証 | 設定の複雑さ |
|---------|------|------|-------------|
| **ローカルMCPサーバー** | 高速、プライバシー保護、信頼性 | 不要 | 簡単 |
| **リモートMCPサーバー** | 最新機能、スケーラビリティ | OAuth 2.0 | 中程度 |

### 方法A: ローカルMCPサーバー（推奨・簡単）

認証不要でシンプルに利用できます。

#### 1. 依存関係のインストール
```bash
npm install
```

#### 2. ローカルMCPサーバーをビルド
```bash
npm run build:local
```

#### 3. Cursorのmcp.jsonに設定
```json
{
  "mcp-weather-local": {
    "command": "node",
    "args": ["/path/to/MCP-Weather/dist/server/local/index.js"]
  }
}
```

#### 4. 使用開始
Cursorを再起動して、「東京の天気を教えて」と入力してください。

### 方法B: リモートMCPサーバー（OAuth認証）

#### 方法1: 自動トークン更新（推奨）
```bash
# プロジェクトディレクトリで実行
node src/utils/update-token.cjs
```

#### 方法2: 手動設定
1. **OAuth認証トークンの取得**
```bash
node src/utils/get-token.cjs
```

2. **トークンを手動で更新**
   - `src/client/mcp-weather-remote.cjs`の`ACCESS_TOKEN`を更新

3. **Cursorのmcp.jsonに設定**
```json
{
  "mcp-weather-remote": {
    "command": "node",
    "args": ["/path/to/MCP-Weather/src/client/mcp-weather-remote.cjs"]
  }
}
```

#### 環境変数を使用する場合
```bash
export MCP_WEATHER_TOKEN="your-token-here"
```

### トラブルシューティング

#### ローカルMCPサーバーの問題
1. **依存関係のインストール確認**
```bash
npm install
```

2. **TypeScriptの直接実行**
```bash
npm run dev:local
```

#### リモートMCPサーバーの問題
1. **デバッグ版を使用**
```json
{
  "mcp-weather-remote-debug": {
    "command": "node",
    "args": ["/path/to/MCP-Weather/src/client/mcp-weather-debug.cjs"]
  }
}
```

2. **トークンの期限切れ**
```bash
node src/utils/update-token.cjs
```

3. **Cursorのログを確認**
   - Cursor > View > Output > MCP

#### ファイル構成
```
MCP-Weather/
├── src/
│   ├── server/               # サーバーサイド実装
│   │   ├── local/            # ローカルサーバー
│   │   │   └── index.ts      # ローカルMCPサーバー
│   │   └── remote/           # リモートサーバー
│   │       ├── worker.ts     # Cloudflare Workers実装
│   │       └── auth.ts       # OAuth認証サービス
│   ├── client/               # クライアントサイド実装
│   │   ├── mcp-weather-remote.cjs  # メインのMCPクライアント
│   │   └── mcp-weather-debug.cjs   # デバッグ版
│   └── utils/                # ユーティリティ
│       ├── get-token.cjs     # トークン取得スクリプト
│       └── update-token.cjs  # トークン自動更新スクリプト
├── dist/                     # ビルド出力
│   └── server/
│       ├── local/            # ローカルサーバーのビルド出力
│       └── remote/           # リモートサーバーのビルド出力
├── node_modules/             # 依存関係
├── package.json              # プロジェクト設定
├── package-lock.json         # 依存関係のロック
├── tsconfig.json             # TypeScript設定（リモート用）
├── tsconfig.local.json       # TypeScript設定（ローカル用）
├── wrangler.toml             # Cloudflare Workers設定
└── README.md
```

### 開発者向けセットアップ

#### 依存関係のインストール

```bash
npm install
```

#### ローカルMCPサーバーの開発

```bash
# ローカルサーバーのビルド
npm run build:local

# ローカルサーバーの開発モード
npm run dev:local

# ローカルサーバーの型チェック
npm run type-check:local
```

#### Cloudflare Workersへのデプロイ

1. Wranglerのインストール（未インストールの場合）
```bash
npm install -g wrangler
```

2. Cloudflareアカウントへのログイン
```bash
npx wrangler login
```

3. KVストレージの作成
OAuth認証データを保存するためのKVネームスペースを作成します：

```bash
# 本番環境用
npx wrangler kv:namespace create "OAUTH_KV"
# 開発環境用
npx wrangler kv:namespace create "OAUTH_KV" --preview
```

4. `wrangler.toml`のKV IDを更新
作成したKVネームスペースのIDを`wrangler.toml`に設定してください。

5. デプロイ
```bash
# ビルド
npm run build

# デプロイ
npx wrangler deploy
```

#### ローカル開発

```bash
# 開発モードで起動
npx wrangler dev

# ビルド
npm run build
```

## 使用方法

### ローカルMCPサーバーでの利用

1. **設定完了後、Cursorを再起動**
2. **天気情報の取得**
   - Cursorで「東京の天気を教えて」と入力
   - 自動的に適切なツールが呼び出されます

### リモートMCPサーバーでの利用

1. **トークンの取得と設定**
```bash
node src/utils/update-token.cjs
```

2. **天気情報の取得**
   - Cursorで「東京の天気を教えて」と入力
   - 自動的に適切なツールが呼び出されます

### デモ認証情報（リモートMCPサーバー用）

開発・テスト用のデモ認証情報：
- **ユーザー名**: demo
- **パスワード**: demo123

※ローカルMCPサーバーを使用する場合は認証不要です。

## モバイルアプリ開発者向け

### OAuth 2.0 APIエンドポイント

- **クライアント作成**: `POST /oauth/client`
- **認証開始**: `GET /oauth/authorize`
- **トークン取得**: `POST /oauth/token`
- **MCP API**: `POST /` (Bearer認証)

### 対応プラットフォーム

- **iOS**: SFSafariViewController, ASWebAuthenticationSession
- **Android**: Chrome Custom Tabs, WebView
- **React Native**: react-native-app-auth
- **Flutter**: flutter_appauth

詳細な実装例は、プロジェクトのサーバー側コード（`src/`）を参照してください。

## データソース

本サーバーは「天気予報 API（livedoor 天気互換）」（https://weather.tsukumijima.net/）を使用しています。
このAPIは気象庁が配信している天気予報データをJSON形式で提供しています。

## セキュリティ

### OAuth 2.0認証

- **認証コード**: 10分間の有効期限
- **アクセストークン**: 1時間の有効期限
- **PKCE対応**: モバイルアプリでのセキュアな認証

### 本番環境での設定

本番環境では以下の点にご注意ください：

1. **クライアントシークレット**: 安全に管理し、公開しないでください
2. **リダイレクトURI**: 信頼できるドメインのみを設定してください
3. **アクセストークン**: 適切に保護し、HTTPSでのみ送信してください

## 注意事項

- APIのレスポンスが予期しないデータになった場合、エラーが発生する可能性があります
- 気象庁HPのAPI構造が変更された場合、サービスが停止する可能性があります
- 連続したAPIアクセスは避け、適切な間隔を空けてご利用ください
- OAuth認証のトークンは適切に管理し、第三者に漏洩しないよう注意してください
