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

### 依存関係のインストール

```bash
npm install
```

### Cloudflare Workersへのデプロイ

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

### ローカル開発

```bash
# 開発モードで起動
npx wrangler dev

# ビルド
npm run build
```

## 使用方法

### 1. OAuth クライアントの作成

まず、OAuth認証用のクライアントを作成します：

```bash
curl -X POST https://your-worker.workers.dev/oauth/client \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Weather App",
    "redirectUris": ["https://your-app.com/callback"]
  }'
```

レスポンス例：
```json
{
  "client_id": "client_abc123...",
  "client_secret": "def456...",
  "name": "My Weather App",
  "redirect_uris": ["https://your-app.com/callback"]
}
```

### 2. OAuth認証フロー

#### Step 1: 認証コードの取得

ユーザーを認証ページにリダイレクトします：

```
https://your-worker.workers.dev/oauth/authorize?
  client_id=client_abc123...&
  redirect_uri=https://your-app.com/callback&
  response_type=code&
  state=random_state_value
```

#### Step 2: アクセストークンの取得

認証コードを使用してアクセストークンを取得します：

```bash
curl -X POST https://your-worker.workers.dev/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTH_CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=REDIRECT_URI"
```

### 3. MCP APIの利用

認証トークンを使用してMCPリクエストを送信できます：

```javascript
const response = await fetch('https://your-worker.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_weather_overview',
      arguments: {
        city: '東京'
      }
    }
  })
});
```

### 4. デモ認証情報

開発・テスト用のデモ認証情報：
- **ユーザー名**: demo
- **パスワード**: demo123

## 実装例

### JavaScript/Node.js
```javascript
// OAuth クライアント作成
const clientResponse = await fetch('https://mcp-weather.get-weather.workers.dev/oauth/client', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Weather App',
    redirectUris: ['http://localhost:3000/callback']
  })
});
const client = await clientResponse.json();

// 認証フローの開始
const authUrl = `https://mcp-weather.get-weather.workers.dev/oauth/authorize?client_id=${client.client_id}&redirect_uri=http://localhost:3000/callback&response_type=code&state=xyz`;

// アクセストークンの取得（認証コード取得後）
const tokenResponse = await fetch('https://mcp-weather.get-weather.workers.dev/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: 'RECEIVED_AUTH_CODE',
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: 'http://localhost:3000/callback'
  })
});
const tokens = await tokenResponse.json();

// 天気データの取得
const weatherResponse = await fetch('https://mcp-weather.get-weather.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokens.access_token}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_weather_overview',
      arguments: { city: '東京' }
    }
  })
});
const weather = await weatherResponse.json();
```

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
