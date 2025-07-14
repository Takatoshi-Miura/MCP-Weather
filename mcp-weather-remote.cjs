#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  InitializedNotificationSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fetch = require('node-fetch');

const REMOTE_SERVER_URL = process.env.MCP_WEATHER_URL || 'https://mcp-weather.get-weather.workers.dev';
const ACCESS_TOKEN = process.env.MCP_WEATHER_TOKEN || 'token_24a6a14c-cb07-4a65-a3c0-ac96945bab4a';

class WeatherMCPClient {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-weather-remote',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  async makeRemoteRequest(method, params = {}) {
    try {
      const response = await fetch(REMOTE_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new McpError(ErrorCode.InternalError, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new McpError(ErrorCode.InternalError, data.error);
      }

      return data.result;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Remote request failed: ${error.message}`);
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const result = await this.makeRemoteRequest('tools/list');
      return result;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const result = await this.makeRemoteRequest('tools/call', {
        name,
        arguments: args,
      });
      
      return result;
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    
    // Handle the initialized notification
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      // Server is ready
    });

    await this.server.connect(transport);
    console.error('MCP Weather Remote Server running on stdio');
  }
}

const client = new WeatherMCPClient();
client.run().catch(console.error); 