#!/usr/bin/env node

const https = require('https');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema, InitializedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');

const SERVER_URL = 'https://mcp-weather.get-weather.workers.dev';
const ACCESS_TOKEN = 'token_bc4025f3-1690-4398-b46d-680854d77892';

// デバッグログ関数
function debugLog(message) {
  console.error(`[DEBUG] ${new Date().toISOString()}: ${message}`);
}

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

    debugLog(`Making HTTP request to ${SERVER_URL}`);
    debugLog(`Request data: ${postData}`);

    const req = https.request(SERVER_URL, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          debugLog(`Response received: ${responseData}`);
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (error) {
          debugLog(`JSON parse error: ${error.message}`);
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      debugLog(`HTTP request error: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// MCP Weather Server
class MCPWeatherServer {
  constructor() {
    debugLog('Creating MCP Weather Server');
    
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
    debugLog('MCP Weather Server created');
  }

  setupHandlers() {
    debugLog('Setting up handlers');

    // 初期化完了通知の処理
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      debugLog('MCP Weather Server initialized notification received');
    });

    // ツールリストの処理
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      debugLog('tools/list request received');
      
      // リモートサーバーからツールリストを取得
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      try {
        const response = await makeRequest(request);
        debugLog(`Tools fetched successfully: ${response.result.tools.length} tools`);
        return response.result;
      } catch (error) {
        debugLog(`Error fetching tools: ${error.message}`);
        // フォールバック: 静的なツールリストを返す
        return {
          tools: [
            {
              name: 'get_weather_overview',
              description: '指定した都市の天気概況を取得します',
              inputSchema: {
                type: 'object',
                properties: {
                  city: {
                    type: 'string',
                    description: '都市名（例：東京、大阪、札幌など）'
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
                    description: '都市名（例：東京、大阪、札幌など）'
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
                    description: '都市名（例：東京、大阪、札幌など）'
                  }
                },
                required: ['city']
              }
            }
          ]
        };
      }
    });

    // ツール実行の処理
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      debugLog(`tools/call request received for tool: ${name}`);
      debugLog(`Tool arguments: ${JSON.stringify(args)}`);

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
        debugLog(`Tool execution completed successfully: ${name}`);
        return response.result;
      } catch (error) {
        debugLog(`Error calling tool: ${error.message}`);
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });

    debugLog('Handlers set up successfully');
  }

  async run() {
    debugLog('Starting MCP Weather Server');
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      debugLog('MCP Weather Server connected and running on stdio');
    } catch (error) {
      debugLog(`Error starting server: ${error.message}`);
      throw error;
    }
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  debugLog('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  debugLog('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// 未処理のエラーをキャッチ
process.on('uncaughtException', (error) => {
  debugLog(`Uncaught exception: ${error.message}`);
  debugLog(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// サーバーを起動
debugLog('Starting MCP Weather Server application');
const server = new MCPWeatherServer();
server.run().catch((error) => {
  debugLog(`Server startup error: ${error.message}`);
  debugLog(`Stack: ${error.stack}`);
  process.exit(1);
}); 