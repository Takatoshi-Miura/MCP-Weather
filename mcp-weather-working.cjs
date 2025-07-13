#!/usr/bin/env node

const https = require('https');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema, InitializedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');

const SERVER_URL = 'https://mcp-weather.get-weather.workers.dev';
const ACCESS_TOKEN = 'token_bc4025f3-1690-4398-b46d-680854d77892';

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

// MCP Weather Server
class MCPWeatherServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-weather',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          }
        }
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // 初期化完了通知の処理
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      console.error('MCP Weather Server initialized');
    });

    // ツールリストの処理
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('Fetching tools from remote server...');
      
      // リモートサーバーからツールリストを取得
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      try {
        const response = await makeRequest(request);
        console.error(`Tools fetched: ${response.result.tools.length} tools`);
        return response.result;
      } catch (error) {
        console.error('Error fetching tools:', error.message);
        return { tools: [] };
      }
    });

    // ツール実行の処理
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Executing tool: ${name}`);

      // リモートサーバーにツール実行リクエストを転送
      const remoteRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: name,
          arguments: args
        }
      };

      try {
        const response = await makeRequest(remoteRequest);
        console.error(`Tool execution completed: ${name}`);
        return response.result;
      } catch (error) {
        console.error('Error calling tool:', error.message);
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Weather Server running on stdio');
  }
}

// サーバーを起動
const server = new MCPWeatherServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 