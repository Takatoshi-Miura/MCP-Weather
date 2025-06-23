# MCP-Weather

気象庁APIを使用した天気情報取得MCPサーバー

## 概要

mcp-weatherは、気象庁の天気予報API（livedoor 天気互換）を使用して、日本各地の天気情報を取得するMCPサーバーです。認証不要で誰でも利用でき、Cloudflare Workersでリモートサーバーとしてもデプロイ可能です。

## 特徴

- **認証不要**: ユーザー登録や認証なしで利用可能
- **豊富な気象データ**: 天気概況、降水確率、風速情報を提供
- **全国対応**: 主要都市の天気データを取得可能
- **リモート対応**: Cloudflare Workersにデプロイしてリモートサーバーとして利用可能

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

### ローカル開発

```bash
# 開発モードで起動
npm run dev

# ビルド
npm run build

# 本番モードで起動
npm start
```

### Cloudflare Workersへのデプロイ

1. Wranglerのインストール（未インストールの場合）
```bash
npm install -g wrangler
```

2. Cloudflareアカウントへのログイン
```bash
wrangler login
```

3. デプロイ
```bash
# ステージング環境
wrangler deploy --env staging

# 本番環境
wrangler deploy --env production
```

## 使用方法

### Claude Desktopでの利用

Claude Desktopの設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "mcp-weather": {
      "command": "node",
      "args": ["path/to/mcp-weather/dist/index.js"]
    }
  }
}
```

### リモートサーバーとしての利用

Cloudflare Workersにデプロイ後、HTTPエンドポイント経由でMCPリクエストを送信できます。

```javascript
const response = await fetch('https://your-worker.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
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

## データソース

本サーバーは「天気予報 API（livedoor 天気互換）」（https://weather.tsukumijima.net/）を使用しています。
このAPIは気象庁が配信している天気予報データをJSON形式で提供しています。

## 注意事項

- APIのレスポンスが予期しないデータになった場合、エラーが発生する可能性があります
- 気象庁HPのAPI構造が変更された場合、サービスが停止する可能性があります
- 連続したAPIアクセスは避け、適切な間隔を空けてご利用ください

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告をお待ちしています。