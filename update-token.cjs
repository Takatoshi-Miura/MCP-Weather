#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function updateToken() {
  console.log('🔄 新しいアクセストークンを取得しています...');
  
  // get-token.cjsを実行してトークンを取得
  return new Promise((resolve, reject) => {
    exec('node get-token.cjs', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      // 出力からトークンを抽出
      const tokenMatch = stdout.match(/Bearer (token_[a-f0-9-]+)/);
      if (!tokenMatch) {
        reject(new Error('トークンを取得できませんでした'));
        return;
      }
      
      const newToken = tokenMatch[1];
      console.log(`✅ 新しいトークンを取得: ${newToken}`);
      
      // mcp-weather-remote.cjsを更新
      const remotePath = path.join(__dirname, 'mcp-weather-remote.cjs');
      let remoteContent = fs.readFileSync(remotePath, 'utf8');
      remoteContent = remoteContent.replace(
        /const ACCESS_TOKEN = process\.env\.MCP_WEATHER_TOKEN \|\| '[^']+';/,
        `const ACCESS_TOKEN = process.env.MCP_WEATHER_TOKEN || '${newToken}';`
      );
      fs.writeFileSync(remotePath, remoteContent);
      
      // mcp-weather-debug.cjsを更新
      const debugPath = path.join(__dirname, 'mcp-weather-debug.cjs');
      let debugContent = fs.readFileSync(debugPath, 'utf8');
      debugContent = debugContent.replace(
        /const ACCESS_TOKEN = process\.env\.MCP_WEATHER_TOKEN \|\| '[^']+';/,
        `const ACCESS_TOKEN = process.env.MCP_WEATHER_TOKEN || '${newToken}';`
      );
      fs.writeFileSync(debugPath, debugContent);
      
      console.log('✅ ファイルを更新しました');
      console.log('📝 Cursorを再起動してください');
      
      resolve(newToken);
    });
  });
}

if (require.main === module) {
  updateToken().catch(console.error);
}

module.exports = { updateToken }; 