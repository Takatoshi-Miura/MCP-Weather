import { v4 as uuidv4 } from 'uuid';

export interface OAuthClient {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
}

export interface AuthCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  expires_at: number;
  state?: string | undefined;
}

export interface AccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  client_id: string;
}

export class OAuthService {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  // OAuth クライアントを作成
  async createClient(name: string, redirect_uris: string[]): Promise<OAuthClient> {
    const client_id = `client_${uuidv4()}`;
    const client_secret = `secret_${uuidv4()}`;
    
    const client: OAuthClient = {
      client_id,
      client_secret,
      name,
      redirect_uris
    };

    await this.kv.put(`client:${client_id}`, JSON.stringify(client));
    return client;
  }

  // OAuth クライアントを取得
  async getClient(client_id: string): Promise<OAuthClient | null> {
    const data = await this.kv.get(`client:${client_id}`);
    return data ? JSON.parse(data) : null;
  }

  // 認証コードを生成
  async generateAuthCode(client_id: string, redirect_uri: string, state?: string | undefined): Promise<string> {
    const code = `code_${uuidv4()}`;
    const expires_at = Date.now() + 10 * 60 * 1000; // 10分後に期限切れ

    const authCode: AuthCode = {
      code,
      client_id,
      redirect_uri,
      expires_at,
      state: state
    };

    await this.kv.put(`auth_code:${code}`, JSON.stringify(authCode), {
      expirationTtl: 600 // 10分
    });

    return code;
  }

  // 認証コードを検証
  async validateAuthCode(code: string): Promise<AuthCode | null> {
    const data = await this.kv.get(`auth_code:${code}`);
    if (!data) return null;

    const authCode: AuthCode = JSON.parse(data);
    if (authCode.expires_at < Date.now()) {
      await this.kv.delete(`auth_code:${code}`);
      return null;
    }

    return authCode;
  }

  // アクセストークンを生成
  async generateAccessToken(client_id: string): Promise<AccessToken> {
    const access_token = `token_${uuidv4()}`;
    const expires_in = 3600; // 1時間
    const expires_at = Date.now() + expires_in * 1000;

    const token: AccessToken = {
      access_token,
      token_type: 'Bearer',
      expires_in,
      expires_at,
      client_id
    };

    await this.kv.put(`token:${access_token}`, JSON.stringify(token), {
      expirationTtl: expires_in
    });

    return token;
  }

  // アクセストークンを検証
  async validateAccessToken(access_token: string): Promise<AccessToken | null> {
    const data = await this.kv.get(`token:${access_token}`);
    if (!data) return null;

    const token: AccessToken = JSON.parse(data);
    if (token.expires_at < Date.now()) {
      await this.kv.delete(`token:${access_token}`);
      return null;
    }

    return token;
  }

  // 認証コードを削除（一度使用したら削除）
  async deleteAuthCode(code: string): Promise<void> {
    await this.kv.delete(`auth_code:${code}`);
  }

  // 簡単な認証フォームのHTML
  generateAuthForm(client_id: string, redirect_uri: string, state?: string | undefined): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>MCP Weather - OAuth認証</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 100px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .card {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 12px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
        }
        button:hover {
            background-color: #0056b3;
        }
        .info {
            background-color: #e7f3ff;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #0066cc;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>🌤️ MCP Weather</h1>
        <div class="info">
            <strong>デモ用認証情報:</strong><br>
            ユーザー名: demo<br>
            パスワード: demo123
        </div>
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            ${state ? `<input type="hidden" name="state" value="${state}">` : ''}
            
            <div class="form-group">
                <label for="username">ユーザー名:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">パスワード:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit">認証して続行</button>
        </form>
    </div>
</body>
</html>`;
  }

  // 簡単な認証（デモ用）
  validateCredentials(username: string, password: string): boolean {
    return username === 'demo' && password === 'demo123';
  }
} 