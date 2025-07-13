#!/usr/bin/env node

const https = require('https');
const http = require('http');

const SERVER_URL = 'https://mcp-weather.get-weather.workers.dev';
const ACCESS_TOKEN = 'token_a6cae0fe-55f0-4b85-a5c6-6bc0209187a4';

// HTTPリクエストを送信する関数
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(SERVER_URL, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 標準入力からJSONを読み取る
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

// メイン処理
async function main() {
  try {
    const input = await readStdin();
    const request = JSON.parse(input);
    
    const response = await makeRequest(request);
    
    console.log(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
}

main();
