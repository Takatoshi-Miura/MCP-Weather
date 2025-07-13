import { OAuthService } from './auth';

export interface Env {
  OAUTH_KV: KVNamespace;
}

interface WeatherData {
  publishingOffice: string;
  reportDatetime: string;
  description: { text: string };
  forecasts: Array<{
    date: string;
    dateLabel: string;
    telop: string;
    detail: { weather: string; wind: string; wave: string };
    temperature: { min: { celsius: string | null }; max: { celsius: string | null } };
    chanceOfRain: { T00_06: string; T06_12: string; T12_18: string; T18_24: string };
    image: { title: string; link: string; url: string; width: number; height: number };
  }>;
}

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

interface OAuthClientRequest {
  name: string;
  redirectUris: string[];
}

// 都市名の定義
const CITIES = [
  '札幌', '青森', '盛岡', '仙台', '秋田', '山形', '福島', '水戸', '宇都宮', '前橋',
  'さいたま', '千葉', '東京', '横浜', '新潟', '富山', '金沢', '福井', '甲府', '長野',
  '岐阜', '静岡', '名古屋', '津', '大津', '京都', '大阪', '神戸', '奈良', '和歌山',
  '鳥取', '松江', '岡山', '広島', '山口', '徳島', '高松', '松山', '高知', '福岡',
  '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '那覇'
];

// 都市名から都市IDへのマッピング
const CITY_ID_MAP: Record<string, string> = {
  '札幌': '016010', '青森': '020010', '盛岡': '030010', '仙台': '040010', '秋田': '050010',
  '山形': '060010', '福島': '070010', '水戸': '080010', '宇都宮': '090010', '前橋': '100010',
  'さいたま': '110010', '千葉': '120010', '東京': '130010', '横浜': '140010', '新潟': '150010',
  '富山': '160010', '金沢': '170010', '福井': '180010', '甲府': '190010', '長野': '200010',
  '岐阜': '210010', '静岡': '220010', '名古屋': '230010', '津': '240010', '大津': '250010',
  '京都': '260010', '大阪': '270000', '神戸': '280010', '奈良': '290010', '和歌山': '300010',
  '鳥取': '310010', '松江': '320010', '岡山': '330010', '広島': '340010', '山口': '350020',
  '徳島': '360010', '高松': '370000', '松山': '380010', '高知': '390010', '福岡': '400010',
  '佐賀': '410010', '長崎': '420010', '熊本': '430010', '大分': '440010', '宮崎': '450010',
  '鹿児島': '460010', '那覇': '471010'
};

// 天気データを取得する関数
async function getWeatherData(city: string): Promise<WeatherData> {
  const cityId = CITY_ID_MAP[city];
  if (!cityId) {
    throw new Error(`対応していない都市です: ${city}`);
  }

  const response = await fetch(`https://weather.tsukumijima.net/api/forecast/city/${cityId}`);
  if (!response.ok) {
    throw new Error(`天気データの取得に失敗しました: ${response.status}`);
  }

  return await response.json() as WeatherData;
}

// フォームデータをパースする関数
async function parseFormData(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData();
  const data: Record<string, string> = {};
  
  for (const [key, value] of formData.entries()) {
    data[key] = value.toString();
  }
  
  return data;
}

// アクセストークンを抽出する関数
function extractAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] || null : null;
}

// レスポンスヘルパー関数
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function htmlResponse(html: string, status: number = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const oauthService = new OAuthService(env.OAUTH_KV);

    // CORS プリフライトリクエストの処理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // OAuth クライアント作成エンドポイント
    if (url.pathname === '/oauth/client' && request.method === 'POST') {
      try {
        const requestData = await request.json() as OAuthClientRequest;
        const { name, redirectUris } = requestData;
        
        if (!name || !redirectUris || !Array.isArray(redirectUris)) {
          return jsonResponse({ error: 'name and redirectUris are required' }, 400);
        }

        const client = await oauthService.createClient(name, redirectUris);
        return jsonResponse(client);
      } catch (error) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
    }

    // OAuth 認証エンドポイント
    if (url.pathname === '/oauth/authorize' && request.method === 'GET') {
      const client_id = url.searchParams.get('client_id');
      const redirect_uri = url.searchParams.get('redirect_uri');
      const response_type = url.searchParams.get('response_type');
      const state = url.searchParams.get('state');

      if (!client_id || !redirect_uri || response_type !== 'code') {
        return jsonResponse({ error: 'Invalid request parameters' }, 400);
      }

      // クライアントを検証
      const client = await oauthService.getClient(client_id);
      if (!client) {
        return jsonResponse({ error: 'Invalid client_id' }, 400);
      }

      // リダイレクトURIを検証
      if (!client.redirect_uris.includes(redirect_uri)) {
        return jsonResponse({ error: 'Invalid redirect_uri' }, 400);
      }

      // 認証フォームを表示
      const authForm = oauthService.generateAuthForm(client_id, redirect_uri, state || undefined);
      return htmlResponse(authForm);
    }

    // OAuth ログインエンドポイント
    if (url.pathname === '/oauth/login' && request.method === 'POST') {
      try {
        const formData = await parseFormData(request);
        const { username, password, client_id, redirect_uri, state } = formData;

        if (!username || !password || !client_id || !redirect_uri) {
          return jsonResponse({ error: 'Missing required fields' }, 400);
        }

        // 認証情報を検証
        if (!oauthService.validateCredentials(username, password)) {
          const authForm = oauthService.generateAuthForm(client_id, redirect_uri, state);
          return htmlResponse(authForm.replace('</form>', '<div style="color: red; margin-top: 10px;">認証に失敗しました。正しい認証情報を入力してください。</div></form>'), 401);
        }

        // 認証コードを生成
        const code = await oauthService.generateAuthCode(client_id, redirect_uri, state);

        // リダイレクトURLを構築
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) {
          redirectUrl.searchParams.set('state', state);
        }

        return new Response(null, {
          status: 302,
          headers: {
            'Location': redirectUrl.toString()
          }
        });
      } catch (error) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
    }

    // OAuth トークンエンドポイント
    if (url.pathname === '/oauth/token' && request.method === 'POST') {
      try {
        const contentType = request.headers.get('Content-Type');
        let data: Record<string, string>;

        if (contentType?.includes('application/x-www-form-urlencoded')) {
          data = await parseFormData(request);
        } else {
          data = await request.json();
        }

        const { grant_type, code, client_id, client_secret, redirect_uri } = data;

        if (grant_type !== 'authorization_code' || !code || !client_id || !client_secret || !redirect_uri) {
          return jsonResponse({ error: 'Invalid request parameters' }, 400);
        }

        // クライアントを検証
        const client = await oauthService.getClient(client_id);
        if (!client || client.client_secret !== client_secret) {
          return jsonResponse({ error: 'Invalid client credentials' }, 401);
        }

        // 認証コードを検証
        const authCode = await oauthService.validateAuthCode(code);
        if (!authCode || authCode.client_id !== client_id || authCode.redirect_uri !== redirect_uri) {
          return jsonResponse({ error: 'Invalid authorization code' }, 400);
        }

        // 認証コードを削除（一度きりの使用）
        await oauthService.deleteAuthCode(code);

        // アクセストークンを生成
        const accessToken = await oauthService.generateAccessToken(client_id);

        return jsonResponse({
          access_token: accessToken.access_token,
          token_type: accessToken.token_type,
          expires_in: accessToken.expires_in
        });
      } catch (error) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
    }

    // MCP リクエストの処理（認証が必要）
    if (request.method === 'POST' && url.pathname === '/') {
      // アクセストークンを検証
      const accessToken = extractAccessToken(request);
      if (!accessToken) {
        return jsonResponse({ error: 'Access token required' }, 401);
      }

      const tokenData = await oauthService.validateAccessToken(accessToken);
      if (!tokenData) {
        return jsonResponse({ error: 'Invalid or expired access token' }, 401);
      }

      try {
        const body = await request.json() as MCPRequest;
        const { jsonrpc, id, method, params } = body;

        if (jsonrpc !== '2.0') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32600, message: 'Invalid Request' }
          });
        }

        switch (method) {
          case 'initialize':
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {
                    listChanged: true
                  }
                },
                serverInfo: {
                  name: 'mcp-weather',
                  version: '1.0.0'
                }
              }
            });

          case 'tools/list':
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                tools: [
                  {
                    name: 'get_weather_overview',
                    description: '指定した都市の天気概況を取得します',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        city: {
                          type: 'string',
                          description: '都市名（例：東京、大阪、札幌など）',
                          enum: CITIES
                        }
                      },
                      required: ['city']
                    }
                  },
                  {
                    name: 'get_precipitation_probability',
                    description: '指定した都市の降水確率を取得します',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        city: {
                          type: 'string',
                          description: '都市名（例：東京、大阪、札幌など）',
                          enum: CITIES
                        }
                      },
                      required: ['city']
                    }
                  },
                  {
                    name: 'get_wind_speed',
                    description: '指定した都市の風速情報を取得します',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        city: {
                          type: 'string',
                          description: '都市名（例：東京、大阪、札幌など）',
                          enum: CITIES
                        }
                      },
                      required: ['city']
                    }
                  }
                ]
              }
            });

          case 'tools/call':
            const { name, arguments: args } = params;
            
            const validTools = ['get_weather_overview', 'get_precipitation_probability', 'get_wind_speed'];
            if (!validTools.includes(name)) {
              return jsonResponse({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: 'Method not found' }
              });
            }

            try {
              const city = args.city;
              if (!city || !CITIES.includes(city)) {
                return jsonResponse({
                  jsonrpc: '2.0',
                  id,
                  error: { 
                    code: -32602, 
                    message: 'Invalid params',
                    data: `都市名が無効です。対応都市: ${CITIES.join(', ')}`
                  }
                });
              }

              const weatherData = await getWeatherData(city);

              let result;
              switch (name) {
                case 'get_weather_overview':
                  result = {
                    city: city,
                    publishingOffice: weatherData.publishingOffice,
                    reportDatetime: weatherData.reportDatetime,
                    description: weatherData.description,
                    forecasts: weatherData.forecasts.map((forecast) => ({
                      date: forecast.date,
                      dateLabel: forecast.dateLabel,
                      telop: forecast.telop,
                      detail: forecast.detail,
                      temperature: forecast.temperature,
                      chanceOfRain: forecast.chanceOfRain,
                      image: forecast.image
                    }))
                  };
                  break;

                case 'get_precipitation_probability':
                  result = {
                    city: city,
                    reportDatetime: weatherData.reportDatetime,
                    forecasts: weatherData.forecasts.map((forecast) => ({
                      date: forecast.date,
                      dateLabel: forecast.dateLabel,
                      chanceOfRain: forecast.chanceOfRain
                    }))
                  };
                  break;

                case 'get_wind_speed':
                  result = {
                    city: city,
                    reportDatetime: weatherData.reportDatetime,
                    forecasts: weatherData.forecasts.map((forecast) => ({
                      date: forecast.date,
                      dateLabel: forecast.dateLabel,
                      detail: forecast.detail
                    }))
                  };
                  break;

                default:
                  return jsonResponse({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32601, message: 'Method not found' }
                  });
              }

              return jsonResponse({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(result, null, 2)
                    }
                  ]
                }
              });
            } catch (error) {
              return jsonResponse({
                jsonrpc: '2.0',
                id,
                error: { 
                  code: -32603, 
                  message: 'Internal error',
                  data: error instanceof Error ? error.message : 'Unknown error'
                }
              });
            }

          default:
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: 'Method not found' }
            });
        }
      } catch (error) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        });
      }
    }

    // 健康チェックエンドポイント
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ status: 'healthy', timestamp: new Date().toISOString() });
    }

    // 404 エラー
    return jsonResponse({ error: 'Not found' }, 404);
  }
}; 