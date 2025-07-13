#!/usr/bin/env node

const http = require('http');
const { URL } = require('url');
const { exec } = require('child_process');

// OAuth設定
const CLIENT_ID = 'client_ad6e6f2f-ed3c-41c6-b00b-ded053084eb8';
const CLIENT_SECRET = 'secret_907ffc3f-d85f-4b3d-8516-64ab0c776b1c';
const REDIRECT_URI = 'http://localhost:8080/callback';
const AUTH_URL = 'https://mcp-weather.get-weather.workers.dev';

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    // 認証用のローカルサーバーを起動
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>エラー: 認証コードが取得できませんでした</h1>');
          server.close();
          reject(new Error('認証コードが取得できませんでした'));
          return;
        }

        try {
          // アクセストークンを取得
          const tokenResponse = await fetch(`${AUTH_URL}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              redirect_uri: REDIRECT_URI
            })
          });

          const tokens = await tokenResponse.json();
          
          if (tokens.access_token) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <h1>✅ 認証成功！</h1>
              <p>アクセストークンを取得しました。</p>
              <p>このウィンドウを閉じてください。</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            `);
            
            server.close();
            resolve(tokens.access_token);
          } else {
            throw new Error('アクセストークンの取得に失敗しました');
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>エラー: ${error.message}</h1>`);
          server.close();
          reject(error);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1>');
      }
    });

    server.listen(8080, () => {
      console.log('🚀 ローカルサーバーを起動しました: http://localhost:8080');
      
      // 認証URLを構築
      const authUrl = new URL(`${AUTH_URL}/oauth/authorize`);
      authUrl.searchParams.set('client_id', CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', 'cursor-mcp-auth');
      
      console.log('🔐 ブラウザで認証を行ってください...');
      console.log('📱 デモ認証情報: demo / demo123');
      console.log('');
      
      // ブラウザで認証URLを開く
      const openCommand = process.platform === 'darwin' ? 'open' : 
                         process.platform === 'win32' ? 'start' : 'xdg-open';
      
      exec(`${openCommand} "${authUrl.toString()}"`, (error) => {
        if (error) {
          console.log('⚠️  ブラウザを自動で開けませんでした。以下のURLにアクセスしてください:');
          console.log(authUrl.toString());
        }
      });
    });

    server.on('error', (error) => {
      console.error('サーバーエラー:', error);
      reject(error);
    });
  });
}

// メイン実行
async function main() {
  try {
    console.log('🌤️  MCP Weather OAuth認証');
    console.log('================================');
    
    const accessToken = await getAccessToken();
    
    console.log('');
    console.log('✅ アクセストークンを取得しました:');
    console.log(`Bearer ${accessToken}`);
    console.log('');
    console.log('📝 mcp.jsonに以下を設定してください:');
    console.log('');
    console.log(JSON.stringify({
      "mcp-weather": {
        "command": "npx",
        "args": [
          "mcp-remote",
          "https://mcp-weather.get-weather.workers.dev",
          "--transport",
          "http-only",
          "--header",
          `Authorization=Bearer ${accessToken}`
        ]
      }
    }, null, 2));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 