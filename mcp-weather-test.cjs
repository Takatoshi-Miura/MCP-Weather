#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema, InitializedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');

// 認証なしの簡単なMCPサーバー
class WeatherTestServer {
  constructor() {
    this.server = new Server(
      {
        name: 'weather-test',
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
      console.error('Weather Test Server initialized');
    });

    // ツールリストの処理
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'test_weather',
            description: 'テスト用の天気情報取得',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '都市名'
                }
              },
              required: ['city']
            }
          }
        ]
      };
    });

    // ツール実行の処理
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'test_weather') {
        return {
          content: [
            {
              type: 'text',
              text: `テスト: ${args.city}の天気は晴れです。`
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Weather Test MCP Server running on stdio');
  }
}

// サーバーを起動
const server = new WeatherTestServer();
server.run().catch(console.error); 